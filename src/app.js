/* BrandGuard UI. Vanilla JS, no framework. State lives in memory and is mirrored to localStorage. */
(function () {
  'use strict';
  var E = window.BrandEngine, S = window.BrandSeed;
  var KEY = 'brandguard.v1';
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  function fresh() { var t = today(); return { v: 1, kit: clone(S.kit), users: clone(S.users), me: 'u-priya', contents: S.contents(t), log: S.log(t), seq: 100 }; }
  function load() { try { var s = localStorage.getItem(KEY); var o = s && JSON.parse(s); return o && o.v === 1 ? o : null; } catch (e) { return null; } }
  var state = load() || fresh();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: keep working in memory */ } }

  var ui = { view: 'queue', id: null, tab: 'content', editing: false, draft: '', filter: 'all', pending: null, libTab: 'guidelines', diffV: null, resolvedOpen: false, newFmt: 'text', cmFinding: null };

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function user(id) { return state.users.filter(function (u) { return u.id === id; })[0] || { name: 'Unknown', role: 'creator' }; }
  function me() { return user(state.me); }
  function cnt(id) { return state.contents.filter(function (c) { return c.id === id; })[0]; }
  function latest(c) { return c.versions[c.versions.length - 1]; }
  function uid(p) { return p + (++state.seq); }
  function ago(iso) { var d = Math.round((Date.now() - new Date(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }
  function toast(t) { var old = document.querySelector('.toast'); if (old) old.remove(); var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t; document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2600); }
  var STATUS = { draft: 'Draft', in_review: 'In review', changes_requested: 'Changes requested', approved: 'Approved', published: 'Published' };
  var ROLE = { creator: 'Creator', manager: 'Manager', reviewer: 'Reviewer', admin: 'Admin' };
  var CAT = { tone: 'Tone', language: 'Language', terminology: 'Terminology', claims: 'Claims', facts: 'Facts', messaging: 'Messaging', visual: 'Visual', accessibility: 'Accessibility', confidentiality: 'Confidentiality' };
  var SEVN = { blocker: 'Blocker', major: 'Major', minor: 'Minor', info: 'Note' };
  var FMT = { text: 'Plain text', markdown: 'Markdown', html: 'HTML', image: 'Image' };

  function reviewOf(c, body) {
    var v = latest(c);
    return E.review({ body: body != null ? body : v.body, format: c.format, channel: c.channel, imageMeta: v.imageMeta }, state.kit, { today: today() });
  }
  function isResolved(c, f) { var d = c.decisions[f.key]; return !!d && (d.state === 'dismissed' || d.state === 'waived'); }
  function scoreClass(s) { return s >= 85 ? 'sc-good' : s >= 60 ? 'sc-mid' : 'sc-bad'; }
  function logOutcome(c, f, outcome, unclear) {
    state.log.push({ at: new Date().toISOString(), ruleId: f.ruleId, title: f.title, category: f.category, authorId: c.authorId, outcome: outcome, unclear: !!unclear, contentId: c.id });
  }
  function hist(c, text) { c.history.push({ at: new Date().toISOString(), by: state.me, text: text }); }

  // ---------- permissions ----------
  function isAuthor(c) { return c.authorId === state.me; }
  function canEdit(c) { var r = me().role; return (isAuthor(c) || r === 'admin') && (c.status === 'draft' || c.status === 'changes_requested'); }
  function requiredRoles(c) { var r = reviewOf(c); return E.approvalPolicy(r.findings, c.decisions); }
  function approvedBy(c, role) { var v = latest(c).v; return c.approvals.some(function (a) { return a.role === role && a.decision === 'approved' && a.version === v; }); }
  function myApprovalRole(c) {
    var r = me().role; if (isAuthor(c)) return null;
    if (r === 'manager' || r === 'admin') return 'manager'; if (r === 'reviewer') return 'reviewer'; return null;
  }
  function refreshStatus(c) {
    if (c.status === 'published') return;
    var v = latest(c).v;
    if (c.status === 'in_review' || c.status === 'approved') {
      if (c.approvals.some(function (a) { return a.version === v && a.decision === 'changes'; })) { c.status = 'changes_requested'; return; }
      var need = requiredRoles(c).roles;
      c.status = need.every(function (r) { return approvedBy(c, r); }) ? 'approved' : 'in_review';
    }
  }

  // ---------- actions ----------
  function newVersion(c, body, note, extra) {
    var v = latest(c), nv = { v: v.v + 1, body: body, by: state.me, at: new Date().toISOString(), note: note };
    if (v.imageMeta) { nv.imageMeta = clone(v.imageMeta); nv.thumb = v.thumb; }
    if (extra) for (var k in extra) nv[k] = extra[k];
    c.versions.push(nv);
    if (c.status === 'approved' || c.status === 'in_review') { c.status = 'draft'; hist(c, 'Edited after review: approvals reset'); }
    hist(c, 'Saved v' + nv.v + (note ? ' (' + note + ')' : ''));
  }
  function applyFinding(c, f, input) {
    if (f.fix && f.fix.input && !String(input || '').trim()) { toast('Add the text first'); return; }
    if (ui.editing) {
      ui.draft = E.applyFix(ui.draft, f, input); logOutcome(c, f, 'fixed'); toast('Applied to your draft. Save to keep it.');
    } else if (f.fix.type === 'setAlt') {
      newVersion(c, latest(c).body, 'Added alt text', { imageMeta: Object.assign(clone(latest(c).imageMeta), { alt: input }) }); logOutcome(c, f, 'fixed'); toast('Alt text added');
    } else {
      newVersion(c, E.applyFix(latest(c).body, f, input), 'Applied: ' + f.title); logOutcome(c, f, 'fixed'); toast('Suggestion applied as a new version');
    }
    save(); render();
  }
  function decide(c, f, state_, reason) {
    c.decisions[f.key] = { state: state_, by: state.me, reason: reason || '', at: new Date().toISOString(), ver: latest(c).v };
    logOutcome(c, f, state_); hist(c, (state_ === 'waived' ? 'Waived' : 'Dismissed') + ': ' + f.title + (reason ? ' (' + reason + ')' : '')); save();
  }

  // ---------- rendering ----------
  var app = document.getElementById('app');
  function render() {
    var navs = [['queue', 'Review queue'], ['insights', 'Insights'], ['library', 'Brand library'], ['about', 'Trust and audit']];
    var h = '<div class="top"><div class="top-in"><button class="brand" data-act="nav" data-v="queue" aria-label="BrandGuard home"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="var(--accent)"/><path d="m8.5 12 2.5 2.5 4.5-5" stroke="var(--accent-ink)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>BrandGuard</button><nav class="nav" aria-label="Main">' +
      navs.map(function (n) { return '<button data-act="nav" data-v="' + n[0] + '"' + (ui.view === n[0] || (ui.view === 'content' && n[0] === 'queue') || ui.view === 'new' && n[0] === 'queue' ? ' aria-current="page"' : '') + '>' + n[1] + '</button>'; }).join('') +
      '</nav><span class="spacer"></span><button class="badge-ai" data-act="nav" data-v="about" title="How AI and external services are used"><b>No external AI.</b> Content stays in this browser</button>' +
      '<div class="who"><label class="muted" for="who">Viewing as</label><select id="who" data-chg="who">' +
      state.users.map(function (u) { return '<option value="' + u.id + '"' + (u.id === state.me ? ' selected' : '') + '>' + esc(u.name) + ' · ' + ROLE[u.role] + '</option>'; }).join('') + '</select></div></div></div><main class="wrap" id="main">';
    if (ui.view === 'queue') h += viewQueue(); else if (ui.view === 'new') h += viewNew(); else if (ui.view === 'content') h += viewContent();
    else if (ui.view === 'insights') h += viewInsights(); else if (ui.view === 'library') h += viewLibrary(); else h += viewAbout();
    app.innerHTML = h + '</main>';
    if (ui.view === 'content') updateDirty();
  }

  // ----- queue -----
  function needsMe(c) {
    var r = me().role;
    if ((c.status === 'draft' || c.status === 'changes_requested') && isAuthor(c)) return true;
    if (c.status === 'in_review' && !isAuthor(c)) {
      var role = myApprovalRole(c); if (!role) return false;
      return requiredRoles(c).roles.indexOf(role) > -1 && !approvedBy(c, role);
    }
    if (c.status === 'approved' && (r === 'manager' || r === 'admin')) return true;
    return false;
  }
  function viewQueue() {
    var list = state.contents.slice().sort(function (a, b) { return latest(b).at < latest(a).at ? -1 : 1; });
    var mine = list.filter(needsMe).length, inrev = list.filter(function (c) { return c.status === 'in_review'; }).length, blk = 0;
    list.forEach(function (c) { if (c.status !== 'published') blk += reviewOf(c).findings.filter(function (f) { return f.severity === 'blocker' && !isResolved(c, f); }).length; });
    var f = ui.filter, shown = list.filter(function (c) { return f === 'all' || (f === 'mine' ? needsMe(c) : c.status === f); });
    return '<div class="page-head"><div><h1>Review queue</h1><p>Everything is checked against approved guidelines, facts and assets before it goes out. You are signed in as ' + esc(me().name) + ' (' + ROLE[me().role] + ').</p></div>' +
      (me().role !== 'reviewer' ? '<button class="btn primary" data-act="newc">New content</button>' : '') + '</div>' +
      '<div class="todo"><div class="card"><b>' + mine + '</b><span class="muted">waiting on you</span></div><div class="card"><b>' + inrev + '</b><span class="muted">in review</span></div><div class="card"><b>' + blk + '</b><span class="muted">open blockers across unpublished work</span></div></div>' +
      '<div class="row" style="margin-bottom:12px" role="group" aria-label="Filter">' +
      [['all', 'All'], ['mine', 'Needs me'], ['draft', 'Draft'], ['in_review', 'In review'], ['changes_requested', 'Changes requested'], ['approved', 'Approved'], ['published', 'Published']].map(function (x) { return '<button class="chip btn-chip' + (f === x[0] ? ' on' : '') + '" data-act="filter" data-f="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="list">' + (shown.map(function (c) {
        var r = reviewOf(c), open = r.findings.filter(function (x) { return !isResolved(c, x); });
        var bl = open.filter(function (x) { return x.severity === 'blocker'; }).length;
        return '<button class="item" data-act="open" data-id="' + c.id + '"><div><h3>' + esc(c.title) + '</h3><div class="meta"><span>' + FMT[c.format] + ' · ' + esc(c.channel) + '</span><span>' + esc(user(c.authorId).name) + '</span><span>v' + latest(c).v + ', ' + ago(latest(c).at) + '</span>' + (bl ? '<span style="color:var(--blocker);font-weight:600">' + bl + ' blocker' + (bl > 1 ? 's' : '') + '</span>' : '') + '<span>' + open.length + ' open finding' + (open.length === 1 ? '' : 's') + '</span></div></div><span class="chip st-' + c.status + '">' + STATUS[c.status] + '</span><span class="score ' + scoreClass(r.score) + '" title="Brand score">' + r.score + '</span></button>';
      }).join('') || '<p class="muted" style="padding:20px">Nothing here.</p>') + '</div>';
  }

  // ----- new content -----
  function viewNew() {
    var img = ui.newFmt === 'image';
    return '<div class="page-head"><div><h1>New content</h1><p>Paste text, import a .txt, .md or .html file, or upload an image. Nothing is uploaded to a server.</p></div><button class="btn" data-act="nav" data-v="queue">Cancel</button></div>' +
      '<div class="card grid" style="max-width:820px"><div class="row"><div class="field" style="flex:2;min-width:220px"><label for="n-title">Title</label><input type="text" id="n-title" placeholder="e.g. Black Friday email"></div>' +
      '<div class="field" style="flex:1;min-width:140px"><label for="n-fmt">Format</label><select id="n-fmt" data-chg="newfmt">' + Object.keys(FMT).map(function (k) { return '<option value="' + k + '"' + (ui.newFmt === k ? ' selected' : '') + '>' + FMT[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" style="flex:1;min-width:140px"><label for="n-ch">Channel</label><select id="n-ch"><option>web</option><option>email</option><option>social</option><option>blog</option><option>press</option></select></div></div>' +
      (img ? '<div class="field"><label for="n-img">Image file</label><input type="file" id="n-img" accept="image/png,image/jpeg,image/webp,image/svg+xml"><span class="muted">Colour, size and ratio are measured locally in your browser.</span></div><div class="field"><label for="n-body">Caption or surrounding copy</label><textarea id="n-body" rows="3"></textarea></div>' :
        '<div class="field"><label for="n-body">Content</label><textarea id="n-body" rows="12" placeholder="Paste your draft here"></textarea></div><div class="field"><label for="n-file">Or import a file</label><input type="file" id="n-file" accept=".txt,.md,.markdown,.html,.htm,text/*"></div>') +
      '<div class="row"><button class="btn primary" data-act="create">Create and check</button></div></div>';
  }
  function analyzeImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement('canvas'); c.width = c.height = 48; var g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 48);
          var d = g.getImageData(0, 0, 48, 48).data, b = {}, i, n = 0;
          for (i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; var k = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5); b[k] = (b[k] || 0) + 1; n++; }
          var colors = Object.keys(b).sort(function (x, y) { return b[y] - b[x]; }).slice(0, 5).map(function (k) { var p = k.split(',').map(function (v) { return Math.min(255, v * 32 + 16); }); return { hex: E.toHex(p), share: b[k] / n }; });
          var s = 320 / Math.max(img.width, img.height, 1), t = document.createElement('canvas'); t.width = Math.round(img.width * Math.min(1, s)) || 1; t.height = Math.round(img.height * Math.min(1, s)) || 1;
          t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
          res({ meta: { name: file.name, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, bytes: file.size, alt: '', colors: colors }, thumb: t.toDataURL('image/jpeg', 0.7) });
        } catch (e) { rej(e); } URL.revokeObjectURL(url);
      };
      img.onerror = function () { rej(new Error('Could not read image')); }; img.src = url;
    });
  }
  function createContent() {
    var title = $('#n-title').value.trim(), fmt = ui.newFmt, ch = $('#n-ch').value, body = ($('#n-body') || {}).value || '';
    if (!title) { toast('Add a title'); return; }
    var finish = function (extra) {
      var c = { id: uid('c-'), title: title, format: fmt, channel: ch, authorId: state.me, status: 'draft', created: new Date().toISOString(), versions: [], decisions: {}, comments: [], approvals: [], history: [] };
      var v = { v: 1, body: body, by: state.me, at: new Date().toISOString(), note: 'First draft' }; if (extra) for (var k in extra) v[k] = extra[k];
      c.versions.push(v); hist(c, 'Created draft'); state.contents.push(c); save(); ui.view = 'content'; ui.id = c.id; ui.tab = 'content'; ui.editing = false; render();
    };
    if (fmt === 'image') {
      var f = $('#n-img').files[0]; if (!f) { toast('Choose an image'); return; }
      analyzeImage(f).then(function (r) { finish({ imageMeta: r.meta, thumb: r.thumb }); }, function () { toast('That image could not be read'); });
    } else { if (!body.trim()) { toast('Add some content'); return; } finish(); }
  }

  // ----- content / review screen -----
  function highlight(body, fs, c) {
    var spans = fs.filter(function (f) { return f.start >= 0 && f.end > f.start; }).sort(function (a, b) { return a.start - b.start; }), pos = 0, h = '';
    spans.forEach(function (f) {
      if (f.start < pos) return; h += esc(body.slice(pos, f.start));
      h += '<mark class="m ' + f.severity + (isResolved(c, f) ? ' done' : '') + '" data-act="jump" data-key="' + esc(f.key) + '" tabindex="0" role="button" title="' + esc(f.title) + '">' + esc(body.slice(f.start, f.end)) + '</mark>'; pos = f.end;
    });
    return h + esc(body.slice(pos));
  }
  function currentBody(c) { return ui.editing ? ui.draft : latest(c).body; }

  function viewContent() {
    var c = cnt(ui.id); if (!c) { ui.view = 'queue'; return viewQueue(); }
    var v = latest(c), h = '<div class="page-head"><div><button class="btn sm" data-act="nav" data-v="queue" style="margin-bottom:8px">Back to queue</button><h1>' + esc(c.title) + '</h1><div class="row muted" style="margin-top:6px"><span class="chip st-' + c.status + '">' + STATUS[c.status] + '</span><span>' + FMT[c.format] + ' · ' + esc(c.channel) + '</span><span>by ' + esc(user(c.authorId).name) + '</span><span>v' + v.v + '</span></div></div><div class="row" id="actions">' + actionsHtml(c) + '</div></div>';
    h += '<div class="review"><div><div class="tabs" role="tablist">' + [['content', 'Content'], ['versions', 'Versions (' + c.versions.length + ')'], ['discussion', 'Discussion (' + c.comments.length + ')']].map(function (t) { return '<button role="tab" aria-selected="' + (ui.tab === t[0]) + '" data-act="tab" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (ui.tab === 'content') h += contentTab(c); else if (ui.tab === 'versions') h += versionsTab(c); else h += discussionTab(c);
    h += '</div><div id="side">' + sideHtml(c) + '</div></div>';
    return h;
  }
  function contentTab(c) {
    var v = latest(c), body = currentBody(c), r = reviewOf(c, ui.editing ? ui.draft : null), h = '<div id="scorebar">' + scorebar(r) + '</div>';
    if (c.format === 'image') {
      var m = v.imageMeta;
      h += '<div class="card imgbox">' + (v.thumb ? '<img src="' + v.thumb + '" alt="' + esc(m.alt || 'Uploaded image, no alt text yet') + '">' : '<div class="muted" style="width:240px;height:135px;display:grid;place-items:center;border:1px dashed var(--line);border-radius:8px">Sample image: no preview</div>') +
        '<div style="min-width:0;flex:1"><div class="lbl">Measured locally</div><p class="mono">' + esc(m.name) + '<br>' + m.width + ' × ' + m.height + ' px · ' + Math.round(m.bytes / 1024) + ' KB<br>Alt text: ' + (m.alt ? esc(m.alt) : '<span style="color:var(--major)">missing</span>') + '</p><div class="row" style="margin-top:8px">' + m.colors.map(function (k) { return '<span title="' + k.hex + ' ' + Math.round(k.share * 100) + '%"><span class="sw" style="background:' + k.hex + '"></span> <span class="mono">' + Math.round(k.share * 100) + '%</span></span>'; }).join('') + '</div></div></div><div class="lbl" style="margin:12px 0 6px">Caption</div>';
    }
    if (ui.editing) {
      h += '<textarea id="editor" rows="' + (c.format === 'html' ? 16 : 11) + '" aria-label="Content editor" data-inp="draft">' + esc(ui.draft) + '</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="savever">Save as new version</button><button class="btn" data-act="canceledit">Cancel</button><span id="dirty" class="muted"></span></div><p class="muted" style="margin-top:6px">Checks run as you type. Nothing is saved until you press Save.</p>';
    } else {
      h += '<div class="doc' + (c.format === 'html' ? ' code' : '') + '" id="doc">' + highlight(body, r.findings, c) + '</div>';
      if (c.format === 'html') h += '<details style="margin-top:10px"><summary class="muted" style="cursor:pointer">Preview (scripts disabled)</summary><iframe class="preview" sandbox srcdoc="' + esc(body) + '" title="Preview"></iframe></details>';
    }
    return h;
  }
  function scorebar(r) {
    var by = { blocker: 0, major: 0, minor: 0, info: 0 }; r.findings.forEach(function (f) { by[f.severity]++; });
    return '<div class="card scorebar"><div class="ring ' + scoreClass(r.score) + '" title="Brand score: 100 minus weighted findings">' + r.score + '</div><div><b>Brand score</b><div class="muted">' + r.stats.words + ' words' + (r.stats.readingEase != null ? ' · reading ease ' + r.stats.readingEase : '') + '</div></div><div class="sev-count">' +
      E.SEV_ORDER.filter(function (s) { return by[s]; }).map(function (s) { return '<span class="sevchip ' + s + '">' + by[s] + ' ' + SEVN[s].toLowerCase() + (by[s] > 1 && s !== 'info' ? 's' : '') + '</span>'; }).join('') + (r.findings.length ? '' : '<span class="sevchip" style="background:var(--good-bg);color:var(--good)">All clear</span>') + '</div></div>';
  }
  function sideHtml(c) {
    var r = reviewOf(c, ui.editing ? ui.draft : null), fs = r.findings, open = fs.filter(function (f) { return !isResolved(c, f); }), done = fs.filter(function (f) { return isResolved(c, f); });
    var h = '<div class="panel-t"><h2>Findings</h2><span class="muted">' + open.length + ' open' + (done.length ? ', ' + done.length + ' resolved' : '') + '</span></div><div class="findings">';
    h += open.map(function (f) { return findingCard(c, f); }).join('') || '<div class="card" style="color:var(--good)"><b>No open findings.</b> <span class="muted">Everything checked against the current guidelines.</span></div>';
    h += '</div>';
    if (done.length) h += '<div class="panel-t" style="margin-top:14px"><button class="btn sm" data-act="toggleres">' + (ui.resolvedOpen ? 'Hide' : 'Show') + ' ' + done.length + ' dismissed or waived</button></div>' + (ui.resolvedOpen ? '<div class="findings">' + done.map(function (f) { return findingCard(c, f); }).join('') + '</div>' : '');
    return h + approvalsHtml(c);
  }
  function canSeeSource(src) { return !src.confidential || me().role !== 'creator'; }
  function findingCard(c, f) {
    var d = c.decisions[f.key], res = isResolved(c, f), role = me().role, edit = canEdit(c) || (role !== 'creator' && c.status !== 'published');
    var h = '<article class="f ' + f.severity + (res ? ' done' : '') + '" data-fkey="' + esc(f.key) + '"><header><span class="sev ' + f.severity + '">' + SEVN[f.severity] + '</span><span class="chip">' + CAT[f.category] + '</span><h4>' + esc(f.title) + '</h4></header>';
    if (f.match) h += '<p class="match">' + esc(f.match.length > 120 ? f.match.slice(0, 120) + '…' : f.match) + '</p>';
    h += '<p>' + esc(f.message) + '</p>';
    if (f.fix && !res) {
      var after = f.fix.type === 'append' ? '+ ' + f.fix.text.trim() : f.fix.input ? '(you provide the text)' : f.fix.text === '' ? '(removed)' : f.fix.text, before = f.fix.type === 'append' ? '' : (f.match.length > 60 ? f.match.slice(0, 60) + '…' : f.match);
      h += '<div class="sugg"><div class="lbl">Suggested change</div><div class="ba">' + (before ? '<del>' + esc(before) + '</del><span aria-hidden="true">→</span>' : '') + '<ins>' + esc(after.length > 140 ? after.slice(0, 140) + '…' : after) + '</ins></div>' + (f.preserves ? '<p class="muted">' + esc(f.preserves) + '</p>' : '');
      if (f.fix.input) h += '<input type="text" data-alt="' + esc(f.key) + '" aria-label="' + esc(f.fix.input.label) + '" placeholder="' + esc(f.fix.input.placeholder) + '">';
      if (canEdit(c)) h += '<div class="acts"><button class="btn sm primary" data-act="apply" data-key="' + esc(f.key) + '">' + esc(f.fix.label) + '</button></div>';
      h += '</div>';
    } else if (f.guidance && !res) h += '<p class="muted"><b>How to fix:</b> ' + esc(f.guidance) + '</p>';
    h += '<details><summary>Why was this flagged?</summary><div class="src">' + (f.source ? '<b>' + (f.source.type === 'fact' ? 'Approved fact ' : 'Guideline ') + esc(f.source.id) + ': ' + esc(f.source.title) + '</b><br>' + (canSeeSource(f.source) ? '“' + esc(f.source.quote) + '”' + (f.source.asOf ? '<br><span class="muted">Source: ' + esc(f.source.origin || '') + ', as of ' + esc(f.source.asOf) + '</span>' : '') : '<span class="muted">The wording of this guideline is confidential. Ask the Brand team for details.</span>') : 'No source') + '<br><span class="muted mono">Method: deterministic rule ' + esc(f.ruleId) + ' · confidence ' + Math.round(f.confidence * 100) + '%' + (f.confidence < 1 ? ' (heuristic)' : '') + '</span></div></details>';
    if (d) h += '<p class="decided">' + (d.state === 'waived' ? 'Waived' : 'Dismissed') + ' by ' + esc(user(d.by).name) + (d.reason ? ': “' + esc(d.reason) + '”' : '') + (edit ? ' <button class="btn sm" data-act="reopenf" data-key="' + esc(f.key) + '">Reopen</button>' : '') + '</p>';
    else if (ui.pending && ui.pending.key === f.key) {
      h += '<div class="sugg"><label class="lbl" for="reason">' + (ui.pending.kind === 'waived' ? 'Reason for waiving (recorded in the audit log)' : 'Reason for dismissing' + (f.severity === 'major' ? ' (required)' : '')) + '</label><input type="text" id="reason" placeholder="e.g. Approved by Legal on 12 Oct, ticket LEG-218"><div class="acts"><button class="btn sm primary" data-act="confirmdec" data-key="' + esc(f.key) + '">Confirm</button><button class="btn sm" data-act="cancelpend">Cancel</button></div></div>';
    } else {
      h += '<div class="acts">';
      if (edit && f.severity !== 'blocker' && !ui.editing) h += '<button class="btn sm" data-act="dismiss" data-key="' + esc(f.key) + '">Dismiss</button>';
      if (role === 'reviewer' && f.severity !== 'info' && c.status !== 'published' && !ui.editing) h += '<button class="btn sm" data-act="waive" data-key="' + esc(f.key) + '">Waive</button>';
      if (f.severity === 'blocker' && role !== 'reviewer') h += '<span class="muted">Only a Reviewer can waive a blocker.</span>';
      h += '<button class="btn sm" data-act="unclear" data-key="' + esc(f.key) + '" title="Tells the brand team this guideline is hard to apply">Guideline unclear</button><button class="btn sm" data-act="cmfor" data-key="' + esc(f.key) + '">Comment</button></div>';
    }
    return h + '</article>';
  }
  function approvalsHtml(c) {
    var pol = requiredRoles(c), v = latest(c).v, g = E.gate(reviewOf(c).findings, c.decisions);
    var h = '<div class="card" style="margin-top:18px"><h3>Approvals</h3><div class="approvals">';
    pol.roles.forEach(function (role) {
      var a = c.approvals.filter(function (x) { return x.role === role && x.version === v; }).pop();
      h += '<div class="ap"><span class="dot ' + (a ? (a.decision === 'approved' ? 'ok' : 'no') : '') + '"></span><b>' + ROLE[role] + '</b> ' + (a ? (a.decision === 'approved' ? 'approved' : 'requested changes') + ' · ' + esc(user(a.by).name) + (a.note ? ': “' + esc(a.note) + '”' : '') : '<span class="muted">pending</span>') + '</div>';
    });
    h += '</div>' + (pol.reasons.length ? '<p class="muted" style="margin-top:8px"><b>Why a Reviewer is needed:</b> ' + esc(pol.reasons.join(' ')) + '</p>' : '<p class="muted" style="margin-top:8px">A manager approval is enough: no claims, facts or confidentiality issues were raised.</p>') +
      (!g.ok ? '<p class="warn" style="margin-top:8px">Cannot be submitted yet: ' + (g.blockers.length ? g.blockers.length + ' blocker(s) need a Reviewer waiver or a fix. ' : '') + (g.majors.length ? g.majors.length + ' major finding(s) need a fix or a recorded reason.' : '') + '</p>' : '') +
      '<p class="muted" style="margin-top:8px">Approvals apply to version ' + v + ' only. Any edit resets them.</p></div>';
    return h;
  }
  function actionsHtml(c) {
    var h = '', role = me().role, g = E.gate(reviewOf(c).findings, c.decisions), ar = myApprovalRole(c);
    if (canEdit(c) && !ui.editing && c.format !== 'image') h += '<button class="btn" data-act="edit">Edit</button>';
    if (canEdit(c) && ui.editing && false) h += '';
    if (canEdit(c) && c.format === 'image' && !ui.editing) h += '<button class="btn" data-act="edit">Edit caption</button>';
    if (canEdit(c) && !ui.editing) h += '<button class="btn primary" data-act="submit"' + (g.ok ? '' : ' disabled title="Resolve blockers and major findings first"') + '>Submit for review</button>';
    if (c.status === 'in_review') {
      if (isAuthor(c)) h += '<button class="btn" data-act="withdraw">Withdraw</button>';
      if (ar && requiredRoles(c).roles.indexOf(ar) > -1) h += '<input type="text" id="apnote" placeholder="Note (optional)" aria-label="Approval note" style="width:200px"><button class="btn primary" data-act="approve">Approve as ' + ROLE[ar].toLowerCase() + '</button><button class="btn danger" data-act="reqchg">Request changes</button>';
      else if (!isAuthor(c)) h += '<span class="muted">Waiting on other approvers</span>';
    }
    if (c.status === 'approved' && (role === 'manager' || role === 'admin')) h += '<button class="btn primary" data-act="publish">Publish</button>';
    if (c.status === 'approved' && isAuthor(c)) h += '<button class="btn" data-act="reopen">Reopen as draft</button>';
    if (c.status === 'published' && (isAuthor(c) || role === 'admin')) h += '<button class="btn" data-act="reopen">Start a new revision</button>';
    return h;
  }
  function versionsTab(c) {
    var vs = c.versions.slice().reverse(), sel = ui.diffV || (c.versions.length > 1 ? latest(c).v : null), h = '';
    if (sel && sel > 1) {
      var a = c.versions[sel - 2], b = c.versions[sel - 1];
      h += '<div class="lbl" style="margin-bottom:6px">Changes in v' + sel + ' compared with v' + (sel - 1) + '</div><div class="diff">' + E.diffWords(a.body, b.body).map(function (o) { return o.t === 'ins' ? '<ins>' + esc(o.s) + '</ins>' : o.t === 'del' ? '<del>' + esc(o.s) + '</del>' : esc(o.s); }).join('') + '</div>';
    } else h += '<p class="muted">Only one version so far.</p>';
    h += '<div class="lbl" style="margin:16px 0 6px">History</div><div class="list">' + vs.map(function (v) { return '<div class="item" style="grid-template-columns:1fr auto auto;cursor:default"><div><b>v' + v.v + '</b> · ' + esc(v.note || '') + '<div class="meta"><span>' + esc(user(v.by).name) + '</span><span>' + ago(v.at) + '</span></div></div>' + (v.v > 1 ? '<button class="btn sm" data-act="diffv" data-v="' + v.v + '">Compare</button>' : '<span></span>') + (canEdit(c) && v.v !== latest(c).v ? '<button class="btn sm" data-act="restore" data-v="' + v.v + '">Restore</button>' : '<span></span>') + '</div>'; }).join('') + '</div>';
    h += '<div class="lbl" style="margin:16px 0 6px">Activity</div><div class="card"><ul style="margin:0;padding-left:18px">' + c.history.slice().reverse().map(function (e) { return '<li><b>' + esc(user(e.by).name) + '</b> ' + esc(e.text) + ' <span class="muted">· ' + ago(e.at) + '</span></li>'; }).join('') + '</ul></div>';
    return h;
  }
  function discussionTab(c) {
    var fs = reviewOf(c).findings;
    return '<div class="grid">' + (c.comments.map(function (k) {
      var ref = k.findingKey && fs.filter(function (f) { return f.key === k.findingKey; })[0];
      return '<div class="cm"><div class="h"><b>' + esc(user(k.by).name) + '</b> · ' + ROLE[user(k.by).role] + ' · ' + ago(k.at) + (ref ? ' · re: ' + esc(ref.title) : '') + '</div>' + esc(k.text) + '</div>';
    }).join('') || '<p class="muted">No comments yet.</p>') + '</div><div class="field" style="margin-top:14px"><label for="cmt">Add a comment' + (ui.cmFinding ? ' about the selected finding' : '') + '</label><textarea id="cmt" rows="3" style="font-family:var(--sans)"></textarea></div><div class="row" style="margin-top:8px"><button class="btn primary" data-act="comment">Post comment</button></div>';
  }
  function updatePanels() {
    var c = cnt(ui.id); if (!c) return; var r = reviewOf(c, ui.editing ? ui.draft : null);
    var sb = $('#scorebar'); if (sb) sb.innerHTML = scorebar(r);
    var sd = $('#side'); if (sd) sd.innerHTML = sideHtml(c); updateDirty();
  }
  function updateDirty() { var c = cnt(ui.id), el = $('#dirty'); if (c && el) el.textContent = ui.draft !== latest(c).body ? 'Unsaved changes' : 'No changes yet'; }

  // ----- insights -----
  var RULE_GUIDE = { 'tone.reading-ease': 'G-TONE-2', 'msg.pillars': 'G-MSG-1', 'visual.off-palette': 'G-VIS-1', 'visual.image-palette': 'G-VIS-1', 'claim.the-best': 'G-CLAIM-1', 'msg.disclaimer.F-SAVE': 'G-CLAIM-3' };
  var ADVICE = { 'tone.reading-ease': 'Reading-ease target of 50 is dismissed often for technical product pages. Consider separate targets for technical and consumer content.', 'msg.pillars': 'Writers dismiss this for hiring, press and community posts. Define which content types must carry a pillar.', 'visual.off-palette': 'Add a "tints and shades" rule so close variants of brand colours are explicitly allowed or forbidden.', 'visual.image-palette': 'Photography rules are subjective. Add 3 approved and 3 rejected image examples to the guideline.' };
  function viewInsights() {
    var L = state.log, role = me().role, total = L.length, fixed = L.filter(function (x) { return x.outcome === 'fixed'; }).length;
    var by = function (k) { var m = {}; L.forEach(function (x) { m[x[k]] = (m[x[k]] || 0) + 1; }); return Object.keys(m).map(function (a) { return [a, m[a]]; }).sort(function (a, b) { return b[1] - a[1]; }); };
    var rules = {}; L.forEach(function (x) { var r = rules[x.ruleId] = rules[x.ruleId] || { id: x.ruleId, title: x.title, cat: x.category, n: 0, over: 0, unclear: 0 }; r.n++; if (x.outcome !== 'fixed') r.over++; if (x.unclear) r.unclear++; });
    var top = Object.keys(rules).map(function (k) { return rules[k]; }).sort(function (a, b) { return b.n - a.n; });
    var unclear = top.filter(function (r) { return r.n >= 5 && (r.over / r.n >= 0.4 || r.unclear / r.n >= 0.3); }).sort(function (a, b) { return (b.over + b.unclear) / b.n - (a.over + a.unclear) / a.n; });
    var weeks = [], i; for (i = 7; i >= 0; i--) { var end = Date.now() - i * 7 * 864e5, st = end - 7 * 864e5; weeks.push({ n: L.filter(function (x) { var t = +new Date(x.at); return t > st && t <= end; }).length, fixed: L.filter(function (x) { var t = +new Date(x.at); return t > st && t <= end && x.outcome === 'fixed'; }).length }); }
    var maxW = Math.max.apply(null, weeks.map(function (w) { return w.n; }).concat(1)), maxT = top.length ? top[0].n : 1;
    var catRows = by('category'), maxC = catRows.length ? catRows[0][1] : 1, conf = L.filter(function (x) { return x.category === 'confidentiality' || x.ruleId === 'claim.competitor'; }).length;
    var h = '<div class="page-head"><div><h1>Governance insights</h1><p>What goes wrong most often, who might need support, and where the guidelines themselves are unclear.</p></div>' + (L.some(function (x) { return x.sample; }) ? '<button class="btn sm" data-act="clearsample">Clear sample history</button>' : '') + '</div>';
    if (L.some(function (x) { return x.sample; })) h += '<p class="note" style="margin-bottom:14px">This page includes ' + L.filter(function (x) { return x.sample; }).length + ' generated sample events from the last 8 weeks so the charts have something to show. Your own review decisions are added as you work.</p>';
    h += '<div class="kpis"><div class="card kpi"><b>' + total + '</b><span>issues caught before publishing</span></div><div class="card kpi"><b>' + (total ? Math.round(fixed / total * 100) : 0) + '%</b><span>fixed using suggestions, not overridden</span></div><div class="card kpi"><b>' + conf + '</b><span>confidential or competitor slips stopped</span></div><div class="card kpi"><b>' + unclear.length + '</b><span>guidelines that look unclear</span></div></div>';
    h += '<div class="grid g2"><div class="card"><h3>Most repeated mistakes</h3><div class="bars">' + top.slice(0, 8).map(function (r) { return '<div class="bar"><span title="' + esc(r.title) + '">' + esc(r.title) + '</span><span class="t"><i style="width:' + Math.round(r.n / maxT * 100) + '%"></i></span><span class="n">' + r.n + '</span></div>'; }).join('') + '</div></div>';
    h += '<div class="card"><h3>By category</h3><div class="bars">' + catRows.map(function (r) { return '<div class="bar"><span>' + CAT[r[0]] + '</span><span class="t"><i style="width:' + Math.round(r[1] / maxC * 100) + '%"></i></span><span class="n">' + r[1] + '</span></div>'; }).join('') + '</div></div></div>';
    var W = 520, H = 150, px = 34, bw = (W - px) / 8;
    h += '<div class="card" style="margin-top:16px"><h3>Findings per week</h3><p class="muted">Bars are all findings; the darker part was fixed with a suggestion.</p><div class="tw"><svg viewBox="0 0 ' + W + ' ' + (H + 28) + '" role="img" aria-label="Findings per week for the last 8 weeks" style="width:100%;max-width:640px;height:auto"><line x1="' + px + '" y1="' + H + '" x2="' + W + '" y2="' + H + '" stroke="var(--line)"/>' +
      [0, 0.5, 1].map(function (f) { var y = H - f * (H - 10); return '<line x1="' + px + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--line)" stroke-dasharray="2 4"/><text x="' + (px - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + Math.round(f * maxW) + '</text>'; }).join('') +
      weeks.map(function (w, k) { var x = px + k * bw + 8, bwid = bw - 16, hh = w.n / maxW * (H - 10), hf = w.fixed / maxW * (H - 10); return '<rect x="' + x + '" y="' + (H - hh) + '" width="' + bwid + '" height="' + hh + '" fill="var(--accent)" opacity=".35" rx="2"/><rect x="' + x + '" y="' + (H - hf) + '" width="' + bwid + '" height="' + hf + '" fill="var(--accent)" rx="2"/><text x="' + (x + bwid / 2) + '" y="' + (H + 16) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + (k === 7 ? 'now' : '-' + (7 - k) + 'w') + '</text>'; }).join('') + '</svg></div></div>';
    h += '<div class="card" style="margin-top:16px"><h3>Where the guidelines may be unclear</h3><p class="muted">Flagged when writers override a rule at least 40% of the time, or mark it "Guideline unclear" in at least 30% of cases.</p>' +
      (unclear.length ? '<div class="tw"><table><thead><tr><th>Rule</th><th>Raised</th><th>Overridden</th><th>Marked unclear</th><th>Suggested action</th></tr></thead><tbody>' + unclear.map(function (r) { return '<tr><td><b>' + esc(r.title) + '</b><br><span class="muted mono">' + esc(r.id) + '</span></td><td>' + r.n + '</td><td>' + Math.round(r.over / r.n * 100) + '%</td><td>' + r.unclear + '</td><td>' + esc(ADVICE[r.id] || 'Review the wording with the brand owner and add a positive and a negative example.') + (RULE_GUIDE[r.id] ? ' <button class="btn sm" data-act="nav" data-v="library" data-lt="guidelines">Open ' + RULE_GUIDE[r.id] + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted" style="margin-top:8px">Nothing stands out yet.</p>') + '</div>';
    var au = by('authorId').filter(function (a) { return role !== 'creator' || a[0] === state.me; });
    h += '<div class="card" style="margin-top:16px"><h3>' + (role === 'creator' ? 'Your most common issues' : 'Where teams may need onboarding') + '</h3><p class="muted">' + (role === 'creator' ? 'Only you can see this.' : 'Visible to managers, reviewers and admins. Use for coaching and briefing agencies, not for ranking people.') + '</p><div class="tw"><table><thead><tr><th>Author</th><th>Issues</th><th>Their top repeat issue</th></tr></thead><tbody>' + au.map(function (a) {
      var m = {}; L.filter(function (x) { return x.authorId === a[0]; }).forEach(function (x) { m[x.title] = (m[x.title] || 0) + 1; }); var tk = Object.keys(m).sort(function (p, q) { return m[q] - m[p]; })[0];
      return '<tr><td>' + esc(user(a[0]).name) + '</td><td>' + a[1] + '</td><td>' + esc(tk || '') + ' (' + (m[tk] || 0) + ')</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return h;
  }

  // ----- library -----
  function viewLibrary() {
    var admin = me().role === 'admin', t = ui.libTab, k = state.kit, role = me().role;
    var tabs = [['guidelines', 'Guidelines'], ['facts', 'Approved facts'], ['terms', 'Terminology'], ['claims', 'Claims and evidence'], ['assets', 'Visual assets'], ['data', 'Import and export']];
    var h = '<div class="page-head"><div><h1>Brand library</h1><p>The approved source material every finding points back to. ' + (admin ? 'You can edit it as Admin.' : 'Only Admins can edit it.') + '</p></div></div><div class="tabs" role="tablist">' + tabs.map(function (x) { return '<button role="tab" aria-selected="' + (t === x[0]) + '" data-act="libtab" data-t="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (t === 'guidelines') {
      h += '<div class="list">' + k.guidelines.map(function (g) { return '<div class="item" style="grid-template-columns:1fr auto;cursor:default"><div><div class="mono muted">' + esc(g.id) + ' · ' + esc(g.section) + (g.confidential ? ' · <b>Confidential</b>' : '') + '</div><h3>' + esc(g.title) + '</h3><p class="muted" style="margin-top:4px">' + (g.confidential && role === 'creator' ? 'Visible to managers, reviewers and admins only.' : esc(g.text)) + '</p></div>' + (admin ? '<button class="btn sm danger" data-act="delg" data-id="' + g.id + '">Delete</button>' : '') + '</div>'; }).join('') + '</div>';
      if (admin) h += '<div class="card grid" style="margin-top:14px;max-width:720px"><h3>Add a guideline</h3><div class="row"><input type="text" id="g-id" placeholder="ID, e.g. G-TONE-3" style="flex:1"><input type="text" id="g-sec" placeholder="Section" style="flex:1"></div><input type="text" id="g-title" placeholder="Title"><textarea id="g-text" rows="3" style="font-family:var(--sans)" placeholder="Guideline text"></textarea><label class="row"><input type="checkbox" id="g-conf"> Confidential (hidden from creators)</label><div><button class="btn primary" data-act="addg">Add guideline</button></div></div>';
    } else if (t === 'facts') {
      h += '<p class="note" style="margin-bottom:12px">Facts are matched by numeric checks (counts, percentages, prices, years). Expired facts are flagged when content uses them.</p><div class="tw"><table><thead><tr><th>Fact</th><th>Approved statement</th><th>Value</th><th>As of</th><th>Expires</th><th>Owner</th></tr></thead><tbody>' + k.facts.map(function (f) {
        var exp = f.expires < today(); return '<tr><td><b>' + esc(f.label) + '</b><br><span class="mono muted">' + esc(f.id) + '</span></td><td>' + (admin ? '<input type="text" data-fact="' + f.id + '" data-k="statement" value="' + esc(f.statement) + '">' : esc(f.statement)) + '<div class="muted">' + esc(f.source) + '</div></td><td class="mono">' + (f.products ? esc(JSON.stringify(f.products)) : (admin ? '<input type="number" data-fact="' + f.id + '" data-k="value" value="' + f.value + '" style="width:90px">' : f.value)) + '</td><td>' + (admin ? '<input type="date" data-fact="' + f.id + '" data-k="asOf" value="' + f.asOf + '">' : f.asOf) + '</td><td>' + (admin ? '<input type="date" data-fact="' + f.id + '" data-k="expires" value="' + f.expires + '">' : f.expires) + (exp ? '<br><span class="chip" style="color:var(--major)">expired</span>' : '') + '</td><td>' + esc(f.owner || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    } else if (t === 'terms') {
      h += '<div class="tw"><table><thead><tr><th>Avoid</th><th>Prefer</th><th>Type</th><th>Severity</th><th>Reason</th><th></th></tr></thead><tbody>' + k.terms.map(function (x) { return '<tr><td>' + esc(x.avoid) + '</td><td>' + esc(x.prefer || '') + '</td><td>' + CAT[x.category] + '</td><td>' + x.severity + '</td><td>' + esc(x.reason) + '</td><td>' + (admin ? '<button class="btn sm danger" data-act="delt" data-id="' + x.id + '">Delete</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      if (admin) h += '<div class="card grid" style="margin-top:14px;max-width:720px"><h3>Add a term</h3><div class="row"><input type="text" id="t-avoid" placeholder="Avoid" style="flex:1"><input type="text" id="t-prefer" placeholder="Prefer" style="flex:1"></div><div class="row"><select id="t-cat" style="flex:1"><option value="terminology">Terminology</option><option value="language">Language</option><option value="tone">Tone</option><option value="facts">Retired or outdated name</option></select><select id="t-sev" style="flex:1"><option>minor</option><option>major</option></select></div><input type="text" id="t-why" placeholder="Reason shown to writers"><div><button class="btn primary" data-act="addt">Add term</button></div></div>';
    } else if (t === 'claims') {
      h += '<h3>Approved evidence</h3><p class="muted" style="margin:4px 0 10px">Superlatives inside these exact phrases are allowed while the evidence is current.</p><div class="list">' + k.approvedClaims.map(function (c) { return '<div class="item" style="grid-template-columns:1fr auto;cursor:default"><div><b>' + esc(c.phrase) + '</b><div class="meta"><span>' + esc(c.id) + '</span><span>' + esc(c.source) + '</span><span>valid until ' + esc(c.expires) + '</span></div></div>' + (admin ? '<button class="btn sm danger" data-act="delc" data-id="' + c.id + '">Delete</button>' : '') + '</div>'; }).join('') + '</div>';
      if (admin) h += '<div class="card grid" style="margin-top:14px;max-width:720px"><h3>Add evidence</h3><input type="text" id="c-phrase" placeholder="Exact approved phrase"><input type="text" id="c-src" placeholder="Source document"><input type="date" id="c-exp"><div><button class="btn primary" data-act="addc">Add evidence</button></div></div>';
      h += '<h3 style="margin-top:22px">Competitors (comparison needs Legal)</h3><p class="mono" style="margin-top:6px">' + esc(k.competitors.join(', ')) + '</p><h3 style="margin-top:18px">Confidential names</h3><p class="mono" style="margin-top:6px">' + (role === 'creator' ? '••••••  (visible to managers, reviewers and admins)' : esc(k.confidentialTerms.join(', '))) + '</p>';
    } else if (t === 'assets') {
      h += '<h3>Colour palette</h3><div class="row" style="margin:10px 0 18px">' + k.palette.map(function (p) { return '<div class="card" style="padding:10px;width:150px"><span class="sw" style="width:100%;height:44px;display:block;background:' + p.hex + '"></span><b>' + esc(p.name) + '</b><div class="mono muted">' + p.hex + '</div><div class="muted">' + esc(p.role) + '</div></div>'; }).join('') + '</div><h3>Fonts</h3><p style="margin:6px 0 18px">' + esc(k.fonts.join(', ')) + '</p><h3>Image rules</h3><p class="muted" style="margin-top:6px">Minimum width ' + k.image.minWidth + ' px · max ' + Math.round(k.image.maxBytes / 1024) + ' KB · ratios ' + k.image.ratios.map(function (r) { return r.n; }).join(', ') + '</p>';
    } else {
      h += '<div class="card grid" style="max-width:820px"><h3>Export</h3><p class="muted">The whole brand kit as JSON. Select and copy it; version it in your own repository.</p><textarea id="kit-out" rows="8" readonly>' + esc(JSON.stringify(k, null, 1)) + '</textarea><div class="row"><button class="btn" data-act="copykit">Copy to clipboard</button></div></div>';
      if (admin) h += '<div class="card grid" style="max-width:820px;margin-top:14px"><h3>Import</h3><p class="muted">Paste a brand kit JSON or choose a file. It replaces the current kit after validation.</p><input type="file" id="kit-file" accept=".json,application/json"><textarea id="kit-in" rows="6" placeholder="{ &quot;guidelines&quot;: [...], &quot;facts&quot;: [...], ... }"></textarea><div class="row"><button class="btn primary" data-act="importkit">Validate and import</button><button class="btn danger" data-act="resetdemo">Reset all demo data</button></div></div>';
    }
    return h;
  }

  // ----- about -----
  function viewAbout() {
    var ev = []; state.contents.forEach(function (c) { c.history.forEach(function (e) { ev.push({ at: e.at, by: e.by, text: e.text, t: c.title }); }); });
    ev.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return '<div class="page-head"><div><h1>Trust, AI disclosure and audit</h1><p>What BrandGuard does with your content, which services it uses, and a record of what people decided.</p></div></div><div class="grid g2"><div class="card prose"><h3>AI and external services</h3><p style="margin-top:8px"><b>This build makes no network requests with your content and calls no AI model.</b> Every finding comes from deterministic rules and your own brand library, so each result can be explained and repeated.</p><ul><li>Review engine: plain JavaScript in this page (<span class="mono">engine.js</span>).</li><li>Suggestions: rule-generated replacements, never auto-applied. Writers choose.</li><li>Image checks: size, ratio and colour sampling with the browser canvas, on your device.</li><li>Storage: your browser\'s local storage. Clearing site data removes it.</li><li>Fonts: loaded from Google Fonts for display only. No content is sent.</li></ul><p>If an organisation adds an AI model for rewriting or document understanding, it should appear here with its provider and data-retention terms, run only on non-confidential text unless approved, and mark every AI-written suggestion as such.</p></div>' +
      '<div class="card prose"><h3>Human control</h3><ul><li><b>Creators</b> write, apply or dismiss suggestions, and submit. Dismissing a major finding needs a written reason.</li><li><b>Managers</b> approve or request changes. They cannot approve their own content.</li><li><b>Reviewers</b> (Legal, Brand) are required when claims, facts or confidentiality are involved. Only they can waive a blocker.</li><li><b>Admins</b> maintain the brand library and publish approved items.</li><li>Approvals are tied to one version. Editing resets them.</li><li>Confidential guidelines and codenames are hidden from Creators.</li></ul><p class="muted">This demo lets you switch role from the top bar. A production deployment needs real sign-in and server-side enforcement.</p></div></div>' +
      '<div class="card" style="margin-top:16px"><h3>Audit log</h3><div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>Content</th><th>Event</th></tr></thead><tbody>' + ev.slice(0, 40).map(function (e) { return '<tr><td>' + ago(e.at) + '</td><td>' + esc(user(e.by).name) + '</td><td>' + esc(e.t) + '</td><td>' + esc(e.text) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="card prose" style="margin-top:16px"><h3>Limits you should know</h3><ul><li>Rules catch what the brand library describes. They do not judge truth beyond approved facts or understand context such as irony.</li><li>Image checks cannot see what a picture shows. A human still judges composition, logo use and people.</li><li>Heuristic findings (reading level, pillars, image palette) show a lower confidence and are easy to dismiss with a reason. Those reasons feed the unclear-guideline insight.</li><li>HTML contrast is checked only where text and background colours appear together in the same style.</li></ul></div>';
  }

  // ---------- events ----------
  function selectedFinding(key) { var c = cnt(ui.id); return c && reviewOf(c, ui.editing ? ui.draft : null).findings.filter(function (f) { return f.key === key; })[0]; }
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), c = cnt(ui.id), key = el.getAttribute('data-key'), f;
    switch (a) {
      case 'nav': ui.view = el.getAttribute('data-v'); if (el.getAttribute('data-lt')) ui.libTab = el.getAttribute('data-lt'); ui.editing = false; ui.pending = null; try { history.replaceState(null, '', '#' + ui.view); } catch (e) { } render(); window.scrollTo(0, 0); break;
      case 'filter': ui.filter = el.getAttribute('data-f'); render(); break;
      case 'open': ui.view = 'content'; ui.id = el.getAttribute('data-id'); ui.tab = 'content'; ui.editing = false; ui.pending = null; ui.diffV = null; render(); window.scrollTo(0, 0); break;
      case 'newc': ui.view = 'new'; render(); break;
      case 'create': createContent(); break;
      case 'tab': ui.tab = el.getAttribute('data-t'); render(); break;
      case 'libtab': ui.libTab = el.getAttribute('data-t'); render(); break;
      case 'edit': ui.editing = true; ui.draft = latest(c).body; render(); break;
      case 'canceledit': ui.editing = false; render(); break;
      case 'savever': if (ui.draft === latest(c).body) { toast('No changes to save'); break; } newVersion(c, ui.draft, 'Edited'); ui.editing = false; save(); toast('Saved as v' + latest(c).v); render(); break;
      case 'jump': var card = document.querySelector('[data-fkey="' + CSS.escape(key) + '"]'); if (card) { card.scrollIntoView({ block: 'center', behavior: 'smooth' }); card.classList.add('flash'); setTimeout(function () { card.classList.remove('flash'); }, 1400); } break;
      case 'toggleres': ui.resolvedOpen = !ui.resolvedOpen; updatePanels(); break;
      case 'apply': f = selectedFinding(key); var inp = document.querySelector('[data-alt="' + CSS.escape(key) + '"]'); applyFinding(c, f, inp && inp.value); break;
      case 'dismiss': ui.pending = { key: key, kind: 'dismissed' }; updatePanels(); break;
      case 'waive': ui.pending = { key: key, kind: 'waived' }; updatePanels(); break;
      case 'cancelpend': ui.pending = null; updatePanels(); break;
      case 'confirmdec': f = selectedFinding(key); var rs = $('#reason').value.trim();
        if ((ui.pending.kind === 'waived' || f.severity === 'major') && !rs) { toast('A reason is required'); break; }
        decide(c, f, ui.pending.kind, rs); ui.pending = null; refreshStatus(c); save(); render(); break;
      case 'reopenf': delete c.decisions[key]; hist(c, 'Reopened a finding'); refreshStatus(c); save(); render(); break;
      case 'unclear': f = selectedFinding(key); logOutcome(c, f, 'open', true); toast('Thanks. The brand team will see this in Insights.'); save(); break;
      case 'cmfor': ui.tab = 'discussion'; ui.cmFinding = key; render(); setTimeout(function () { var t = $('#cmt'); t && t.focus(); }, 0); break;
      case 'comment': var tx = $('#cmt').value.trim(); if (!tx) break; c.comments.push({ id: uid('k'), by: state.me, at: new Date().toISOString(), text: tx, findingKey: ui.cmFinding || null }); ui.cmFinding = null; hist(c, 'Commented'); save(); render(); break;
      case 'submit': var g = E.gate(reviewOf(c).findings, c.decisions); if (!g.ok) break; c.status = 'in_review'; hist(c, 'Submitted for review (v' + latest(c).v + ')'); refreshStatus(c); save(); toast('Submitted. ' + requiredRoles(c).roles.map(function (r) { return ROLE[r]; }).join(' and ') + ' approval needed.'); render(); break;
      case 'withdraw': c.status = 'draft'; hist(c, 'Withdrew from review'); save(); render(); break;
      case 'approve': case 'reqchg': var role = myApprovalRole(c), note = ($('#apnote') || {}).value || '';
        if (a === 'reqchg' && !note.trim()) { toast('Add a note so the author knows what to change'); break; }
        c.approvals.push({ by: state.me, role: role, decision: a === 'approve' ? 'approved' : 'changes', note: note, at: new Date().toISOString(), version: latest(c).v });
        hist(c, a === 'approve' ? 'Approved as ' + role : 'Requested changes'); if (a === 'reqchg') c.comments.push({ id: uid('k'), by: state.me, at: new Date().toISOString(), text: note });
        c.status = 'in_review'; refreshStatus(c); save(); toast(a === 'approve' ? 'Approval recorded' : 'Changes requested'); render(); break;
      case 'publish': var rr = reviewOf(c), gg = E.gate(rr.findings, c.decisions); if (!gg.ok) { toast('New blockers appeared since approval. Publish stopped.'); break; } c.status = 'published'; hist(c, 'Published'); save(); toast('Published (simulated)'); render(); break;
      case 'reopen': c.status = 'draft'; hist(c, 'Reopened as draft'); save(); render(); break;
      case 'diffv': ui.diffV = +el.getAttribute('data-v'); render(); break;
      case 'restore': var rv = c.versions[+el.getAttribute('data-v') - 1]; newVersion(c, rv.body, 'Restored v' + rv.v); save(); render(); break;
      case 'clearsample': state.log = state.log.filter(function (x) { return !x.sample; }); save(); render(); break;
      case 'delg': state.kit.guidelines = state.kit.guidelines.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); save(); render(); break;
      case 'addg': var gi = $('#g-id').value.trim(), gt = $('#g-title').value.trim(); if (!gi || !gt) { toast('ID and title are required'); break; } if (state.kit.guidelines.some(function (x) { return x.id === gi; })) { toast('That ID exists'); break; } state.kit.guidelines.push({ id: gi, section: $('#g-sec').value || 'General', title: gt, text: $('#g-text').value, confidential: $('#g-conf').checked }); save(); render(); break;
      case 'delt': state.kit.terms = state.kit.terms.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); save(); render(); break;
      case 'addt': var av = $('#t-avoid').value.trim(); if (!av) { toast('Enter the term to avoid'); break; } var pr = $('#t-prefer').value.trim(); state.kit.terms.push({ id: 'x' + (++state.seq), pattern: '\\b' + av.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', avoid: av, prefer: pr || null, category: $('#t-cat').value, severity: $('#t-sev').value, guideline: 'G-TERM-1', reason: $('#t-why').value || 'Custom term added by an admin.', guidance: pr ? '' : 'Rephrase this.' }); save(); toast('Term added. It applies immediately.'); render(); break;
      case 'delc': state.kit.approvedClaims = state.kit.approvedClaims.filter(function (x) { return x.id !== el.getAttribute('data-id'); }); save(); render(); break;
      case 'addc': var ph = $('#c-phrase').value.trim(); if (!ph) { toast('Enter the approved phrase'); break; } state.kit.approvedClaims.push({ id: 'EV-' + (++state.seq), phrase: ph, source: $('#c-src').value || 'Unspecified', expires: $('#c-exp').value || '2099-12-31' }); save(); render(); break;
      case 'copykit': var ta = $('#kit-out'); ta.select(); try { navigator.clipboard.writeText(ta.value).then(function () { toast('Copied'); }, function () { toast('Press Ctrl+C to copy'); }); } catch (e) { toast('Press Ctrl+C to copy'); } break;
      case 'importkit': importKit($('#kit-in').value); break;
      case 'resetdemo': state = fresh(); save(); ui.view = 'queue'; toast('Demo data restored'); render(); break;
    }
  });
  function importKit(txt) {
    try {
      var k = JSON.parse(txt), need = ['guidelines', 'facts', 'terms', 'palette'];
      need.forEach(function (n) { if (!Array.isArray(k[n])) throw new Error('"' + n + '" must be a list'); });
      ['claims', 'approvedClaims', 'competitors', 'confidentialTerms', 'requirements', 'pillars', 'fonts', 'acronyms'].forEach(function (n) { if (!Array.isArray(k[n])) k[n] = []; });
      k.settings = k.settings || clone(S.kit.settings); k.image = k.image || clone(S.kit.image); state.kit = k; save(); toast('Brand kit imported: ' + k.guidelines.length + ' guidelines, ' + k.facts.length + ' facts'); render();
    } catch (e) { toast('Import failed: ' + e.message); }
  }
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.getAttribute('data-chg');
    if (c === 'who') { state.me = t.value; ui.editing = false; ui.pending = null; save(); render(); }
    else if (c === 'newfmt') { var tt = $('#n-title').value, bb = ($('#n-body') || {}).value; ui.newFmt = t.value; render(); $('#n-title').value = tt; if (bb && $('#n-body')) $('#n-body').value = bb; }
    else if (t.id === 'n-file' && t.files[0]) { var fr = new FileReader(), fl = t.files[0]; fr.onload = function () { $('#n-body').value = fr.result; var n = fl.name.toLowerCase(); ui.newFmt = /\.html?$/.test(n) ? 'html' : /\.(md|markdown)$/.test(n) ? 'markdown' : 'text'; $('#n-fmt').value = ui.newFmt; if (!$('#n-title').value) $('#n-title').value = fl.name.replace(/\.[^.]+$/, ''); }; fr.readAsText(fl); }
    else if (t.id === 'kit-file' && t.files[0]) { var fr2 = new FileReader(); fr2.onload = function () { $('#kit-in').value = fr2.result; }; fr2.readAsText(t.files[0]); }
    else if (t.getAttribute('data-fact')) { var fa = state.kit.facts.filter(function (x) { return x.id === t.getAttribute('data-fact'); })[0], kk = t.getAttribute('data-k'); fa[kk] = kk === 'value' ? parseFloat(t.value) : t.value; save(); toast('Fact updated. New reviews use it immediately.'); }
  });
  document.addEventListener('input', function (ev) { if (ev.target.getAttribute('data-inp') === 'draft') { ui.draft = ev.target.value; var c = cnt(ui.id), r = reviewOf(c, ui.draft); $('#scorebar').innerHTML = scorebar(r); var ae = document.activeElement; $('#side').innerHTML = sideHtml(c); updateDirty(); if (ae && ae.id === 'editor') ae.focus(); } });
  document.addEventListener('keydown', function (ev) { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('mark.m')) { ev.preventDefault(); ev.target.click(); } });
  window.addEventListener('hashchange', function () { var t = location.hash.slice(1); if (['queue', 'insights', 'library', 'about'].indexOf(t) > -1 && t !== ui.view) { ui.view = t; render(); } });
  var h0 = location.hash.slice(1); if (['queue', 'insights', 'library', 'about'].indexOf(h0) > -1) ui.view = h0;
  render();
  window.__bg = { state: function () { return state; }, ui: ui };
})();
