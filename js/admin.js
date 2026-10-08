(() => {
  const SB = window.FACETIME_SUPABASE;
  const db = window.supabase.createClient(SB.url, SB.key);
  const $ = sel => document.querySelector(sel);
  const money = n => `฿${Number(n || 0).toLocaleString('th-TH')}`;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const fmtDate = d => new Date(d).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  const STATUS = {
    new: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', paid: 'ชำระเงินแล้ว',
    shipped: 'จัดส่งแล้ว', completed: 'สำเร็จ', cancelled: 'ยกเลิก'
  };
  const PAID = ['paid', 'shipped', 'completed'];
  const PENDING = ['new', 'confirmed'];
  const isSoldOut = p => /สินค้าหมด/.test(p.status || '');

  let products = [];
  let orders = [];

  function show(view) {
    ['loginView', 'deniedView', 'dashView', 'loadingView'].forEach(id => { $('#' + id).hidden = id !== view; });
  }

  function toast(msg, isError = false) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('is-error', isError); t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ===== Auth =====
  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { $('#adminUser').hidden = true; show('loginView'); return; }
    $('#adminEmail').textContent = session.user.email || '';
    $('#adminUser').hidden = false;
    const { data: isAdmin, error } = await db.rpc('is_store_admin');
    if (error || !isAdmin) { show('deniedView'); return; }
    show('loadingView');
    await loadAll();
    show('dashView');
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const btn = e.currentTarget.querySelector('button');
    btn.disabled = true; $('#loginError').hidden = true;
    const { error } = await db.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
    btn.disabled = false;
    if (error) { $('#loginError').textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; $('#loginError').hidden = false; return; }
    boot();
  });

  $('#logoutBtn').addEventListener('click', () => db.auth.signOut());

  // ===== Data =====
  async function loadAll() {
    const [p, o] = await Promise.all([
      db.from('products').select('*').order('sort_order'),
      db.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(1000)
    ]);
    if (p.error || o.error) { toast('โหลดข้อมูลไม่สำเร็จ', true); return; }
    products = p.data; orders = o.data;
    renderAll();
  }

  function renderAll() { renderOverview(); renderOrders(); renderProducts(); }

  $('#refreshBtn').addEventListener('click', async () => { await loadAll(); toast('อัปเดตข้อมูลแล้ว'); });

  // ===== Tabs =====
  document.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('is-active', b === btn));
    document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== btn.dataset.tab; });
  }));

  // ===== Overview =====
  function renderOverview() {
    const sum = list => list.reduce((s, o) => s + Number(o.total || 0), 0);
    const paid = orders.filter(o => PAID.includes(o.status));
    const pending = orders.filter(o => PENDING.includes(o.status));
    const now = new Date();
    const thisMonth = paid.filter(o => { const d = new Date(o.created_at); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
    const active = products.filter(p => p.active);
    const soldOut = active.filter(isSoldOut);
    const newCount = orders.filter(o => o.status === 'new').length;

    $('#newOrderCount').textContent = newCount || '';
    $('#kpiGrid').innerHTML = [
      ['ยอดขายเดือนนี้', money(sum(thisMonth)), `${thisMonth.length} คำสั่งซื้อที่ชำระแล้ว`],
      ['ยอดขายทั้งหมด', money(sum(paid)), `${paid.length} คำสั่งซื้อที่ชำระแล้ว`],
      ['รอดำเนินการ', String(pending.length), `มูลค่า ${money(sum(pending))}`],
      ['สินค้าบนเว็บ', String(active.length), `${soldOut.length} รายการสินค้าหมด · ${products.length - active.length} ซ่อนอยู่`]
    ].map(([label, value, sub]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`).join('');

    const tally = {};
    orders.filter(o => o.status !== 'cancelled').forEach(o => o.order_items.forEach(i => {
      const t = tally[i.product_name] || (tally[i.product_name] = { qty: 0, total: 0 });
      t.qty += i.qty; t.total += Number(i.line_total);
    }));
    const top = Object.entries(tally).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
    $('#topProducts').innerHTML = top.length
      ? `<table class="admin-table"><thead><tr><th>สินค้า</th><th class="num">ชิ้น</th><th class="num">ยอดขาย</th></tr></thead><tbody>${top.map(([name, t]) => `<tr><td>${esc(name)}</td><td class="num">${t.qty}</td><td class="num">${money(t.total)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="admin-empty">ยังไม่มีข้อมูลการขาย</p>';

    const recent = orders.slice(0, 6);
    $('#recentOrders').innerHTML = recent.length
      ? `<table class="admin-table"><thead><tr><th>เลขที่</th><th>ลูกค้า</th><th class="num">ยอดรวม</th><th>สถานะ</th></tr></thead><tbody>${recent.map(o => `<tr><td>${esc(o.order_no)}</td><td>${esc(o.customer_name)}</td><td class="num">${money(o.total)}</td><td><span class="status-pill status-${o.status}">${STATUS[o.status]}</span></td></tr>`).join('')}</tbody></table>`
      : '<p class="admin-empty">ยังไม่มีคำสั่งซื้อ</p>';
  }

  // ===== Orders =====
  Object.entries(STATUS).forEach(([k, v]) => $('#orderFilter').insertAdjacentHTML('beforeend', `<option value="${k}">${v}</option>`));
  $('#orderFilter').addEventListener('input', renderOrders);
  $('#orderSearch').addEventListener('input', renderOrders);

  function renderOrders() {
    const f = $('#orderFilter').value;
    const q = $('#orderSearch').value.trim().toLowerCase();
    const list = orders.filter(o => (f === 'all' || o.status === f) && (!q || [o.order_no, o.customer_name, o.phone].join(' ').toLowerCase().includes(q)));
    if (!list.length) { $('#ordersList').innerHTML = '<p class="admin-empty">ไม่พบคำสั่งซื้อ</p>'; return; }
    $('#ordersList').innerHTML = list.map(o => `
      <details class="order-row">
        <summary>
          <span class="order-no">${esc(o.order_no)}</span>
          <span class="order-who">${esc(o.customer_name)}<small>${esc(o.phone)} · ${fmtDate(o.created_at)}</small></span>
          <strong class="order-total">${money(o.total)}</strong>
          <span class="status-pill status-${o.status}">${STATUS[o.status]}</span>
        </summary>
        <div class="order-detail">
          <div>
            <h3>รายการสินค้า</h3>
            ${o.order_items.map(i => `<div class="order-item"><span>${esc(i.product_name)} × ${i.qty}</span><span>${money(i.line_total)}</span></div>`).join('')}
            <div class="order-item order-item--total"><span>ยอดรวม</span><strong>${money(o.total)}</strong></div>
          </div>
          <div>
            <h3>ที่อยู่จัดส่ง</h3>
            <p class="order-address">${esc(o.address)}</p>
            ${o.note ? `<h3>หมายเหตุ</h3><p class="order-address">${esc(o.note)}</p>` : ''}
            <label class="order-status-edit">เปลี่ยนสถานะ
              <select data-order-status="${o.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
            </label>
            <a class="btn btn--outline btn--sm" href="tel:${esc(o.phone)}">โทรหาลูกค้า</a>
          </div>
        </div>
      </details>`).join('');
    $('#ordersList').querySelectorAll('[data-order-status]').forEach(sel => sel.addEventListener('change', async () => {
      const id = Number(sel.dataset.orderStatus);
      const { error } = await db.from('orders').update({ status: sel.value }).eq('id', id);
      if (error) { toast('เปลี่ยนสถานะไม่สำเร็จ', true); return; }
      orders.find(o => o.id === id).status = sel.value;
      renderOverview(); renderOrders();
      toast('บันทึกสถานะแล้ว');
    }));
  }

  // ===== Products =====
  $('#productSearch').addEventListener('input', renderProducts);

  function renderProducts() {
    const q = $('#productSearch').value.trim().toLowerCase();
    const list = products.filter(p => !q || [p.id, p.name, p.brand].join(' ').toLowerCase().includes(q));
    $('#productsList').innerHTML = `<div class="admin-scroll"><table class="admin-table product-table">
      <thead><tr><th></th><th>สินค้า</th><th>ราคา</th><th>ราคาเดิม</th><th>สถานะ</th><th>แสดงบนเว็บ</th><th></th></tr></thead>
      <tbody>${list.map(p => `<tr data-row="${esc(p.id)}">
        <td><div class="thumb">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}</div></td>
        <td class="product-name"><strong>${esc(p.name)}</strong><small>${esc(p.id)} · ${esc(p.brand)} · ${esc(p.category)}</small></td>
        <td><input type="number" min="0" step="1" name="price" value="${p.price ?? ''}" placeholder="สอบถาม"></td>
        <td><input type="number" min="0" step="1" name="old_price" value="${p.old_price ?? ''}" placeholder="-"></td>
        <td><select name="status">${['มีจำหน่าย', 'สินค้าหมด'].map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
        <td><label class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span></span></label></td>
        <td><button class="btn btn--outline btn--sm" type="button" data-save="${esc(p.id)}">บันทึก</button></td>
      </tr>`).join('')}</tbody></table></div>`;
    $('#productsList').querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => saveProduct(btn)));
  }

  const numOrNull = v => (v === '' || v == null || Number(v) === 0) ? null : Number(v);

  async function saveProduct(btn) {
    const id = btn.dataset.save;
    const row = btn.closest('tr');
    const val = n => row.querySelector(`[name="${n}"]`);
    const patch = {
      price: numOrNull(val('price').value),
      old_price: numOrNull(val('old_price').value),
      status: val('status').value,
      active: val('active').checked
    };
    btn.disabled = true;
    const { error } = await db.from('products').update(patch).eq('id', id);
    btn.disabled = false;
    if (error) { toast('บันทึกไม่สำเร็จ', true); return; }
    Object.assign(products.find(p => p.id === id), patch);
    renderOverview();
    toast('บันทึกสินค้าแล้ว');
  }

  $('#addProductToggle').addEventListener('click', () => { $('#addProductForm').hidden = !$('#addProductForm').hidden; });

  $('#addProductForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const row = {
      id: fd.get('id').trim(), name: fd.get('name').trim(),
      brand: fd.get('brand').trim(), category: fd.get('category').trim(),
      price: numOrNull(fd.get('price')), old_price: numOrNull(fd.get('old_price')),
      unit: fd.get('unit').trim(), badge: fd.get('badge').trim() || null,
      image: fd.get('image').trim() || null, description: fd.get('description').trim(),
      sort_order: products.reduce((m, p) => Math.max(m, p.sort_order), 0) + 1
    };
    const { data, error } = await db.from('products').insert(row).select().single();
    if (error) {
      $('#addProductError').textContent = error.code === '23505' ? 'รหัสสินค้านี้มีอยู่แล้ว' : 'เพิ่มสินค้าไม่สำเร็จ';
      $('#addProductError').hidden = false; return;
    }
    $('#addProductError').hidden = true;
    products.push(data); e.currentTarget.reset(); e.currentTarget.hidden = true;
    renderOverview(); renderProducts();
    toast('เพิ่มสินค้าแล้ว');
  });

  db.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') boot(); });
  boot();
})();
