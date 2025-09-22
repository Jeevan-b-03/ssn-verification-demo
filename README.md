# Inline SSN Verification — Branded Demo (v4)

**Demo only — do not use real SSNs.**

### What’s new in v4
- **Duplicate detection** now includes **EMP ID** (case-insensitive, non-alphanumeric ignored), in addition to **email** and **deterministic SSN digest**.
- Search bar updated to match by **EMP ID** too.
- Merge flow recomputes the normalized EMP ID after updates.

### Deploy
- Push these files to your GitHub repo (App Location `/`) and let **Azure Static Web Apps** auto-deploy.

### Notes
- Deterministic SSN digest should be computed **server-side** with a secret in production.
- Continue storing **masked SSN + salted hash**; never store plaintext.
