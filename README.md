
# Unified Talent — Duplicate Prevention PoC (ATS ↔ ER)

> Interactive, front‑end proof‑of‑concept that prevents duplicate account creation when applicants transition to employees. Implements validation, dedupe checks (fuzzy + exact), and an SSN verification **stub** for demo purposes.

---

## ✨ Key Features
- **Exact duplicate gates** (block immediately):
  - Deterministic **SSN digest** match (peppered SHA‑256)
  - **Exact** email match (personal or district)
  - **Exact** EMP‑ID match
  - **Exact** phone digits match
- **Fuzzy candidate detection** (show merge workflow):
  - **Token‑aware Jaro–Winkler** on names (handles hyphens, apostrophes, spacing)
  - **Phonetic fallback** (Soundex) to catch minor spelling variants
  - **Email local‑part** similarity **with Gmail canonicalization** (ignores dots and `+tag`)
  - **EMP‑ID** approximate similarity
  - **Phone last‑4** as a weak signal
  - Composite score with tunable weights; default threshold **`0.70`**
- **Validation**: SSN (`###-##-####`), email (RFC‑lite), phone (+CC formats), DOB ≥ 18
- **SSN verification (stub)**: demo-only algorithm to return Verified/Mismatch/Deceased
- **Candidates‑first UI**: prompts to **Review & Merge** before creating new records
- **Local persistence**: stores Employees and Audit trail in `localStorage`
- **Import/Export**: JSON export & import for quick demos

> **Out of scope (removed):** Email OTP verification.

---

## 🗂️ Repo Structure (PoC)
```
/ (root)
  index.html
  styles.css
  app.js            # main logic (matching, UI wiring, storage)
  /assets           # images/icons (optional)
  README.md         # this file
```

## 🧩 How Dedupe Works

### 1) Exact Gates (hard blocks)
If any of the following matches are found, the app **blocks create** and asks to merge:
- `ssnDet` (deterministic SSN digest) **===** incoming
- Email (personal/district canonical) **===** incoming
- `empIdNorm` **===** incoming
- Full phone digits **===** incoming

### 2) Fuzzy Candidates (composite score)
For every existing record, we compute signals and aggregate:

| Signal | Weight (w) | Notes |
|---|---:|---|
| Name JW (token‑aware) | 0.45 | Jaro–Winkler on name tokens (handles hyphens/apostrophes) |
| Name phonetic (Soundex) | 0.15 | Adds robustness to small misspellings |
| Email local‑part JW | 0.20 | After Gmail canonicalization |
| EMP‑ID JW | 0.10 | Catches near matches like `A12345` vs `A1234S` |
| Phone last‑4 match | 0.10 | Weak but helpful |
| DOB exact (booster) | 0.05 | Only if DOB provided |

**Score** = Σ (wᵢ × valueᵢ). If **Score ≥ 0.70**, the candidate is shown in the **Possible Duplicates** dialog.

> You can tune weights and threshold inside `app.js` where `findDuplicateCandidates(...)` is defined.

---

## 🧪 Validation & Verification
- **SSN format** must be `###-##-####` (enforced on input & paste).
- **Email** uses a simple RFC‑lite regex; at least one email (Personal or District) is required.
- **Phone** accepts international formats; digits are normalized for comparisons.
- **DOB** must indicate **18+**.
- **Verification (stub):** `Verify` runs a deterministic demo check and stores `verification.status` (do **not** rely on this in production).

---

## 🔐 Data Privacy & Security (PoC Only)
- **Never use real PII** in the PoC. Use synthetic or masked data.
- The app stores:
  - `ssnHash` = SHA‑256 of `digits:salt` (unique per record)
  - `salt` = random per record
  - `ssnDet` = **deterministic** SHA‑256 of `PEPPER + digits` for **matching** only
  - `ssnMasked` = `***-**-LAST4` for UI display
- All data is saved in **`localStorage`** on the browser (`ssn-demo-inline-brand-v4`).
- **Action required:** change the constant **`DETERMINISTIC_PEPPER`** in `app.js` before sharing. Rotate it if you re‑seed the dataset.

> The PoC has no backend and no network calls for SSN; the “verify” step is simulated.

---

## 🧭 User Flow (Happy Path)
1. **Add** → enter First/Last, DOB, emails, optional phone, employee ID, and SSN.
2. Click **Verify SSN** → must return **Verified** (stub) to enable **Save**.
3. Click **Save** → if duplicates found, **Candidates** modal opens first.
4. Choose **Review & Merge** to reconcile fields, or **Create** (when allowed).
5. **Preview** → confirm final record. Audit trail is updated.

---

## 🛠️ Configuration & Tuning
Open `app.js` and adjust inside `findDuplicateCandidates(...)`:
- **Weights** for each signal (e.g., `nameJW: 0.45` → `0.40`)
- **Threshold** (default `0.70`)
- **Email canonicalization**: enabled for Gmail by default

For stricter systems, raise to `0.75–0.80`. For broader catch, lower to `0.65–0.68`.

---

## 📈 Smoke Tests (Manual)
- Invalid SSN → **blocked** save
- Valid SSN → `Verify` succeeds (green)
- Email variants: `jeevan.b+hr@gmail.com` vs `jeevanb@gmail.com` → shows candidate
- Hyphenated/apostrophe names: `Ann‑Marie` vs `Ann Marie`, `O’Neil` vs `Oneil` → shows candidate
- EMP‑ID typo: `A12345` vs `A1234S` → shows candidate
- Phone formats: `+1 (415) 555‑2671` vs `415-555-2671` → weak signal contributes

---

## 📦 Import / Export
- **Export** → click **Export** to download a JSON snapshot (`employees` + `audit`).
- **Import** → click **Import** and select a previously exported JSON. The app remaps fields and re-renders.

---

## ☁️ Deploy to Azure Static Web Apps (SWA)
1. Push repo to GitHub.
2. In Azure Portal → **Create Static Web App**.
3. Connect your GitHub repo/branch; set **App location** to `/` (root).
4. Build presets: **Custom** (no build step needed for pure static).
5. Review & Create → SWA provides a public URL.

> For private demos, protect the URL, or deploy to an internal environment.

---

## 👥 Stakeholders & Maintainers
- **Jeevan B** (Owner) — Intern/Apprentice, Technical Support
- **K Devadharshini** (Co‑owner)
- Mentors/SMEs: **Apurv Anand**, **Ashley Johann**, **Kate Young**, **Michelle Winchester**

---

## 📄 License
```
PowerSchool © 2025 Unified Talent. All rights reserved.
```

---

## ⚠️ Disclaimer
This is a **non‑production PoC**. It uses synthetic/anonymized data only, stores data in the browser, and simulates verification. Do **not** use real SSNs or PII.
