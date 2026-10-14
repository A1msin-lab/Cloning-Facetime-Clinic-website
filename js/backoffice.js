(() => {
  const SB = window.FACETIME_SUPABASE;
  // ใช้รหัสหลังบ้านเดียวกับร้านค้า (app_settings.store_admin_key) แนบไปกับฟังก์ชัน clinic_admin_* ใน Supabase
  const KEY_STORE = 'facetime_store_admin_key';
  const ACTOR_STORE = 'facetime_backoffice_actor';
  const store = {
    get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} }
  };
  const getKey = () => store.get(KEY_STORE);

  async function rpc(fn, args = {}) {
    const res = await fetch(`${SB.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SB.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: getKey(), ...args })
    });
    const body = await res.text();
    if (!res.ok) { const err = new Error(body); err.badKey = /invalid admin key/.test(body); throw err; }
    return body ? JSON.parse(body) : null;
  }
  // ปุ่มที่ต้องซิงก์ Google Calendar / แจ้งลูกค้าทาง LINE → ส่งผ่าน n8n "10 Web Backoffice" ให้ทำงานเหมือนกดจาก LIFF
  // (n8n เรียก clinic_admin_action ตัวเดิมใน Supabase ซึ่งตรวจรหัสหลังบ้านให้) · ดึงรอบว่าง / ค้นลูกค้า ยังเรียก Supabase ตรง
  const N8N_ACTION_URL = 'https://ai-reminder-n8n.up.railway.app/webhook/backoffice-action';
  const VIA_N8N = ['confirm', 'book', 'propose', 'decline', 'reschedule', 'cancel', 'sell', 'use'];
  const actDirect = (action, p = {}) => rpc('clinic_admin_action', { p_action: action, p_actor: $('#actorSelect').value || null, p });
  async function act(action, p = {}) {
    if (!VIA_N8N.includes(action)) return actDirect(action, p);
    let res;
    try {
      res = await fetch(N8N_ACTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: getKey(), action, actor: $('#actorSelect').value || null, p })
      });
    } catch {
      // n8n ติดต่อไม่ได้ → บันทึกตรงที่ Supabase ไปก่อน (ปฏิทินจะซิงก์ตามรอบ 08 Scheduler แต่ไม่ได้แจ้ง LINE)
      return actDirect(action, p);
    }
    const body = await res.json().catch(() => null);
    if (!body) throw new Error('n8n ' + res.status);
    if (body.error === 'bad_key') { const err = new Error('invalid admin key'); err.badKey = true; throw err; }
    return body;
  }

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const TZ = 'Asia/Bangkok';
  const ymd = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
  const hm = d => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  const dayLabel = d => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
  const fullDay = d => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
  const when = (d, allDay) => `${dayLabel(d)} · ${allDay ? 'ทั้งวัน' : hm(d)}`;
  const phoneFmt = p => p && p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : (p || '—');
  const money = n => n == null ? '' : `฿${Number(n).toLocaleString('th-TH')}`;

  const TYPE = { surgery: 'ผ่าตัด', single: 'ครั้งเดียว', course: 'คอร์ส' };
  const typePill = t => `<span class="type-pill type-${TYPE[t] ? t : 'other'}">${TYPE[t] || 'อื่นๆ'}</span>`;

  const ERR = {
    forbidden: 'ผู้ทำรายการต้องเป็นแพทย์/พนักงาน', not_request: 'คำขอนี้ถูกจัดการไปแล้ว', need_reason: 'กรุณาใส่เหตุผล',
    max_rounds: 'เสนอเวลาใหม่ครบจำนวนรอบแล้ว', slot_taken: 'ช่วงเวลานี้มีนัดเต็มแล้ว', closed: 'นอกเวลาทำการหรือไม่ตรงช่องเวลา',
    past: 'เวลานี้ผ่านไปแล้ว', bad_input: 'ข้อมูลไม่ครบ', no_patient: 'ไม่พบลูกค้า', invalid_phone: 'เบอร์โทรไม่ถูกต้อง (10 หลัก ขึ้นต้น 0)',
    missing_name: 'กรุณาเลือกคอร์ส', invalid_sessions: 'จำนวนครั้งไม่ถูกต้อง', not_enough: 'จำนวนครั้งคงเหลือไม่พอ',
    no_active_package: 'ไม่พบคอร์สที่ใช้งานได้', ambiguous: 'พบหลายคอร์ส กรุณาเลือกให้ชัด', no_request: 'ไม่มีคำขอเลื่อนแล้ว',
    not_pending: 'นัดนี้ไม่ได้อยู่ในสถานะรอ', not_found: 'ไม่พบรายการ', date_out_of_range: 'วันที่อยู่นอกช่วงที่จองได้'
  };
  const errText = r => ERR[r?.error] || r?.message || 'ทำรายการไม่สำเร็จ';

  let data = { appointments: [], packages: [], services: [], usages: [], doctors: [] };
  let typeFilter = 'all';
  let pkgTab = 'active';
  let openForm = null;      // { id, kind: 'propose' | 'decline' }
  const stepN = {};         // package_id -> จำนวนครั้งที่จะตัด

  function show(view) { ['loginView', 'dashView', 'loadingView'].forEach(id => { $('#' + id).hidden = id !== view; }); }
  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('is-error', isError); t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  // ===== เข้าระบบด้วยรหัสหลังบ้าน =====
  async function boot() {
    const urlKey = new URLSearchParams(location.search).get('key');
    if (urlKey) { store.set(KEY_STORE, urlKey.trim()); history.replaceState(null, '', location.pathname + location.hash); }
    if (!getKey()) { $('#adminUser').hidden = true; show('loginView'); return; }
    show('loadingView');
    try { await loadAll(); }
    catch (err) {
      if (err.badKey) { store.set(KEY_STORE, ''); $('#loginError').textContent = 'รหัสหลังบ้านไม่ถูกต้อง'; $('#loginError').hidden = false; show('loginView'); return; }
      toast('โหลดข้อมูลไม่สำเร็จ', true);
    }
    $('#adminUser').hidden = false;
    show('dashView');
    selectTab(location.hash === '#courses' ? 'courses' : 'appointments');
  }
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    store.set(KEY_STORE, new FormData(e.currentTarget).get('key').trim());
    $('#loginError').hidden = true;
    boot();
  });
  $('#logoutBtn').addEventListener('click', () => { store.set(KEY_STORE, ''); boot(); });

  async function loadAll() {
    data = await rpc('clinic_admin_data');
    renderActors(); renderServiceOptions(); renderAll();
  }
  async function reload(msg) {
    try { await loadAll(); if (msg) toast(msg); } catch { toast('โหลดข้อมูลไม่สำเร็จ', true); }
  }
  $('#refreshBtn').addEventListener('click', () => reload('อัปเดตข้อมูลแล้ว'));

  function renderActors() {
    const saved = store.get(ACTOR_STORE);
    const sel = $('#actorSelect');
    sel.innerHTML = data.doctors.map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
    if (data.doctors.some(d => d.id === saved)) sel.value = saved;
  }
  $('#actorSelect').addEventListener('change', e => store.set(ACTOR_STORE, e.target.value));

  function renderServiceOptions() {
    const groups = {};
    data.services.forEach(s => { (groups[s.category || 'อื่นๆ'] ||= []).push(s); });
    $('#bookForm [name=service]').innerHTML = '<option value="">เลือกบริการ</option>' + Object.entries(groups).map(([g, list]) =>
      `<optgroup label="${esc(g)}">${list.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('');
    const courses = data.services.filter(s => s.is_course);
    $('#sellForm [name=course]').innerHTML = '<option value="">เลือกคอร์ส</option>' +
      courses.map(s => `<option value="${esc(s.name)}" data-sessions="${s.sessions || ''}" data-price="${s.price ?? ''}">${esc(s.name)}</option>`).join('');
  }

  function renderAll() {
    $('#todayLabel').textContent = data.today ? fullDay(data.today + 'T12:00:00+07:00') : 'Clinic Back Office';
    renderAppointments(); renderCourses();
  }

  // ===== Tabs =====
  function selectTab(name) {
    document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== name; });
    history.replaceState(null, '', '#' + name);
  }
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => selectTab(btn.dataset.tab)));

  // ===================== นัดหมาย =====================
  const appts = () => data.appointments || [];
  const isRequest = a => a.booking_status === 'requested';
  const isProposed = a => a.booking_status === 'proposed';
  const isMoveReq = a => a.booking_status === 'confirmed' && a.reschedule_to;
  const isConfirmed = a => a.booking_status === 'confirmed';

  function renderAppointments() {
    const today = data.today;
    const todayList = appts().filter(a => isConfirmed(a) && ymd(a.event_at) === today);
    const req = appts().filter(isRequest);
    const proposed = appts().filter(isProposed);
    const moves = appts().filter(isMoveReq);
    $('#reqCount').textContent = (req.length + moves.length) || '';

    $('#apptKpis').innerHTML = [
      ['นัดวันนี้', todayList.length, `${todayList.filter(a => a.confirm_status === 'confirmed').length} คนกดยืนยันมาแล้ว`, false],
      ['คำขอรอยืนยัน', req.length, 'ลูกค้าจองผ่าน LINE', req.length > 0],
      ['รอลูกค้าตอบ', proposed.length, 'คลินิกเสนอเวลาใหม่แล้ว', false],
      ['ลูกค้าขอเลื่อน', moves.length, 'รอคลินิกอนุมัติ', moves.length > 0]
    ].map(([l, v, s, alert]) => `<div class="kpi${alert ? ' is-alert' : ''}"><span>${l}</span><strong>${v}</strong><small>${s}</small></div>`).join('');

    renderRequests(req, moves, proposed);
    renderToday(todayList);
    renderApptTable();
  }

  function infoBlock(a, extra = '') {
    return `<div class="bo-req-info">
      <div><span>บริการ</span><b>${esc(a.service)}</b></div>
      <div><span>วันเวลาที่ขอ</span><b>${when(a.event_at, a.all_day)}</b></div>
      ${extra}
    </div>`;
  }
  function who(a, sub) {
    return `<div class="bo-req-who"><strong>${esc(a.patient_name || 'ไม่ระบุชื่อ')}</strong>
      <small>${phoneFmt(a.patient_phone)} · ${a.linked ? 'ผูก LINE แล้ว' : 'ยังไม่ผูก LINE'}${sub ? ' · ' + sub : ''}</small></div>`;
  }

  function renderRequests(req, moves, proposed) {
    const html = [];
    req.forEach(a => {
      const f = openForm && openForm.id === a.id ? openForm.kind : null;
      html.push(`<article class="bo-req" data-id="${esc(a.id)}">
        <div class="bo-req-top">${who(a, 'ส่งคำขอ ' + dayLabel(a.created_at) + ' ' + hm(a.created_at))}${typePill(a.service_type)}</div>
        ${infoBlock(a, a.proposal_round ? `<div><span>รอบเสนอเวลา</span><b>${a.proposal_round}</b></div>` : '')}
        ${f ? '' : `<div class="bo-actions">
          <button class="btn btn--gold btn--sm" type="button" data-do="confirm">ยืนยันนัด</button>
          <button class="btn btn--outline btn--sm" type="button" data-do="open-propose">เสนอวันเวลาใหม่</button>
          <button class="btn btn--outline btn--sm bo-btn-danger" type="button" data-do="open-decline">ปฏิเสธ</button>
        </div>`}
        ${f === 'propose' ? `<form class="bo-subform" data-form="propose">
          <div class="bo-grid2">
            <label>วันที่เสนอ<input type="date" name="date" required min="${data.today}" value="${ymd(a.event_at) >= data.today ? ymd(a.event_at) : data.today}"></label>
            <label>เวลา<select name="time" required><option value="">กำลังโหลด...</option></select></label>
          </div>
          <label>เหตุผลที่แจ้งลูกค้า<textarea name="reason" rows="2" required placeholder="เช่น คุณหมอติดผ่าตัดช่วงเวลานี้"></textarea></label>
          <div class="bo-actions"><button class="btn btn--gold btn--sm" type="submit">ส่งข้อเสนอ</button>
          <button class="btn btn--outline btn--sm" type="button" data-do="close">ยกเลิก</button></div>
        </form>` : ''}
        ${f === 'decline' ? `<form class="bo-subform" data-form="decline">
          <label>เหตุผลที่ปฏิเสธ<textarea name="reason" rows="2" required placeholder="เช่น บริการนี้ต้องปรึกษาแพทย์ก่อน"></textarea></label>
          <div class="bo-actions"><button class="btn btn--outline btn--sm bo-btn-danger" type="submit">ยืนยันการปฏิเสธ</button>
          <button class="btn btn--outline btn--sm" type="button" data-do="close">ยกเลิก</button></div>
        </form>` : ''}
      </article>`);
    });
    moves.forEach(a => {
      html.push(`<article class="bo-req" data-id="${esc(a.id)}">
        <div class="bo-req-top">${who(a)}<span class="type-pill st-move">ขอเลื่อนนัด</span></div>
        <div class="bo-req-info">
          <div><span>บริการ</span><b>${esc(a.service)}</b></div>
          <div><span>นัดเดิม</span><b>${when(a.event_at, a.all_day)}</b></div>
          <div><span>ขอเลื่อนเป็น</span><b>${when(a.reschedule_to)}</b></div>
        </div>
        <div class="bo-actions">
          <button class="btn btn--gold btn--sm" type="button" data-do="approve">อนุมัติวันใหม่</button>
          <button class="btn btn--outline btn--sm" type="button" data-do="reject">ไม่อนุมัติ (คงนัดเดิม)</button>
        </div>
      </article>`);
    });
    proposed.forEach(a => {
      html.push(`<article class="bo-req" data-id="${esc(a.id)}">
        <div class="bo-req-top">${who(a)}<span class="type-pill st-proposed">รอลูกค้าตอบ</span></div>
        <div class="bo-req-info">
          <div><span>บริการ</span><b>${esc(a.service)}</b></div>
          <div><span>เวลาที่เสนอ</span><b>${when(a.event_at)}</b></div>
          <div><span>เหตุผล</span><b>${esc(a.proposal_reason || '—')}</b></div>
          ${a.proposal_expires_at ? `<div><span>หมดเวลาตอบ</span><b>${when(a.proposal_expires_at)}</b></div>` : ''}
        </div>
      </article>`);
    });
    $('#requestList').innerHTML = html.join('') || '<p class="admin-empty">ไม่มีคำขอค้างอยู่</p>';

    const pf = $('#requestList [data-form=propose]');
    if (pf) { loadSlots(pf.date.value, pf.time); pf.date.addEventListener('change', () => loadSlots(pf.date.value, pf.time)); }
  }

  async function loadSlots(date, select, keep) {
    if (!date) { select.innerHTML = '<option value="">เลือกวันก่อน</option>'; return; }
    select.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const r = await act('slots', { date });
      const free = (r.slots || []).filter(s => s.free);
      select.innerHTML = r.date_ok === false || !free.length
        ? '<option value="">วันนี้ไม่มีช่วงว่าง</option>'
        : '<option value="">เลือกเวลา</option>' + free.map(s => `<option ${s.time === keep ? 'selected' : ''}>${s.time}</option>`).join('');
    } catch { select.innerHTML = '<option value="">โหลดเวลาไม่สำเร็จ</option>'; }
  }

  $('#requestList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-do]');
    if (!btn) return;
    const id = btn.closest('[data-id]').dataset.id;
    const kind = btn.dataset.do;
    if (kind === 'open-propose' || kind === 'open-decline') { openForm = { id, kind: kind.slice(5) }; renderAppointments(); return; }
    if (kind === 'close') { openForm = null; renderAppointments(); return; }
    const map = { confirm: ['confirm', {}, 'ยืนยันนัดแล้ว'], approve: ['reschedule', { approve: true }, 'อนุมัติวันใหม่แล้ว'], reject: ['reschedule', { approve: false }, 'คงนัดเดิมไว้แล้ว'] };
    const [action, extra, okMsg] = map[kind];
    btn.disabled = true;
    try {
      const r = await act(action, { id, ...extra });
      if (!r.ok) { toast(errText(r), true); btn.disabled = false; return; }
      openForm = null; await reload(okMsg);
    } catch { toast('ทำรายการไม่สำเร็จ', true); btn.disabled = false; }
  });

  $('#requestList').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const id = form.closest('[data-id]').dataset.id;
    const fd = new FormData(form);
    const isPropose = form.dataset.form === 'propose';
    const p = isPropose ? { id, date: fd.get('date'), time: fd.get('time'), reason: fd.get('reason') } : { id, reason: fd.get('reason') };
    form.querySelector('[type=submit]').disabled = true;
    try {
      const r = await act(isPropose ? 'propose' : 'decline', p);
      if (!r.ok) { toast(errText(r), true); form.querySelector('[type=submit]').disabled = false; return; }
      openForm = null; await reload(isPropose ? 'บันทึกข้อเสนอเวลาใหม่แล้ว' : 'ปฏิเสธคำขอแล้ว');
    } catch { toast('ทำรายการไม่สำเร็จ', true); form.querySelector('[type=submit]').disabled = false; }
  });

  function renderToday(list) {
    $('#todayList').innerHTML = list.length ? list.map(a => `<li>
      <time>${a.all_day ? 'ทั้งวัน' : hm(a.event_at)}</time>
      <div class="bo-slot"><div><strong>${esc(a.patient_name || 'ไม่ระบุชื่อ')}</strong>
        <small>${esc(a.service)}${a.session_no ? ` (ครั้งที่ ${a.session_no}/${a.session_total})` : ''}</small></div>
        ${typePill(a.service_type)}</div>
    </li>`).join('') : '<li class="admin-empty" style="justify-content:center">วันนี้ยังไม่มีนัด</li>';
  }

  function statusOf(a) {
    if (a.reschedule_to) return ['ขอเลื่อน', 'st-move'];
    if (a.confirm_status === 'confirmed') return ['ลูกค้ายืนยันแล้ว', 'st-confirmed'];
    if (a.status === 'sent') return ['แจ้งเตือนแล้ว', 'st-pending'];
    return ['รอวันนัด', 'st-pending'];
  }

  function renderApptTable() {
    const all = appts().filter(isConfirmed).filter(a => ymd(a.event_at) >= data.today);
    const counts = t => all.filter(a => a.service_type === t).length;
    $('#typeFilters').innerHTML = [['all', 'ทั้งหมด', all.length], ['surgery', 'ผ่าตัด', counts('surgery')], ['single', 'ครั้งเดียว', counts('single')], ['course', 'คอร์ส', counts('course')]]
      .map(([k, l, n]) => `<button type="button" role="tab" class="bo-chip ${typeFilter === k ? 'is-active' : ''}" aria-selected="${typeFilter === k}" data-type="${k}">${l} <span>${n}</span></button>`).join('');
    const q = $('#apptSearch').value.trim().toLowerCase();
    const list = all.filter(a => (typeFilter === 'all' || a.service_type === typeFilter) &&
      (!q || [a.patient_name, a.patient_phone, a.service].join(' ').toLowerCase().includes(q)));
    if (!list.length) { $('#apptTable').innerHTML = '<p class="admin-empty">ไม่พบนัด</p>'; return; }
    $('#apptTable').innerHTML = `<table class="admin-table bo-table">
      <thead><tr><th>วันเวลา</th><th>ลูกค้า</th><th>บริการ</th><th>ประเภท</th><th>สถานะ</th><th>Google Calendar</th><th></th></tr></thead>
      <tbody>${list.map(a => { const [st, cls] = statusOf(a); return `<tr data-id="${esc(a.id)}">
        <td style="white-space:nowrap">${when(a.event_at, a.all_day)}</td>
        <td>${esc(a.patient_name || '—')}<small>${phoneFmt(a.patient_phone)}${a.linked ? '' : ' · ยังไม่ผูก LINE'}</small></td>
        <td>${esc(a.service)}${a.session_no ? `<small>ครั้งที่ ${a.session_no}/${a.session_total}</small>` : ''}</td>
        <td>${typePill(a.service_type)}</td>
        <td><span class="type-pill ${cls}">${st}</span></td>
        <td><small>${a.gcal_synced ? 'ซิงก์แล้ว' : 'รอซิงก์'}</small></td>
        <td style="text-align:right">${a.status === 'pending' ? '<button class="btn btn--outline btn--sm bo-btn-danger" type="button" data-cancel>ยกเลิกนัด</button>' : ''}</td>
      </tr>`; }).join('')}</tbody></table>`;
  }
  $('#typeFilters').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (b) { typeFilter = b.dataset.type; renderApptTable(); } });
  $('#apptSearch').addEventListener('input', renderApptTable);
  $('#apptTable').addEventListener('click', async e => {
    const b = e.target.closest('[data-cancel]');
    if (!b) return;
    const a = appts().find(x => x.id === b.closest('[data-id]').dataset.id);
    if (!confirm(`ยกเลิกนัด ${a.patient_name || ''} · ${a.service} · ${when(a.event_at, a.all_day)} ?`)) return;
    b.disabled = true;
    try { const r = await act('cancel', { id: a.id }); if (!r.ok) { toast(errText(r), true); b.disabled = false; return; } await reload('ยกเลิกนัดแล้ว'); }
    catch { toast('ทำรายการไม่สำเร็จ', true); b.disabled = false; }
  });

  // ----- ลงนัดให้ลูกค้า -----
  const bookForm = $('#bookForm');
  $('#bookToggle').addEventListener('click', () => {
    bookForm.hidden = !bookForm.hidden;
    if (!bookForm.hidden && !bookForm.date.value) bookForm.date.value = data.today;
    if (!bookForm.hidden) loadSlots(bookForm.date.value, bookForm.time);
  });
  bookForm.date.addEventListener('change', () => loadSlots(bookForm.date.value, bookForm.time));
  let custTimer;
  $('#custSearch').addEventListener('input', e => {
    clearTimeout(custTimer);
    const q = e.target.value.trim();
    if (q.length < 2) { $('#custResults').innerHTML = ''; return; }
    custTimer = setTimeout(async () => {
      try {
        const r = await act('customers', { q });
        const list = r.customers || [];
        $('#custResults').innerHTML = list.length ? list.slice(0, 6).map(c =>
          `<button type="button" data-cust="${esc(c.id)}" data-name="${esc(c.name)}"><span>${esc(c.name)}</span><small>${phoneFmt(c.phone)}${c.linked ? '' : ' · ยังไม่ผูก LINE'}</small></button>`).join('')
          : '<p class="admin-muted">ไม่พบลูกค้าที่ลงทะเบียนไว้</p>';
      } catch { $('#custResults').innerHTML = '<p class="admin-error">ค้นหาไม่สำเร็จ</p>'; }
    }, 300);
  });
  $('#custResults').addEventListener('click', e => {
    const b = e.target.closest('[data-cust]');
    if (!b) return;
    bookForm.patient_id.value = b.dataset.cust;
    $('#custPicked').textContent = `ลูกค้า: ${b.dataset.name}`; $('#custPicked').hidden = false;
    $('#custResults').innerHTML = ''; $('#custSearch').value = '';
  });
  bookForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(bookForm);
    const err = $('#bookError');
    if (!fd.get('patient_id')) { err.textContent = 'กรุณาเลือกลูกค้าจากผลค้นหา'; err.hidden = false; return; }
    err.hidden = true;
    const btn = bookForm.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await act('book', { patient_id: fd.get('patient_id'), service: fd.get('service'), date: fd.get('date'), time: fd.get('time') });
      btn.disabled = false;
      if (!r.ok) { err.textContent = errText(r); err.hidden = false; return; }
      bookForm.reset(); bookForm.patient_id.value = ''; $('#custPicked').hidden = true; bookForm.hidden = true;
      await reload('บันทึกนัดแล้ว');
    } catch { btn.disabled = false; err.textContent = 'บันทึกไม่สำเร็จ'; err.hidden = false; }
  });

  // ===================== คอร์ส =====================
  function renderCourses() {
    const pk = data.packages || [];
    const active = pk.filter(p => !p.finished);
    const done = pk.filter(p => p.finished);
    const month = data.today ? data.today.slice(0, 7) : '';
    const usedMonth = (data.usages || []).filter(u => ymd(u.used_at).startsWith(month)).reduce((s, u) => s + u.sessions, 0);
    const low = active.filter(p => p.total - p.used === 1);
    $('#courseKpis').innerHTML = [
      ['คอร์สที่ใช้งานอยู่', active.length, 'ยังเหลือครั้งให้ใช้', false],
      ['ตัดคอร์สเดือนนี้', usedMonth, 'ครั้ง (จากรายการล่าสุด)', false],
      ['ใกล้หมด', low.length, 'เหลือ 1 ครั้ง · เสนอขายต่อได้', low.length > 0],
      ['ใช้ครบ / หมดอายุ', done.length, 'ดูในแท็บประวัติ', false]
    ].map(([l, v, s, alert]) => `<div class="kpi${alert ? ' is-alert' : ''}"><span>${l}</span><strong>${v}</strong><small>${s}</small></div>`).join('');
    $('#activeN').textContent = active.length; $('#historyN').textContent = done.length;
    renderPkgList();
    $('#usageList').innerHTML = (data.usages || []).length ? data.usages.slice(0, 8).map(u => `<li>
      <div><strong>${esc(u.name)}</strong><small>${esc(u.course)}${u.by ? ' · โดย ' + esc(u.by) : ''}</small></div>
      <div class="r">−${u.sessions} · ${u.session_no}/${u.total}<small style="display:block">${dayLabel(u.used_at)} ${hm(u.used_at)}</small></div>
    </li>`).join('') : '<li class="admin-empty">ยังไม่มีการตัดคอร์ส</li>';
  }

  function renderPkgList() {
    const q = $('#pkgSearch').value.trim().toLowerCase();
    const list = (data.packages || []).filter(p => (pkgTab === 'active' ? !p.finished : p.finished) &&
      (!q || [p.name, p.phone, p.course].join(' ').toLowerCase().includes(q)));
    if (!list.length) { $('#pkgList').innerHTML = `<p class="admin-empty">${pkgTab === 'active' ? 'ยังไม่มีคอร์สที่ใช้งานอยู่' : 'ยังไม่มีประวัติ'}</p>`; return; }
    $('#pkgList').innerHTML = list.map(p => {
      const left = p.total - p.used;
      const n = Math.min(stepN[p.id] || 1, Math.max(left, 1));
      const expired = p.finished && p.used < p.total;
      const pill = p.finished ? `<span class="type-pill type-other">${expired ? 'หมดอายุ' : 'ใช้ครบแล้ว'}</span>`
        : `<span class="type-pill ${left === 1 ? 'st-pending' : 'st-confirmed'}">เหลือ ${left} ครั้ง</span>`;
      const meta = [
        p.next_at ? `นัดถัดไป ${when(p.next_at)}` : (p.finished ? '' : 'ยังไม่มีนัดครั้งถัดไป'),
        p.last_used_at ? `ใช้ล่าสุด ${dayLabel(p.last_used_at)}` : '',
        `ซื้อ ${dayLabel(p.purchased_at)}${p.price != null ? ' · ' + money(p.price) : ''}`,
        p.expires_at && !p.finished ? `หมดอายุ ${dayLabel(p.expires_at)}` : '',
        p.linked ? '' : 'ยังไม่ผูก LINE'
      ].filter(Boolean).join(' · ');
      return `<article class="bo-pkg" data-pkg="${esc(p.id)}">
        <div class="bo-pkg-main">
          <div class="bo-pkg-top"><strong>${esc(p.name || 'ไม่ระบุชื่อ')}</strong><small>${phoneFmt(p.phone)}</small>${pill}</div>
          <div class="bo-pkg-line"><span>${esc(p.course)}</span><span>ใช้แล้ว <b>${p.used}/${p.total}</b></span></div>
          <div class="bo-bar" role="progressbar" aria-label="ความคืบหน้าคอร์ส" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.used}"><span style="width:${Math.min(100, Math.round(p.used / p.total * 100))}%"></span></div>
          <div class="bo-pkg-meta">${meta}</div>
        </div>
        ${p.finished ? '' : `<div class="bo-stepper">
          <button class="bo-step" type="button" data-step="-1" aria-label="ลดจำนวนครั้ง">−</button>
          <span class="bo-step-n" aria-live="polite">${n}</span>
          <button class="bo-step" type="button" data-step="1" aria-label="เพิ่มจำนวนครั้ง">+</button>
          <button class="btn btn--gold btn--sm" type="button" data-use>ตัด ${n} ครั้ง</button>
        </div>`}
      </article>`;
    }).join('');
  }
  document.querySelectorAll('[data-pkgtab]').forEach(b => b.addEventListener('click', () => {
    pkgTab = b.dataset.pkgtab;
    document.querySelectorAll('[data-pkgtab]').forEach(x => x.classList.toggle('is-active', x === b));
    renderPkgList();
  }));
  $('#pkgSearch').addEventListener('input', renderPkgList);
  $('#pkgList').addEventListener('click', async e => {
    const card = e.target.closest('[data-pkg]');
    if (!card) return;
    const p = data.packages.find(x => x.id === card.dataset.pkg);
    const left = p.total - p.used;
    const step = e.target.closest('[data-step]');
    if (step) { stepN[p.id] = Math.max(1, Math.min(left, (stepN[p.id] || 1) + Number(step.dataset.step))); renderPkgList(); return; }
    const use = e.target.closest('[data-use]');
    if (!use) return;
    const n = Math.min(stepN[p.id] || 1, left);
    if (!confirm(`ตัดคอร์ส ${p.course} ของ ${p.name || p.phone} จำนวน ${n} ครั้ง ?`)) return;
    use.disabled = true;
    try {
      const r = await act('use', { package_id: p.id, phone: p.phone, sessions: n });
      if (!r.ok) { toast(errText(r), true); use.disabled = false; return; }
      delete stepN[p.id];
      await reload(`ตัดคอร์สแล้ว · ${r.package.used}/${r.package.total}`);
    } catch { toast('ทำรายการไม่สำเร็จ', true); use.disabled = false; }
  });

  const sellForm = $('#sellForm');
  sellForm.course.addEventListener('change', () => {
    const o = sellForm.course.selectedOptions[0];
    if (o && o.dataset.sessions) sellForm.sessions.value = o.dataset.sessions;
    if (o && o.dataset.price && !sellForm.price.value) sellForm.price.value = o.dataset.price;
  });
  sellForm.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(sellForm);
    const err = $('#sellError'); err.hidden = true;
    const btn = sellForm.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const r = await act('sell', {
        customer_name: fd.get('customer_name').trim(), phone: fd.get('phone').replace(/\D/g, ''),
        course: fd.get('course'), sessions: fd.get('sessions'), price: fd.get('price'), expire_days: fd.get('expire_days')
      });
      btn.disabled = false;
      if (!r.ok) { err.textContent = errText(r); err.hidden = false; return; }
      sellForm.reset();
      await reload(`ขายคอร์ส ${r.package.package_name} ${r.package.total} ครั้งแล้ว${r.patient && !r.patient.linked ? ' · ลูกค้ายังไม่ผูก LINE' : ''}`);
    } catch { btn.disabled = false; err.textContent = 'บันทึกไม่สำเร็จ'; err.hidden = false; }
  });

  boot();
})();
