# Architecture and technical decisions

```
 Brand library (kit JSON)         Content (text / md / html / image + metadata)
 guidelines · facts · terms ·            │
 evidence · palette · rules              ▼
            └──────────────►  engine.review(content, kit)  ──►  findings[]
                              pure function, no I/O              each = rule, severity, span, why,
                                                                 source (guideline/fact), fix, confidence
                                          │
        UI (vanilla JS) ◄─────────────────┤
          · highlight + finding cards     │   workflow policy (engine.gate, engine.approvalPolicy)
          · versions, diff, comments      │     blockers: only Reviewer waives
          · roles, approvals, audit       │     majors: fix or dismiss with reason
          · insights from decision log    │     risky categories => Reviewer approval also required
                                          ▼
                              localStorage (demo persistence)
```

## Key decisions

1. **Deterministic engine, not an LLM, for findings.** Brand governance needs results that are repeatable, cite a source and can be audited. Every finding carries a rule id, the guideline or fact it came from and a confidence value (1.0 for exact rules, lower for heuristics). An LLM can later be added for *suggestions* and document understanding without changing this contract.
2. **Pure engine module.** `engine.js` has no DOM and no network, so it runs in the browser, in Node tests and on a server unchanged.
3. **Masking keeps offsets honest.** HTML and Markdown are masked (tags and URLs replaced by spaces of equal length) before text rules run, so findings point at exact positions in the original source and fixes apply by offset.
4. **Fixes are data, not side effects.** A fix is `{type, text}` that a person applies. Apply, re-review, repeat converges (tested).
5. **Facts have owners and expiry.** An expired fact is surfaced when content uses it, which catches outdated information without anyone remembering to update copy.
6. **Policy is separate from detection.** What blocks, who can waive and who must approve is in `gate` and `approvalPolicy`, and approvals bind to a version.
7. **Confidential by design.** Processing is local. Codenames, internal markings, secrets and non-public emails are blockers. Confidential guidelines are hidden from Creators in findings and the library.
8. **Insights from decisions, not just detections.** Fixed, dismissed, waived and "Guideline unclear" are logged. A rule overridden 40%+ of the time is surfaced as a likely unclear guideline.

## Rule coverage

Confidentiality (codename, marker, secret, email) · brand and product casing · terminology, retired names, jargon, hype · claims (superlatives, rankings, absolute promises, competitors) · approved-fact comparison (counts, percentages, prices, years, warranty, expiry) · required disclaimers and legal lines · message pillars · tone (exclamation, caps, emoji) · readability and sentence length · social length, hashtags · HTML/Markdown accessibility (alt, link text, heading order, contrast) · visual (palette, font) · image (alt, resolution, ratio, size, dominant colour).

## Data model

`kit`: guidelines, facts (type, value, asOf, expires, owner, regexes), terms, claims, approvedClaims, competitors, confidentialTerms, requirements, pillars, palette, fonts, image rules, settings.
`content`: versions[{body, by, at, note, imageMeta}], decisions{findingKey: state, reason, by}, comments, approvals[{role, version}], history.
`log`: one event per resolved finding, used by Insights.

## Roadmap to production

- Server with auth (SSO), Postgres, server-side permission checks, per-tenant encryption.
- .docx/.pdf parsing (mammoth, pdf.js), image logo detection.
- Optional LLM layer: rewrite suggestions and "does this claim match the evidence?" only on non-confidential text or a private deployment; AI output labelled and never auto-applied.
- Webhooks into CMS and DAM so unpublished content cannot go live without an approval record.
