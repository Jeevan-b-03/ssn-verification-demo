// v4.1: Two email inputs (personal + district), DOB >=18 check, fuzzy duplicate search, preview-before-save
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
  // two emails
  emailPersonal: document.getElementById('emailPersonal'),
  emailPersonalHelp: document.getElementById('emailPersonalHelp'),
  emailDistrict: document.getElementById('emailDistrict'),
  emailDistrictHelp: document.getElementById('emailDistrictHelp'),
  // SSN boxes
  ssn1: document.getElementById('ssn1'),
  ssn2: document.getElementById('ssn2'),
  ssn3: document.getElementById('ssn3'),
  // merge dialog
  mergeModal: document.getElementById('mergeModal'),
  mergeBody: document.getElementById('mergeBody'),
  mergeConfirmBtn: document.getElementById('mergeConfirmBtn'),
  // preview dialog
  previewModal: document.getElementById('previewModal'),
  previewBody: document.getElementById('previewBody'),
  previewConfirmBtn: document.getElementById('previewConfirmBtn'),
  previewCancelBtn: document.getElementById('previewCancelBtn'),
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
function save(){ localStorage.setItem('ssn-demo-inline-brand-v4', JSON.stringify(store)); }
function load(){
  try{
    const data = JSON.parse(localStorage.getItem('ssn-demo-inline-brand-v4') || '{}');
    Object.assign(store, data);
  }catch{}
}
function migrate(){
  // Backfill from older schemas
  store.employees = (store.employees || []).map(emp => ({
    ...emp,
    emailPersonal: (emp.emailPersonal || emp.email || '').trim().toLowerCase(),
    emailDistrict: (emp.emailDistrict || '').trim().toLowerCase(),
    empIdNorm: normalizeEmpId(emp.employeeId || ''),
  }));
}
function addAudit(action, employeeName, result){ store.audit.unshift({ ts: nowISO(), user: CURRENT_USER, action, employeeName, result }); }
function normalizeEmail(e){ return (e||'').trim().toLowerCase(); }
function isValidEmail(e){ const v = normalizeEmail(e); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
function normalizeEmpId(id){ return (id==null? '': String(id)).trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
function getSSN(){ return `${els.ssn1.value}-${els.ssn2.value}-${els.ssn3.value}`; }
function validSSNFormat(){ const s = getSSN().trim(); const normalized = s.replace(/[–—‑–−]/g,'-'); return /^\d{3}-\d{2}-\d{4}$/.test(normalized); }
async function ssnDeterministicDigest(ssnDigits){ return await sha256Hex(DETERMINISTIC_PEPPER + '' + ssnDigits); }

function isAdult(dobISO){
  const dob = new Date(dobISO);
  if (Number.isNaN(+dob)) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 18;
}
function hasAtLeastOneValidEmail(personal, district){
  const p = normalizeEmail(personal||'');
  const d = normalizeEmail(district||'');
  return isValidEmail(p) || isValidEmail(d);
}
function primaryEmailOf(emp){ return normalizeEmail(emp.emailPersonal||'') || normalizeEmail(emp.emailDistrict||''); }
function emailLocal(e){ const v = normalizeEmail(e||''); return v.split('@')[0] || ''; }
function fullName(emp){ return `${(emp.firstName||'').trim()} ${(emp.lastName||'').trim()}`.trim(); }

// Jaro-Winkler similarity for fuzzy matching
function jaroWinkler(a, b) {
  a = (a || '').toLowerCase(); b = (b || '').toLowerCase();
  if (a === b) return 1; const al=a.length, bl=b.length; if (!al || !bl) return 0;
  const matchDist = Math.floor(Math.max(al, bl) / 2) - 1;
  const aMatch = new Array(al).fill(false); const bMatch = new Array(bl).fill(false);
  let matches = 0, transpositions = 0;
  for (let i=0;i<al;i++){
    const start = Math.max(0, i - matchDist); const end = Math.min(i + matchDist + 1, bl);
    for (let j=start;j<end;j++){
      if (!bMatch[j] && a[i] === b[j]) { aMatch[i]=bMatch[j]=true; matches++; break; }
    }
  }
  if (!matches) return 0; let k=0;
  for (let i=0;i<al;i++){
    if (!aMatch[i]) continue; while (!bMatch[k]) k++; if (a[i] !== b[k]) transpositions++; k++;
  }
  const m = matches; const jaro = (m/al + m/bl + (m - transpositions/2)/m) / 3;
  let prefix = 0; for (let i=0;i<Math.min(4, al, bl); i++){ if (a[i] === b[i]) prefix++; else break; }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function findDuplicateCandidates(incoming){
  const candidates = [];
  for (const emp of store.employees){
    // Strong matches
    if (emp.ssnDet && incoming.ssnDet && emp.ssnDet === incoming.ssnDet){
      candidates.push({ emp, score: 1.00, reason: 'Deterministic SSN digest match' });
      continue;
    }
    const incPersonal = normalizeEmail(incoming.emailPersonal||'');
    const incDistrict = normalizeEmail(incoming.emailDistrict||'');
    const ePersonal = normalizeEmail(emp.emailPersonal || emp.email || '');
    const eDistrict = normalizeEmail(emp.emailDistrict || '');
    if (incPersonal && (incPersonal === ePersonal || incPersonal === eDistrict)){
      candidates.push({ emp, score: 0.95, reason: 'Exact email match (personal)' });
      continue;
    }
    if (incDistrict && (incDistrict === ePersonal || incDistrict === eDistrict)){
      candidates.push({ emp, score: 0.95, reason: 'Exact email match (district)' });
      continue;
    }
    const empIdSame = normalizeEmpId(emp.employeeId) === incoming.empIdNorm;
    if (incoming.empIdNorm && empIdSame){ candidates.push({ emp, score: 0.90, reason: 'Exact EMP-ID match' }); continue; }

    // Fuzzy rules
    const nameSim = jaroWinkler(fullName(emp), fullName(incoming));
    const dobEqual = (emp.dob||'') === (incoming.dob||'');
    if (dobEqual && nameSim >= 0.93){ candidates.push({ emp, score: 0.85, reason: `Name≈ (JW ${nameSim.toFixed(2)}) + DOB match` }); continue; }
    const incLocal = emailLocal(incPersonal || incDistrict);
    const empLocal = emailLocal(ePersonal || eDistrict);
    const lastNameSame = (emp.lastName||'').trim().toLowerCase() === (incoming.lastName||'').trim().toLowerCase();
    const localSim = jaroWinkler(incLocal, empLocal);
    if (incLocal && empLocal && localSim >= 0.92 && (lastNameSame || dobEqual)){
      candidates.push({ emp, score: 0.80, reason: `Email local≈ (JW ${localSim.toFixed(2)}) + last name/DOB` });
      continue;
    }
    const empIdSim = jaroWinkler(normalizeEmpId(emp.employeeId), incoming.empIdNorm);
    if (incoming.empIdNorm && empIdSim >= 0.92){ candidates.push({ emp, score: 0.75, reason: `EMP-ID≈ (JW ${empIdSim.toFixed(2)})` }); }
  }
  candidates.sort((a,b)=> b.score - a.score);
  return candidates;
}

function setVerifyStatus(kind, msg){ const map={ok:'ok',error:'error',warn:'warn'}; els.verifyStatus.innerHTML=`<span class="${map[kind]}">${msg}</span>`; }
function resetVerifyState(){ addVerifyResult=null; els.saveBtn.disabled=true; setVerifyStatus('warn','Please verify SSN before saving.'); }

function renderEmployees(){
  const q = (els.search.value||'').trim().toLowerCase();
  els.tableBody.innerHTML = (store.employees||[]).filter(e => {
    const name = `${e.firstName} ${e.lastName}`.toLowerCase();
    const email1 = (e.emailPersonal||'').toLowerCase();
    const email2 = (e.emailDistrict||'').toLowerCase();
    const empid = (e.employeeId||'').toLowerCase();
    const masked = (e.ssnMasked||'').toLowerCase();
    return !q || name.includes(q) || email1.includes(q) || email2.includes(q) || empid.includes(q) || masked.includes(q);
  }).map(e => {
    const status = e.verification?.status || 'pending';
    const label = { verified:'Verified (match)', mismatch:'Mismatch', deceased:'Deceased', pending:'Pending' }[status] || 'Pending';
    const last = e.verification?.at ? new Date(e.verification.at).toLocaleString() : '—';
    return `<tr>
      <td>${e.firstName||''} ${e.lastName||''}</td>
      <td>${e.dob||'—'}</td>
      <td>${e.employeeId||'—'}</td>
      <td>${e.emailPersonal||'—'}${e.emailDistrict? `<div class='tiny muted'>${e.emailDistrict}</div>`:''}</td>
      <td>${e.ssnMasked||'—'}</td>
      <td><span class="status ${status}">${label}</span></td>
      <td>${last}</td>
      <td>
        <button data-action="verify" data-id="${e.id}">Re-Verify</button>
        <button class="secondary" data-action="delete" data-id="${e.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" class="muted">No employees yet.</td></tr>`;
}
function renderAudit(){ els.auditBody.innerHTML = (store.audit||[]).map(a => `
  <tr>
    <td>${new Date(a.ts).toLocaleString()}</td>
    <td>${a.user}</td>
    <td>${a.action}</td>
    <td>${a.employeeName}</td>
    <td>${a.result||'—'}</td>
  </tr>`).join(''); }
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

// Init
load(); migrate(); renderEmployees(); renderAudit(); resetVerifyState();

// Nav
els.nav.employees.addEventListener('click', ()=>switchView('employees'));
els.nav.add.addEventListener('click', ()=>{ switchView('add'); resetVerifyState(); });
els.nav.audit.addEventListener('click', ()=>{ switchView('audit'); renderAudit(); });
els.nav.compliance.addEventListener('click', ()=>{ switchView('compliance'); });

// Live validation (emails)
['input','blur'].forEach(evt=>{
  els.emailPersonal.addEventListener(evt, ()=>{
    const ok = isValidEmail(els.emailPersonal.value); els.emailPersonalHelp.textContent = ok || !els.emailPersonal.value ? '' : 'Enter a valid personal email (e.g., name@example.com)';
  });
  els.emailDistrict.addEventListener(evt, ()=>{
    const ok = isValidEmail(els.emailDistrict.value); els.emailDistrictHelp.textContent = ok || !els.emailDistrict.value ? '' : 'Enter a valid district email (e.g., name@district.edu)';
  });
});

// Also invalidate verification if key fields change
['firstName','lastName','dob','employeeId','department'].forEach(id=>{
  const el = document.getElementById(id); if (el) el.addEventListener('input', resetVerifyState);
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
  const last  = (fd.get('lastName')||'').trim();
  const dob   = (fd.get('dob')||'').trim();
  const emailPersonal = normalizeEmail(fd.get('emailPersonal')||'');
  const emailDistrict = normalizeEmail(fd.get('emailDistrict')||'');

  if (!first || !last || !dob){ setVerifyStatus('error','Fill name and DOB before verification.'); return; }
  if (!isAdult(dob)){ setVerifyStatus('error','Employee must be 18 or older.'); return; }
  if (!hasAtLeastOneValidEmail(emailPersonal, emailDistrict)){
    setVerifyStatus('error','Enter at least one valid email (Personal or District).'); els.emailPersonal.focus(); return;
  }
  if (!els.consentAdd.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }
  if (!validSSNFormat()){ setVerifyStatus('error','SSN must be in xxx‑xx‑xxxx format.'); return; }

  const ssn = getSSN().replace(/[–—‑–−]/g,'-');
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
    addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`);
    save();
  } else {
    setVerifyStatus('error', 'Verification failed: No match.');
    els.saveBtn.disabled = true;
    addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`);
    save();
  }
});

function buildMergeRows(existing, incoming){
  const fields=[
    {key:'firstName',label:'First Name'},
    {key:'lastName',label:'Last Name'},
    {key:'dob',label:'Date of Birth'},
    {key:'employeeId',label:'Employee ID'},
    {key:'department',label:'Department'},
    {key:'emailPersonal',label:'Personal Email'},
    {key:'emailDistrict',label:'District Email'},
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
    const fields = ['firstName','lastName','dob','employeeId','department','emailPersonal','emailDistrict'];
    const updated = { ...existing };
    fields.forEach(k=>{
      const choice = document.querySelector(`input[name="use-${k}"]:checked`)?.value || 'existing';
      if (choice==='new') updated[k] = incoming[k] ?? existing[k];
    });
    if (incoming.verification?.status === 'verified') { updated.verification = incoming.verification; }
    updated.empIdNorm = normalizeEmpId(updated.employeeId || '');
    onConfirm(updated);
    els.mergeModal.close();
  };
  els.mergeModal.showModal();
}

function openPreview(record, mode, dedupeInfo, onConfirm){
  const badge = (s) => { const map={verified:'verified', mismatch:'mismatch', deceased:'deceased', pending:'pending'}; const cls=map[s]||'pending'; return `<span class="status ${cls}">${s}</span>`; };
  const lines = [
    `<strong>Name:</strong> ${record.firstName||'—'} ${record.lastName||''}`,
    `<strong>DOB:</strong> ${record.dob||'—'}`,
    `<strong>EMP ID:</strong> ${record.employeeId||'—'}`,
    `<strong>Department:</strong> ${record.department||'—'}`,
    `<strong>Emails:</strong> ${(record.emailPersonal||'—')}${record.emailDistrict? `, ${record.emailDistrict}`:''}`,
    `<strong>SSN (masked):</strong> ${record.ssnMasked||'—'}`,
    `<strong>Verification:</strong> ${badge(record.verification?.status)} — ${record.verification?.message||''} ${record.verification?.at? 'at '+record.verification.at:''}`,
  ];
  const dupHtml = (dedupeInfo&&dedupeInfo.length)
    ? `<div class="callout"><strong>Possible duplicates detected:</strong><ul>${dedupeInfo.map(d=>`<li>${fullName(d.emp)} — ${d.reason} (score ${d.score.toFixed(2)})</li>`).join('')}</ul></div>`
    : '';
  els.previewBody.innerHTML = `<div class="grid"><div class="card"><div class="tiny">${lines.map(l=>`<div>${l}</div>`).join('')}</div></div>${dupHtml ? `<div class="card">${dupHtml}</div>`:''}</div>`;
  els.previewConfirmBtn.onclick = ()=>{ els.previewModal.close(); onConfirm?.(); };
  els.previewCancelBtn.onclick  = ()=>{ els.previewModal.close(); };
  els.previewModal.showModal();
}

// Submit (with preview and fuzzy duplicates)
els.addForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!addVerifyResult || addVerifyResult.status !== 'verified'){ setVerifyStatus('error','Please verify SSN successfully before saving.'); return; }
  if (!els.consentAdd.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }

  const fd = new FormData(els.addForm);
  const firstName   = (fd.get('firstName')   || '').trim();
  const lastName    = (fd.get('lastName')    || '').trim();
  const dob         = (fd.get('dob')         || '').trim();
  const employeeId  = (fd.get('employeeId')  || '').trim();
  const department  = (fd.get('department')  || '').trim();
  const emailPersonal = normalizeEmail(fd.get('emailPersonal') || '');
  const emailDistrict = normalizeEmail(fd.get('emailDistrict') || '');

  if (!hasAtLeastOneValidEmail(emailPersonal, emailDistrict)){
    els.emailPersonal.focus(); els.emailPersonalHelp.textContent = 'Enter at least one valid email.'; return;
  }

  const ssnDigits = addVerifyResult.ssn.replace(/\D/g,'');
  const salt = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const ssnHash = await sha256Hex(ssnDigits + ':' + salt); // per-record salt hash
  const ssnDet  = await ssnDeterministicDigest(ssnDigits); // deterministic digest (demo)
  const empIdNorm = normalizeEmpId(employeeId);

  const incoming = {
    id: crypto.randomUUID(), firstName, lastName, dob, employeeId, department,
    emailPersonal, emailDistrict,
    empIdNorm,
    ssnMasked: maskSSN(ssnDigits),
    ssnHash, salt, ssnDet,
    verification: { status:'verified', message:addVerifyResult.message, at:addVerifyResult.at, by: CURRENT_USER }
  };

  // Exact duplicate check (SSN OR email OR EMP-ID)
  const exactDup = store.employees.find(emp =>
    (emp.ssnDet && emp.ssnDet === ssnDet) ||
    (normalizeEmail(emp.emailPersonal||emp.email||'') === emailPersonal) ||
    (normalizeEmail(emp.emailDistrict||'') === emailDistrict) ||
    (normalizeEmpId(emp.employeeId) === empIdNorm)
  );

  const candidates = exactDup ? [{ emp: exactDup, score:1, reason:'Exact match' }] : findDuplicateCandidates(incoming);

  const finishAndNavigate = (record, mode, dedupeInfo=[]) => {
    openPreview(record, mode, dedupeInfo, () => {
      if (mode === 'update'){
        const idx = store.employees.findIndex(e=>e.id===record.id);
        if (idx>=0) store.employees[idx] = record;
        addAudit('UPDATE', `${record.firstName} ${record.lastName}`, 'updated via merge + preview');
      } else {
        store.employees.unshift(record);
        addAudit('CREATE', `${record.firstName} ${record.lastName}`, 'created with pre‑verification (+ preview)');
      }
      save();
      els.addForm.reset();
      [els.ssn1, els.ssn2, els.ssn3].forEach(i=> i.value='');
      resetVerifyState();
      renderEmployees();
      switchView('employees');
    });
  };

  if (candidates.length){
    const dup = candidates[0].emp;
    openMerge(dup, incoming, (merged)=>{
      // keep identity fields from existing
      merged.id = dup.id; merged.ssnHash = dup.ssnHash; merged.salt = dup.salt; merged.ssnDet = dup.ssnDet; merged.ssnMasked = dup.ssnMasked;
      merged.empIdNorm = normalizeEmpId(merged.employeeId || '');
      finishAndNavigate(merged, 'update', candidates.slice(0,3));
    });
    return;
  }

  // No duplicates — preview new record
  finishAndNavigate(incoming, 'create', []);
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
  a.href = url; a.download = 'ssn-demo-inline-brand-v4.1-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
});
els.importFile.addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
  r.onload = ()=>{ try { const data = JSON.parse(r.result);
    if (data.employees && data.audit){
      store.employees = data.employees.map(emp=>({
        ...emp,
        emailPersonal: normalizeEmail(emp.emailPersonal || emp.email || ''),
        emailDistrict: normalizeEmail(emp.emailDistrict || ''),
        empIdNorm: normalizeEmpId(emp.employeeId || '')
      }));
      store.audit = data.audit; save(); renderEmployees(); renderAudit();
    } else alert('Invalid file'); } catch { alert('Could not parse file'); } };
  r.readAsText(f);
});
