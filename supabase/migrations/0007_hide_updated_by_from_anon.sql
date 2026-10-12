-- ============================================================
--  ซ่อนอีเมลผู้ดูแล (คอลัมน์ updated_by) จากคนทั่วไป
--
--  เดิม anon มีสิทธิ์ SELECT ทั้งตาราง ทุกคนจึงอ่านอีเมลผู้ดูแลได้ทาง REST และ /data
--  การ revoke เฉพาะคอลัมน์อย่างเดียวไม่มีผล ถ้ายังมีสิทธิ์ระดับตารางอยู่
--  จึงต้องถอนสิทธิ์ทั้งตาราง แล้วให้คืนเฉพาะคอลัมน์ที่หน้าเว็บใช้
--
--  ⚠️ ลำดับสำคัญ: deploy api/data.js เวอร์ชันที่ขอคอลัมน์แบบระบุชื่อ (PUBLIC_COLS) ขึ้นเว็บก่อน
--     แล้วค่อยรันไฟล์นี้ — api/data.js เวอร์ชันเก่าขอ select=* ซึ่งจะโดน permission denied
--
--  ผู้ดูแล (authenticated) ไม่กระทบ: ยังอ่านได้ทุกคอลัมน์ตาม RLS เดิม
--  เพิ่มคอลัมน์ใหม่ในตารางเหล่านี้เมื่อไหร่ ต้อง grant ให้ anon เพิ่มที่นี่ และเพิ่มใน PUBLIC_COLS ของ api/data.js
-- ============================================================

revoke select on activities, docs, albums, places, members, settings from anon;

grant select (id, title_th, date, location, description, featured, cover_id, status, created_at, updated_at)
  on activities to anon;
grant select (id, title, description, date, file_id, status, created_at, updated_at)
  on docs to anon;
grant select (id, title, date, description, folder_id, cover_id, status, created_at, updated_at)
  on albums to anon;
grant select (id, name, type, description, map_url, coords, status, created_at, updated_at)
  on places to anon;
grant select (id, name, title, description, sort_order, cover_id, status, created_at, updated_at)
  on members to anon;
grant select (key, value, updated_at)
  on settings to anon;
