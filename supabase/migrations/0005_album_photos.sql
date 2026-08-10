-- ============================================================
--  รายชื่อรูปในอัลบั้ม
--
--  ปัญหา: เดิม Apps Script ไล่อ่านโฟลเดอร์ Drive เพื่อหารูปในอัลบั้ม
--  ซึ่ง Supabase ทำแทนไม่ได้ ทำให้สลับมาใช้ Supabase แล้วอัลบั้มว่าง
--
--  ทางแก้: เก็บแค่ "รายชื่อรูป" ไว้ในฐานข้อมูล ตัวไฟล์รูปยังอยู่บน Drive
--  ได้ผลเหมือนเดิมโดยไม่ต้องย้ายไฟล์ 89 MB
--  (ถ้าวันหนึ่งย้ายรูปเข้า Supabase Storage ก็แค่เปลี่ยนค่าในคอลัมน์ file_id)
-- ============================================================

create table album_photos (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references albums(id) on delete cascade,
  file_id    text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index on album_photos (album_id, sort_order);
create unique index on album_photos (album_id, file_id);

alter table album_photos enable row level security;

-- คนทั่วไปเห็นรูปของอัลบั้มที่เผยแพร่แล้วเท่านั้น
create policy public_read on album_photos
  for select to anon, authenticated
  using (exists (
    select 1 from albums a
    where a.id = album_photos.album_id and a.status = 'published'
  ));

create policy admin_full_access on album_photos
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
