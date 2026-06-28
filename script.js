/* ============================================
   SCHOOL TIMETABLE MANAGER — script.js
   ============================================ */

'use strict';

// ── Constants ──────────────────────────────────────────────
const CLASSES    = [6, 7, 8, 9, 10];
const DAYS       = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const PERIOD_ORDER = ['Assembly','Period 1','Period 2','Period 3','Period 4','Period 5','Period 6','Break','Period 7','Period 8'];

// ── App State ──────────────────────────────────────────────
let currentClass   = 6;
let editingEntryId = null;
let deletingKey    = null;
let deferredPrompt = null;

// ── Storage Helpers ────────────────────────────────────────
const storageKey  = (cls) => `timetable_class_${cls}`;
const infoKey     = (cls) => `classinfo_${cls}`;

function loadEntries(cls) {
  try { return JSON.parse(localStorage.getItem(storageKey(cls))) || []; }
  catch { return []; }
}

function saveEntries(cls, entries) {
  localStorage.setItem(storageKey(cls), JSON.stringify(entries));
}

function loadClassInfo(cls) {
  try { return JSON.parse(localStorage.getItem(infoKey(cls))) || {}; }
  catch { return {}; }
}

function saveClassInfoData(cls, info) {
  localStorage.setItem(infoKey(cls), JSON.stringify(info));
}

// ── ID Generator ───────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// ── Switch Class ───────────────────────────────────────────
function switchClass(cls) {
  currentClass = Number(cls);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.class) === currentClass);
  });
  renderInfoBar();
  renderTimetable();
}

// ── Info Bar ───────────────────────────────────────────────
function renderInfoBar() {
  const info = loadClassInfo(currentClass);
  const now  = new Date();
  document.getElementById('displayIncharge').textContent = info.incharge  || '— Not Set —';
  document.getElementById('displayDate').textContent     = now.toLocaleDateString('en-PK', {weekday:'short', day:'2-digit', month:'short', year:'numeric'});
  document.getElementById('displayTime').textContent     = now.toLocaleTimeString('en-PK', {hour:'2-digit', minute:'2-digit'});
}

function editClassInfo() {
  const info = loadClassInfo(currentClass);
  document.getElementById('inchargeInput').value = info.incharge || '';
  document.getElementById('schoolInput').value   = info.school   || '';
  openModal('classInfoModal');
}

function saveClassInfo() {
  const info = {
    incharge: document.getElementById('inchargeInput').value.trim(),
    school:   document.getElementById('schoolInput').value.trim(),
  };
  saveClassInfoData(currentClass, info);
  renderInfoBar();
  closeModal('classInfoModal');
  showToast('✅ Class info saved!');
}

// ── Timetable Render ───────────────────────────────────────
function renderTimetable() {
  const entries = loadEntries(currentClass);
  const tbody   = document.getElementById('timetableBody');
  tbody.innerHTML = '';

  document.getElementById('emptyState').style.display = entries.length === 0 ? 'block' : 'none';
  document.getElementById('timetableContainer').style.display = entries.length === 0 ? 'none' : 'block';

  if (entries.length === 0) return;

  // Build map: period → day → entries[]
  const map = {};
  PERIOD_ORDER.forEach(p => { map[p] = {}; DAYS.forEach(d => { map[p][d] = []; }); });
  entries.forEach(e => {
    if (e.day === 'All') {
      DAYS.forEach(d => map[e.period]?.[d]?.push(e));
    } else {
      map[e.period]?.[e.day]?.push(e);
    }
  });

  // Which periods have any data?
  const usedPeriods = PERIOD_ORDER.filter(p =>
    DAYS.some(d => map[p][d].length > 0) || p === 'Break'
  );

  usedPeriods.forEach(period => {
    const tr = document.createElement('tr');

    // Special row types
    if (period === 'Break') {
      tr.className = 'row-break';
      tr.innerHTML = `
        <td class="period-label">
          <div class="break-label">☕ <span class="break-badge">BREAK</span></div>
        </td>
        ${DAYS.map(() => `<td style="text-align:center; color:#b07a00; font-weight:600; font-size:.8rem;">— Break —</td>`).join('')}
        <td class="action-cell no-print"></td>`;
      tbody.appendChild(tr);
      return;
    }

    if (period === 'Assembly') {
      tr.className = 'row-assembly';
    }

    // Period label cell
    const defaultTimes = {
      'Assembly': '07:30 – 07:50',
      'Period 1': '07:50 – 08:35',
      'Period 2': '08:35 – 09:20',
      'Period 3': '09:20 – 10:05',
      'Period 4': '10:05 – 10:50',
      'Period 5': '10:50 – 11:35',
      'Period 6': '11:35 – 12:20',
      'Period 7': '12:45 – 01:30',
      'Period 8': '01:30 – 02:15',
    };

    // Collect first-found time across all days for label
    let labelTime = defaultTimes[period] || '';
    DAYS.forEach(d => {
      if (map[period][d].length > 0 && map[period][d][0].startTime && !labelTime.includes('–')) {
        labelTime = `${map[period][d][0].startTime} – ${map[period][d][0].endTime || ''}`;
      }
    });

    const emoji = period === 'Assembly' ? '🔔' : '';

    const tdPeriod = document.createElement('td');
    tdPeriod.className = 'period-label';
    tdPeriod.innerHTML = `
      <span class="period-name">${emoji} ${period}</span>
      <span class="period-time">${labelTime}</span>`;

    tr.appendChild(tdPeriod);

    // Day cells
    DAYS.forEach(day => {
      const td = document.createElement('td');
      const dayEntries = map[period][day];
      if (dayEntries.length === 0) {
        td.innerHTML = `<span class="empty-cell">—</span>`;
      } else {
        td.innerHTML = dayEntries.map(e => `
          <div class="cell-content">
            <span class="cell-subject">${escHtml(e.subject)}</span>
            <span class="cell-teacher">👤 ${escHtml(e.teacher)}</span>
            ${e.room   ? `<span class="cell-room">📍 ${escHtml(e.room)}</span>` : ''}
            ${e.startTime ? `<span class="cell-time">🕐 ${e.startTime}${e.endTime ? ' – '+e.endTime : ''}</span>` : ''}
            ${e.note   ? `<span class="cell-note">📌 ${escHtml(e.note)}</span>` : ''}
          </div>`).join('<hr style="margin:6px 0;border:none;border-top:1px dashed #dde3ed">');
      }
      tr.appendChild(td);
    });

    // Actions cell — show edit/delete for first entry per period (all-day or first day)
    const actionTd = document.createElement('td');
    actionTd.className = 'action-cell no-print';

    // Collect all unique entry IDs in this period row
    const rowEntryIds = [];
    DAYS.forEach(d => map[period][d].forEach(e => {
      if (!rowEntryIds.includes(e.id)) rowEntryIds.push(e.id);
    }));

    if (rowEntryIds.length > 0) {
      actionTd.innerHTML = rowEntryIds.map(id => {
        const e = entries.find(x => x.id === id);
        return `
          <button class="tbl-btn edit" onclick="openEditModal('${id}')" title="Edit">✏️</button>
          <button class="tbl-btn del"  onclick="openDeleteModal('${id}')" title="Delete">🗑️</button>`;
      }).join('<br>');
    }
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Add / Edit Modal ───────────────────────────────────────
function openAddModal() {
  editingEntryId = null;
  document.getElementById('modalTitle').textContent = '➕ Add Timetable Entry';
  clearForm();
  openModal('addModal');
}

function openEditModal(id) {
  const entries = loadEntries(currentClass);
  const entry   = entries.find(e => e.id === id);
  if (!entry) return;

  editingEntryId = id;
  document.getElementById('modalTitle').textContent = '✏️ Edit Timetable Entry';

  document.getElementById('formPeriod').value    = entry.period;
  document.getElementById('formDay').value       = entry.day;
  document.getElementById('formSubject').value   = entry.subject;
  document.getElementById('formTeacher').value   = entry.teacher;
  document.getElementById('formStartTime').value = entry.startTime || '';
  document.getElementById('formEndTime').value   = entry.endTime   || '';
  document.getElementById('formRoom').value      = entry.room      || '';
  document.getElementById('formNote').value      = entry.note      || '';

  openModal('addModal');
}

function clearForm() {
  ['formSubject','formTeacher','formStartTime','formEndTime','formRoom','formNote'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('formPeriod').value = 'Period 1';
  document.getElementById('formDay').value    = 'Monday';
}

function saveEntry() {
  const period    = document.getElementById('formPeriod').value;
  const day       = document.getElementById('formDay').value;
  const subject   = document.getElementById('formSubject').value.trim();
  const teacher   = document.getElementById('formTeacher').value.trim();
  const startTime = document.getElementById('formStartTime').value;
  const endTime   = document.getElementById('formEndTime').value;
  const room      = document.getElementById('formRoom').value.trim();
  const note      = document.getElementById('formNote').value.trim();

  if (!subject || !teacher) {
    showToast('⚠️ Subject and Teacher fields are required!');
    return;
  }

  let entries = loadEntries(currentClass);

  if (editingEntryId) {
    const idx = entries.findIndex(e => e.id === editingEntryId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], period, day, subject, teacher, startTime, endTime, room, note, updatedAt: Date.now() };
    }
    showToast('✅ Entry updated successfully!');
  } else {
    const newEntry = { id: genId(), period, day, subject, teacher, startTime, endTime, room, note, createdAt: Date.now() };
    entries.push(newEntry);
    showToast('✅ Entry added successfully!');
  }

  saveEntries(currentClass, entries);
  closeModal('addModal');
  renderTimetable();
}

// ── Delete ─────────────────────────────────────────────────
function openDeleteModal(id) {
  deletingKey = id;
  openModal('deleteModal');
}

function confirmDelete() {
  if (!deletingKey) return;
  let entries = loadEntries(currentClass);
  entries = entries.filter(e => e.id !== deletingKey);
  saveEntries(currentClass, entries);
  deletingKey = null;
  closeModal('deleteModal');
  renderTimetable();
  showToast('🗑️ Entry deleted.');
}

// ── Print ──────────────────────────────────────────────────
function printTimetable() {
  const info    = loadClassInfo(currentClass);
  const entries = loadEntries(currentClass);

  if (entries.length === 0) {
    showToast('⚠️ No data to print for this class.');
    return;
  }

  const now = new Date();
  document.getElementById('printSchool').textContent = info.school || 'School Timetable';
  document.getElementById('printTitle').textContent  = `Class ${currentClass} — Weekly Timetable`;
  document.getElementById('printMeta').textContent   =
    `Class Incharge: ${info.incharge || 'N/A'}  •  Printed on: ${now.toLocaleDateString('en-PK', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}  •  Time: ${now.toLocaleTimeString('en-PK')}`;

  window.print();
}

// ── Modal Helpers ──────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
  document.body.style.overflow = '';
}

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.style.display = 'none';
    document.body.style.overflow = '';
  }
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['addModal','classInfoModal','deleteModal'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    document.body.style.overflow = '';
  }
});

// ── Toast ──────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── PWA Install ────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  let banner = document.getElementById('installBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id        = 'installBanner';
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner-icon">📲</div>
      <div class="install-banner-text">
        <p>Install Timetable App</p>
        <p>Add to home screen for offline use</p>
      </div>
      <div class="install-banner-actions">
        <button class="btn btn-ghost-dark" style="font-size:.8rem;padding:7px 12px;" onclick="dismissInstall()">Later</button>
        <button class="btn btn-primary" style="font-size:.8rem;padding:7px 14px;" onclick="installApp()">Install</button>
      </div>`;
    document.body.appendChild(banner);
  }
  setTimeout(() => banner.classList.add('visible'), 800);
}

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(result => {
    if (result.outcome === 'accepted') showToast('🎉 App installed successfully!');
    deferredPrompt = null;
    dismissInstall();
  });
}

function dismissInstall() {
  const banner = document.getElementById('installBanner');
  if (banner) { banner.classList.remove('visible'); setTimeout(() => banner.remove(), 400); }
}

window.addEventListener('appinstalled', () => showToast('✅ Timetable App installed!'));

// ── Service Worker ─────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── Boot ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderInfoBar();
  renderTimetable();

  // Auto-refresh time every minute
  setInterval(renderInfoBar, 60000);

  // Seed demo data for Class 6 if empty
  if (loadEntries(6).length === 0) {
    seedDemoData();
  }
});

// ── Seed Demo Data ─────────────────────────────────────────
function seedDemoData() {
  const demo = [
    // Assembly — all days
    { id:genId(), period:'Assembly', day:'All',       subject:'Morning Assembly', teacher:'Principal / Duty Teacher', startTime:'07:30', endTime:'07:50', room:'Ground', note:'Flag hoisting & announcements', createdAt:Date.now() },
    // Period 1
    { id:genId(), period:'Period 1', day:'Monday',    subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'07:50', endTime:'08:35', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 1', day:'Tuesday',   subject:'English',      teacher:'Mrs. Sana Raza',  startTime:'07:50', endTime:'08:35', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 1', day:'Wednesday', subject:'Urdu',         teacher:'Mr. Tariq Mehmood',startTime:'07:50', endTime:'08:35', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 1', day:'Thursday',  subject:'Science',      teacher:'Mrs. Amna Sheikh', startTime:'07:50', endTime:'08:35', room:'Lab 1',  note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 1', day:'Friday',    subject:'Islamiat',     teacher:'Mr. Hamid Ullah',  startTime:'07:50', endTime:'08:35', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 1', day:'Saturday',  subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'07:50', endTime:'08:35', room:'Room 6A', note:'', createdAt:Date.now() },
    // Period 2
    { id:genId(), period:'Period 2', day:'Monday',    subject:'English',      teacher:'Mrs. Sana Raza',  startTime:'08:35', endTime:'09:20', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 2', day:'Tuesday',   subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'08:35', endTime:'09:20', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 2', day:'Wednesday', subject:'Science',      teacher:'Mrs. Amna Sheikh', startTime:'08:35', endTime:'09:20', room:'Lab 1',  note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 2', day:'Thursday',  subject:'Social Studies',teacher:'Mr. Naveed Khan', startTime:'08:35', endTime:'09:20', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 2', day:'Friday',    subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'08:35', endTime:'09:20', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 2', day:'Saturday',  subject:'Urdu',         teacher:'Mr. Tariq Mehmood',startTime:'08:35', endTime:'09:20', room:'Room 6A', note:'', createdAt:Date.now() },
    // Period 3
    { id:genId(), period:'Period 3', day:'Monday',    subject:'Urdu',         teacher:'Mr. Tariq Mehmood',startTime:'09:20', endTime:'10:05', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 3', day:'Tuesday',   subject:'Islamiat',     teacher:'Mr. Hamid Ullah',  startTime:'09:20', endTime:'10:05', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 3', day:'Wednesday', subject:'English',      teacher:'Mrs. Sana Raza',  startTime:'09:20', endTime:'10:05', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 3', day:'Thursday',  subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'09:20', endTime:'10:05', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 3', day:'Friday',    subject:'Art & Craft',  teacher:'Mrs. Rukhsar Bibi',startTime:'09:20', endTime:'10:05', room:'Art Room', note:'Bring art kit', createdAt:Date.now() },
    { id:genId(), period:'Period 3', day:'Saturday',  subject:'Science',      teacher:'Mrs. Amna Sheikh', startTime:'09:20', endTime:'10:05', room:'Lab 1',  note:'', createdAt:Date.now() },
    // Period 4
    { id:genId(), period:'Period 4', day:'Monday',    subject:'Science',      teacher:'Mrs. Amna Sheikh', startTime:'10:05', endTime:'10:50', room:'Lab 1',  note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 4', day:'Tuesday',   subject:'Computer',     teacher:'Mr. Usman Farooq', startTime:'10:05', endTime:'10:50', room:'Computer Lab', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 4', day:'Wednesday', subject:'Social Studies',teacher:'Mr. Naveed Khan', startTime:'10:05', endTime:'10:50', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 4', day:'Thursday',  subject:'Urdu',         teacher:'Mr. Tariq Mehmood',startTime:'10:05', endTime:'10:50', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 4', day:'Friday',    subject:'Computer',     teacher:'Mr. Usman Farooq', startTime:'10:05', endTime:'10:50', room:'Computer Lab', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 4', day:'Saturday',  subject:'English',      teacher:'Mrs. Sana Raza',  startTime:'10:05', endTime:'10:50', room:'Room 6A', note:'', createdAt:Date.now() },
    // Period 5
    { id:genId(), period:'Period 5', day:'Monday',    subject:'Social Studies',teacher:'Mr. Naveed Khan', startTime:'10:50', endTime:'11:35', room:'Room 6A', note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 5', day:'Tuesday',   subject:'Science',      teacher:'Mrs. Amna Sheikh', startTime:'10:50', endTime:'11:35', room:'Lab 1',  note:'', createdAt:Date.now() },
    { id:genId(), period:'Period 5', day:'Wednesday', subject:'Mathematics',  teacher:'Mr. Imran Ali',   startTime:'1
