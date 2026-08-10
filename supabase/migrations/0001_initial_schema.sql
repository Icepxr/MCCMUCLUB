-- ============================================================
--  MCCMU — โครงสร้างฐานข้อมูลตั้งต้น
--
--  ออกแบบให้ตรงกับชีต Google Sheets เดิม เพื่อให้ย้ายข้อมูลตรงไปตรงมา
--  และเทียบความถูกต้องได้ทีละฟิลด์
--
--  หลักความปลอดภัย (Row Level Security):
--    • คนทั่วไป (anon)  อ่านได้เฉพาะแถวที่ status = 'published'
--    • ผู้ดูแล           ทำได้ทุกอย่าง — ดูจากอีเมลในตาราง admins
--  แปลว่าเบราว์เซอร์ต่อฐานข้อมูลตรงได้อย่างปลอดภัย ไม่ต้องมี API คั่น
-- ============================================================

create type content_status as enum ('published', 'draft', 'archived');

-- ── ผู้ดูแลระบบ · ส่งต่อรุ่นด้วยการเพิ่ม/ลบอีเมลในตารางนี้ ──
create table admins (
  email      text primary key,
  name       text,
  note       text,
  created_at timestamptz not null default now()
);
comment on table admins is 'อีเมลที่เข้าหลังบ้านได้ — เพิ่ม/ลบที่นี่เมื่อเปลี่ยนรุ่น';

-- ── ตัวช่วยเช็คสิทธิ์ ใช้ในทุก policy ──
-- security definer เพื่อให้อ่านตาราง admins ได้โดยไม่ติด RLS ของตัวเอง
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ── อัปเดต updated_at อัตโนมัติ ──
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ══════════════════════════════════════════════════════════
--  ตารางเนื้อหา
--  หมายเหตุ: cover_id / file_id / folder_id ตอนนี้เก็บค่าจาก Google Drive
--  (เป็นได้ทั้ง id ล้วนและลิงก์เต็ม เหมือนที่อยู่ในชีตตอนนี้)
--  เฟสหลังจะย้ายไป Supabase Storage แล้วค่อยเปลี่ยนความหมายของคอลัมน์
-- ══════════════════════════════════════════════════════════

create table activities (
  id          uuid primary key default gen_random_uuid(),
  title_th    text not null,
  date        date,
  location    text,
  description text,
  featured    boolean not null default false,
  cover_id    text,
  status      content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table docs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  date        date,
  file_id     text,
  status      content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table albums (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  date        date,
  description text,
  folder_id   text,
  cover_id    text,
  status      content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text,
  description text,
  map_url     text,
  coords      text,
  status      content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  title       text,
  description text,
  sort_order  integer,              -- ชีตใช้ชื่อ order ซึ่งเป็นคำสงวนใน SQL
  cover_id    text,
  status      content_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ตั้งค่าเว็บ (คู่ key/value) — ไม่มี status เพราะใช้งานทุกค่าเสมอ
create table settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ── index ตามการใช้งานจริงของหน้าเว็บ ──
create index on activities (status, date desc);
create index on docs       (status, date desc);
create index on albums     (status, date desc);
create index on places     (status, type);
create index on members    (status, sort_order);

-- ── trigger updated_at ──
create trigger touch before update on activities for each row execute function touch_updated_at();
create trigger touch before update on docs       for each row execute function touch_updated_at();
create trigger touch before update on albums     for each row execute function touch_updated_at();
create trigger touch before update on places     for each row execute function touch_updated_at();
create trigger touch before update on members    for each row execute function touch_updated_at();
create trigger touch before update on settings   for each row execute function touch_updated_at();

-- ══════════════════════════════════════════════════════════
--  Row Level Security
--  เปิดทุกตาราง — ถ้าไม่เปิด ใครก็อ่านเขียนได้ด้วย anon key
-- ══════════════════════════════════════════════════════════
alter table admins     enable row level security;
alter table activities enable row level security;
alter table docs       enable row level security;
alter table albums     enable row level security;
alter table places     enable row level security;
alter table members    enable row level security;
alter table settings   enable row level security;

-- เนื้อหา: คนทั่วไปอ่านเฉพาะ published · ผู้ดูแลทำได้ทุกอย่าง
-- (นโยบาย select สองอันเป็น OR กัน ผู้ดูแลจึงเห็น draft/archived ด้วย)
do $$
declare t text;
begin
  foreach t in array array['activities','docs','albums','places','members'] loop
    execute format($f$
      create policy public_read_published on %I
        for select to anon, authenticated
        using (status = 'published');
      create policy admin_full_access on %I
        for all to authenticated
        using (is_admin()) with check (is_admin());
    $f$, t, t);
  end loop;
end $$;

-- settings: อ่านได้ทุกคน (หน้าเว็บต้องใช้) แก้ได้เฉพาะผู้ดูแล
create policy public_read on settings
  for select to anon, authenticated using (true);
create policy admin_full_access on settings
  for all to authenticated using (is_admin()) with check (is_admin());

-- admins: ไม่เปิดให้ anon เห็นรายชื่อ · ผู้ดูแลจัดการกันเองได้
create policy admin_full_access on admins
  for all to authenticated using (is_admin()) with check (is_admin());
