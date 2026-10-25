# BrandGuard

Pre-publication brand governance. BrandGuard checks content against approved guidelines, facts and assets, explains every finding, suggests corrections that keep the writer's intent, and routes the result through a role-based approval workflow. Insights show repeated mistakes and where the guidelines themselves are unclear.

The demo brand is **Lumio**, a fictional smart-home energy company. All data is sample data.

## Run it

```
npm run build        # writes dist/index.html (artifact) and dist/standalone.html
open dist/standalone.html     # no server needed
npm test             # 18 engine tests (node:test, zero dependencies)
python3 test/smoke.py         # headless-browser end-to-end check (needs playwright + chromium)
```

## Try this (3 minutes)

1. As **Priya (Creator)** open *Winter launch social post*. It has 20+ findings: a retired product name, an overstated customer count and savings figure, a guarantee, a competitor, hype, a missing disclaimer. Click *Apply* on a few. Each creates a new version; see the diff under *Versions*.
2. Submit is blocked by the competitor blocker. Switch to **Daniel (Reviewer)** and waive it with a reason, or leave it and see that Creators cannot.
3. Open *Spring landing page hero* (HTML): contrast, off-palette colour, wrong font, missing alt text, skipped heading. Add alt text inline.
4. Open *Kitchen hero image*: size, ratio, off-palette dominant colour, missing alt. Upload your own image via *New content*.
5. As **Marcus**, withdraw *December newsletter*, apply fixes, submit. As **Anita (Manager)** approve. Legal claims would also require **Daniel**.
6. **Insights** shows recurring issues, a weekly trend, and guidelines that writers keep overriding ("Guideline unclear").
7. **Brand library** (as Sam, Admin): edit a fact's value or add a term. The next review uses it immediately.

## What is covered

| Brief requirement | Where |
|---|---|
| Import/define guidelines, facts, terminology, assets | Brand library: guidelines, approved facts (with owner and expiry), terminology, approved evidence, palette/fonts/image rules, JSON import/export |
| Text, HTML, Markdown, images | Paste or import .txt/.md/.html, upload png/jpg/webp/svg |
| Tone, language, facts, claims, visual, accessibility | `src/engine.js`, 40+ rules, see ARCHITECTURE.md |
| Explain and cite source | Each finding: why, source guideline or fact with quote, method, confidence |
| Suggest without overriding | Suggestions are shown as before/after and applied only by a person; each says how intent is preserved |
| Comments, approvals, history, roles | Creator / Manager / Reviewer / Admin, per-version approvals, diff, audit log |
| Recurring problems and unclear guidelines | Insights page |
| Confidentiality and AI disclosure | Local-only processing, confidential codename and secret detection, confidential guidelines hidden from Creators, *Trust and audit* page |

## Limits (stated honestly)

- Demo roles are a dropdown. A real deployment needs sign-in and server-side permission checks.
- State is in browser local storage. There is no shared backend in this build, so two people do not see each other's changes.
- No LLM is used. This keeps results repeatable and private, but it cannot judge meaning beyond the rules. See *Roadmap* in ARCHITECTURE.md.
- .docx and .pdf import are not implemented.
- Image analysis measures size, ratio and colour only. It cannot recognise logos or content.

See `docs/ARCHITECTURE.md`, `docs/USER_TESTING.md` and `docs/TEAM_AND_DISCLOSURES.md`.
