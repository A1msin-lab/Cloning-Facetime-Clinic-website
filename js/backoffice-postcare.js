// หน้าหลังบ้าน "ติดตามหลังทำ" (backoffice-postcare.html) — ดูอย่างเดียว
// ข้อมูลจาก Supabase function clinic_admin_postcare (ตรวจรหัสหลังบ้านเดียวกับหน้านัดหมาย/คอร์ส/ร้านค้า)
(() => {
  const SB = window.FACETIME_SUPABASE;
  const KEY_STORE = 'facetime_store_admin_key';
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

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const TZ = 'Asia/Bangkok';
  const hm = d => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
  const dayLabel = d => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
  const fullDay = d => new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
  const phoneFmt = p => p && p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}` : (p || '—');
  const telLink = p => /^0\d{8,9}$/.test(p || '') ? `<a class="btn btn--outline btn--sm" href="tel:${p}">โทร ${phoneFmt(p)}</a>` : '';
  const TYPE = { surgery: 'ผ่าตัด', single: 'ครั้งเดียว', course: 'คอร์ส' };

  // สถานะของแต่ละรอบ → [ข้อความ, class, ลำดับความสำคัญ (ยิ่งน้อยยิ่งด่วน)]
  const LEVEL = { urgent: ['🚨 ด่วน', 'pc-urgent', 0], watch: ['⚠️ ควรติดตาม', 'pc-watch', 1], normal: ['ℹ️ อาการทั่วไป', 'pc-normal', 3] };
  function roundStatus(r) {
    if (r.skipped_at) return [r.skip_reason === 'no_line' ? 'ข้าม (ไม่ผูก LINE)' : 'ข้าม', 'pc-muted', 9];
    if (!r.sent_at) return [`รอส่ง ${dayLabel(r.due_at)}`, 'pc-muted', 8];
    if (r.response === 'ok') return ['ปกติดี', 'pc-ok', 7];
    if (r.response === 'issue') {
      if (r.issue_text) return LEVEL[r.ai_level] || LEVEL.watch;
      if (r.no_detail_alerted_at) return ['มีอาการ (ไม่ได้เล่า)', 'pc-watch', 2];
      return ['รอเล่าอาการ', 'pc-wait', 4];
    }
    return ['ยังไม่ตอบ', 'pc-wait', 6];
  }

  let data = { rows: [] };
  let filter = 'all';

  function show(view) { ['loginView', 'dashView', 'loadingView'].forEach(id => { $('#' + id).hidden = id !== view; }); }
  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('is-error', isError); t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  // ===== เข้าระบบด้วยรหัสหลังบ้าน =====
  async function boot() {
    const urlKey = new URLSearchParams(location.search).get('key');
    if (urlKey) { store.set(KEY_STORE, urlKey.trim()); history.replaceState(null, '', location.pathname); }
    if (!getKey()) { $('#adminUser').hidden = true; show('loginView'); return; }
    show('loadingView');
    try { await loadAll(); }
    catch (err) {
      if (err.badKey) { store.set(KEY_STORE, ''); $('#loginError').textContent = 'รหัสหลังบ้านไม่ถูกต้อง'; $('#loginError').hidden = false; show('loginView'); return; }
      toast('โหลดข้อมูลไม่สำเร็จ', true);
    }
    $('#adminUser').hidden = false;
    show('dashView');
  }
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    store.set(KEY_STORE, new FormData(e.currentTarget).get('key').trim());
    $('#loginError').hidden = true;
    boot();
  });
  $('#logoutBtn').addEventListener('click', () => { store.set(KEY_STORE, ''); boot(); });

  async function loadAll() {
    data = await rpc('clinic_admin_postcare');
    $('#todayLabel').textContent = data.today ? fullDay(data.today + 'T12:00:00+07:00') : 'Clinic Back Office';
    renderKpis(); renderIssues(); renderTable();
  }
  $('#refreshBtn').addEventListener('click', async () => {
    try { await loadAll(); toast('อัปเดตข้อมูลแล้ว'); } catch { toast('โหลดข้อมูลไม่สำเร็จ', true); }
  });

  const rows = () => data.rows || [];

  // ===== KPI =====
  function renderKpis() {
    const sent = rows().filter(r => r.sent_at);
    const answered = sent.filter(r => r.response);
    const ok = sent.filter(r => r.response === 'ok').length;
    const issues = sent.filter(r => r.response === 'issue');
    const urgent = issues.filter(r => r.ai_level === 'urgent').length;
    const rate = sent.length ? Math.round(answered.length / sent.length * 100) : 0;
    const kpi = (label, value, sub, alert) => `<div class="kpi${alert ? ' is-alert' : ''}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
    $('#pcKpis').innerHTML = [
      kpi('ส่งการ์ดถามอาการแล้ว', sent.length, `จากทั้งหมด ${rows().length} รอบ`),
      kpi('อัตราตอบกลับ', `${rate}%`, `ตอบแล้ว ${answered.length} รอบ`),
      kpi('ตอบว่าปกติดี', ok, 'ไม่มีอาการผิดปกติ'),
      kpi('แจ้งอาการ', issues.length, urgent ? `ด่วน ${urgent} ราย` : 'ไม่มีเคสด่วน', urgent > 0)
    ].join('');
  }

  // ===== เคสแจ้งอาการ =====
  function renderIssues() {
    const list = rows().filter(r => r.response === 'issue')
      .map(r => ({ r, st: roundStatus(r) }))
      .sort((a, b) => a.st[2] - b.st[2] || new Date(b.r.responded_at) - new Date(a.r.responded_at));
    if (!list.length) { $('#issueList').innerHTML = '<p class="admin-empty">ยังไม่มีลูกค้าแจ้งอาการ</p>'; return; }
    $('#issueList').innerHTML = list.map(({ r, st }) => `
      <article class="bo-req pc-case ${st[1]}-edge">
        <div class="bo-req-top">
          <div class="bo-req-who"><strong>${esc(r.patient_name || 'ลูกค้า')}</strong><small>${phoneFmt(r.patient_phone)}${r.linked ? '' : ' · ยังไม่ผูก LINE'}</small></div>
          <span class="type-pill ${st[1]}">${st[0]}</span>
        </div>
        <div class="bo-req-info">
          <div><span>บริการ</span><b>${esc(r.service || '—')}</b>${TYPE[r.service_type] ? ` · ${TYPE[r.service_type]}` : ''}</div>
          <div><span>รอบติดตาม</span><b>วันที่ ${r.day_no} หลังทำ</b></div>
          <div><span>แจ้งเมื่อ</span><b>${r.responded_at ? `${dayLabel(r.responded_at)} · ${hm(r.responded_at)}` : '—'}</b></div>
        </div>
        ${r.ai_summary ? `<p class="pc-summary"><span>สรุป (AI)</span>${esc(r.ai_summary)}</p>` : ''}
        ${r.issue_text ? `<p class="pc-quote"><span>ข้อความลูกค้า</span>${esc(r.issue_text)}</p>`
          : `<p class="pc-quote"><span>ข้อความลูกค้า</span>${r.no_detail_alerted_at ? 'ลูกค้ากด "มีอาการผิดปกติ" แต่ไม่ได้เล่าอาการภายในเวลา — แนะนำโทรสอบถาม' : 'กำลังรอลูกค้าพิมพ์อาการ'}</p>`}
        <div class="bo-actions">${telLink(r.patient_phone)}</div>
      </article>`).join('');
  }

  // ===== ภาพรวม: 1 แถว = 1 การบันทึกบริการ, คอลัมน์ = รอบวันที่ 1/3/7 =====
  function groups() {
    const map = new Map();
    rows().forEach(r => {
      if (!map.has(r.so_id)) map.set(r.so_id, { so_id: r.so_id, done_at: r.done_at, patient_name: r.patient_name, patient_phone: r.patient_phone,
        linked: r.linked, service: r.service, service_type: r.service_type, rounds: {} });
      map.get(r.so_id).rounds[r.day_no] = r;
    });
    return [...map.values()].sort((a, b) => new Date(b.done_at) - new Date(a.done_at));
  }
  const DAYS = () => [...new Set(rows().map(r => r.day_no))].sort((a, b) => a - b);
  const hasIssue = g => Object.values(g.rounds).some(r => r.response === 'issue');
  const waiting = g => Object.values(g.rounds).some(r => r.sent_at && !r.response && !r.skipped_at);

  function renderTable() {
    const all = groups();
    const chips = [['all', 'ทั้งหมด', all.length], ['issue', 'แจ้งอาการ', all.filter(hasIssue).length], ['waiting', 'ยังไม่ตอบ', all.filter(waiting).length]];
    $('#pcFilters').innerHTML = chips.map(([k, l, n]) =>
      `<button type="button" role="tab" class="bo-chip ${filter === k ? 'is-active' : ''}" aria-selected="${filter === k}" data-f="${k}">${l} <span>${n}</span></button>`).join('');
    const q = $('#pcSearch').value.trim().toLowerCase();
    const list = all.filter(g => (filter === 'all' || (filter === 'issue' ? hasIssue(g) : waiting(g))) &&
      (!q || [g.patient_name, g.patient_phone, g.service].join(' ').toLowerCase().includes(q)));
    if (!list.length) { $('#pcTable').innerHTML = '<p class="admin-empty">ยังไม่มีรายการติดตาม — รายการจะขึ้นเมื่อพนักงานบันทึกบริการ</p>'; return; }
    const days = DAYS();
    $('#pcTable').innerHTML = `<table class="admin-table bo-table">
      <thead><tr><th>บันทึกบริการ</th><th>ลูกค้า</th><th>บริการ</th>${days.map(d => `<th>วันที่ ${d}</th>`).join('')}</tr></thead>
      <tbody>${list.map(g => `<tr>
        <td style="white-space:nowrap">${dayLabel(g.done_at)}<small>${hm(g.done_at)} น.</small></td>
        <td>${esc(g.patient_name || '—')}<small>${phoneFmt(g.patient_phone)}${g.linked ? '' : ' · ยังไม่ผูก LINE'}</small></td>
        <td>${esc(g.service || '—')}<small>${TYPE[g.service_type] || ''}</small></td>
        ${days.map(d => { const r = g.rounds[d]; if (!r) return '<td>—</td>'; const st = roundStatus(r);
          return `<td><span class="type-pill ${st[1]}">${st[0]}</span></td>`; }).join('')}
      </tr>`).join('')}</tbody></table>`;
  }
  $('#pcFilters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; renderTable(); } });
  $('#pcSearch').addEventListener('input', renderTable);

  boot();
})();
