FaceTime Clinic website

เปิดใน VS Code:
1. แตกไฟล์ ZIP
2. เปิดโฟลเดอร์นี้ด้วย VS Code
3. เปิด index.html หรือใช้ Live Server

โครงสร้างไฟล์
-------------
index.html, about.html, services.html, products.html, contact.html   หน้าหลัก
service-*.html                                                       หน้ารายละเอียดบริการ
ทุกหน้าใช้ css/style.css และ js/script.js ร่วมกัน

css/style.css      สไตล์ทั้งเว็บ (สี/ฟอนต์อยู่ในตัวแปร :root ด้านบนสุดของไฟล์)
js/script.js       เมนูมือถือ, เงา header ตอนเลื่อน, animation ตอนเลื่อน, ฟอร์มติดต่อ (ตัวอย่าง)
images/
  logo/              โลโก้
  clinic/            รูปคลินิกและแพทย์
  products/          รูปสินค้า
  services/<บริการ>/ รูปแต่ละบริการ (rhinoplasty, eyes, lips, ears, filler)
                     *-card.jpg = รูปการ์ด/หัวหน้า, *-main.jpg = รูปในเนื้อหา
  _unused/           รูปที่ไม่ได้ใช้ในเว็บ ลบทิ้งได้

หมายเหตุ: header / footer เหมือนกันทุกหน้า ถ้าแก้เมนูหรือข้อมูลติดต่อ ต้องแก้ให้ครบทุกไฟล์ .html


PRODUCT STORE UPDATE (v19)
- products.html now lists all 29 products referenced from https://www.facetime-clinic.com/category.
- product.html provides a dynamic product detail page via ?id=PRODUCT_ID.
- cart.html provides a browser localStorage shopping cart with quantity controls.
- order.html provides a static checkout/order summary form and LINE handoff workflow.
- js/products-data.js contains the 29-product catalog data used by the store.
- This is a static front-end store: no real payment gateway, inventory database, or backend order API is connected. Staff should confirm stock, shipping and payment before fulfillment.


v20 update: removed the external FaceTime Clinic category link from product detail pages and improved product image rendering by using higher-resolution CDN variants where available, plus sharper local product assets.

Address form update (v23)
- บ้านเลขที่ is a text field.
- จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ are linked dependent dropdowns.
- Address geography data is loaded from the Thailand Geography JSON dataset (7,000+ subdistrict records) and cached in the browser after first load.
- ถนน is an editable field with suggestions rather than a strict linked dropdown because the geography dataset does not contain a complete authoritative road-name table.


Store backend (v24) — ระบบสั่งซื้อ + หลังบ้าน (ยังไม่ใช้ login)
- order.html → เรียก Supabase RPC place_order → บันทึกตาราง orders + order_items (ราคาคำนวณฝั่ง DB จากตาราง products)
- admin.html → หลังบ้าน: ภาพรวมยอดขาย / รายการคำสั่งซื้อ (สินค้า จำนวน ราคา ที่อยู่ เบอร์) / เปลี่ยนสถานะ / แก้ราคา-สต็อกสินค้า
- เข้าหลังบ้านด้วยลิงก์ admin.html?key=<รหัส> (รหัสอยู่ใน Supabase ตาราง app_settings key = store_admin_key)
  ระบบจำรหัสไว้ในเบราว์เซอร์เครื่องนั้น — เปลี่ยนรหัสได้โดยแก้ค่าใน app_settings (ลิงก์เก่าจะใช้ไม่ได้ทันที)
- หลังบ้านเรียกเฉพาะฟังก์ชัน store_admin_* ที่ตรวจรหัสก่อนทุกครั้ง; ตาราง orders อ่านตรงจากเว็บไม่ได้ (RLS)
- ยังไม่เชื่อม LINE และยังไม่ใช้ระบบ login (ตาราง store_admins + is_store_admin() ยังอยู่ ไว้ต่อยอดภายหลัง)
