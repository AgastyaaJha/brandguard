const test = require('node:test');
const assert = require('node:assert');
const E = require('../src/engine.js');
const S = require('../src/seed.js');
const TODAY = '2026-10-23';
const run = (body, format = 'text', channel = 'web', imageMeta) => E.review({ body, format, channel, imageMeta }, S.kit, { today: TODAY });
const ids = r => r.findings.map(f => f.ruleId);
const has = (r, id) => r.findings.some(f => f.ruleId === id);

test('clean copy produces no blockers or majors', () => {
  const r = run(S.contents(TODAY)[3].versions[1].body);
  assert.deepStrictEqual(r.findings.filter(f => ['blocker', 'major'].includes(f.severity)), []);
  assert.ok(r.score >= 95);
});

test('terminology: users -> customers keeps plural and case', () => {
  const r = run('Our users love it. Users save money.');
  const fs = r.findings.filter(f => f.ruleId === 'term.users');
  assert.strictEqual(fs.length, 2);
  assert.strictEqual(fs[0].fix.text, 'customers');
  assert.strictEqual(fs[1].fix.text, 'Customers');
});

test('retired product name is a major fact issue with source', () => {
  const f = run('Buy Lumio Pro today.').findings.find(x => x.ruleId === 'term.pro');
  assert.strictEqual(f.severity, 'major');
  assert.strictEqual(f.source.id, 'G-NAME-1');
  assert.strictEqual(E.applyFix('Buy Lumio Pro today.', f), 'Buy Lumio Plus today.');
});

test('unsupported figures are compared with approved facts', () => {
  const body = 'Over 50,000 customers cut bills by 40% and Lumio Hub costs $99.';
  const r = run(body);
  const c = r.findings.find(f => f.ruleId === 'fact.F-CUST');
  assert.strictEqual(E.applyFix(body, c), body.replace('50,000', '42,000'));
  const s = r.findings.find(f => f.ruleId === 'fact.F-SAVE');
  assert.match(E.applyFix(body, s), /an average of 18% bills|an average of 18%/);
  const p = r.findings.find(f => f.ruleId === 'fact.F-PRICE');
  assert.match(E.applyFix(body, p), /\$149/);
  assert.ok(has(r, 'msg.disclaimer.F-SAVE'));
});

test('superlatives are flagged unless covered by approved evidence', () => {
  assert.ok(has(run('The best hub on the market.'), 'claim.the-best'));
  assert.ok(!has(run('Winner of Best Energy Hub 2025 at the Home Tech Awards.'), 'claim.the-best'));
});

test('guarantees and competitors are caught', () => {
  const r = run('Guaranteed savings, better than Nest.');
  assert.ok(has(r, 'claim.guarantee'));
  const c = r.findings.find(f => f.ruleId === 'claim.competitor');
  assert.strictEqual(c.severity, 'blocker');
});

test('confidential codenames and emails block publication', () => {
  const r = run('Project Aurora ships soon. Mail jon@gmail.com. Internal only.');
  assert.ok(has(r, 'conf.codename') && has(r, 'conf.email') && has(r, 'conf.marker'));
  assert.strictEqual(E.gate(r.findings, {}).ok, false);
});

test('tone: exclamation limit, caps, hype', () => {
  const r = run('Wow!!! This is AMAZING! Great!');
  assert.ok(has(r, 'tone.exclaim') && has(r, 'tone.caps') && has(r, 'term.amazing'));
});

test('brand name casing ignores URLs and emails', () => {
  assert.ok(has(run('Meet LUMIO and lumio today.'), 'brand.name-case'));
  assert.ok(!has(run('Visit lumio.example or hello@lumio.example'), 'brand.name-case'));
});

test('required legal lines are suggested as appends', () => {
  const body = 'Every device has a 3-year warranty.';
  const f = run(body).findings.find(x => x.ruleId === 'msg.warranty-terms');
  assert.match(E.applyFix(body, f), /warranty terms/);
  assert.ok(has(run('Hello', 'text', 'email'), 'msg.unsubscribe'));
  assert.ok(!has(run('Hello', 'text', 'web'), 'msg.unsubscribe'));
});

test('html: contrast, fonts, palette, alt, link text, heading order', () => {
  const html = '<h1 style="font-family:Comic Sans MS;color:#9CB4FF;background:#fff">Hi</h1><h3>x</h3><img src="a.png"><a href="#">Click here</a><p style="color:#FF2D95">z</p>';
  const r = run(html, 'html');
  ['a11y.contrast', 'visual.font', 'a11y.alt-missing', 'a11y.link-text', 'a11y.heading-order', 'visual.off-palette'].forEach(id => assert.ok(has(r, id), id));
  const c = r.findings.find(f => f.ruleId === 'a11y.contrast');
  const fixed = E.applyFix(html, c);
  assert.ok(E.contrast(E.parseColor(c.fix.text), [255, 255, 255]) >= 4.5);
  assert.ok(fixed.includes(c.fix.text));
  const alt = r.findings.find(f => f.ruleId === 'a11y.alt-missing');
  assert.match(E.applyFix(html, alt, 'A hub on a wall'), /<img alt="A hub on a wall" src="a.png">/);
});

test('markdown checks', () => {
  const r = run('# A\n\n#### B\n\n![](x.png) [click here](https://x.test)', 'markdown');
  assert.ok(has(r, 'a11y.heading-order') && has(r, 'a11y.alt-missing') && has(r, 'a11y.link-text'));
});

test('social length and hashtags', () => {
  const r = run('Hello #energysavingtips #a #b #c', 'text', 'social');
  assert.ok(has(r, 'a11y.hashtag-case') && has(r, 'msg.hashtags'));
});

test('image metadata rules', () => {
  const r = run('Caption', 'image', 'web', { width: 1000, height: 563, bytes: 950000, alt: '', colors: [{ hex: '#E0457B', share: 0.4 }] });
  ['a11y.alt-missing', 'visual.resolution', 'visual.size', 'visual.image-palette'].forEach(id => assert.ok(has(r, id), id));
  assert.ok(!has(r, 'visual.ratio'));
});

test('expired approved facts are surfaced', () => {
  assert.ok(has(run('We serve 6 countries.'), 'fact.F-COUNTRY.expired'));
});

test('policy: waiving needed for blockers; reviewer required for risky content', () => {
  const r = run('Better than Nest.');
  const b = r.findings.find(f => f.severity === 'blocker');
  assert.strictEqual(E.gate(r.findings, { [b.key]: { state: 'dismissed' } }).ok, false);
  assert.strictEqual(E.gate(r.findings, { [b.key]: { state: 'waived' } }).blockers.length, 0);
  assert.deepStrictEqual(E.approvalPolicy(r.findings, {}).roles, ['manager', 'reviewer']);
  assert.deepStrictEqual(E.approvalPolicy(run('Hello there.').findings, {}).roles, ['manager']);
});

test('applying all fixes repeatedly converges (no endless loop)', () => {
  let body = S.contents(TODAY)[0].versions[0].body;
  for (let i = 0; i < 30; i++) {
    const f = run(body, 'text', 'social').findings.find(x => x.fix && !x.fix.input);
    if (!f) break;
    body = E.applyFix(body, f);
  }
  const left = run(body, 'text', 'social').findings.filter(x => x.fix && !x.fix.input);
  assert.strictEqual(left.length, 0, body);
});

test('diff', () => {
  const d = E.diffWords('a b c', 'a x c');
  assert.deepStrictEqual(d.map(x => x.t), ['eq', 'del', 'ins', 'eq']);
});
