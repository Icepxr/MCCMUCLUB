-- ============================================================
--  สถิติผู้เข้าชม
--
--  เก็บแค่ "ตัวเลขนับต่อวันต่อหน้า" เท่านั้น
--  ไม่เก็บ IP · ไม่เก็บ user agent · ไม่เก็บอะไรที่ระบุตัวบุคคลได้
--  ตรงตามหลักความเป็นส่วนตัวใน CLAUDE.md (เก็บเท่าที่จำเป็น)
--
--  "ผู้เข้าชม" นับจากธงใน localStorage ของเบราว์เซอร์ว่าวันนี้นับไปแล้วหรือยัง
--  จึงเป็นตัวเลขโดยประมาณ ไม่ใช่ตัวเลขที่ตรวจสอบย้อนหลังได้
-- ============================================================

create table page_stats (
  day      date not null,
  path     text not null,
  views    integer not null default 0,
  visitors integer not null default 0,
  primary key (day, path)
);
create index on page_stats (day desc);

alter table page_stats enable row level security;
-- อ่านได้เฉพาะผู้ดูแล · เขียนตรงไม่ได้ ต้องผ่านฟังก์ชันด้านล่างเท่านั้น
create policy admin_read on page_stats
  for select to authenticated using (private.is_admin());

/* ฟังก์ชันนี้ตั้งใจให้เรียกได้จากหน้าเว็บสาธารณะ (anon)
   จึงต้องอยู่ใน schema public และเป็น security definer
   — ตัว security advisor จะเตือนเรื่องนี้ ซึ่งเป็นการเตือนที่ถูกต้องตามกฎทั่วไป
   แต่กรณีนี้เป็นเจตนา เพราะเป็นทางเดียวที่จะนับผู้เข้าชมได้
   ความปลอดภัยอยู่ที่ฟังก์ชันรับได้แค่ path ของเว็บเรา และเพิ่มได้ทีละ 1 */
create or replace function track_view(p_path text, p_new_visitor boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d     date := (now() at time zone 'Asia/Bangkok')::date;
  clean text := left(coalesce(nullif(btrim(p_path), ''), '/'), 120);
begin
  -- รับเฉพาะ path ที่หน้าตาเหมือนของเว็บเรา กันคนยิงข้อมูลขยะเข้ามา
  if clean !~ '^/[A-Za-z0-9/_.-]*$' then
    return;
  end if;

  insert into page_stats (day, path, views, visitors)
  values (d, clean, 1, case when p_new_visitor then 1 else 0 end)
  on conflict (day, path) do update
    set views    = page_stats.views + 1,
        visitors = page_stats.visitors + case when p_new_visitor then 1 else 0 end;
end $$;

revoke all on function track_view(text, boolean) from public;
grant execute on function track_view(text, boolean) to anon, authenticated;
