/* BrandGuard review engine.
 * Pure, deterministic, dependency-free. Runs in the browser and in Node.
 * Every finding cites the guideline or approved fact that produced it.
 * No network calls, no model calls: content never leaves the process.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BrandEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEV_ORDER = ['blocker', 'major', 'minor', 'info'];
  var SEV_WEIGHT = { blocker: 25, major: 10, minor: 4, info: 1 };

  // ---------- helpers ----------
  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function blank(m) { return m.replace(/[^\n]/g, ' '); }

  function maskFor(format, body) {
    var t = body;
    if (format === 'html') {
      t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, blank);
      t = t.replace(/<[^>]*>/g, blank);
      t = t.replace(/&[a-zA-Z#0-9]+;/g, blank);
    } else if (format === 'markdown') {
      t = t.replace(/```[\s\S]*?```/g, blank).replace(/`[^`\n]*`/g, blank);
      t = t.replace(/\]\([^)\n]*\)/g, blank);
      t = t.replace(/^[ \t]{0,3}#{1,6}[ \t]/gm, blank);
    }
    return t.replace(/https?:\/\/[^\s)>"']+/g, blank);
  }

  function matchCase(src, repl) {
    if (!repl) return repl;
    if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return repl.toUpperCase();
    var c = src.charAt(0);
    if (c !== c.toLowerCase()) return repl.charAt(0).toUpperCase() + repl.slice(1);
    return repl;
  }

  function sourceOf(kit, id) {
    var g = (kit.guidelines || []).filter(function (x) { return x.id === id; })[0];
    if (g) return { type: 'guideline', id: g.id, title: g.title, quote: g.text, confidential: !!g.confidential };
    var f = (kit.facts || []).filter(function (x) { return x.id === id; })[0];
    if (f) return { type: 'fact', id: f.id, title: f.label, quote: f.statement, asOf: f.asOf, origin: f.source, confidential: false };
    return { type: 'guideline', id: id, title: id, quote: '' };
  }

  function parseNum(s, suffix) {
    var n = parseFloat(String(s).replace(/,/g, ''));
    if (suffix && /k/i.test(suffix)) n *= 1000;
    return n;
  }
  function fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // colour utils
  var NAMED = { white: '#ffffff', black: '#000000' };
  function parseColor(v) {
    v = String(v).trim().toLowerCase();
    if (NAMED[v]) v = NAMED[v];
    var m = /^#([0-9a-f]{3})$/.exec(v);
    if (m) return m[1].split('').map(function (c) { return parseInt(c + c, 16); });
    m = /^#([0-9a-f]{6})$/.exec(v);
    if (m) return [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    return null;
  }
  function toHex(rgb) { return '#' + rgb.map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join(''); }
  function lum(rgb) {
    var a = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function dist(a, b) { return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)); }
  function isNeutral(rgb) { return Math.max.apply(null, rgb) - Math.min.apply(null, rgb) < 18; }
  function paletteRgb(kit) {
    return (kit.palette || []).map(function (p) { return { name: p.name, hex: p.hex, rgb: parseColor(p.hex) }; }).filter(function (p) { return p.rgb; });
  }
  function nearestPalette(kit, rgb) {
    var best = null, bd = 1e9;
    paletteRgb(kit).forEach(function (p) { var d = dist(p.rgb, rgb); if (d < bd) { bd = d; best = p; } });
    return best ? { entry: best, d: bd } : null;
  }

  function syll(w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }
  function words(t) { return t.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) || []; }
  function flesch(t) {
    var w = words(t); if (w.length < 5) return null;
    var s = (t.match(/[.!?]+(\s|$)/g) || []).length || 1;
    var sy = w.reduce(function (a, x) { return a + syll(x); }, 0);
    return 206.835 - 1.015 * (w.length / s) - 84.6 * (sy / w.length);
  }

  // ---------- review ----------
  function review(input, kit, opts) {
    opts = opts || {};
    var today = opts.today || new Date().toISOString().slice(0, 10);
    var raw = input.body || '';
    var format = input.format || 'text';
    var channel = input.channel || 'web';
    var masked = maskFor(format, raw);
    var meta = input.imageMeta || null;
    var out = [];

    function add(f) {
      f.severity = f.severity || 'minor';
      f.start = f.start == null ? -1 : f.start;
      f.end = f.end == null ? -1 : f.end;
      f.match = f.start >= 0 ? raw.slice(f.start, f.end) : (f.match || '');
      f.source = f.source || null;
      out.push(f);
    }
    function rx(p, flags) { return new RegExp(p, flags || 'gi'); }
    function each(text, re, fn) {
      var m; re.lastIndex = 0;
      while ((m = re.exec(text))) { fn(m); if (m[0].length === 0) re.lastIndex++; }
    }

    // 1. confidentiality (raw text, strongest rule)
    (kit.confidentialTerms || []).forEach(function (t) {
      each(raw, rx('\\b' + escapeRe(t) + '\\b'), function (m) {
        add({ ruleId: 'conf.codename', category: 'confidentiality', severity: 'blocker',
          title: 'Unreleased or confidential name', start: m.index, end: m.index + m[0].length,
          message: 'This name is on the confidential list. Publishing it would disclose unannounced work.',
          guidance: 'Remove it, or get written sign-off from Product Marketing and Legal and have a Reviewer waive this finding.',
          fix: { type: 'replace', text: '', label: 'Remove it' },
          preserves: 'Removing only the name keeps the rest of the sentence; reword if it no longer reads well.',
          source: sourceOf(kit, 'G-CONF-1') });
      });
    });
    each(raw, /\b(confidential|internal use only|internal only|do not distribute|not for external (?:use|distribution))\b/gi, function (m) {
      add({ ruleId: 'conf.marker', category: 'confidentiality', severity: 'blocker', title: 'Internal-only marking found',
        start: m.index, end: m.index + m[0].length,
        message: 'Text marked "' + m[0] + '" suggests this was copied from an internal document.',
        guidance: 'Check the source document is cleared for external use, then delete the marking.',
        fix: { type: 'replace', text: '', label: 'Remove marking' }, preserves: 'Only the marking is removed.', source: sourceOf(kit, 'G-CONF-1') });
    });
    each(raw, /\b(?:sk|pk|api|key|token)[-_][A-Za-z0-9]{16,}\b/g, function (m) {
      add({ ruleId: 'conf.secret', category: 'confidentiality', severity: 'blocker', title: 'Possible secret or API key',
        start: m.index, end: m.index + m[0].length, message: 'This looks like a credential. Credentials must never appear in published content.',
        guidance: 'Remove it and rotate the key if it was ever shared.', fix: { type: 'replace', text: '', label: 'Remove' },
        preserves: 'Nothing else changes.', source: sourceOf(kit, 'G-CONF-1') });
    });
    var okDomains = (kit.settings && kit.settings.publicEmailDomains) || [];
    each(raw, /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, function (m) {
      if (okDomains.indexOf(m[1].toLowerCase()) === -1)
        add({ ruleId: 'conf.email', category: 'confidentiality', severity: 'major', title: 'Non-public email address',
          start: m.index, end: m.index + m[0].length,
          message: 'Only approved public addresses may appear in content (' + okDomains.join(', ') + ').',
          guidance: 'Use a shared mailbox such as hello@' + (okDomains[0] || 'company.example') + '.',
          preserves: 'Contact intent is kept by pointing to the shared mailbox.', source: sourceOf(kit, 'G-CONF-1') });
    });

    // 2. brand and product names
    each(masked, /\b(lumio)\b/gi, function (m) {
      var before = masked.charAt(m.index - 1), after = masked.charAt(m.index + m[0].length), after2 = masked.charAt(m.index + m[0].length + 1);
      if (/[\/@.\-]/.test(before) || (after === '.' && /[a-z]/i.test(after2))) return;
      if (m[0] !== 'Lumio')
        add({ ruleId: 'brand.name-case', category: 'terminology', severity: 'major', title: 'Brand name spelled incorrectly',
          start: m.index, end: m.index + m[0].length, message: 'Our name is always written "Lumio" with a capital L and lowercase letters.',
          fix: { type: 'replace', text: 'Lumio', label: 'Use "Lumio"' }, preserves: 'Meaning unchanged; only the spelling is corrected.', source: sourceOf(kit, 'G-NAME-1') });
    });
    each(masked, /\bLumio\s+(hub|plus)\b/gi, function (m) {
      var good = 'Lumio ' + m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      if (m[0] !== good)
        add({ ruleId: 'brand.product-case', category: 'terminology', severity: 'minor', title: 'Product name capitalisation',
          start: m.index, end: m.index + m[0].length, message: 'Product names are written "Lumio Hub" and "Lumio Plus".',
          fix: { type: 'replace', text: good, label: 'Use "' + good + '"' }, preserves: 'Meaning unchanged.', source: sourceOf(kit, 'G-NAME-1') });
    });

    // 3. terminology, retired names, hype and jargon
    (kit.terms || []).forEach(function (t) {
      var re = rx(t.pattern || '\\b' + escapeRe(t.avoid) + '\\b');
      each(masked, re, function (m) {
        var rep = t.prefer ? matchCase(m[0], t.prefer) : null;
        if (rep && t.pluralize && /s$/i.test(m[0]) && !/s$/i.test(t.prefer)) rep += /[A-Z]$/.test(m[0]) ? 'S' : 's';
        add({ ruleId: 'term.' + t.id, category: t.category || 'terminology', severity: t.severity || 'minor',
          title: t.prefer ? 'Use "' + t.prefer + '" instead of "' + t.avoid + '"' : 'Avoid "' + t.avoid + '"',
          start: m.index, end: m.index + m[0].length, message: t.reason,
          fix: rep ? { type: 'replace', text: rep, label: 'Change to "' + rep + '"' } : null,
          guidance: rep ? '' : t.guidance,
          preserves: rep ? 'Same sentence structure, with the approved wording.' : '', source: sourceOf(kit, t.guideline) });
      });
    });

    // 4. claims
    var approved = (kit.approvedClaims || []).filter(function (c) { return !c.expires || c.expires >= today; });
    function coveredByEvidence(s, e) {
      return approved.some(function (c) {
        var re = rx(escapeRe(c.phrase)), hit = false;
        each(raw, re, function (m) { if (s >= m.index && e <= m.index + m[0].length) hit = true; });
        return hit;
      });
    }
    (kit.claims || []).forEach(function (c) {
      each(masked, rx(c.pattern), function (m) {
        var s = m.index, e = m.index + m[0].length;
        if (coveredByEvidence(s, e)) return;
        var rep = c.prefer ? matchCase(m[0], m[0].replace(rx(c.pattern, 'i'), c.prefer)) : null;
        add({ ruleId: 'claim.' + c.id, category: 'claims', severity: c.severity || 'major', title: c.title,
          start: s, end: e, message: c.reason, guidance: c.guidance || '',
          fix: rep ? { type: 'replace', text: rep, label: 'Soften to "' + rep + '"' } : null,
          preserves: rep ? 'Keeps the positive message but drops the claim we cannot evidence.' : '',
          source: sourceOf(kit, c.guideline) });
      });
    });
    (kit.competitors || []).forEach(function (n) {
      each(masked, rx('\\b' + escapeRe(n) + '\\b'), function (m) {
        add({ ruleId: 'claim.competitor', category: 'claims', severity: 'blocker', title: 'Competitor named',
          start: m.index, end: m.index + m[0].length,
          message: 'Naming a competitor, especially in a comparison, needs Legal approval first.',
          guidance: 'Describe our strengths on their own, e.g. "works with 300+ devices", without naming others.',
          preserves: '', source: sourceOf(kit, 'G-CLAIM-4') });
      });
    });

    // 4b. approved facts
    var usedFacts = {};
    (kit.facts || []).forEach(function (f) {
      (f.regexes || []).forEach(function (r) {
        each(masked, rx(r.re), function (m) {
          if (f.type === 'savings' && r.constant) {
            usedFacts[f.id] = true;
            add({ ruleId: 'fact.' + f.id, category: 'claims', severity: 'major', title: 'Savings claim not supported',
              start: m.index, end: m.index + m[0].length,
              message: 'Claims like "' + m[0] + '" imply about ' + r.constant + '% savings. Our approved figure is ' + f.value + '%.',
              guidance: 'Say "an average of ' + f.value + '% lower energy bills".', fix: null, source: sourceOf(kit, f.id) });
            return;
          }
          var raw1 = m[r.num];
          if (raw1 == null) return;
          // locate the number token inside the match (price: the last occurrence, after the product name)
          var idx = r.prod ? m[0].lastIndexOf(raw1) : m[0].indexOf(raw1);
          var ns = m.index + idx;
          var suffix = r.suffix ? m[r.suffix] : '';
          var token = raw1 + (suffix || '');
          var ne = ns + token.length;
          var pctLen = 0;
          if (f.type === 'savings') { var pm = /^\s?%/.exec(masked.slice(ne)); pctLen = pm ? pm[0].length : 0; }
          var n = parseNum(raw1, suffix);
          usedFacts[f.id] = true;
          var pre = masked.slice(Math.max(0, ns - 14), ns);
          var hasQual = /(over|more than|nearly|almost|about|average|up to|around)\s*$/i.test(pre);
          var prod = r.prod ? (m[r.prod] || '').toLowerCase() : null;
          if (f.type === 'price') {
            var want = f.products[prod];
            if (want != null && Math.abs(n - want) > 0.001)
              add({ ruleId: 'fact.' + f.id, category: 'facts', severity: 'major', title: 'Price differs from approved price',
                start: ns, end: ne, message: 'Lumio ' + prod.charAt(0).toUpperCase() + prod.slice(1) + ' is approved at $' + want + ' (' + f.asOf + ').',
                fix: { type: 'replace', text: String(want), label: 'Use $' + want }, preserves: 'Offer wording unchanged; only the figure is corrected.', source: sourceOf(kit, f.id) });
            return;
          }
          if (f.type === 'exact') {
            if (Math.abs(n - f.value) > 0.001)
              add({ ruleId: 'fact.' + f.id, category: 'facts', severity: 'major', title: f.label + ' does not match approved fact',
                start: ns, end: ne, message: 'Approved: ' + f.statement,
                fix: { type: 'replace', text: String(f.value), label: 'Use ' + f.value }, preserves: 'Only the figure changes.', source: sourceOf(kit, f.id) });
            return;
          }
          // cap (count or percent)
          var pct = f.type === 'savings';
          if (n > f.value) {
            var txt = pct ? (hasQual && /average/i.test(pre) ? f.value + '%' : 'an average of ' + f.value + '%') : (hasQual ? fmtNum(f.value) : 'more than ' + fmtNum(f.value));
            add({ ruleId: 'fact.' + f.id, category: 'claims', severity: 'major', title: pct ? 'Savings figure above approved figure' : 'Figure above approved fact',
              start: ns, end: ne + pctLen,
              message: 'Content says ' + token + (pct ? '%' : '') + '. Approved: ' + f.statement + ' (' + f.asOf + ').',
              fix: { type: 'replace', text: txt, label: 'Use "' + txt + '"' }, preserves: 'Keeps the point (a big number) using the figure we can prove.', source: sourceOf(kit, f.id) });
          } else if (!pct && n < f.value * 0.97) {
            add({ ruleId: 'fact.' + f.id + '.stale', category: 'facts', severity: 'minor', title: 'Figure may be out of date',
              start: ns, end: ne, message: 'Content says ' + token + '; the current approved figure is ' + fmtNum(f.value) + ' (' + f.asOf + ').',
              fix: { type: 'replace', text: hasQual ? fmtNum(f.value) : 'more than ' + fmtNum(f.value), label: 'Update to ' + fmtNum(f.value) },
              preserves: 'Same claim with the current number.', source: sourceOf(kit, f.id) });
          }
        });
      });
    });
    // expired fact sources
    (kit.facts || []).forEach(function (f) {
      if (usedFacts[f.id] && f.expires && f.expires < today) {
        var first = out.filter(function (x) { return x.ruleId.indexOf('fact.' + f.id) === 0; })[0];
        add({ ruleId: 'fact.' + f.id + '.expired', category: 'facts', severity: 'minor', title: 'Approved fact has expired',
          start: first ? first.start : 0, end: first ? first.end : 0, match: first ? '' : '',
          message: '"' + f.label + '" was last confirmed ' + f.asOf + ' and expired on ' + f.expires + '. Ask the fact owner to reconfirm before publishing.',
          guidance: 'Owner: ' + (f.owner || 'Brand team') + '.', source: sourceOf(kit, f.id) });
      }
    });
    // savings disclaimer
    (kit.facts || []).forEach(function (f) {
      if (f.disclaimer && usedFacts[f.id] && !rx(f.disclaimer.require, 'i').test(raw)) {
        add({ ruleId: 'msg.disclaimer.' + f.id, category: 'messaging', severity: 'major', title: 'Required disclaimer missing',
          message: 'Savings claims must carry: "' + f.disclaimer.append + '"',
          fix: { type: 'append', text: appendFor(format, f.disclaimer.append), label: 'Add disclaimer' },
          preserves: 'Adds a line at the end; your copy is untouched.', source: sourceOf(kit, 'G-CLAIM-3') });
      }
    });

    function appendFor(fmt, t) {
      if (fmt === 'html') return '\n<p><small>' + t + '</small></p>';
      if (fmt === 'markdown') return '\n\n*' + t + '*';
      return '\n\n' + t;
    }

    // 5. required elements
    (kit.requirements || []).forEach(function (r) {
      if (r.channels && r.channels.indexOf(channel) === -1) return;
      if (rx(r.when, 'i').test(raw) && !rx(r.require, 'i').test(raw)) {
        var m = rx(r.when, 'i').exec(raw);
        add({ ruleId: 'msg.' + r.id, category: 'messaging', severity: r.severity || 'major', title: r.title,
          start: r.when === '.' ? -1 : m.index, end: r.when === '.' ? -1 : m.index + m[0].length, message: r.reason,
          fix: { type: 'append', text: appendFor(format, r.append), label: 'Add required line' },
          preserves: 'Adds a line at the end only.', source: sourceOf(kit, r.guideline) });
      }
    });
    var wc = words(masked).length;
    if (wc > 80 && (kit.pillars || []).length) {
      var hit = (kit.pillars || []).some(function (p) { return p.keywords.some(function (k) { return rx('\\b' + escapeRe(k)).test(masked); }); });
      if (!hit) add({ ruleId: 'msg.pillars', category: 'messaging', severity: 'minor', title: 'No key message pillar found', confidence: 0.5,
        message: 'Long-form content should support at least one pillar: ' + kit.pillars.map(function (p) { return p.name; }).join(', ') + '. This check is heuristic.',
        guidance: 'If the piece is intentionally off-message (e.g. a hiring post), dismiss with a reason; that helps us improve the guideline.',
        source: sourceOf(kit, 'G-MSG-1') });
    }

    // 6. tone and language
    var maxEx = (kit.settings && kit.settings.maxExclaim) || 1, exN = 0;
    each(masked, /!+/g, function (m) {
      exN++;
      if (exN > maxEx || m[0].length > 1)
        add({ ruleId: 'tone.exclaim', category: 'tone', severity: 'minor', title: 'Too many exclamation marks',
          start: m.index, end: m.index + m[0].length, message: 'Our voice is warm and confident, not shouty. One exclamation mark per piece is the limit.',
          fix: { type: 'replace', text: '.', label: 'Use a full stop' }, preserves: 'Enthusiasm stays in the words instead of the punctuation.', source: sourceOf(kit, 'G-TONE-1') });
    });
    var acr = (kit.acronyms || []).map(function (a) { return a.toUpperCase(); });
    each(masked, /\b[A-Z]{3,}(?:[ \t]+[A-Z]{3,})*\b/g, function (m) {
      var parts = m[0].split(/\s+/);
      if (parts.every(function (p) { return acr.indexOf(p) > -1 || p === 'LUMIO'; })) return;
      var fixed = m[0].toLowerCase();
      add({ ruleId: 'tone.caps', category: 'tone', severity: 'minor', title: 'ALL CAPS text',
        start: m.index, end: m.index + m[0].length, message: 'Capitals read as shouting and are harder for screen-reader and dyslexic users to parse.',
        fix: { type: 'replace', text: matchCase('A', fixed), label: 'Use normal case' }, preserves: 'Same words; emphasis can come from bold instead.',
        source: sourceOf(kit, 'G-ACC-4') });
    });
    var emoN = 0, maxEmo = (kit.settings && kit.settings.maxEmoji) || 2;
    try {
      each(masked, /\p{Extended_Pictographic}/gu, function (m) {
        emoN++;
        if (emoN === maxEmo + 1)
          add({ ruleId: 'tone.emoji', category: 'tone', severity: 'info', title: 'Emoji overuse', start: m.index, end: m.index + m[0].length,
            message: 'Use at most ' + maxEmo + ' emoji per piece.', fix: { type: 'replace', text: '', label: 'Remove' }, preserves: 'Text is unchanged.', source: sourceOf(kit, 'G-TONE-1') });
      });
    } catch (e) { /* old engines without \p support */ }

    var fe = flesch(masked);
    var minEase = (kit.settings && kit.settings.minReadingEase) || 50;
    if (fe != null && wc >= 40 && fe < minEase)
      add({ ruleId: 'tone.reading-ease', category: 'language', severity: 'minor', confidence: 0.6, title: 'Reading level is high',
        message: 'Reading ease is ' + Math.round(fe) + ' (target ' + minEase + '+). Shorter words and sentences help every reader.',
        guidance: 'Split long sentences and swap long words for short ones. This is a heuristic score.', source: sourceOf(kit, 'G-TONE-2') });
    var maxLen = (kit.settings && kit.settings.maxSentenceWords) || 28;
    each(masked, /[^.!?\n]+[.!?]*/g, function (m) {
      var n = words(m[0]).length;
      if (n > maxLen) {
        var lead = m[0].length - m[0].replace(/^\s+/, '').length;
        add({ ruleId: 'tone.long-sentence', category: 'language', severity: 'minor', title: 'Sentence is very long (' + n + ' words)',
          start: m.index + lead, end: m.index + m[0].replace(/\s+$/, '').length, message: 'Sentences over ' + maxLen + ' words are hard to follow.',
          guidance: 'Split at a conjunction or after the first clause.', source: sourceOf(kit, 'G-TONE-2') });
      }
    });

    // 7. channel specifics
    if (channel === 'social') {
      var plain = masked.replace(/\s+$/, '');
      if (plain.length > 280)
        add({ ruleId: 'msg.social-length', category: 'messaging', severity: 'minor', title: 'Post is over 280 characters',
          message: 'This post is ' + plain.length + ' characters. Most networks truncate at 280.', guidance: 'Cut the second sentence or move detail to a linked page.', source: sourceOf(kit, 'G-MSG-1') });
      var tags = [];
      each(masked, /(^|\s)(#[A-Za-z][A-Za-z0-9]*)/g, function (m) { tags.push({ t: m[2], i: m.index + m[1].length }); });
      if (tags.length > 3)
        add({ ruleId: 'msg.hashtags', category: 'messaging', severity: 'info', title: 'More than 3 hashtags', start: tags[3].i, end: tags[3].i + tags[3].t.length,
          message: 'Use at most 3 hashtags.', fix: { type: 'replace', text: '', label: 'Remove' }, preserves: 'Post text is untouched.', source: sourceOf(kit, 'G-MSG-1') });
      tags.forEach(function (h) {
        if (h.t.length > 10 && h.t === h.t.toLowerCase())
          add({ ruleId: 'a11y.hashtag-case', category: 'accessibility', severity: 'minor', title: 'Hashtag needs CamelCase',
            start: h.i, end: h.i + h.t.length, message: 'Screen readers read all-lowercase hashtags as one unintelligible word.',
            guidance: 'Write it as ' + h.t.replace(/(^#)(.)/, function (a, b, c) { return b + c.toUpperCase(); }) + ' with each word capitalised.', source: sourceOf(kit, 'G-ACC-5') });
      });
    }

    // 8. accessibility + visual (markup)
    if (format === 'html') {
      each(raw, /<img\b[^>]*>/gi, function (m) {
        var alt = /\balt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[0]);
        if (!alt) {
          add({ ruleId: 'a11y.alt-missing', category: 'accessibility', severity: 'major', title: 'Image has no alt text', start: m.index, end: m.index + m[0].length,
            message: 'People using screen readers get nothing from this image.', guidance: 'Describe what the image shows and why it is there.',
            fix: { type: 'replace', text: m[0].replace(/<img\b/i, '<img alt="{{input}}"'), label: 'Add alt text', input: { label: 'Alt text', placeholder: 'e.g. Lumio Hub on a kitchen wall showing today’s energy use' } },
            preserves: 'The image itself is unchanged.', source: sourceOf(kit, 'G-ACC-1') });
        } else if (!(alt[2] || alt[3] || '').trim() && !/role\s*=\s*["']presentation/i.test(m[0])) {
          add({ ruleId: 'a11y.alt-missing', category: 'accessibility', severity: 'major', title: 'Image alt text is empty', start: m.index, end: m.index + m[0].length,
            message: 'Empty alt is only correct for purely decorative images.', guidance: 'Describe the image, or mark it decorative with role="presentation".',
            fix: { type: 'replace', text: m[0].replace(/\balt\s*=\s*("[^"]*"|'[^']*')/i, 'alt="{{input}}"'), label: 'Add alt text', input: { label: 'Alt text', placeholder: 'Describe the image' } },
            preserves: 'The image itself is unchanged.', source: sourceOf(kit, 'G-ACC-1') });
        } else if (/^(image|photo|picture|img|graphic)$/i.test((alt[2] || alt[3] || '').trim()) || /\.(png|jpe?g|gif|svg|webp)$/i.test(alt[2] || alt[3] || '')) {
          add({ ruleId: 'a11y.alt-weak', category: 'accessibility', severity: 'minor', title: 'Alt text is not descriptive', start: m.index, end: m.index + m[0].length,
            message: 'Alt text such as "image" or a file name does not tell the reader anything.', guidance: 'Describe the content and purpose.', source: sourceOf(kit, 'G-ACC-1') });
        }
      });
      each(raw, /<a\b[^>]*>([\s\S]*?)<\/a>/gi, function (m) {
        var t = m[1].replace(/<[^>]*>/g, '').trim();
        if (/^(click here|here|read more|learn more|more|link|this|details)$/i.test(t))
          add({ ruleId: 'a11y.link-text', category: 'accessibility', severity: 'minor', title: 'Link text is not descriptive', start: m.index, end: m.index + m[0].length,
            message: '"' + t + '" means nothing when links are read out of context.', guidance: 'Name the destination, e.g. "See Lumio Plus pricing".', source: sourceOf(kit, 'G-ACC-3') });
      });
      var lastH = 0;
      each(raw, /<h([1-6])\b/gi, function (m) {
        var l = +m[1];
        if (lastH && l > lastH + 1)
          add({ ruleId: 'a11y.heading-order', category: 'accessibility', severity: 'minor', title: 'Heading level skipped', start: m.index, end: m.index + m[0].length + 1,
            message: 'h' + lastH + ' is followed by h' + l + '. Skipped levels break navigation for assistive tech.', fix: { type: 'replace', text: '<h' + (lastH + 1), label: 'Use h' + (lastH + 1) },
            preserves: 'Visual size can be kept with CSS.', source: sourceOf(kit, 'G-ACC-3') });
        lastH = l;
      });
      cssChecks();
    } else if (format === 'markdown') {
      each(raw, /!\[([^\]]*)\]\(([^)\n]*)\)/g, function (m) {
        if (!m[1].trim())
          add({ ruleId: 'a11y.alt-missing', category: 'accessibility', severity: 'major', title: 'Image has no alt text', start: m.index, end: m.index + m[0].length,
            message: 'People using screen readers get nothing from this image.', guidance: 'Describe what the image shows.',
            fix: { type: 'replace', text: '![{{input}}](' + m[2] + ')', label: 'Add alt text', input: { label: 'Alt text', placeholder: 'Describe the image' } },
            preserves: 'The image is unchanged.', source: sourceOf(kit, 'G-ACC-1') });
      });
      each(raw, /(^|[^!])\[([^\]]*)\]\(([^)\n]*)\)/g, function (m) {
        if (/^(click here|here|read more|learn more|more|link|this|details)$/i.test(m[2].trim()))
          add({ ruleId: 'a11y.link-text', category: 'accessibility', severity: 'minor', title: 'Link text is not descriptive', start: m.index + m[1].length, end: m.index + m[0].length,
            message: '"' + m[2] + '" means nothing when links are read out of context.', guidance: 'Name the destination.', source: sourceOf(kit, 'G-ACC-3') });
      });
      var lh = 0;
      each(raw, /^[ \t]{0,3}(#{1,6})[ \t]/gm, function (m) {
        var l = m[1].length;
        if (lh && l > lh + 1)
          add({ ruleId: 'a11y.heading-order', category: 'accessibility', severity: 'minor', title: 'Heading level skipped', start: m.index, end: m.index + m[0].length,
            message: 'Level ' + lh + ' is followed by ' + l + '.', fix: { type: 'replace', text: m[0].replace(/#+/, new Array(lh + 2).join('#')), label: 'Use level ' + (lh + 1) },
            preserves: 'Heading text unchanged.', source: sourceOf(kit, 'G-ACC-3') });
        lh = l;
      });
    } else {
      each(masked, /\b(click here|read more)\b/gi, function (m) {
        add({ ruleId: 'a11y.link-text', category: 'accessibility', severity: 'info', title: 'Generic call to action', start: m.index, end: m.index + m[0].length,
          message: 'If this becomes a link, "' + m[0] + '" will not describe its destination.', guidance: 'Name the destination.', source: sourceOf(kit, 'G-ACC-3') });
      });
    }

    function cssChecks() {
      var fonts = (kit.fonts || []).map(function (f) { return f.toLowerCase(); });
      var seen = {};
      each(raw, /\{[^}]*\}|style\s*=\s*"[^"]*"|style\s*=\s*'[^']*'/gi, function (blk) {
        var txt = blk[0], base = blk.index;
        var fg = /(^|[;{"'\s])color\s*:\s*([^;}"']+)/i.exec(txt);
        var bg = /background(?:-color)?\s*:\s*([^;}"']+)/i.exec(txt);
        var fgRgb = fg && parseColor(fg[2]), bgRgb = bg && parseColor(bg[1]);
        if (fgRgb && bgRgb) {
          var r = contrast(fgRgb, bgRgb);
          if (r < 4.5) {
            var vs = base + fg.index + fg[0].length - fg[2].length, ve = vs + fg[2].trim().length;
            var cands = paletteRgb(kit).concat([{ name: 'White', hex: '#ffffff', rgb: [255, 255, 255] }, { name: 'Black', hex: '#000000', rgb: [0, 0, 0] }])
              .filter(function (p) { return contrast(p.rgb, bgRgb) >= 4.5; }).sort(function (a, b) { return dist(a.rgb, fgRgb) - dist(b.rgb, fgRgb); });
            var best = cands[0];
            add({ ruleId: 'a11y.contrast', category: 'accessibility', severity: 'major', title: 'Low colour contrast (' + r.toFixed(1) + ':1)', start: vs, end: ve,
              message: 'Text needs at least 4.5:1 contrast against its background; this pair gives ' + r.toFixed(2) + ':1.',
              fix: best ? { type: 'replace', text: best.hex, label: 'Use ' + best.name + ' ' + best.hex } : null,
              preserves: 'Layout and message unchanged; only the text colour moves to the nearest accessible brand colour.', source: sourceOf(kit, 'G-ACC-2') });
            seen[vs] = true;
          }
        }
        var re = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, m;
        while ((m = re.exec(txt))) {
          var s = base + m.index; if (seen[s]) continue;
          var rgb = parseColor(m[0]); if (!rgb || isNeutral(rgb)) continue;
          var nr = nearestPalette(kit, rgb);
          if (nr && nr.d > 48)
            add({ ruleId: 'visual.off-palette', category: 'visual', severity: 'minor', title: 'Colour is not in the brand palette', start: s, end: s + m[0].length,
              message: m[0] + ' is not an approved colour. Nearest is ' + nr.entry.name + ' ' + nr.entry.hex + '.',
              fix: { type: 'replace', text: nr.entry.hex, label: 'Use ' + nr.entry.name + ' ' + nr.entry.hex }, preserves: 'Same role in the layout, in an approved colour.', source: sourceOf(kit, 'G-VIS-1') });
        }
        var ff = /font-family\s*:\s*([^;}"']+)/i.exec(txt);
        if (ff && fonts.length) {
          var fam = ff[1].split(',').map(function (x) { return x.trim().replace(/["']/g, '').toLowerCase(); });
          if (!fam.some(function (x) { return fonts.indexOf(x) > -1; })) {
            var fs = base + ff.index + ff[0].length - ff[1].length;
            add({ ruleId: 'visual.font', category: 'visual', severity: 'minor', title: 'Font is not an approved brand font', start: fs, end: fs + ff[1].trim().length,
              message: 'Approved fonts: ' + kit.fonts.join(', ') + '.', fix: { type: 'replace', text: kit.fonts[0] + ', sans-serif', label: 'Use ' + kit.fonts[0] },
              preserves: 'Text content unchanged.', source: sourceOf(kit, 'G-VIS-2') });
          }
        }
      });
    }

    // 9. image metadata
    if (meta) {
      var im = kit.image || {};
      if (!meta.alt || !meta.alt.trim())
        add({ ruleId: 'a11y.alt-missing', category: 'accessibility', severity: 'major', title: 'Image has no alt text',
          message: 'Every published image needs a description for people who cannot see it.', guidance: 'Describe what is shown and why it is there.',
          fix: { type: 'setAlt', text: '{{input}}', label: 'Add alt text', input: { label: 'Alt text', placeholder: 'Describe the image' } },
          preserves: 'The image is unchanged.', source: sourceOf(kit, 'G-ACC-1') });
      if (im.minWidth && meta.width < im.minWidth)
        add({ ruleId: 'visual.resolution', category: 'visual', severity: 'minor', title: 'Image resolution is low',
          message: 'Width is ' + meta.width + 'px; hero and campaign images need at least ' + im.minWidth + 'px.', guidance: 'Request the original asset from the asset library.', source: sourceOf(kit, 'G-VIS-3') });
      if (im.ratios) {
        var ar = meta.width / meta.height;
        var ok = im.ratios.some(function (r) { return Math.abs(ar - r.v) / r.v < 0.03; });
        if (!ok) add({ ruleId: 'visual.ratio', category: 'visual', severity: 'minor', title: 'Aspect ratio is not approved',
          message: 'This image is ' + ar.toFixed(2) + ':1. Approved ratios: ' + im.ratios.map(function (r) { return r.n; }).join(', ') + '.', guidance: 'Crop to an approved ratio.', source: sourceOf(kit, 'G-VIS-3') });
      }
      if (im.maxBytes && meta.bytes > im.maxBytes)
        add({ ruleId: 'visual.size', category: 'visual', severity: 'info', title: 'Image file is large',
          message: 'File is ' + Math.round(meta.bytes / 1024) + ' KB; keep under ' + Math.round(im.maxBytes / 1024) + ' KB for fast pages.', guidance: 'Export as WebP or compress.', source: sourceOf(kit, 'G-VIS-3') });
      var off = (meta.colors || []).filter(function (c) {
        var rgb = parseColor(c.hex); if (!rgb || c.share < 0.12) return false;
        var mx = Math.max.apply(null, rgb), mn = Math.min.apply(null, rgb);
        if (mx < 40 || (mx - mn) / (mx || 1) < 0.3) return false;
        var nr = nearestPalette(kit, rgb); return nr && nr.d > 90;
      });
      if (off.length)
        add({ ruleId: 'visual.image-palette', category: 'visual', severity: 'minor', confidence: 0.7, title: 'Dominant colour is outside the brand palette',
          message: off.map(function (c) { return c.hex + ' (' + Math.round(c.share * 100) + '% of image)'; }).join(', ') + ' sits far from every brand colour.',
          guidance: 'Colour-grade the image toward the palette or choose another asset. This check samples pixels and is heuristic.', source: sourceOf(kit, 'G-VIS-1') });
    }

    // finalise: dedupe, sort, key
    var seenK = {};
    out = out.filter(function (f) { var k = f.ruleId + '|' + f.start + '|' + f.end; if (seenK[k]) return false; seenK[k] = 1; return true; });
    out.sort(function (a, b) {
      var sa = SEV_ORDER.indexOf(a.severity), sb = SEV_ORDER.indexOf(b.severity);
      if (a.start < 0 && b.start >= 0) return 1; if (b.start < 0 && a.start >= 0) return -1;
      return a.start - b.start || sa - sb;
    });
    var occ = {};
    out.forEach(function (f) {
      var base = f.ruleId + '|' + (f.match || '').toLowerCase().slice(0, 40);
      occ[base] = (occ[base] || 0) + 1;
      f.key = base + '|' + occ[base];
      f.confidence = f.confidence == null ? 1 : f.confidence;
      f.method = 'rule';
    });
    return { findings: out, score: score(out), stats: { words: wc, readingEase: fe == null ? null : Math.round(fe) } };
  }

  function score(fs) {
    var s = 100; fs.forEach(function (f) { s -= SEV_WEIGHT[f.severity] || 0; });
    return Math.max(0, s);
  }

  // ---------- fixes ----------
  function applyFix(body, finding, inputValue) {
    var fx = finding.fix; if (!fx) return body;
    var text = fx.text;
    if (fx.input) text = text.replace('{{input}}', String(inputValue || '').replace(/"/g, '&quot;'));
    if (fx.type === 'append') return body.replace(/\s+$/, '') + text;
    if (fx.type === 'replace') {
      var out = body.slice(0, finding.start) + text + body.slice(finding.end);
      if (text === '') out = out.replace(/ {2,}/g, ' ').replace(/ +([.,;!?])/g, '$1');
      return out;
    }
    return body;
  }

  // ---------- workflow policy ----------
  function resolved(decisions, f) { var d = decisions && decisions[f.key]; return !!d && (d.state === 'dismissed' || d.state === 'waived'); }
  function gate(findings, decisions) {
    var blockers = findings.filter(function (f) { return f.severity === 'blocker' && !(decisions[f.key] && decisions[f.key].state === 'waived'); });
    var majors = findings.filter(function (f) { return f.severity === 'major' && !resolved(decisions, f); });
    return { ok: !blockers.length && !majors.length, blockers: blockers, majors: majors };
  }
  function approvalPolicy(findings, decisions) {
    var roles = ['manager'], reasons = [];
    var risky = findings.filter(function (f) { return ['claims', 'facts', 'confidentiality'].indexOf(f.category) > -1 && f.severity !== 'info'; });
    if (risky.length) reasons.push('Content triggered ' + risky.length + ' claim, fact or confidentiality finding(s).');
    var dm = findings.filter(function (f) { return f.severity === 'major' && decisions[f.key] && decisions[f.key].state === 'dismissed'; });
    if (dm.length) reasons.push(dm.length + ' major finding(s) were dismissed by the author.');
    var wv = findings.filter(function (f) { return decisions[f.key] && decisions[f.key].state === 'waived'; });
    if (wv.length) reasons.push(wv.length + ' finding(s) were waived.');
    if (reasons.length) roles.push('reviewer');
    return { roles: roles, reasons: reasons };
  }

  // ---------- diff ----------
  function diffWords(a, b) {
    var x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
    if (x.length * y.length > 4e6) return [{ t: 'del', s: a }, { t: 'ins', s: b }];
    var n = x.length, m = y.length, L = [], i, j;
    for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (x[i] === y[j]) { push('eq', x[i]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { push('del', x[i]); i++; } else { push('ins', y[j]); j++; }
    }
    while (i < n) push('del', x[i++]); while (j < m) push('ins', y[j++]);
    function push(t, s) { var l = ops[ops.length - 1]; if (l && l.t === t) l.s += s; else ops.push({ t: t, s: s }); }
    return ops;
  }

  return { review: review, applyFix: applyFix, gate: gate, approvalPolicy: approvalPolicy, diffWords: diffWords,
    score: score, flesch: flesch, contrast: contrast, parseColor: parseColor, toHex: toHex, SEV_ORDER: SEV_ORDER, SEV_WEIGHT: SEV_WEIGHT };
});
