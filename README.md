# Inline SSN Verification — Branded Demo (v3)

**Demo only — do not use real SSNs.**

### What’s new
- **Email field** with live validation.
- **Duplicate detection** by **email** or **deterministic SSN digest** (demo-safe).
- **Merge dialog** to selectively update existing records when duplicates are found.
- Keeps **verify-before-save** rule, larger segmented SSN boxes, and compliance page.

### Deploy
- Push these files to your GitHub repo and let **Azure Static Web Apps** auto-deploy (App Location `/`).

### Notes
- Deterministic SSN digest uses a demo pepper in the **front-end**. In production, compute this on the **server** with a secret.
- Continue storing **masked SSN + salted hash**; never store plaintext.
