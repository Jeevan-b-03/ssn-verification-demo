// Inline SSN verification on Add Employee
// Demo only: uses mock verification. Do not use real SSNs.

const CURRENT_USER = 'hr-admin@demo';

const store = { employees: [], audit: [] };

const els = {
  views: {
    employees: document.getElementById('view-employees'),
    add: document.getElementById('view-add'),
    audit: document.getElementById('view-audit'),
  },
  nav: {
    employees: document.getElementById('nav-employees'),
    add: document.getElementById('nav-add'),
    audit: document.getElementById('nav-audit'),
  },
  tableBody: document.querySelector('#employeeTable tbody'),
  auditBody: document.querySelector('#auditTable tbody'),
  addForm: document.getElementById('addForm'),
  search: document.getElementById('search'),
  exportBtn: document.getElementById('exportBtn'),
  importFile: document.getElementById('importFile'),
  verifyModal: document.getElementById('verifyModal'),
  verifyEmp: document.getElementById('verifyEmp'),
  runVerifyBtn: document.getElementById('runVerifyBtn'),
  consentCheckbox: document.getElementById('consentCheckbox'),
  consentAdd: document.getElementById('consentAdd'),
  verifyBtn: document.getElementById('verifyBtn'),
  saveBtn: document.getElementById('saveBtn'),
  verifyStatus: document.getElementById('verifyStatus'),
  ssn1: document.getElementById('ssn1'),
  ssn2: document.getElementById('ssn2'),
  ssn3: document.getElementById('ssn3'),
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
function save(){ localStorage.setItem('ssn-demo-inline', JSON.stringify(store)); }
function load(){ try{ Object.assign(store, JSON.parse(localStorage.getItem('ssn-demo-inline')||'{}')); }catch{} }
function addAudit(action, employeeName, result){ store.audit.unshift({ ts: nowISO(), user: CURRENT_USER, action, employeeName, result }); }

function renderEmployees(){
  const q = (els.search.value||'').trim().toLowerCase();
  els.tableBody.innerHTML = store.employees.filter(e => !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || (e.ssnMasked||'').includes(q))
  .map(e => {
    const status = e.verification?.status || 'pending';
    const label = { verified:'Verified (match)', mismatch:'Mismatch', deceased:'Deceased', pending:'Pending' }[status] || 'Pending';
    const last = e.verification?.at ? new Date(e.verification.at).toLocaleString() : '—';
    return `<tr>
      <td>${e.firstName} ${e.lastName}</td>
      <td>${e.dob||''}</td>
      <td>${e.employeeId||''}</td>
      <td>${e.ssnMasked||''}</td>
      <td><span class="status ${status}">${label}</span></td>
      <td>${last}</td>
      <td>
        <button data-action="verify" data-id="${e.id}">Re-Verify</button>
        <button class="secondary" data-action="delete" data-id="${e.id}">Delete</button>
      </td>
    </tr>`; }).join('') || `<tr><td colspan="7" class="muted">No employees yet.</td></tr>`;
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
function autoAdvance(e){
  const t = e.target; const max = parseInt(t.getAttribute('maxlength'),10);
  if (t.value.length >= max){ if (t.id==='ssn1') els.ssn2.focus(); else if (t.id==='ssn2') els.ssn3.focus(); }
}
function autoBackspace(e){
  const t = e.target; if (e.key === 'Backspace' && t.value.length===0){ if (t.id==='ssn3') els.ssn2.focus(); else if (t.id==='ssn2') els.ssn1.focus(); }
}
function handlePaste(e){
  const data = (e.clipboardData || window.clipboardData).getData('text');
  const digits = data.replace(/\D/g,'');
  if (digits.length === 9){ e.preventDefault(); els.ssn1.value = digits.slice(0,3); els.ssn2.value = digits.slice(3,5); els.ssn3.value = digits.slice(5); els.ssn3.focus(); }
}
function getSSN(){ return `${els.ssn1.value}-${els.ssn2.value}-${els.ssn3.value}`; }
function validSSNFormat(){ return /^\d{3}-\d{2}-\d{4}$/.test(getSSN()); }

// Inline verify state for Add Form
let addVerifyResult = null; // {status,message,at}

function setVerifyStatus(kind, msg){
  els.verifyStatus.innerHTML = `<span class="${kind}">${msg}</span>`;
}

function resetVerifyState(){ addVerifyResult = null; els.saveBtn.disabled = true; setVerifyStatus('warn','Please verify SSN before saving.'); }

// Initialization
load(); renderEmployees(); renderAudit(); resetVerifyState();

// Nav
els.nav.employees.addEventListener('click', ()=>switchView('employees'));
els.nav.add.addEventListener('click', ()=>{ switchView('add'); resetVerifyState(); });
els.nav.audit.addEventListener('click', ()=>{ switchView('audit'); renderAudit(); });

// SSN input listeners
[els.ssn1, els.ssn2, els.ssn3].forEach(inp=>{
  inp.addEventListener('input', (e)=>{ onlyDigits(e); autoAdvance(e); resetVerifyState(); });
  inp.addEventListener('keydown', autoBackspace);
  inp.addEventListener('paste', handlePaste);
});

// Verify button
els.verifyBtn.addEventListener('click', ()=>{
  const name = new FormData(els.addForm);
  const first = (name.get('firstName')||'').trim();
  const last = (name.get('lastName')||'').trim();
  const dob = name.get('dob');
  const fullName = `${first} ${last}`.trim();

  if (!first || !last || !dob){ setVerifyStatus('error','Fill name and DOB before verification.'); return; }
  if (!els.consentAdd.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }
  if (!validSSNFormat()){ setVerifyStatus('error','SSN must be in xxx‑xx‑xxxx format.'); return; }

  const ssn = getSSN();
  const res = mockVerify(ssn, fullName, dob);
  addVerifyResult = { ...res, at: nowISO(), ssn };

  if (res.status === 'verified'){
    setVerifyStatus('ok', `Verified ✓ — ${res.message}`);
    els.saveBtn.disabled = false;
    addAudit('VERIFY', fullName, `${res.status}: ${res.message}`);
    save();
  } else if (res.status === 'deceased'){
    setVerifyStatus('error', 'Verification failed: SSN has a death indicator.');
    els.saveBtn.disabled = true;
  } else {
    setVerifyStatus('error', 'Verification failed: No match.');
    els.saveBtn.disabled = true;
  }
});

// Add form submit (allowed only after verified)
els.addForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(els.addForm);
  const firstName = (fd.get('firstName')||'').trim();
  const lastName = (fd.get('lastName')||'').trim();
  const dob = fd.get('dob');
  const employeeId = (fd.get('employeeId')||'').trim();
  const department = (fd.get('department')||'').trim();

  if (!addVerifyResult || addVerifyResult.status !== 'verified'){
    setVerifyStatus('error','Please verify SSN successfully before saving.');
    return;
  }

  const ssnDigits = addVerifyResult.ssn.replace(/\D/g,'');
  const salt = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const ssnHash = await sha256Hex(ssnDigits + ':' + salt);
  const emp = {
    id: crypto.randomUUID(), firstName, lastName, dob, employeeId, department,
    ssnMasked: maskSSN(ssnDigits), ssnHash, salt,
    verification: { status:'verified', message:addVerifyResult.message, at: addVerifyResult.at, by: CURRENT_USER }
  };

  store.employees.unshift(emp);
  addAudit('CREATE', `${firstName} ${lastName}`, 'created with pre‑verification');
  save();

  // Reset form for next entry
  els.addForm.reset();
  [els.ssn1, els.ssn2, els.ssn3].forEach(i=>i.value='');
  resetVerifyState();
  renderEmployees();
  switchView('employees');
});

// Employees table actions
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
    openVerify(emp);
  }
});

function openVerify(emp){
  els.verifyEmp.textContent = `${emp.firstName} ${emp.lastName} — ${emp.ssnMasked}`;
  els.consentCheckbox.checked = false;
  els.runVerifyBtn.onclick = ()=>runVerify(emp);
  els.verifyModal.showModal();
}

function runVerify(emp){
  if (!els.consentCheckbox.checked){ alert('You must confirm written consent (SSA‑89) is on file.'); return; }
  // We cannot reconstruct full SSN from masked/hash in demo; keep mock result neutral
  // In real app, store encrypted SSN or call with user input again.
  const res = { status:'verified', message:'Re-verify (demo)' };
  emp.verification = { status: res.status, message: res.message, at: nowISO(), by: CURRENT_USER };
  addAudit('VERIFY', `${emp.firstName} ${emp.lastName}`, `${res.status}: ${res.message}`);
  save(); renderEmployees(); els.verifyModal.close();
}

// Search
els.search.addEventListener('input', renderEmployees);

// Export/Import
els.exportBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(store, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'ssn-demo-inline-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
});

els.importFile.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
  r.onload = ()=>{ try { const data = JSON.parse(r.result); if (data.employees && data.audit){ store.employees = data.employees; store.audit = data.audit; save(); renderEmployees(); renderAudit(); } else alert('Invalid file'); } catch { alert('Could not parse file'); } };
  r.readAsText(f);
});
