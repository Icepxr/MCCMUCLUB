-- ============================================================
--  นโยบายสิทธิ์ (Row Level Security)
--
--  แยกจากไฟล์ 0001 เพราะเป็นคนละเรื่องกัน — 0001 คือรูปร่างข้อมูล
--  ไฟล์นี้คือกติกาว่าใครทำอะไรได้
--
--  is_admin() อยู่ใน schema private ไม่ใช่ public
--  เพราะทุกฟังก์ชันใน public ถูกเปิดเป็น REST endpoint อัตโนมัติ
--  (/rest/v1/rpc/is_admin) ซึ่งไม่ใช่เจตนา — policy เรียกใช้ได้ตามปกติ
--  เพราะทำงานในฐานข้อมูล ไม่ได้ผ่าน API
-- ============================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
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

-- เนื้อหา: คนทั่วไปอ่านเฉพาะ published
-- (นโยบาย select สองอันเป็น OR กัน ผู้ดูแลจึงเห็น draft/archived ด้วย)
do $$
declare t text;
begin
  foreach t in array array['activities','docs','albums','places','members'] loop
    execute format($f$
      create policy public_read_published on %I
        for select to anon, authenticated
        using (status = 'published');
    $f$, t);
  end loop;

  foreach t in array array['activities','docs','albums','places','members','settings','admins'] loop
    execute format($f$
      create policy admin_full_access on %I
        for all to authenticated
        using (private.is_admin()) with check (private.is_admin());
    $f$, t);
  end loop;
end $$;

-- settings อ่านได้ทุกคน เพราะหน้าเว็บต้องใช้ (อีเมล โซเชียล ลิงก์แผนที่)
create policy public_read on settings
  for select to anon, authenticated using (true);
