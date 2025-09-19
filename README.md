# SSN Authorization Demo — Employee Records (Static Prototype)

> **Demo only. Do not use with real SSNs.** This single-page app shows how SSN authorization and verification could be integrated into an employee records system. It runs entirely in the browser with **localStorage** and a **mock verifier**.

## What it demonstrates
- Capture and store employee records with **masked SSNs** and **hashed SSN digests** (never plaintext).
- Require an **SSA-89 written consent acknowledgement** before running any verification.
- Trigger an SSN verification flow and persist **status + audit trail**.
- Export/Import JSON data for demos.

## How to run
1. Download all files in this folder.
2. Open `index.html` in any modern browser.

## Notes on real integrations (non-demo)
- **SSNVS** (Social Security Number Verification Service) is for **employers’ wage reporting (Form W‑2) purposes only**. It lets you verify small batches online or upload up to 250k records for next-business-day results. Do **not** use it for pre-employment screening or eligibility determinations. See SSA guidance: https://www.ssa.gov/employer/ssnv.htm
- **eCBSV** (electronic Consent Based SSN Verification) is an SSA **API** that returns a *yes/no* match (and death indicator if applicable). It requires the SSN holder’s **written consent** (SSA‑89), and only **Permitted Entities** (e.g., financial institutions or their service providers) may enroll. Start here: https://www.ssa.gov/dataexchange/eCBSV/ and technical details here: https://www.ssa.gov/dataexchange/eCBSV/technical_information.html
- **Written consent (SSA‑89)**: use SSA’s form and rules. The latest SSA‑89 PDF is here: https://www.ssa.gov/forms/ssa-89.pdf. eCBSV consent requirements and examples: https://www.ssa.gov/dataexchange/eCBSV/written_consent.html and the user agreement’s consent section: https://www.ssa.gov/dataexchange/eCBSV/documents/ua/eCBSV%20User%20Agreement%20-%20Consent.pdf

## Security & privacy suggestions (production)
- **Never store full SSNs**; store a one‑way **hash** (e.g., SHA‑256 with a per‑record salt) + **mask** for display (***‑**‑1234). Restrict access by role.
- Keep a **link/reference** to the signed consent (SSA‑89) and an **immutable audit log** with who/when/why.
- Use **TLS**, **HSTS**, and encrypt at rest. Manage secrets with a vault (e.g., Azure Key Vault). Apply the **principle of least privilege**.
- For eCBSV, implement **OIDC/OAuth 2.0** client flows, handle **rate limits** and **error codes**, and separate test vs. production tenants.

## Folder contents
- `index.html` – UI for employees, add form, audit log, verification modal.
- `styles.css` – Minimal dark theme styling.
- `app.js` – Local data store, hashing, masking, mock verifier, audit trail.

---
**Legal reminder:** Follow SSA’s terms. SSNVS use is limited to wage reporting, and eCBSV requires eligibility and written consent. This repo is for demonstration and training only and **must not** be used with real PII.
