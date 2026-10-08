(() => {
  // Local file is the fallback; loadProducts() replaces it with live data from Supabase.
  let products = Array.isArray(window.FACETIME_PRODUCTS) ? window.FACETIME_PRODUCTS : [];
  const SB = window.FACETIME_SUPABASE;
  const sbFetch = (path, opts = {}) => fetch(`${SB.url}/rest/v1/${path}`, { ...opts, headers: { apikey: SB.key, 'Content-Type': 'application/json', ...(opts.headers || {}) } });

  async function loadProducts() {
    if (!SB) return;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await sbFetch('products?select=*&order=sort_order.asc', { signal: ctrl.signal });
      if (!res.ok) throw new Error(res.status);
      const rows = await res.json();
      if (rows.length) products = rows.map(r => ({
        id: r.id, name: r.name, description: r.description, detail: r.detail,
        price: Number(r.price || 0), oldPrice: Number(r.old_price || 0), badge: r.badge || '',
        category: r.category, brand: r.brand, status: r.status, unit: r.unit, image: r.image
      }));
    } catch (err) {
      console.warn('Supabase products unavailable, using local data', err);
    } finally { clearTimeout(timer); }
  }
  const CART_KEY = 'facetime_clinic_cart_v19';
  const money = n => `฿${Number(n || 0).toLocaleString('th-TH')}`;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const getCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } };
  const saveCart = cart => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount(); };
  const findProduct = id => products.find(p => p.id === id);
  const isSoldOut = p => /สินค้าหมด/.test(p.status || '');

  function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count);
  }

  function imageMarkup(p, large=false) {
    if (!p.image) return `<div class="product-placeholder">${esc((p.name || 'F').slice(0,1))}</div>`;
    const src = String(p.image).replace('/r_120x120/', '/r_1000x1000/');
    return `<img src="${esc(src)}" alt="${esc(p.name)}" loading="${large ? 'eager' : 'lazy'}" decoding="async" ${large ? 'fetchpriority="high"' : ''} onerror="this.classList.add('image-load-error')">`;
  }

  function cardMarkup(p) {
    const sold = isSoldOut(p);
    const sale = p.oldPrice && p.oldPrice > p.price;
    return `<article class="product-card store-card reveal">
      <a class="product-media store-product-media" href="product.html?id=${encodeURIComponent(p.id)}">${p.badge ? `<span class="store-badge">${esc(p.badge.split(' · ')[0])}</span>` : ''}${imageMarkup(p)}</a>
      <div class="product-body">
        <span class="product-tag">${esc(p.brand)} · ${esc(p.category)}</span>
        <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <p>${esc(p.description)}</p>
        <div class="price-row"><div>${sale ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}<span class="product-price">${p.price ? money(p.price) : 'สอบถามราคา'}</span></div>${sold ? '<span class="stock-pill is-out">สินค้าหมด</span>' : '<span class="stock-pill">พร้อมสั่งซื้อ</span>'}</div>
        <div class="card-actions"><a class="btn btn--outline btn--sm" href="product.html?id=${encodeURIComponent(p.id)}">ดูรายละเอียด</a><button class="btn btn--gold btn--sm" data-add-to-cart="${esc(p.id)}" ${sold ? 'disabled' : ''}>${sold ? 'สินค้าหมด' : 'ใส่ตะกร้า'}</button></div>
      </div></article>`;
  }

  function bindAddButtons(root=document) {
    root.querySelectorAll('[data-add-to-cart]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-add-to-cart'); const p = findProduct(id); if (!p || isSoldOut(p)) return;
      const cart = getCart(); const item = cart.find(x => x.id === id);
      if (item) item.qty += 1; else cart.push({ id, qty: 1 });
      saveCart(cart);
      btn.textContent = 'เพิ่มแล้ว ✓';
      setTimeout(() => { if (document.body.contains(btn)) btn.textContent = 'ใส่ตะกร้า'; }, 900);
    }));
  }

  function initProductsPage() {
    const grid = document.querySelector('#productGrid'); if (!grid) return;
    const search = document.querySelector('#productSearch');
    const category = document.querySelector('#productCategory');
    const sort = document.querySelector('#productSort');
    const count = document.querySelector('#productResultCount');
    const empty = document.querySelector('#productEmpty');
    const total = document.querySelector('#productTotal');
    if (total) total.textContent = `${products.length} รายการ`;
    [...new Set(products.map(p => p.category))].sort().forEach(cat => category.insertAdjacentHTML('beforeend', `<option value="${esc(cat)}">${esc(cat)}</option>`));

    function render() {
      const q = (search.value || '').trim().toLowerCase(); const cat = category.value; const s = sort.value;
      let list = products.filter(p => (!q || [p.name,p.id,p.brand,p.category,p.description].join(' ').toLowerCase().includes(q)) && (cat === 'all' || p.category === cat));
      if (s === 'price-asc') list.sort((a,b) => (a.price || 999999) - (b.price || 999999));
      if (s === 'price-desc') list.sort((a,b) => (b.price || 0) - (a.price || 0));
      if (s === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'th'));
      grid.innerHTML = list.map(cardMarkup).join(''); count.textContent = `พบสินค้า ${list.length} รายการ`; empty.hidden = list.length !== 0;
      grid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible')); bindAddButtons(grid);
    }
    [search, category, sort].forEach(el => el.addEventListener('input', render));
    render();
  }

  function initProductDetail() {
    const mount = document.querySelector('#productDetail'); if (!mount) return;
    const id = new URLSearchParams(location.search).get('id'); const p = findProduct(id) || products[0];
    document.title = `${p.name} | FaceTime Clinic`;
    document.querySelector('#detailTitle').textContent = p.name;
    const sold = isSoldOut(p);
    mount.innerHTML = `<div class="product-detail-grid"><div class="product-detail-media">${imageMarkup(p,true)}</div><div class="product-detail-copy"><div class="detail-badges">${p.badge ? `<span class="store-badge static">${esc(p.badge)}</span>` : ''}<span class="stock-pill ${sold ? 'is-out' : ''}">${esc(p.status)}</span></div><span class="product-tag">${esc(p.brand)} · ${esc(p.category)}</span><h2>${esc(p.name)}</h2><p class="detail-lead">${esc(p.description)}</p><div class="detail-price">${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}<strong>${p.price ? money(p.price) : 'สอบถามราคา'}</strong></div><div class="detail-meta"><div><span>รหัสสินค้า</span><strong>${esc(p.id)}</strong></div><div><span>แบรนด์</span><strong>${esc(p.brand)}</strong></div><div><span>ขนาด / หน่วย</span><strong>${esc(p.unit || '—')}</strong></div><div><span>หมวดหมู่</span><strong>${esc(p.category)}</strong></div></div><div class="detail-actions">${sold ? '<button class="btn btn--outline btn--block" disabled>สินค้าหมดชั่วคราว</button>' : `<div class="qty-control"><button type="button" data-qty-minus>−</button><input id="detailQty" value="1" inputmode="numeric" aria-label="จำนวน"><button type="button" data-qty-plus>+</button></div><button class="btn btn--gold btn--block" id="detailAdd">ใส่ตะกร้า</button>`}<a class="btn btn--outline btn--block" href="cart.html">ไปที่ตะกร้า</a></div><p class="store-note">ราคาหรือสถานะสินค้าอาจเปลี่ยนแปลงได้ กรุณาตรวจสอบกับคลินิกก่อนชำระเงิน</p></div></div>`;
    if (!sold) {
      const qty = document.querySelector('#detailQty');
      document.querySelector('[data-qty-minus]').onclick = () => qty.value = Math.max(1, Number(qty.value || 1) - 1);
      document.querySelector('[data-qty-plus]').onclick = () => qty.value = Math.max(1, Number(qty.value || 1) + 1);
      document.querySelector('#detailAdd').onclick = () => { const cart=getCart(); const n=Math.max(1,parseInt(qty.value,10)||1); const item=cart.find(x=>x.id===p.id); if(item)item.qty+=n;else cart.push({id:p.id,qty:n}); saveCart(cart); document.querySelector('#detailAdd').textContent='เพิ่มลงตะกร้าแล้ว ✓'; };
    }
    const related = products.filter(x => x.id !== p.id && (x.category === p.category || x.brand === p.brand)).slice(0,4);
    const relatedGrid = document.querySelector('#relatedProducts');
    relatedGrid.innerHTML = related.map(cardMarkup).join('');
    relatedGrid.querySelectorAll('.reveal').forEach(el => el.classList.add('is-visible')); bindAddButtons(relatedGrid);
  }

  function renderCart() {
    const mount = document.querySelector('#cartView'); if (!mount) return;
    const cart = getCart(); const items = cart.map(x => ({...x,p:findProduct(x.id)})).filter(x=>x.p);
    if (!items.length) { mount.innerHTML = `<div class="empty-cart"><div class="product-placeholder">🛒</div><h2>ยังไม่มีสินค้าในตะกร้า</h2><p>เลือกสินค้าที่ต้องการ แล้วกด “ใส่ตะกร้า” เพื่อเริ่มจัดทำรายการสั่งซื้อ</p><a class="btn btn--gold" href="products.html">เลือกสินค้า</a></div>`; return; }
    const total = items.reduce((s,x)=>s+(x.p.price||0)*x.qty,0);
    mount.innerHTML = `<div class="cart-items"><div class="cart-list-head"><span>สินค้า</span><span>จำนวน</span><span>รวม</span></div>${items.map(x=>`<div class="cart-item"><div class="cart-item-product"><div class="cart-thumb">${imageMarkup(x.p)}</div><div><a href="product.html?id=${encodeURIComponent(x.p.id)}"><strong>${esc(x.p.name)}</strong></a><small>${esc(x.p.id)} · ${esc(x.p.unit || '')}</small></div></div><div class="qty-control"><button data-cart-minus="${esc(x.p.id)}">−</button><input value="${x.qty}" data-cart-qty="${esc(x.p.id)}" inputmode="numeric"><button data-cart-plus="${esc(x.p.id)}">+</button></div><div class="cart-item-total"><strong>${money((x.p.price||0)*x.qty)}</strong><button class="remove-btn" data-cart-remove="${esc(x.p.id)}">ลบ</button></div></div>`).join('')}</div><aside class="cart-summary"><p class="eyebrow">Order Summary</p><h2>สรุปคำสั่งซื้อ</h2><div class="summary-line"><span>จำนวนสินค้า</span><strong>${items.reduce((s,x)=>s+x.qty,0)} ชิ้น</strong></div><div class="summary-line total"><span>ยอดรวม</span><strong>${money(total)}</strong></div><p class="store-note">ค่าจัดส่งและวิธีชำระเงินให้คลินิกยืนยันกับผู้สั่งซื้อก่อนชำระเงิน</p><a class="btn btn--gold btn--block" href="order.html">ไปหน้าสั่งซื้อ</a><a class="btn btn--outline btn--block" href="products.html">เลือกสินค้าเพิ่ม</a><button class="text-button" id="clearCart">ล้างตะกร้า</button></aside>`;
    mount.querySelectorAll('[data-cart-minus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.cartMinus,-1));
    mount.querySelectorAll('[data-cart-plus]').forEach(b=>b.onclick=()=>changeQty(b.dataset.cartPlus,1));
    mount.querySelectorAll('[data-cart-qty]').forEach(i=>i.onchange=()=>setQty(i.dataset.cartQty,i.value));
    mount.querySelectorAll('[data-cart-remove]').forEach(b=>b.onclick=()=>removeItem(b.dataset.cartRemove));
    document.querySelector('#clearCart').onclick=()=>{localStorage.removeItem(CART_KEY);updateCartCount();renderCart();};
  }
  function changeQty(id, delta){const cart=getCart();const item=cart.find(x=>x.id===id);if(!item)return;item.qty=Math.max(1,item.qty+delta);saveCart(cart);renderCart();}
  function setQty(id,val){const cart=getCart();const item=cart.find(x=>x.id===id);if(!item)return;item.qty=Math.max(1,parseInt(val,10)||1);saveCart(cart);renderCart();}
  function removeItem(id){saveCart(getCart().filter(x=>x.id!==id));renderCart();}

  async function loadThaiAddressData(){
    const CACHE_KEY='facetime_thai_address_v1';
    const URL='https://cdn.jsdelivr.net/gh/thailand-geography-data/thailand-geography-json@main/src/geography.json';
    try{
      const cached=localStorage.getItem(CACHE_KEY);
      if(cached){
        const parsed=JSON.parse(cached);
        if(Array.isArray(parsed) && parsed.length>7000) return parsed;
      }
    }catch{}
    const res=await fetch(URL,{cache:'no-store'});
    if(!res.ok) throw new Error('โหลดฐานข้อมูลที่อยู่ไม่สำเร็จ');
    const data=await res.json();
    if(!Array.isArray(data) || data.length<7000) throw new Error('ฐานข้อมูลที่อยู่ไม่ครบ');
    try{ localStorage.setItem(CACHE_KEY,JSON.stringify(data)); }catch{}
    return data;
  }

  function fillSelect(select, items, placeholder, valueKey='value', textKey='text'){
    select.innerHTML=`<option value="">${esc(placeholder)}</option>`;
    items.forEach(item=>{
      const opt=document.createElement('option');
      opt.value=String(item[valueKey]);
      opt.textContent=item[textKey];
      select.appendChild(opt);
    });
    select.disabled=items.length===0;
  }

  function initAddressFields(root, data){
    const province=root.querySelector('[name="province"]');
    const district=root.querySelector('[name="district"]');
    const subdistrict=root.querySelector('[name="subdistrict"]');
    const postal=root.querySelector('[name="postalCode"]');
    const road=root.querySelector('[name="road"]');
    const addressNote=root.querySelector('#addressDataNote');
    if(!province||!district||!subdistrict||!postal)return;

    const provinces=[...new Map(data.map(x=>[String(x.provinceCode),x])).values()]
      .sort((a,b)=>a.provinceNameTh.localeCompare(b.provinceNameTh,'th'))
      .map(x=>({value:x.provinceCode,text:x.provinceNameTh}));
    fillSelect(province,provinces,'เลือกจังหวัด');
    fillSelect(district,[],'เลือกอำเภอ / เขต');
    fillSelect(subdistrict,[],'เลือกตำบล / แขวง');
    fillSelect(postal,[],'เลือกรหัสไปรษณีย์');

    const updateDistricts=()=>{
      const pc=province.value;
      const rows=data.filter(x=>String(x.provinceCode)===pc);
      const districts=[...new Map(rows.map(x=>[String(x.districtCode),x])).values()]
        .sort((a,b)=>a.districtNameTh.localeCompare(b.districtNameTh,'th'))
        .map(x=>({value:x.districtCode,text:x.districtNameTh}));
      fillSelect(district,districts,'เลือกอำเภอ / เขต');
      fillSelect(subdistrict,[],'เลือกตำบล / แขวง');
      fillSelect(postal,[],'เลือกรหัสไปรษณีย์');
      if(road) road.value='';
    };
    const updateSubdistricts=()=>{
      const pc=province.value, dc=district.value;
      const rows=data.filter(x=>String(x.provinceCode)===pc&&String(x.districtCode)===dc);
      const subs=[...new Map(rows.map(x=>[String(x.subdistrictCode),x])).values()]
        .sort((a,b)=>a.subdistrictNameTh.localeCompare(b.subdistrictNameTh,'th'))
        .map(x=>({value:x.subdistrictCode,text:x.subdistrictNameTh}));
      fillSelect(subdistrict,subs,'เลือกตำบล / แขวง');
      fillSelect(postal,[],'เลือกรหัสไปรษณีย์');
    };
    const updatePostal=()=>{
      const pc=province.value, dc=district.value, sc=subdistrict.value;
      const rows=data.filter(x=>String(x.provinceCode)===pc&&String(x.districtCode)===dc&&String(x.subdistrictCode)===sc);
      const zips=[...new Set(rows.map(x=>String(x.postalCode)).filter(Boolean))].sort();
      fillSelect(postal,zips.map(x=>({value:x,text:x})),'เลือกรหัสไปรษณีย์');
      if(zips.length===1) postal.value=zips[0];
    };

    province.addEventListener('change',updateDistricts);
    district.addEventListener('change',updateSubdistricts);
    subdistrict.addEventListener('change',updatePostal);
    if(addressNote) addressNote.textContent='เลือกจังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ ระบบจะเชื่อมข้อมูลให้โดยอัตโนมัติ';
  }

  async function initOrder(){
    const mount=document.querySelector('#orderView'); if(!mount)return;
    const cart=getCart(); const items=cart.map(x=>({...x,p:findProduct(x.id)})).filter(x=>x.p); if(!items.length){mount.innerHTML=`<div class="empty-cart"><h2>ยังไม่มีรายการสั่งซื้อ</h2><p>กรุณาเลือกสินค้าก่อนเข้าสู่หน้าสั่งซื้อ</p><a class="btn btn--gold" href="products.html">เลือกสินค้า</a></div>`;return;}
    const total=items.reduce((s,x)=>s+(x.p.price||0)*x.qty,0);
    mount.innerHTML=`<div class="order-form-wrap"><form id="orderForm" class="order-form"><div class="section-head section-head--left"><p class="eyebrow">Customer Information</p><h2>ข้อมูลผู้สั่งซื้อ</h2></div><div class="form-row"><label>ชื่อ - นามสกุล<input name="name" required placeholder="กรอกชื่อผู้สั่งซื้อ"></label><label>เบอร์โทรศัพท์<input name="phone" required inputmode="tel" placeholder="08x-xxx-xxxx"></label></div><div class="address-block"><div class="address-title"><strong>ที่อยู่จัดส่ง</strong><span>เลือกข้อมูลจากรายการเพื่อให้ที่อยู่สัมพันธ์กัน</span></div><div class="address-grid address-grid--2"><label>บ้านเลขที่ / หมู่บ้าน<input name="houseNo" required placeholder="เช่น 221/10 หมู่ 3"></label><label>ถนน <input name="road" placeholder="พิมพ์ชื่อถนน"></label></div><div class="address-grid address-grid--2"><label>จังหวัด<select name="province" required><option value="">กำลังโหลดข้อมูล...</option></select></label><label>อำเภอ / เขต<select name="district" required disabled><option value="">เลือกจังหวัดก่อน</option></select></label></div><div class="address-grid address-grid--2"><label>ตำบล / แขวง<select name="subdistrict" required disabled><option value="">เลือกอำเภอก่อน</option></select></label><label>รหัสไปรษณีย์<select name="postalCode" required disabled><option value="">เลือกตำบลก่อน</option></select></label></div><p class="address-data-note" id="addressDataNote">กำลังโหลดฐานข้อมูลที่อยู่ประเทศไทย...</p></div><label>หมายเหตุเพิ่มเติม<textarea name="note" rows="3" placeholder="เช่น ต้องการให้คลินิกโทรยืนยันก่อนจัดส่ง"></textarea></label><div class="order-policy"><strong>การชำระเงิน</strong><p>เว็บไซต์เวอร์ชันนี้ยังไม่เชื่อมระบบชำระเงินออนไลน์ หลังส่งรายการแล้ว กรุณาส่งสรุปคำสั่งซื้อให้คลินิกผ่าน LINE เพื่อยืนยันสินค้า ค่าส่ง และวิธีชำระเงิน</p></div><button class="btn btn--gold btn--block" type="submit">สร้างสรุปคำสั่งซื้อ</button><div id="orderResult" class="order-result" hidden></div></form><aside class="order-summary"><p class="eyebrow">Your Order</p><h2>รายการสินค้า</h2>${items.map(x=>`<div class="order-line"><div><strong>${esc(x.p.name)}</strong><small>${x.qty} × ${money(x.p.price)}</small></div><strong>${money(x.p.price*x.qty)}</strong></div>`).join('')}<div class="summary-line total"><span>ยอดรวม</span><strong>${money(total)}</strong></div><a class="btn btn--outline btn--block" href="cart.html">แก้ไขตะกร้า</a></aside></div>`;

    try{
      const addressData=await loadThaiAddressData();
      initAddressFields(mount,addressData);
    }catch(err){
      const note=mount.querySelector('#addressDataNote');
      if(note) note.innerHTML='ไม่สามารถโหลดฐานข้อมูลที่อยู่ได้ในขณะนี้ กรุณาเปิดเว็บผ่านอินเทอร์เน็ตแล้วรีเฟรชหน้าอีกครั้ง';
      const form=mount.querySelector('#orderForm');
      form?.querySelectorAll('select[name="province"],select[name="district"],select[name="subdistrict"],select[name="postalCode"]').forEach(s=>s.disabled=true);
    }

    mount.querySelector('#orderForm').onsubmit=async e=>{
      e.preventDefault();
      const form=e.currentTarget;
      const submitBtn=form.querySelector('button[type="submit"]');
      const fd=new FormData(form);
      const selectedText=name=>{const el=form.querySelector(`[name="${name}"]`);return el?.selectedOptions?.[0]?.textContent?.trim()||'-';};
      const address=[
        `บ้านเลขที่: ${fd.get('houseNo')}`,
        `ถนน: ${fd.get('road') || '-'}`,
        `ตำบล/แขวง: ${selectedText('subdistrict')}`,
        `อำเภอ/เขต: ${selectedText('district')}`,
        `จังหวัด: ${selectedText('province')}`,
        `รหัสไปรษณีย์: ${fd.get('postalCode') || '-'}`
      ].join('\n');
      const lines=items.map(x=>`- ${x.p.name} x${x.qty} = ${money(x.p.price*x.qty)}`).join('\n');
      submitBtn.disabled=true; submitBtn.textContent='กำลังส่งคำสั่งซื้อ...';
      let orderNo='';
      try{
        const res=await sbFetch('rpc/place_order',{method:'POST',body:JSON.stringify({
          customer:{name:fd.get('name'),phone:fd.get('phone'),address,note:fd.get('note')||''},
          items:items.map(x=>({id:x.p.id,qty:x.qty}))
        })});
        if(!res.ok) throw new Error(await res.text());
        orderNo=await res.json();
        localStorage.removeItem(CART_KEY); updateCartCount();
      }catch(err){ console.warn('Order not saved to Supabase',err); }
      if(orderNo) submitBtn.textContent='ส่งคำสั่งซื้อแล้ว ✓';
      else { submitBtn.disabled=false; submitBtn.textContent='สร้างสรุปคำสั่งซื้อ'; }
      const summary=`สั่งซื้อสินค้า FaceTime Clinic${orderNo?`\nเลขที่คำสั่งซื้อ: ${orderNo}`:''}\nชื่อ: ${fd.get('name')}\nโทร: ${fd.get('phone')}\nที่อยู่จัดส่ง:\n${address}\n${lines}\nยอดรวม: ${money(total)}${fd.get('note')?`\nหมายเหตุ: ${fd.get('note')}`:''}`;
      const result=mount.querySelector('#orderResult');
      result.hidden=false;
      result.innerHTML=`<h3>${orderNo?`ได้รับคำสั่งซื้อแล้ว · เลขที่ ${esc(orderNo)}`:'สร้างสรุปคำสั่งซื้อแล้ว'}</h3>${orderNo?'':'<p class="store-note">ระบบบันทึกคำสั่งซื้อไม่สำเร็จ กรุณาส่งสรุปนี้ให้คลินิกทาง LINE</p>'}<textarea readonly id="orderSummaryText">${esc(summary)}</textarea><div class="result-actions"><button class="btn btn--gold" type="button" id="copyOrder">คัดลอกสรุป</button><a class="btn btn--outline" href="https://page.line.me/edz3851q" target="_blank" rel="noopener">เปิด LINE ให้คลินิก</a></div><p class="store-note">กด “คัดลอกสรุป” แล้วเปิด LINE เพื่อส่งรายละเอียดให้คลินิก เจ้าหน้าที่จะยืนยันสต็อก ค่าจัดส่ง และการชำระเงินอีกครั้ง</p>`;
      mount.querySelector('#copyOrder').onclick=async()=>{try{await navigator.clipboard.writeText(summary);mount.querySelector('#copyOrder').textContent='คัดลอกแล้ว ✓';}catch{const t=mount.querySelector('#orderSummaryText');t.focus();t.select();document.execCommand('copy');mount.querySelector('#copyOrder').textContent='คัดลอกแล้ว ✓';}};
    };
  }

  document.addEventListener('DOMContentLoaded',async()=>{updateCartCount();await loadProducts();initProductsPage();initProductDetail();renderCart();initOrder();});
})();
