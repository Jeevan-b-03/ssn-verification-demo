// Inline SSN verification + email + duplicate check + merge (demo)
// Demo only: uses mock verification. Do not use real SSNs.

const CURRENT_USER = 'hr-admin@demo';
const DETERMINISTIC_PEPPER = 'DEMO_PEPPER_v1'; // demo-only; use server secret in production

const store = { employees: [], audit: [] };

const els = {
  views: {
    employees: document.getElementById('view-employees'),
    add: document.getElementById('view-add'),
    audit: document.getElementById('view-audit'),
    compliance: document.getElementById('view-compliance'),
  },
  nav: {
    employees: document.getElementById('nav-employees'),
    add: document.getElementById('nav-add'),
    audit: document.getElementById('nav-audit'),
    compliance: document.getElementById('nav-compliance'),
  },
  tableBody: document.querySelector('#employeeTable tbody'),
  auditBody: document.querySelector('#auditTable tbody'),
  addForm: document.getElementById('addForm'),
  search: document.getElementById('search'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  consentAdd: document.getElementById('consentAdd'),
  verifyBtn: document.getElementById('verifyBtn'),
  saveBtn: document.getElementById('saveBtn'),
  verifyStatus: document.getElementById('verifyStatus'),
  email: document.getElementById('email'),
  emailHelp: document.getElementById('emailHelp'),
  ssn1: document.getElementById('ssn1'),
  ssn2: document.getElementById('ssn2'),
  ssn3: document.getElementById('ssn3'),
  // merge dialog
  mergeModal: document.getElementById('mergeModal'),
  mergeBody: document.getElementById('mergeBody'),
  mergeConfirmBtn: document.getElementById('mergeConfirmBtn'),
};

const encoder = new TextEncoder();

function maskSSN(ssn) {
  const d = ssn.replace(/\D/g, '').padStart(9, '*');
  return `***-**-${d.slice(-4)}`;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}

function nowISO(){ return new Date().toISOString(); }
function save(){ localStorage.setItem('ssn-demo-inline-brand-v3', JSON.stringify(store)); }
function load(){ try{ Object.assign(store, JSON.parse(localStorage.getItem('ssn-demo-inline-brand-v3')||'{}')); }catch{} }
function addAudit(action, employeeName, result){ store.audit.unshift({ ts: nowISO(), user: CURRENT_USER, action, employeeName, result }); }

function normalizeEmail(e){ return (e||'').trim().toLowerCase(); }
function isValidEmail(e){ const v = normalizeEmail(e); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

function getSSN(){ return `${els.ssn1.value}-${els.ssn2.value}-${els.ssn3.value}`; }
function validSSNFormat(){ const s = getSSN().trim(); const normalized = s.replace(/[–—‐‑−]/g,'-'); return /^\d{3}-\d{2}-\d{4}$/.test(normalized); }

// Deterministic digest (for duplicate detection only; demo-only in front-end)
async function ssnDeterministicDigest(ssnDigits){
  return await sha256Hex(DETERMINISTIC_PEPPER + '|' + ssnDigits);
}

function renderEmployees(){
  const q = (els.search.value||'').trim().toLowerCase();
  els.tableBody.innerHTML = store.employees.filter(e => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    const email = (e.email||'').toLowerCase();
    return !q || name.includes(q) || email.includes(q) || (e.ssnMasked||'').includes(q);
  }).map(e => {
    const status = e.verification?.status || 'pending';
    const label = { verified:'Verified (match)', mismatch:'Mismatch', deceased:'Deceased', pending:'Pending' }[status] || 'Pending';
    const last = e.verification?.at ? new Date(e.verification.at).toLocaleString() : '—';
    return `<tr>
      <td>${e.firstName} ${e.lastName}</td>
      <td>${e.dob||''}</td>
      <td>${e.employeeId||''}</td>
      <td>${e.email||''}</td>
      <td>${e.ssnMasked||''}</td>
      <td><span class="status ${status}">${label}</span></td>
      <td>${last}</td>
      <td>
        <button data-action="verify" data-id="${e.id}">Re-Verify</button>
        <button class="secondary" data-action="delete" data-id="${e.id}">Delete</button>
      </td>
    </tr>`; }).join('') || `<tr><td colspan="8" class="muted">No employees yet.</td></tr>`;
}

function renderAudit(){
  els.auditBody.innerHTML = store.audit.map(a => `
    <tr>
      <td>${new Date(a.ts).toLocaleString()}</td>
      <td>${a.user}</td>
      <td>${a.action}</td>
      <td>${a.employeeName}</td>
      <td>${a.result||'—'}</td>
    </tr>`).join('');
}

function switchView(v){ Object.values(els.views).forEach(x=>x.classList.add('hidden')); Object.values(els.nav).forEach(x=>x.classList.remove('active')); els.views[v].classList.remove('hidden'); els.nav[v].classList.add('active'); }

// Mock verifier — replace with SSA services in production
function mockVerify(ssn, name, dob){
  const clean = ssn.replace(/\D/g,'');
  if (clean.length !== 9) return { status:'mismatch', message:'Invalid SSN length' };
  const last = parseInt(clean.slice(-1),10);
  if (last === 0) return { status:'deceased', message:'Death indicator present (demo)' };
  const sum = clean.split('').reduce((a,b)=>a+parseInt(b,10),0);
  return (sum % 2 === 0) ? { status:'verified', message:'Yes/Match (demo)' } : { status:'mismatch', message:'No/Does not match (demo)' };
}

// SSN segmented input behavior
function onlyDigits(e){ e.target.value = e.target.value.replace(/\D/g,''); }
function autoAdvance(e){ const t=e.target, max=+t.getAttribute('maxlength'); if (t.value.length>=max){ if (t.id==='ssn1') els.ssn2.focus(); else if (t.id==='ssn2') els.ssn3.focus(); } }
function autoBackspace(e){ const t=e.target; if (e.key==='Backspace' && t.value.length===0){ if (t.id==='ssn3') els.ssn2.focus(); else if (t.id==='ssn2') els.ssn1.focus(); } }
function handlePaste(e){ const d=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,''); if (d.length===9){ e.preventDefault(); els.ssn1.value=d.slice(0,3); els.ssn2.value=d.slice(3,5); els.ssn3.value=d.slice(5); els.ssn3.focus(); } }

let addVerifyResult = null; // {status,message,at,ssn}
function setVerifyStatus(kind, msg){ const map={ok:'ok',error:'error',warn:'warn'}; els.verifyStatus.innerHTML=`<span class="${map[kind]}">${msg}</span>`; }
function resetVerifyState(){ addVerifyResult=null; els.saveBtn.disabled=true; setVerifyStatus('warn','Please verify SSN before saving.'); }

// Init
load(); renderEmployees(); renderAudit(); resetVerifyState();

// Nav
els.nav.employees.addEventListener('click', ()=>switchView('employees'));
els.nav.add.addEventListener('click', ()=>{ switchView('add'); resetVerifyState(); });
els.nav.audit.addEventListener('click', ()=>{ switchView('audit'); renderAudit(); });
els.nav.compliance.addEventListener('click', ()=>{ switchView('compliance'); });

// Email live validation
['input','blur'].forEach(evt=>{
  els.email.addEventListener(evt, ()=>{
    const ok = isValidEmail(els.email.value);
    els.emailHelp.textContent = ok ? '' : 'Enter a valid email like name@company.com';
  });
});

// SSN inputs
[els.ssn1, els.ssn2, els.ssn3].forEach(inp=>{
  inp.addEventListener('input', (e)=>{ onlyDigits(e); autoAdvance(e); resetVerifyState(); });
  inp.addEventListener('keydown', autoBackspace);
  inp.addEventListener('paste', handlePaste);
});

// Verify
els.verifyBtn.addEventListener('click', ()=>{
  const fd = new FormData(els.addForm);
  const first = (fd.get('firstName')||'').trim();
  const last = (fd.get('lastName')||'').trim();
  const dob = (fd.get('dob')||'').trim();
  const email = normalizeEmail(fd.get('email')||'');

  if (!first || !last || !dob){ setVerifyStatus('error','Fill name and DOB before verification.'); return; }
  if (!email || !isValidEmail(email)){ setVerifyStatus('error','Enter a valid email before verification.'); els.email.focus(); return; }
  if (!els.consentAdd.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }
  if (!validSSNFormat()){ setVerifyStatus('error','SSN must be in xxx‑xx‑xxxx format.'); return; }

  const ssn = getSSN().replace(/[–—‐‑−]/g,'-');
  const res = mockVerify(ssn, `${first} ${last}`, dob);
  addVerifyResult = { ...res, at: nowISO(), ssn };

  if (res.status === 'verified'){
    setVerifyStatus('ok', `Verified ✓ — ${res.message}`);
    els.saveBtn.disabled = false;
    addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`);
    save();
  } else if (res.status === 'deceased'){
    setVerifyStatus('error', 'Verification failed: SSN has a death indicator.');
    els.saveBtn.disabled = true;
  } else {
    setVerifyStatus('error', 'Verification failed: No match.');
    els.saveBtn.disabled = true;
  }
});

function buildMergeRows(existing, incoming){
  const fields=[
    {key:'firstName',label:'First Name'},
    {key:'lastName',label:'Last Name'},
    {key:'dob',label:'Date of Birth'},
    {key:'employeeId',label:'Employee ID'},
    {key:'department',label:'Department'},
    {key:'email',label:'Email'},
  ];
  els.mergeBody.innerHTML = fields.map(f=>{
    const ex = existing[f.key] ?? '';
    const nv = incoming[f.key] ?? '';
    const id = `use-${f.key}`;
    return `<tr>
      <td>${f.label}</td>
      <td class="value">${ex || '<span class="muted">—</span>'}</td>
      <td class="value">${nv || '<span class="muted">—</span>'}</td>
      <td class="choice">
        <label><input type="radio" name="${id}" value="existing" checked /> Existing</label>
        <label><input type="radio" name="${id}" value="new" /> New</label>
      </td>
    </tr>`;
  }).join('');
}

function openMerge(existing, incoming, onConfirm){
  buildMergeRows(existing, incoming);
  els.mergeConfirmBtn.onclick = () => {
    const fields = ['firstName','lastName','dob','employeeId','department','email'];
    const updated = { ...existing };
    fields.forEach(k=>{
      const choice = document.querySelector(`input[name="use-${k}"]:checked`)?.value || 'existing';
      if (choice==='new') updated[k] = incoming[k] ?? existing[k];
    });
    if (incoming.verification?.status === 'verified') {
      updated.verification = incoming.verification;
    }
    onConfirm(updated);
    els.mergeModal.close();
  };
  els.mergeModal.showModal();
}

els.addForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!addVerifyResult || addVerifyResult.status !== 'verified'){
    setVerifyStatus('error','Please verify SSN successfully before saving.');
    return;
  }

  const fd = new FormData(els.addForm);
  const firstName  = (fd.get('firstName')  || '').trim();
  const lastName   = (fd.get('lastName')   || '').trim();
  const dob        = (fd.get('dob')        || '').trim();
  const employeeId = (fd.get('employeeId') || '').trim();
  const department = (fd.get('department') || '').trim();
  const emailNorm  = normalizeEmail(fd.get('email')||'');

  if (!emailNorm || !isValidEmail(emailNorm)){
    els.email.focus();
    els.emailHelp.textContent = 'Enter a valid email like name@company.com';
    return;
  }

  const ssnDigits = addVerifyResult.ssn.replace(/\D/g,'');
  const salt = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const ssnHash = await sha256Hex(ssnDigits + ':' + salt); // per-record salt hash
  const ssnDet = await ssnDeterministicDigest(ssnDigits);   // deterministic digest (demo)

  const incoming = {
    id: crypto.randomUUID(), firstName, lastName, dob, employeeId, department,
    email: emailNorm,
    ssnMasked: maskSSN(ssnDigits),
    ssnHash, salt, ssnDet, // store both
    verification: { status:'verified', message:addVerifyResult.message, at:addVerifyResult.at, by: CURRENT_USER }
  };

  // Duplicate detection: deterministic SSN OR email
  const dup = store.employees.find(emp => emp.ssnDet === ssnDet || normalizeEmail(emp.email) === emailNorm);

  if (dup){
    openMerge(dup, incoming, (merged)=>{
      // keep identity fields (id, ssnHash, salt, ssnDet, ssnMasked) from existing
      merged.id = dup.id;
      merged.ssnHash = dup.ssnHash;
      merged.salt = dup.salt;
      merged.ssnDet = dup.ssnDet;
      merged.ssnMasked = dup.ssnMasked;

      const idx = store.employees.findIndex(e=>e.id===dup.id);
      if (idx>=0) store.employees[idx] = merged;
      addAudit('MERGE', `${merged.firstName} ${merged.lastName}`, 'merged duplicate into existing');
      save();

      els.addForm.reset();
      [els.ssn1, els.ssn2, els.ssn3].forEach(i=>i.value='');
      resetVerifyState();
      renderEmployees();
      switchView('employees');
    });
    return;
  }

  // No duplicate → create new
  store.employees.unshift(incoming);
  addAudit('CREATE', `${firstName} ${lastName}`, 'created with pre‑verification');
  save();

  els.addForm.reset();
  [els.ssn1, els.ssn2, els.ssn3].forEach(i=>i.value='');
  resetVerifyState();
  renderEmployees();
  switchView('employees');
});

// Table actions
els.tableBody.addEventListener('click', (e)=>{
  const btn = e.target.closest('button'); if (!btn) return;
  const id = btn.dataset.id; const action = btn.dataset.action;
  const emp = store.employees.find(x=>x.id===id); if (!emp) return;

  if (action==='delete'){
    if (confirm(`Delete ${emp.firstName} ${emp.lastName}?`)){
      store.employees = store.employees.filter(x=>x.id!==id);
      addAudit('DELETE', `${emp.firstName} ${emp.lastName}`);
      save(); renderEmployees();
    }
  }
  if (action==='verify'){
    alert('Re-verify would call SSA in production. (Demo)');
  }
});

// Search
els.search.addEventListener('input', renderEmployees);

// Export/Import
els.exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(store, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'ssn-demo-inline-brand-v3-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
});

els.importFile.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
  r.onload = ()=>{ try { const data = JSON.parse(r.result); if (data.employees && data.audit){ store.employees = data.employees; store.audit = data.audit; save(); renderEmployees(); renderAudit(); } else alert('Invalid file'); } catch { alert('Could not parse file'); } };
  r.readAsText(f);
});
