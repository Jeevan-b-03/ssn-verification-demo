// Simple demo app — data is stored locally in your browser.
// IMPORTANT: Do not use real SSNs here. This is a mock for demonstration only.

const store = {
  employees: [],
  audit: [],
};

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
};

const CURRENT_USER = 'hr-admin@demo';

// ---------- Utilities ----------
const encoder = new TextEncoder();

function maskSSN(ssn) {
  const digits = ssn.replace(/\D/g, '').padStart(9, '*');
  return `***-**-${digits.slice(-4)}`;
}

async function sha256Hex(str) {
  if (!window.crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  }
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function nowISO() { return new Date().toISOString(); }

function save() {
  localStorage.setItem('ssn-demo', JSON.stringify(store));
}

function load() {
  const raw = localStorage.getItem('ssn-demo');
  if (raw) {
    try { Object.assign(store, JSON.parse(raw)); }
    catch { }
  }
}

function addAudit(action, employee, result) {
  store.audit.unshift({ ts: nowISO(), user: CURRENT_USER, action, employeeName: `${employee.firstName} ${employee.lastName}` , result });
}

function renderEmployees() {
  const q = (els.search.value || '').trim().toLowerCase();
  const rows = store.employees
    .filter(e => !q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || (e.ssnMasked||'').includes(q))
    .map(e => {
      const statusCls = e.verification?.status || 'pending';
      const statusLabel = {
        verified: 'Verified (match)',
        mismatch: 'Mismatch',
        deceased: 'Deceased flag',
        pending: 'Pending',
      }[statusCls] || 'Pending';
      const last = e.verification?.at ? new Date(e.verification.at).toLocaleString() : '—';
      return `<tr>
        <td>${e.firstName} ${e.lastName}</td>
        <td>${e.dob||''}</td>
        <td>${e.ssnMasked||''}</td>
        <td><span class="status ${statusCls}">${statusLabel}</span></td>
        <td>${last}</td>
        <td>
          <button data-action="verify" data-id="${e.id}">Verify</button>
          <button class="secondary" data-action="delete" data-id="${e.id}">Delete</button>
        </td>
      </tr>`;
    }).join('');
  els.tableBody.innerHTML = rows || `<tr><td colspan="6" class="muted">No employees yet.</td></tr>`;
}

function renderAudit() {
  els.auditBody.innerHTML = store.audit.map(a => `
    <tr>
      <td>${new Date(a.ts).toLocaleString()}</td>
      <td>${a.user}</td>
      <td>${a.action}</td>
      <td>${a.employeeName}</td>
      <td>${a.result || '—'}</td>
    </tr>
  `).join('');
}

function switchView(view) {
  Object.values(els.views).forEach(v => v.classList.add('hidden'));
  Object.values(els.nav).forEach(b => b.classList.remove('active'));
  els.views[view].classList.remove('hidden');
  els.nav[view].classList.add('active');
}

function mockVerify(ssn, name, dob) {
  const clean = ssn.replace(/\D/g, '');
  const last = parseInt(clean.slice(-1), 10);
  if (isNaN(last)) return { status: 'mismatch', message: 'Invalid SSN format' };
  if (last === 0) return { status: 'deceased', message: 'Death indicator present (demo)' };
  const sum = clean.split('').reduce((a, b) => a + parseInt(b, 10), 0);
  if (sum % 2 === 0) return { status: 'verified', message: 'Yes/Match (demo)' };
  return { status: 'mismatch', message: 'No/Does not match (demo)' };
}

load();
renderEmployees();
renderAudit();

els.nav.employees.addEventListener('click', () => switchView('employees'));
els.nav.add.addEventListener('click', () => switchView('add'));
els.nav.audit.addEventListener('click', () => { switchView('audit'); renderAudit(); });

els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.addForm);
  const record = Object.fromEntries(fd.entries());
  if (!record.firstName || !record.lastName || !record.dob || !record.ssn) return;
  const ssnDigits = record.ssn.replace(/\D/g, '');
  if (ssnDigits.length !== 9) { alert('SSN must be 9 digits'); return; }
  const salt = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  const ssnHash = await sha256Hex(ssnDigits + ':' + salt);
  const emp = {
    id: crypto.randomUUID(),
    firstName: record.firstName.trim(),
    lastName: record.lastName.trim(),
    dob: record.dob,
    employeeId: record.employeeId || '',
    department: record.department || '',
    ssnMasked: maskSSN(ssnDigits),
    ssnHash,
    salt,
    verification: { status: 'pending' },
  };
  store.employees.unshift(emp);
  addAudit('CREATE', emp);
  save();
  els.addForm.reset();
  renderEmployees();
  switchView('employees');
});

els.tableBody.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const emp = store.employees.find(x => x.id === id);
  if (!emp) return;

  if (action === 'delete') {
    if (confirm(`Delete ${emp.firstName} ${emp.lastName}?`)) {
      store.employees = store.employees.filter(x => x.id !== id);
      addAudit('DELETE', emp);
      save();
      renderEmployees();
    }
  }
  if (action === 'verify') {
    openVerify(emp);
  }
});

function openVerify(emp) {
  els.verifyEmp.textContent = `${emp.firstName} ${emp.lastName} — ${emp.ssnMasked}`;
  els.consentCheckbox.checked = false;
  els.runVerifyBtn.onclick = () => runVerify(emp);
  document.getElementById('verifyModal').showModal();
}

function runVerify(emp) {
  if (!els.consentCheckbox.checked) { alert('You must confirm written consent (SSA-89) is on file.'); return; }
  const res = mockVerify(emp.ssnMasked, `${emp.firstName} ${emp.lastName}`, emp.dob);
  emp.verification = { status: res.status, message: res.message, at: nowISO(), by: CURRENT_USER };
  addAudit('VERIFY', emp, `${res.status}: ${res.message}`);
  save();
  renderEmployees();
  document.getElementById('verifyModal').close();
}

els.search.addEventListener('input', renderEmployees);

els.exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ssn-demo-data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

els.importFile.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.employees && data.audit) {
        store.employees = data.employees; store.audit = data.audit; save();
        renderEmployees(); renderAudit();
      } else alert('Invalid file');
    } catch { alert('Could not parse file'); }
  };
  reader.readAsText(file);
});
