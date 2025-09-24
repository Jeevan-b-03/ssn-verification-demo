(function(){
  'use strict';
  const qs  = (s, r=document) => r.querySelector(s);
  const CURRENT_USER = 'hr-admin@demo';
  const DETERMINISTIC_PEPPER = 'DEMO_PEPPER_v1';
  const store = { employees: [], audit: [] };

  // Elements
  const els = {};
  function bindEls(){
    els.views = { employees: qs('#view-employees'), add: qs('#view-add'), audit: qs('#view-audit'), compliance: qs('#view-compliance') };
    els.navBar = qs('#main-nav');
    els.tableBody = qs('#employeeTable tbody');
    els.auditBody = qs('#auditTable tbody');
    els.addForm = qs('#addForm');
    els.search = qs('#search');
    els.exportBtn = qs('#exportBtn');
    els.importFile = qs('#importFile');
    els.consentAdd = qs('#consentAdd');
    els.verifyBtn = qs('#verifyBtn');
    els.saveBtn = qs('#saveBtn');
    els.verifyStatus = qs('#verifyStatus');
    els.emailPersonal = qs('#emailPersonal');
    els.emailPersonalHelp = qs('#emailPersonalHelp');
    els.emailDistrict = qs('#emailDistrict');
    els.emailDistrictHelp = qs('#emailDistrictHelp');
    els.phone = qs('#phone');
    els.phoneHelp = qs('#phoneHelp');
    els.location = qs('#location');
    els.locationHelp = qs('#locationHelp');
    els.ssn1 = qs('#ssn1'); els.ssn2 = qs('#ssn2'); els.ssn3 = qs('#ssn3');
    // candidates dialog
    els.candModal = qs('#candidatesModal');
    els.candidatesBody = qs('#candidatesBody');
    els.candSkipBtn = qs('#candSkipBtn');
    els.candCloseBtn = qs('#candCloseBtn');
    // merge dialog
    els.mergeModal = qs('#mergeModal');
    els.mergeBody = qs('#mergeBody');
    els.mergeConfirmBtn = qs('#mergeConfirmBtn');
    els.mergeBackBtn = qs('#mergeBackBtn');
    // preview dialog
    els.previewModal = qs('#previewModal');
    els.previewBody = qs('#previewBody');
    els.previewConfirmBtn = qs('#previewConfirmBtn');
    els.previewCancelBtn = qs('#previewCancelBtn');
  }

  const encoder = new TextEncoder();
  function maskSSN(ssn){ const d = ssn.replace(/\D/g, '').padStart(9, '*'); return `***-**-${d.slice(-4)}`; }
  async function sha256Hex(str){ const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str)); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function nowISO(){ return new Date().toISOString(); }
  function save(){ localStorage.setItem('ssn-demo-inline-brand-v4', JSON.stringify(store)); }
  function load(){ try{ Object.assign(store, JSON.parse(localStorage.getItem('ssn-demo-inline-brand-v4') || '{}')); }catch{} }
  function migrate(){ store.employees = (store.employees||[]).map(emp=>({ ...emp, emailPersonal: (emp.emailPersonal||emp.email||'').trim().toLowerCase(), emailDistrict: (emp.emailDistrict||'').trim().toLowerCase(), empIdNorm: normalizeEmpId(emp.employeeId||''), phone: emp.phone||'', location: emp.location||'' })); }
  function addAudit(action, employeeName, result){ store.audit.unshift({ ts: nowISO(), user: CURRENT_USER, action, employeeName, result }); }
  function normalizeEmail(e){ return (e||'').trim().toLowerCase(); }
  function isValidEmail(e){ const v = normalizeEmail(e); return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function normalizeEmpId(id){ return (id==null? '': String(id)).trim().toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function isValidPhone(p){ const v = (p||'').trim(); return /^\+?[0-9 ()-]{7,20}$/.test(v); }
  function getSSN(){ return `${els.ssn1.value}-${els.ssn2.value}-${els.ssn3.value}`; }
  function validSSNFormat(){ const s = getSSN().trim(); const normalized = s.replace(/[–—‑–−]/g,'-'); return /^\d{3}-\d{2}-\d{4}$/.test(normalized); }
  async function ssnDeterministicDigest(ssnDigits){ return await sha256Hex(DETERMINISTIC_PEPPER + '' + ssnDigits); }
  function isAdult(dobISO){ const dob = new Date(dobISO); if (Number.isNaN(+dob)) return false; const t=new Date(); let age=t.getFullYear()-dob.getFullYear(); const m=t.getMonth()-dob.getMonth(); if (m<0 || (m===0 && t.getDate()<dob.getDate())) age--; return age>=18; }
  function hasAtLeastOneValidEmail(personal, district){ const p=normalizeEmail(personal||''); const d=normalizeEmail(district||''); return isValidEmail(p) || isValidEmail(d); }
  function emailLocal(e){ const v=normalizeEmail(e||''); return v.split('@')[0]||''; }
  function fullName(emp){ return `${(emp.firstName||'').trim()} ${(emp.lastName||'').trim()}`.trim(); }

  function jaroWinkler(a,b){ a=(a||'').toLowerCase(); b=(b||'').toLowerCase(); if(a===b) return 1; const al=a.length, bl=b.length; if(!al||!bl) return 0; const md=Math.floor(Math.max(al,bl)/2)-1; const am=new Array(al).fill(false), bm=new Array(bl).fill(false); let m=0,t=0; for(let i=0;i<al;i++){ const s=Math.max(0,i-md), e=Math.min(i+md+1,bl); for(let j=s;j<e;j++){ if(!bm[j] && a[i]===b[j]){ am[i]=bm[j]=true; m++; break; } } } if(!m) return 0; let k=0; for(let i=0;i<al;i++){ if(!am[i]) continue; while(!bm[k]) k++; if(a[i]!==b[k]) t++; k++; } const j=(m/al + m/bl + (m - t/2)/m)/3; let p=0; for(let i=0;i<Math.min(4,al,bl);i++){ if(a[i]===b[i]) p++; else break; } return j + p*0.1*(1-j); }

  function findDuplicateCandidates(incoming){
    const candidates = [];
    for (const emp of store.employees){
      // Strongest: deterministic SSN digest
      if (emp.ssnDet && incoming.ssnDet && emp.ssnDet === incoming.ssnDet){
        candidates.push({ emp, score: 1.00, reason: 'Deterministic SSN digest match' });
        continue;
      }

      // Email exact matches
      const incP = normalizeEmail(incoming.emailPersonal||'');
      const incD = normalizeEmail(incoming.emailDistrict||'');
      const eP   = normalizeEmail(emp.emailPersonal || emp.email || '');
      const eD   = normalizeEmail(emp.emailDistrict || '');
      if (incP && (incP === eP || incP === eD)) { candidates.push({ emp, score: 0.95, reason: 'Exact email match (personal)' }); continue; }
      if (incD && (incD === eP || incD === eD)) { candidates.push({ emp, score: 0.95, reason: 'Exact email match (district)' }); continue; }

      // EMP ID exact using emp.empIdNorm if present, else normalize on the fly
      const empIdLeft = (emp.empIdNorm && emp.empIdNorm.length) ? emp.empIdNorm : normalizeEmpId(emp.employeeId || '');
      if (incoming.empIdNorm && empIdLeft && empIdLeft === incoming.empIdNorm) {
        candidates.push({ emp, score: 0.90, reason: 'Exact EMP‑ID match' });
        continue;
      }

      // Fuzzy rules
      const nameSim = jaroWinkler(fullName(emp), fullName(incoming));
      const dobEqual = (emp.dob||'') === (incoming.dob||'');
      if (dobEqual && nameSim >= 0.93) { candidates.push({ emp, score: 0.85, reason: `Name≈ (JW ${nameSim.toFixed(2)}) + DOB match` }); continue; }

      const incLocal = emailLocal(incP || incD);
      const empLocal = emailLocal(eP || eD);
      const lastNameSame = (emp.lastName||'').trim().toLowerCase() === (incoming.lastName||'').trim().toLowerCase();
      const localSim = jaroWinkler(incLocal, empLocal);
      if (incLocal && empLocal && localSim >= 0.92 && (lastNameSame || dobEqual)) {
        candidates.push({ emp, score: 0.80, reason: `Email local≈ (JW ${localSim.toFixed(2)}) + last name/DOB` });
        continue;
      }

      const empIdSim = jaroWinkler(empIdLeft, incoming.empIdNorm);
      if (incoming.empIdNorm && empIdLeft && empIdSim >= 0.92) {
        candidates.push({ emp, score: 0.75, reason: `EMP‑ID≈ (JW ${empIdSim.toFixed(2)})` });
      }
    }
    candidates.sort((a,b)=> b.score - a.score);
    return candidates;
  }

  function setVerifyStatus(kind,msg){ const map={ok:'ok',error:'error',warn:'warn'}; if (els.verifyStatus) els.verifyStatus.innerHTML=`<span class="${map[kind]}">${msg}</span>`; }
  function resetVerifyState(){ addVerifyResult=null; if (els.saveBtn) els.saveBtn.disabled=true; setVerifyStatus('warn','Please verify SSN before saving.'); }

  function renderEmployees(){ if(!els.tableBody) return; const q=(els.search?.value||'').trim().toLowerCase(); els.tableBody.innerHTML=(store.employees||[]).filter(e=>{ const name=`${e.firstName} ${e.lastName}`.toLowerCase(); const email1=(e.emailPersonal||'').toLowerCase(); const email2=(e.emailDistrict||'').toLowerCase(); const empid=(e.employeeId||'').toLowerCase(); const masked=(e.ssnMasked||'').toLowerCase(); const phone=(e.phone||'').toLowerCase(); const loc=(e.location||'').toLowerCase(); return !q || name.includes(q)||email1.includes(q)||email2.includes(q)||empid.includes(q)||masked.includes(q)||phone.includes(q)||loc.includes(q); }).map(e=>{ const status=e.verification?.status||'pending'; const label={verified:'Verified (match)', mismatch:'Mismatch', deceased:'Deceased', pending:'Pending'}[status]||'Pending'; const last=e.verification?.at? new Date(e.verification.at).toLocaleString():'—'; return `<tr>
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
    </tr>`; }).join('') || `<tr><td colspan="8" class="muted">No employees yet.</td></tr>`; }
  function renderAudit(){ if(!els.auditBody) return; els.auditBody.innerHTML=(store.audit||[]).map(a=>`<tr><td>${new Date(a.ts).toLocaleString()}</td><td>${a.user}</td><td>${a.action}</td><td>${a.employeeName}</td><td>${a.result||'—'}</td></tr>`).join(''); }
  function switchView(v){ if(!els.views) return; Object.values(els.views).forEach(x=>x?.classList.add('hidden')); const activeBtn = document.querySelector(`[data-view].active`); if(activeBtn) activeBtn.classList.remove('active'); const show = els.views[v]; if(show) show.classList.remove('hidden'); const btn = document.querySelector(`[data-view='${v}']`); if(btn) btn.classList.add('active'); }

  function mockVerify(ssn){ const clean=ssn.replace(/\D/g,''); if(clean.length!==9) return {status:'mismatch',message:'Invalid SSN length'}; const last=parseInt(clean.slice(-1),10); if(last===0) return {status:'deceased',message:'Death indicator present (demo)'}; const sum=clean.split('').reduce((a,b)=>a+parseInt(b,10),0); return (sum%2===0)? {status:'verified',message:'Yes/Match (demo)'} : {status:'mismatch',message:'No/Does not match (demo)'}; }

  function onlyDigits(e){ e.target.value=e.target.value.replace(/\D/g,''); }
  function autoAdvance(e){ const t=e.target, max=+t.getAttribute('maxlength'); if(t.value.length>=max){ if(t.id==='ssn1') els.ssn2?.focus(); else if(t.id==='ssn2') els.ssn3?.focus(); } }
  function autoBackspace(e){ const t=e.target; if(e.key==='Backspace' && t.value.length===0){ if(t.id==='ssn3') els.ssn2?.focus(); else if(t.id==='ssn2') els.ssn1?.focus(); } }
  function handlePaste(e){ const d=(e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,''); if(d.length===9){ e.preventDefault(); if(els.ssn1&&els.ssn2&&els.ssn3){ els.ssn1.value=d.slice(0,3); els.ssn2.value=d.slice(3,5); els.ssn3.value=d.slice(5); els.ssn3.focus(); } } }

  let addVerifyResult=null; // {status,message,at,ssn}

  function buildMergeRows(existing,incoming){ const fields=[
    {key:'firstName',label:'First Name'}, {key:'lastName',label:'Last Name'}, {key:'dob',label:'Date of Birth'},
    {key:'employeeId',label:'Employee ID'}, {key:'department',label:'Department'}, {key:'phone',label:'Phone Number'}, {key:'location',label:'Primary Location'},
    {key:'emailPersonal',label:'Personal Email'}, {key:'emailDistrict',label:'District Email'},
  ]; els.mergeBody.innerHTML=fields.map(f=>{ const ex=existing[f.key]??''; const nv=incoming[f.key]??''; const id=`use-${f.key}`; return `<tr>
    <td>${f.label}</td>
    <td class="value">${ex || '<span class="muted">—</span>'}</td>
    <td class="value">${nv || '<span class="muted">—</span>'}</td>
    <td class="choice"><label><input type="radio" name="${id}" value="existing" checked /> Existing</label> <label><input type="radio" name="${id}" value="new" /> New</label></td>
  </tr>`; }).join(''); }

  function openMerge(existing, incoming, onConfirm, onCancel){
    buildMergeRows(existing, incoming);
    els.mergeConfirmBtn.onclick = () => {
      const fields=['firstName','lastName','dob','employeeId','department','phone','location','emailPersonal','emailDistrict'];
      const updated={...existing};
      fields.forEach(k=>{ const choice = document.querySelector(`input[name="use-${k}"]:checked`)?.value || 'existing'; if (choice==='new') updated[k] = incoming[k] ?? existing[k]; });
      if (incoming.verification?.status === 'verified') updated.verification = incoming.verification;
      updated.empIdNorm = normalizeEmpId(updated.employeeId || '');
      els.mergeModal.close();
      onConfirm?.(updated);
    };
    els.mergeBackBtn.onclick = () => { els.mergeModal.close(); onCancel?.(); };
    els.mergeModal.showModal();
  }

  function openPreview(record, mode, dedupeInfo, onConfirm){
    const badge=(s)=>{ const map={verified:'verified',mismatch:'mismatch',deceased:'deceased',pending:'pending'}; const cls=map[s]||'pending'; return `<span class="status ${cls}">${s}</span>`; };
    const lines=[
      `<strong>Name:</strong> ${record.firstName||'—'} ${record.lastName||''}`,
      `<strong>DOB:</strong> ${record.dob||'—'}`,
      `<strong>EMP ID:</strong> ${record.employeeId||'—'}`,
      `<strong>Department:</strong> ${record.department||'—'}`,
      `<strong>Phone:</strong> ${record.phone||'—'}`,
      `<strong>Primary Location:</strong> ${record.location||'—'}`,
      `<strong>Emails:</strong> ${(record.emailPersonal||'—')}${record.emailDistrict? `, ${record.emailDistrict}`:''}`,
      `<strong>SSN (masked):</strong> ${record.ssnMasked||'—'}`,
      `<strong>Verification:</strong> ${badge(record.verification?.status)} — ${record.verification?.message||''} ${record.verification?.at? 'at '+record.verification.at:''}`,
    ];
    const dupHtml = (dedupeInfo&&dedupeInfo.length)
      ? `<div class="callout"><strong>Possible duplicates:</strong><ul>${dedupeInfo.slice(0,5).map(d=>`<li>${fullName(d.emp)} — ${d.reason} (score ${d.score.toFixed(2)})</li>`).join('')}</ul></div>`
      : '';
    els.previewBody.innerHTML = `<div class="grid"><div class="card"><div class="tiny">${lines.map(l=>`<div>${l}</div>`).join('')}</div></div>${dupHtml? `<div class="card">${dupHtml}</div>`:''}</div>`;
    els.previewConfirmBtn.onclick = ()=>{ els.previewModal.close(); onConfirm?.(); };
    els.previewCancelBtn.onclick  = ()=>{ els.previewModal.close(); };
    els.previewModal.showModal();
  }

  function renderCandidatesModal(incoming, candidates, onPick, onSkip){
    els.candidatesBody.innerHTML = candidates.map((c, i) => {
      const e = c.emp;
      const emails = [e.emailPersonal, e.emailDistrict].filter(Boolean).join(', ') || '—';
      return `<tr class="cand-row" data-index="${i}">
        <td class="cand-score">${c.score.toFixed(2)}</td>
        <td>${e.firstName||''} ${e.lastName||''}</td>
        <td>${e.dob||'—'}</td>
        <td>${e.employeeId||'—'}</td>
        <td>${emails}</td>
        <td>${c.reason}</td>
        <td><button type="button" data-action="pick" data-index="${i}">Review & Merge</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="muted">No candidates found.</td></tr>`;

    // Row / button click
    els.candidatesBody.onclick = (ev)=>{
      const btn = ev.target.closest('[data-action=pick], .cand-row');
      if(!btn) return;
      const idx = +btn.getAttribute('data-index');
      const chosen = candidates[idx];
      if(!chosen) return;
      els.candModal.close();
      onPick?.(chosen.emp);
    };

    els.candSkipBtn.onclick = ()=>{ els.candModal.close(); onSkip?.(); };
    els.candCloseBtn.onclick = ()=>{ els.candModal.close(); };

    els.candModal.showModal();
  }

  function wireEvents(){
    // Nav
    els.navBar?.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-view]');
      if(!btn) return; e.preventDefault(); const v = btn.getAttribute('data-view'); switchView(v); if (v==='audit') renderAudit(); if (v==='add') resetVerifyState();
    });

    // Live validation
    ['input','blur'].forEach(evt=>{
      els.emailPersonal?.addEventListener(evt, ()=>{ const ok=isValidEmail(els.emailPersonal.value); els.emailPersonalHelp.textContent = ok || !els.emailPersonal.value ? '' : 'Format: name@example.com'; });
      els.emailDistrict?.addEventListener(evt, ()=>{ const ok=isValidEmail(els.emailDistrict.value); els.emailDistrictHelp.textContent = ok || !els.emailDistrict.value ? '' : 'Format: name@district.edu'; });
      els.phone?.addEventListener(evt, ()=>{ const ok=isValidPhone(els.phone.value); els.phoneHelp.textContent = ok || !els.phone.value ? '' : 'Format: +1 415 555 2671'; });
    });

    // Invalidate verification when key fields change
    ['firstName','lastName','dob','employeeId','department'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', resetVerifyState); });

    // SSN inputs
    [els.ssn1,els.ssn2,els.ssn3].forEach(inp=>{ if(!inp) return; inp.addEventListener('input',(e)=>{ onlyDigits(e); autoAdvance(e); resetVerifyState(); }); inp.addEventListener('keydown', autoBackspace); inp.addEventListener('paste', handlePaste); });

    // Verify
    els.verifyBtn?.addEventListener('click', ()=>{
      const fd=new FormData(els.addForm);
      const first=(fd.get('firstName')||'').trim();
      const last =(fd.get('lastName')||'').trim();
      const dob  =(fd.get('dob')||'').trim();
      const emailPersonal=normalizeEmail(fd.get('emailPersonal')||'');
      const emailDistrict=normalizeEmail(fd.get('emailDistrict')||'');

      if(!first||!last||!dob){ setVerifyStatus('error','Fill name and DOB before verification.'); return; }
      if(!isAdult(dob)){ setVerifyStatus('error','Employee must be 18 or older.'); return; }
      if(!hasAtLeastOneValidEmail(emailPersonal,emailDistrict)){ setVerifyStatus('error','Enter at least one valid email (Personal or District).'); els.emailPersonal?.focus(); return; }
      if(!els.consentAdd?.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }
      if(!validSSNFormat()){ setVerifyStatus('error','SSN must be in xxx‑xx‑xxxx format.'); return; }

      const ssn=getSSN().replace(/[–—‑–−]/g,'-');
      const res=mockVerify(ssn);
      addVerifyResult={...res, at:nowISO(), ssn};
      if(res.status==='verified'){ setVerifyStatus('ok', `Verified ✓ — ${res.message}`); if(els.saveBtn) els.saveBtn.disabled=false; addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`); save(); }
      else if(res.status==='deceased'){ setVerifyStatus('error','Verification failed: SSN has a death indicator.'); if(els.saveBtn) els.saveBtn.disabled=true; addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`); save(); }
      else{ setVerifyStatus('error','Verification failed: No match.'); if(els.saveBtn) els.saveBtn.disabled=true; addAudit('VERIFY', `${first} ${last}`, `${res.status}: ${res.message}`); save(); }
    });

    // Submit (show candidates first, then merge per pick, or skip to save new)
    els.addForm?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!addVerifyResult || addVerifyResult.status!=='verified'){ setVerifyStatus('error','Please verify SSN successfully before saving.'); return; }
      if(!els.consentAdd?.checked){ setVerifyStatus('error','You must confirm SSA‑89 consent is on file.'); return; }

      const fd=new FormData(els.addForm);
      const firstName=(fd.get('firstName')||'').trim();
      const lastName=(fd.get('lastName')||'').trim();
      const dob=(fd.get('dob')||'').trim();
      const employeeId=(fd.get('employeeId')||'').trim();
      const department=(fd.get('department')||'').trim();
      const phone=(fd.get('phone')||'').trim();
      const location=(fd.get('location')||'');
      const emailPersonal=normalizeEmail(fd.get('emailPersonal')||'');
      const emailDistrict=normalizeEmail(fd.get('emailDistrict')||'');

      if(!hasAtLeastOneValidEmail(emailPersonal,emailDistrict)){ els.emailPersonal?.focus(); els.emailPersonalHelp.textContent='Enter at least one valid email.'; return; }
      if(phone && !isValidPhone(phone)){ els.phone?.focus(); els.phoneHelp.textContent='Enter a valid phone (e.g., +1 415 555 2671)'; return; }

      const ssnDigits=addVerifyResult.ssn.replace(/\D/g,'');
      const salt=crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
      const ssnHash=await sha256Hex(ssnDigits + ':' + salt);
      const ssnDet =await ssnDeterministicDigest(ssnDigits);
      const empIdNorm=normalizeEmpId(employeeId);

      const incoming={ id: crypto.randomUUID(), firstName, lastName, dob, employeeId, department, phone, location,
        emailPersonal, emailDistrict, empIdNorm, ssnMasked: maskSSN(ssnDigits), ssnHash, salt, ssnDet,
        verification:{ status:'verified', message:addVerifyResult.message, at:addVerifyResult.at, by: CURRENT_USER }
      };

      const candidates = findDuplicateCandidates(incoming);

      const proceedPreviewCreate = ()=>{
        openPreview(incoming, 'create', candidates, ()=>{
          store.employees.unshift(incoming);
          addAudit('CREATE', `${incoming.firstName} ${incoming.lastName}`, 'created with pre‑verification (+ preview)');
          save(); els.addForm?.reset(); [els.ssn1,els.ssn2,els.ssn3].forEach(i=> i && (i.value='')); resetVerifyState(); renderEmployees(); switchView('employees');
        });
      };

      if(!candidates.length){ proceedPreviewCreate(); return; }

      // Show candidates first
      renderCandidatesModal(incoming, candidates, (pickedEmp)=>{
        // Open merge for picked existing vs incoming
        openMerge(pickedEmp, incoming, (merged)=>{
          // After merge, go to preview as UPDATE
          openPreview(merged, 'update', candidates, ()=>{
            const idx=store.employees.findIndex(e=>e.id===pickedEmp.id);
            if(idx>=0) store.employees[idx]=merged; else store.employees.unshift(merged);
            addAudit('UPDATE', `${merged.firstName} ${merged.lastName}`, 'updated via merge + preview');
            save(); els.addForm?.reset(); [els.ssn1,els.ssn2,els.ssn3].forEach(i=> i && (i.value='')); resetVerifyState(); renderEmployees(); switchView('employees');
          });
        }, ()=>{
          // Back from merge -> reopen candidates
          renderCandidatesModal(incoming, candidates, (emp)=>{ /* recursive pick */ openMerge(emp, incoming, (m)=>{
            openPreview(m, 'update', candidates, ()=>{ const idx=store.employees.findIndex(e=>e.id===emp.id); if(idx>=0) store.employees[idx]=m; else store.employees.unshift(m); addAudit('UPDATE', `${m.firstName} ${m.lastName}`, 'updated via merge + preview'); save(); els.addForm?.reset(); [els.ssn1,els.ssn2,els.ssn3].forEach(i=> i && (i.value='')); resetVerifyState(); renderEmployees(); switchView('employees'); });
          }, ()=>{ renderCandidatesModal(incoming, candidates, arguments.callee, proceedPreviewCreate); }); }, proceedPreviewCreate);
        });
      }, proceedPreviewCreate);

    });

    // Table actions
    els.tableBody?.addEventListener('click',(e)=>{ const btn=e.target.closest('button'); if(!btn) return; const id=btn.dataset.id; const action=btn.dataset.action; const emp=store.employees.find(x=>x.id===id); if(!emp) return; if(action==='delete'){ if(confirm(`Delete ${emp.firstName} ${emp.lastName}?`)){ store.employees = store.employees.filter(x=>x.id!==id); addAudit('DELETE', `${emp.firstName} ${emp.lastName}`); save(); renderEmployees(); } } if(action==='verify'){ alert('Re-verify would call SSA in production. (Demo)'); } });

    // Search
    els.search?.addEventListener('input', renderEmployees);

    // Export/Import
    els.exportBtn?.addEventListener('click',()=>{ const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ssn-demo-inline-brand-v4.3-data.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); });
    els.importFile?.addEventListener('change',(e)=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(data.employees && data.audit){ store.employees=data.employees.map(emp=>({ ...emp, emailPersonal: normalizeEmail(emp.emailPersonal || emp.email || ''), emailDistrict: normalizeEmail(emp.emailDistrict || ''), empIdNorm: normalizeEmpId(emp.employeeId || ''), phone: emp.phone||'', location: emp.location||'' })); store.audit = data.audit; save(); renderEmployees(); renderAudit(); } else alert('Invalid file'); } catch{ alert('Could not parse file'); } }; r.readAsText(f); });
  }

  // Bootstrap
  window.addEventListener('DOMContentLoaded', () => {
    try { bindEls(); load(); migrate(); renderEmployees(); renderAudit(); resetVerifyState(); wireEvents(); switchView('employees'); console.debug('[SSN Demo] Initialized v4.3'); }
    catch (err) { console.error('[SSN Demo] Init failed:', err); alert('App failed to initialize. Open DevTools → Console and share the error with me.'); }
  });
})();
