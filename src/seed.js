/* Demo data for "Lumio", a fictional smart-home energy company.
 * Everything here is sample data. Replace it via Brand Library > Import. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BrandSeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var kit = {
    brand: 'Lumio',
    settings: { maxExclaim: 1, maxEmoji: 2, minReadingEase: 50, maxSentenceWords: 28, publicEmailDomains: ['lumio.example'] },
    guidelines: [
      { id: 'G-TONE-1', section: 'Voice', title: 'Warm, clear, confident', text: 'We sound like a knowledgeable neighbour: warm, plain-spoken and confident. We never shout or hype. Use at most one exclamation mark and two emoji per piece.' },
      { id: 'G-TONE-2', section: 'Voice', title: 'Plain language', text: 'Write at a reading ease of 50 or higher. Keep sentences under 28 words. Prefer everyday words to jargon.' },
      { id: 'G-TERM-1', section: 'Terminology', title: 'Approved terminology', text: 'Call the people who use Lumio "customers" (or "households" for energy topics), never "users". Say "device", not "gadget". Say "affordable", not "cheap".' },
      { id: 'G-NAME-1', section: 'Terminology', title: 'Brand and product names', text: 'The company is "Lumio". Products are "Lumio Hub" and "Lumio Plus". "Lumio Pro" was retired in March 2025 and replaced by Lumio Plus. "Lumio Classic" was retired in 2024 and replaced by Lumio Hub.' },
      { id: 'G-CLAIM-1', section: 'Claims', title: 'Superlatives need evidence', text: 'Words such as "best", "#1", "fastest" or "world-class" may only be used when the Evidence Library holds a current proof point. Otherwise describe a specific benefit.' },
      { id: 'G-CLAIM-2', section: 'Claims', title: 'No absolute promises', text: 'Never promise outcomes. Avoid "guaranteed", "risk-free" and "never fails". Point to the 3-year warranty instead.' },
      { id: 'G-CLAIM-3', section: 'Claims', title: 'Savings claims', text: 'Only use the approved savings figure (average 18% lower energy bills, 2025 customer study, n=3,100) and always add "Based on our 2025 customer study. Individual results vary."' },
      { id: 'G-CLAIM-4', section: 'Claims', title: 'No competitor comparisons', text: 'Never name or compare with competitors in published content unless Legal has approved it in writing.' },
      { id: 'G-VIS-1', section: 'Visual', title: 'Colour palette', text: 'Use Lumio Blue #1F4BFF, Midnight #0E1A3A, Sun #FFB400, Mist #F2F5FB, Ink #1A1A1A and Mint #1F9E7F. Neutral greys are allowed. Photography should sit comfortably inside this palette.' },
      { id: 'G-VIS-2', section: 'Visual', title: 'Typography', text: 'Headlines and body use Inter. Long-form editorial may use Source Serif 4. No other typefaces.' },
      { id: 'G-VIS-3', section: 'Visual', title: 'Imagery specifications', text: 'Hero images are at least 1200px wide, at 16:9, 4:5, 1:1 or 1.91:1, and under 800 KB.' },
      { id: 'G-ACC-1', section: 'Accessibility', title: 'Alternative text', text: 'Every informative image has alt text that describes its content and purpose. Decorative images use an empty alt with role="presentation".' },
      { id: 'G-ACC-2', section: 'Accessibility', title: 'Colour contrast', text: 'Text must meet WCAG 2.2 AA contrast of 4.5:1 (3:1 for large text).' },
      { id: 'G-ACC-3', section: 'Accessibility', title: 'Links and headings', text: 'Link text describes its destination. Never use "click here". Headings descend one level at a time.' },
      { id: 'G-ACC-4', section: 'Accessibility', title: 'No all-caps text', text: 'Avoid blocks of capital letters. Use bold for emphasis.' },
      { id: 'G-ACC-5', section: 'Accessibility', title: 'Social accessibility', text: 'Write multi-word hashtags in CamelCase so screen readers can pronounce them.' },
      { id: 'G-CONF-1', section: 'Confidentiality', title: 'Unreleased work and internal data', text: 'Codenames: Project Aurora, Helios, Nightingale. Never publish roadmap dates, internal pricing, credentials or text marked internal. Visible to Managers, Reviewers and Admins only.', confidential: true },
      { id: 'G-LEGAL-1', section: 'Legal', title: 'Offer and warranty terms', text: 'Any mention of a warranty must point to the warranty terms. Any "free" offer must say that terms apply.' },
      { id: 'G-LEGAL-2', section: 'Legal', title: 'Email compliance', text: 'Every marketing email includes an unsubscribe line.' },
      { id: 'G-MSG-1', section: 'Messaging', title: 'Message pillars', text: 'Long-form content supports at least one pillar: Comfort, Control, Savings or Simplicity. Social posts stay under 280 characters with at most 3 hashtags.' }
    ],
    facts: [
      { id: 'F-CUST', label: 'Customer base', type: 'cap', value: 42000, statement: 'More than 42,000 households use Lumio.', asOf: '2026-09-30', expires: '2027-03-31', source: 'Finance monthly report, Sep 2026', owner: 'Finance',
        regexes: [{ re: '(\\d[\\d,]*(?:\\.\\d+)?)([kK])?\\+?\\s+(?:happy\\s+)?(?:customers|households|homes|families|users)\\b', num: 1, suffix: 2 }] },
      { id: 'F-SAVE', label: 'Average savings', type: 'savings', value: 18, statement: 'Customers see an average 18% lower energy bills (2025 customer study, n=3,100).', asOf: '2026-01-15', expires: '2027-01-15', source: '2025 customer study', owner: 'Insights',
        disclaimer: { require: 'results vary|individual results|may vary', append: 'Based on our 2025 customer study. Individual results vary.' },
        regexes: [
          { re: '(\\d{1,3})\\s?%[^.!?\\n]{0,40}?\\b(?:savings?|save|lower|less|reduction|cut|off)\\b', num: 1 },
          { re: '\\b(?:save|saves|saving|cut|cuts|reduce|reduced|lower|lowered|slash(?:ed)?)\\b[^.!?\\n%]{0,40}?(\\d{1,3})\\s?%', num: 1 },
          { re: '\\b(?:cut|slash|halve)[^.!?\\n]{0,30}?\\bin half\\b|\\bhalve\\b', constant: 50 }] },
      { id: 'F-FOUND', label: 'Founding year', type: 'exact', value: 2018, statement: 'Lumio was founded in 2018.', asOf: '2026-01-01', expires: '2030-01-01', source: 'Company register', owner: 'Legal',
        regexes: [{ re: '\\b(?:founded|established)\\s+(?:in\\s+)?(\\d{4})\\b', num: 1 }] },
      { id: 'F-PRICE', label: 'Recommended retail price', type: 'price', products: { hub: 149, plus: 229 }, statement: 'Lumio Hub $149, Lumio Plus $229.', asOf: '2026-08-01', expires: '2027-02-01', source: 'Price list Aug 2026', owner: 'Product Marketing',
        regexes: [{ re: 'Lumio\\s+(Hub|Plus)\\b[^.!?\\n]{0,40}?\\$\\s?(\\d[\\d,]*(?:\\.\\d{2})?)', prod: 1, num: 2 }] },
      { id: 'F-WARR', label: 'Warranty length', type: 'exact', value: 3, statement: 'Every Lumio device has a 3-year warranty.', asOf: '2026-01-01', expires: '2028-01-01', source: 'Warranty policy v4', owner: 'Legal',
        regexes: [{ re: '\\b(\\d+)[- ]year\\s+(?:limited\\s+)?warranty\\b', num: 1 }] },
      { id: 'F-COUNTRY', label: 'Countries served', type: 'exact', value: 6, statement: 'Lumio is available in 6 countries.', asOf: '2025-12-01', expires: '2026-06-30', source: 'Sales ops, Dec 2025', owner: 'Sales Ops',
        regexes: [{ re: '\\b(\\d+)\\s+countries\\b', num: 1 }] }
    ],
    terms: [
      { id: 'users', pattern: '\\busers?\\b', avoid: 'user', prefer: 'customer', pluralize: true, category: 'terminology', severity: 'minor', guideline: 'G-TERM-1', reason: 'We call the people who use Lumio "customers".' },
      { id: 'cheap', pattern: '\\bcheap(?:er|est)?\\b', avoid: 'cheap', prefer: 'affordable', category: 'terminology', severity: 'minor', guideline: 'G-TERM-1', reason: '"Cheap" reads as low quality. We say "affordable".' },
      { id: 'gadget', pattern: '\\bgadgets?\\b', avoid: 'gadget', prefer: 'device', pluralize: true, category: 'terminology', severity: 'minor', guideline: 'G-TERM-1', reason: 'We say "device", not "gadget".' },
      { id: 'pro', pattern: '\\bLumio\\s+Pro\\b', avoid: 'Lumio Pro', prefer: 'Lumio Plus', category: 'facts', severity: 'major', guideline: 'G-NAME-1', reason: 'Lumio Pro was retired in March 2025. It is now Lumio Plus.' },
      { id: 'classic', pattern: '\\bLumio\\s+Classic\\b', avoid: 'Lumio Classic', prefer: 'Lumio Hub', category: 'facts', severity: 'major', guideline: 'G-NAME-1', reason: 'Lumio Classic was retired in 2024. It is now Lumio Hub.' },
      { id: 'utilize', pattern: '\\butili[sz]e[sd]?\\b', avoid: 'utilize', prefer: 'use', category: 'language', severity: 'minor', guideline: 'G-TONE-2', reason: 'Plain language: "use" beats "utilize".' },
      { id: 'leverage', pattern: '\\bleverage\\b', avoid: 'leverage', prefer: 'use', category: 'language', severity: 'minor', guideline: 'G-TONE-2', reason: 'Jargon. Say "use".' },
      { id: 'guys', pattern: '\\bguys\\b', avoid: 'guys', prefer: 'everyone', category: 'language', severity: 'minor', guideline: 'G-TONE-1', reason: 'Inclusive language: address everyone.' },
      { id: 'aipowered', pattern: '\\bAI[- ]powered\\b', avoid: 'AI-powered', prefer: 'adaptive', category: 'terminology', severity: 'minor', guideline: 'G-TERM-1', reason: 'We describe what the product does ("adaptive heating"), not the technology.' },
      { id: 'amazing', pattern: '\\bamazing\\b', avoid: 'amazing', prefer: 'effective', category: 'tone', severity: 'minor', guideline: 'G-TONE-1', reason: 'Hype words undercut our calm, confident voice.' },
      { id: 'incredible', pattern: '\\bincredible\\b', avoid: 'incredible', prefer: 'impressive', category: 'tone', severity: 'minor', guideline: 'G-TONE-1', reason: 'Hype words undercut our calm, confident voice.' },
      { id: 'gamechanging', pattern: '\\bgame[- ]chang(?:ing|er)\\b', avoid: 'game-changing', prefer: 'useful', category: 'tone', severity: 'minor', guideline: 'G-TONE-1', reason: 'Hype words undercut our calm, confident voice.' },
      { id: 'revolutionary', pattern: '\\brevolutionary\\b', avoid: 'revolutionary', prefer: 'new', category: 'tone', severity: 'minor', guideline: 'G-TONE-1', reason: 'Hype words undercut our calm, confident voice.' },
      { id: 'ultimate', pattern: '\\bultimate\\b', avoid: 'ultimate', prefer: 'complete', category: 'tone', severity: 'minor', guideline: 'G-TONE-1', reason: 'Hype words undercut our calm, confident voice.' }
    ],
    claims: [
      { id: 'best-ever', pattern: '\\b(?:the\\s+)?best\\s+([a-z\\- ]{1,30}?)\\s+ever\\b', prefer: 'a great $1', title: 'Unsupported superlative', severity: 'major', guideline: 'G-CLAIM-1', reason: '"Best ever" cannot be proven and there is no matching proof point in the Evidence Library.' },
      { id: 'the-best', pattern: '\\bthe\\s+best\\b', prefer: 'a strong', title: 'Unsupported superlative', severity: 'major', guideline: 'G-CLAIM-1', reason: '"The best" is a comparative claim with no proof point on file.' },
      { id: 'number-one', pattern: '#\\s?1\\b|\\bnumber\\s+(?:one|1)\\b|\\bno\\.\\s?1\\b', title: 'Unsupported ranking claim', severity: 'major', guideline: 'G-CLAIM-1', reason: 'Ranking claims need a named, current source.', guidance: 'Name the ranking, source and year, or describe a specific benefit instead.' },
      { id: 'worldclass', pattern: '\\bworld[- ]class\\b', prefer: 'high-quality', title: 'Unsupported superlative', severity: 'major', guideline: 'G-CLAIM-1', reason: '"World-class" has no proof point on file.' },
      { id: 'unbeatable', pattern: '\\bunbeatable\\b', prefer: 'competitive', title: 'Unsupported superlative', severity: 'major', guideline: 'G-CLAIM-1', reason: '"Unbeatable" is an absolute comparative claim.' },
      { id: 'leading', pattern: '\\b(?:market|industry)[- ]leading\\b|\\bbest[- ]in[- ]class\\b|\\b(?:fastest|cheapest|most (?:advanced|powerful|reliable|trusted))\\b', title: 'Unsupported superlative', severity: 'major', guideline: 'G-CLAIM-1', reason: 'Superlatives need a current proof point.', guidance: 'Replace with a specific, provable benefit.' },
      { id: 'guarantee', pattern: '\\bguarantee[ds]?\\b|\\brisk[- ]free\\b|\\bzero risk\\b|\\bnever\\s+(?:fails?|breaks?)\\b', title: 'Absolute promise', severity: 'major', guideline: 'G-CLAIM-2', reason: 'Absolute promises create legal exposure.', guidance: 'Use "designed to" or point to the 3-year warranty (and link to its terms).' }
    ],
    approvedClaims: [
      { id: 'EV-12', phrase: 'Best Energy Hub 2025', source: 'Home Tech Awards 2025 certificate', expires: '2027-01-01' }
    ],
    competitors: ['Nest', 'Ecobee', 'Hive', 'Tado'],
    confidentialTerms: ['Project Aurora', 'Helios', 'Nightingale'],
    requirements: [
      { id: 'warranty-terms', when: '\\bwarranty\\b', require: 'warranty terms|terms apply', append: 'See warranty terms at lumio.example/warranty.', title: 'Warranty terms link missing', reason: 'Any mention of a warranty must point to the warranty terms.', guideline: 'G-LEGAL-1', severity: 'major' },
      { id: 'free-terms', when: '\\bfree (?:trial|shipping|installation|delivery)\\b', require: '(?:terms|conditions) apply|T&Cs', append: 'Terms apply.', title: 'Offer terms missing', reason: 'Any "free" offer must say that terms apply.', guideline: 'G-LEGAL-1', severity: 'major' },
      { id: 'unsubscribe', channels: ['email'], when: '.', require: 'unsubscribe', append: 'You can unsubscribe at any time.', title: 'Unsubscribe line missing', reason: 'Every marketing email needs an unsubscribe line.', guideline: 'G-LEGAL-2', severity: 'major' }
    ],
    pillars: [
      { name: 'Comfort', keywords: ['comfort', 'warm', 'cosy', 'cozy', 'temperature'] },
      { name: 'Control', keywords: ['control', 'schedule', 'app', 'room'] },
      { name: 'Savings', keywords: ['sav', 'bill', 'cost', 'spend'] },
      { name: 'Simplicity', keywords: ['simple', 'easy', 'minutes', 'automatic'] }
    ],
    palette: [
      { name: 'Lumio Blue', hex: '#1F4BFF', role: 'Primary' }, { name: 'Midnight', hex: '#0E1A3A', role: 'Text and dark surfaces' },
      { name: 'Sun', hex: '#FFB400', role: 'Accent' }, { name: 'Mist', hex: '#F2F5FB', role: 'Background' },
      { name: 'Ink', hex: '#1A1A1A', role: 'Body text' }, { name: 'Mint', hex: '#1F9E7F', role: 'Success' }
    ],
    fonts: ['Inter', 'Source Serif 4'],
    acronyms: ['LED', 'USB', 'FAQ', 'HVAC', 'WIFI', 'API', 'USA', 'CEO', 'FAQS', 'PDF', 'NEW'],
    image: { minWidth: 1200, maxBytes: 800 * 1024, ratios: [{ n: '16:9', v: 16 / 9 }, { n: '4:5', v: 0.8 }, { n: '1:1', v: 1 }, { n: '1.91:1', v: 1.91 }] }
  };

  var users = [
    { id: 'u-priya', name: 'Priya Nair', role: 'creator', title: 'Content marketer' },
    { id: 'u-marcus', name: 'Marcus Webb', role: 'creator', title: 'Agency copywriter' },
    { id: 'u-anita', name: 'Anita Rao', role: 'manager', title: 'Marketing manager' },
    { id: 'u-daniel', name: 'Daniel Okoye', role: 'reviewer', title: 'Legal and brand reviewer' },
    { id: 'u-sam', name: 'Sam Ellis', role: 'admin', title: 'Brand governance admin' }
  ];

  function iso(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(today, n) { var d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString(); }

  function version(v, body, by, at, note, extra) { var o = { v: v, body: body, by: by, at: at, note: note }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }

  function contents(today) {
    var t = function (n) { return daysAgo(today, n); };
    return [
      { id: 'c-1', title: 'Winter launch social post', format: 'text', channel: 'social', authorId: 'u-priya', status: 'draft', created: t(1),
        versions: [version(1, 'Meet LUMIO Pro, the best smart hub ever!!! Over 50,000 users have cut their energy bills by 40%, guaranteed. Our smart home gadgets are amazing. Click here to learn more. Way better than Nest. #SmartHome #energysavingtips #Lumio #Sustainability', 'u-priya', t(1), 'First draft')],
        decisions: {}, comments: [{ id: 'k1', by: 'u-priya', at: t(1), text: 'Launch is Monday. Happy to cut anything that needs Legal.' }], approvals: [], history: [{ at: t(1), by: 'u-priya', text: 'Created draft' }] },
      { id: 'c-2', title: 'December newsletter feature', format: 'text', channel: 'email', authorId: 'u-marcus', status: 'in_review', created: t(4),
        versions: [version(1, 'Hi there,\n\nWinter is when heating costs climb. Lumio Plus learns how your household uses energy and adjusts your heating automatically, so you stay comfortable and spend less. Customers see an average 18% lower energy bills in our 2025 study.\n\nLumio Plus is $229, and we include free installation for the first 500 orders.\n\nSee how Lumio Plus works at lumio.example/plus.\n\nThe Lumio team', 'u-marcus', t(4), 'Draft from agency')],
        decisions: {}, comments: [{ id: 'k2', by: 'u-anita', at: t(2), text: 'Looks close. Can you check the savings line and the offer wording against the brand rules before Daniel sees it?' }], approvals: [], history: [{ at: t(4), by: 'u-marcus', text: 'Created draft' }, { at: t(3), by: 'u-marcus', text: 'Submitted for review (v1)' }] },
      { id: 'c-3', title: 'Spring landing page hero', format: 'html', channel: 'web', authorId: 'u-marcus', status: 'changes_requested', created: t(8),
        versions: [version(1, '<section style="background:#F2F5FB">\n<h1 style="font-family: Comic Sans MS, cursive; color:#1F4BFF">Spring clean your energy bill</h1>\n<h3>Lumio Hub keeps every room at the right temperature.</h3>\n<img src="hero.jpg">\n<p style="color:#9CB4FF; background:#FFFFFF">Order today and get a 3-year warranty. Founded in 2015, we have helped over 42,000 households.</p>\n<a href="/hub">Click here</a>\n<p style="color:#FF2D95">Lumio Hub from $129.</p>\n</section>', 'u-marcus', t(8), 'Agency first pass')],
        decisions: {}, comments: [{ id: 'k3', by: 'u-anita', at: t(5), text: 'Please run the automatic checks and fix what you can. The visuals are off-brand.' }], approvals: [{ by: 'u-anita', role: 'manager', decision: 'changes', note: 'Visuals off-brand. See comment.', at: t(5), version: 1 }], history: [{ at: t(8), by: 'u-marcus', text: 'Created draft' }, { at: t(7), by: 'u-marcus', text: 'Submitted for review (v1)' }, { at: t(5), by: 'u-anita', text: 'Requested changes' }] },
      { id: 'c-4', title: 'Lumio Hub product page copy', format: 'text', channel: 'web', authorId: 'u-priya', status: 'published', created: t(20),
        versions: [
          version(1, 'Lumio Hub helps you cut energy bills in half. Utilize 300 devices from one cheap, simple app.', 'u-priya', t(20), 'First draft'),
          version(2, 'Lumio Hub is the smart home hub that makes saving energy simple. It connects to more than 300 devices and shows your usage in one clear view. Lumio Hub is $149 and comes with a 3-year warranty. See warranty terms at lumio.example/warranty.', 'u-priya', t(18), 'Applied suggestions and rewrote opening')],
        decisions: {}, comments: [{ id: 'k4', by: 'u-daniel', at: t(17), text: 'Warranty link is there now. Approved from Legal.' }], approvals: [{ by: 'u-anita', role: 'manager', decision: 'approved', note: '', at: t(17), version: 2 }, { by: 'u-daniel', role: 'reviewer', decision: 'approved', note: 'Legal OK', at: t(17), version: 2 }],
        history: [{ at: t(20), by: 'u-priya', text: 'Created draft' }, { at: t(19), by: 'u-priya', text: 'Submitted for review (v1)' }, { at: t(19), by: 'u-anita', text: 'Requested changes' }, { at: t(18), by: 'u-priya', text: 'Saved v2' }, { at: t(17), by: 'u-anita', text: 'Approved as manager' }, { at: t(17), by: 'u-daniel', text: 'Approved as reviewer' }, { at: t(16), by: 'u-anita', text: 'Published' }] },
      { id: 'c-5', title: 'Behind the scenes blog teaser', format: 'markdown', channel: 'blog', authorId: 'u-marcus', status: 'draft', created: t(2),
        versions: [version(1, '## Behind the scenes\n\nWe are excited to share a sneak peek at Project Aurora, our next-generation controller. (Internal only: launch date 3 March.)\n\n#### What it means for you\n\n![](aurora.png)\n\nContact jon.martin@gmail.com for details or [click here](https://lumio.example/news).', 'u-marcus', t(2), 'Draft')],
        decisions: {}, comments: [], approvals: [], history: [{ at: t(2), by: 'u-marcus', text: 'Created draft' }] },
      { id: 'c-6', title: 'Kitchen hero image', format: 'image', channel: 'web', authorId: 'u-priya', status: 'draft', created: t(1),
        versions: [version(1, 'Family cooking in a sunlit kitchen with Lumio Plus on the wall.', 'u-priya', t(1), 'Uploaded',
          { imageMeta: { name: 'kitchen-hero.jpg', width: 1000, height: 563, bytes: 950000, alt: '', colors: [{ hex: '#E0457B', share: 0.38 }, { hex: '#F4EDE4', share: 0.3 }, { hex: '#2B2B2B', share: 0.2 }] }, thumb: null })],
        decisions: {}, comments: [], approvals: [], history: [{ at: t(1), by: 'u-priya', text: 'Uploaded image' }] }
    ];
  }

  // Sample governance history so Insights has something to show. Clearly labelled as sample data in the UI.
  function log(today) {
    var s = 7;
    function rnd() { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    var R = [
      ['term.users', 'Use "customer" instead of "user"', 'terminology', 22, 0.05, 0.0],
      ['claim.the-best', 'Unsupported superlative', 'claims', 16, 0.12, 0.05],
      ['a11y.alt-missing', 'Image has no alt text', 'accessibility', 18, 0.05, 0.0],
      ['tone.exclaim', 'Too many exclamation marks', 'tone', 14, 0.1, 0.0],
      ['fact.F-SAVE', 'Savings figure above approved figure', 'claims', 9, 0.05, 0.0],
      ['msg.disclaimer.F-SAVE', 'Required disclaimer missing', 'messaging', 10, 0.08, 0.1],
      ['tone.reading-ease', 'Reading level is high', 'language', 12, 0.62, 0.45],
      ['msg.pillars', 'No key message pillar found', 'messaging', 9, 0.7, 0.55],
      ['term.pro', 'Use "Lumio Plus" instead of "Lumio Pro"', 'facts', 8, 0.0, 0.0],
      ['visual.off-palette', 'Colour is not in the brand palette', 'visual', 9, 0.4, 0.3],
      ['visual.image-palette', 'Dominant colour is outside the brand palette', 'visual', 7, 0.55, 0.4],
      ['a11y.contrast', 'Low colour contrast', 'accessibility', 6, 0.05, 0.0],
      ['claim.competitor', 'Competitor named', 'claims', 4, 0.0, 0.0],
      ['conf.codename', 'Unreleased or confidential name', 'confidentiality', 3, 0.0, 0.0]
    ];
    var total = R.reduce(function (a, r) { return a + r[3]; }, 0), out = [], i;
    var authors = ['u-priya', 'u-marcus', 'u-marcus'];
    for (i = 0; i < 150; i++) {
      var x = rnd() * total, r = R[0], acc = 0;
      for (var j = 0; j < R.length; j++) { acc += R[j][3]; if (x <= acc) { r = R[j]; break; } }
      var age = Math.floor(Math.pow(rnd(), 0.8) * 56);
      var a = authors[Math.floor(rnd() * 3)];
      if (r[0].indexOf('a11y') === 0 || r[0] === 'visual.off-palette') a = rnd() < 0.7 ? 'u-marcus' : a;
      var o = rnd() < r[4] ? (r[0] === 'conf.codename' ? 'waived' : 'dismissed') : 'fixed';
      out.push({ at: daysAgo(today, age), ruleId: r[0], title: r[1], category: r[2], authorId: a, outcome: o, unclear: rnd() < r[5], sample: true });
    }
    return out.sort(function (p, q) { return p.at < q.at ? -1 : 1; });
  }

  return { kit: kit, users: users, contents: contents, log: log };
});
