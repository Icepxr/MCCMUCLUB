-- ============================================================
--  ย้าย is_admin() ออกจาก schema public
--
--  ปัญหา: ทุกฟังก์ชันใน schema public ถูกเปิดเป็น REST endpoint อัตโนมัติ
--  (/rest/v1/rpc/is_admin) ใครก็เรียกได้ ซึ่งไม่ใช่เจตนา
--
--  วิธีแก้: ย้ายไป schema private ที่ไม่ถูกเปิดเป็น API
--  policy ยังเรียกใช้ได้ตามปกติ เพราะ policy ทำงานในฐานข้อมูลไม่ผ่าน API
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

-- ผูก policy เดิมกับฟังก์ชันตัวใหม่
do $$
declare t text;
begin
  foreach t in array array['activities','docs','albums','places','members','settings','admins'] loop
    execute format('drop policy if exists admin_full_access on %I', t);
    execute format($f$
      create policy admin_full_access on %I
        for all to authenticated
        using (private.is_admin()) with check (private.is_admin());
    $f$, t);
  end loop;
end $$;

drop function if exists public.is_admin();
