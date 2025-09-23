# Inline SSN Verification — Branded Demo (v4.1)

**Demo only — do not use real SSNs.**

### What’s new in v4.1
- Two email inputs: Personal and District
- DOB logic check: must be 18 or older
- Fuzzy duplicate detection using Jaro-Winkler similarity
- Preview-before-save flow: Verify → Submit → Check duplicates → Merge → Review → Save

### Deploy
- Push these files to your GitHub repo (App Location `/`) and let **Azure Static Web Apps** auto-deploy.

### Notes
- Deterministic SSN digest should be computed **server-side** with a secret in production.
- Continue storing **masked SSN + salted hash**; never store plaintext.
