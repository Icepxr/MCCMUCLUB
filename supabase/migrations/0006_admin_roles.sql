-- ============================================================
--  ระดับสิทธิ์ของผู้ดูแล
--
--  ปัญหาเดิม: ทุกคนในตาราง admins มีสิทธิ์เท่ากันหมด (policy admin_full_access
--  ครอบทุกคำสั่งบนทุกตาราง รวมถึงตาราง admins เอง) แปลว่าคนที่เพิ่งถูกเพิ่ม
--  เข้ามาเมื่อวาน ลบหัวหน้าฝ่ายไอทีออกจากระบบได้ทันที
--
--  แก้เป็น 2 ระดับ:
--    owner  — ทำได้ทุกอย่าง + เพิ่ม/ลบ/เปลี่ยนระดับผู้ดูแล
--    editor — แก้เนื้อหาได้ทั้งหมด แต่แตะตาราง admins ไม่ได้ (อ่านได้อย่างเดียว)
--
--  บังคับที่ฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ — ต่อให้ยิง REST ตรงก็ไม่ผ่าน
-- ============================================================

create type admin_role as enum ('owner', 'editor');

alter table admins add column role admin_role not null default 'editor';
comment on column admins.role is 'owner = จัดการผู้ดูแลได้ · editor = แก้เนื้อหาได้อย่างเดียว';

-- คนที่ถูกเพิ่มเข้าระบบคนแรกคือคนที่ตั้งระบบขึ้นมา → ให้เป็นเจ้าของ
-- ถ้าไม่ตรงกับความจริง แก้ได้ใน SQL Editor:
--   update admins set role = 'owner'  where email = 'อีเมล@gmail.com';
--   update admins set role = 'editor' where email = 'อีเมล@gmail.com';
update admins set role = 'owner'
where email = (select email from admins order by created_at, email limit 1);

-- ── ใครคือเจ้าของ ──
-- อยู่ใน schema private ด้วยเหตุผลเดียวกับ is_admin() คือกันไม่ให้กลายเป็น
-- REST endpoint สาธารณะโดยอัตโนมัติ
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'owner'
  );
$$;

-- ── สิทธิ์บนตาราง admins ──
-- เดิม: ผู้ดูแลทุกคน for all  →  ใหม่: ทุกคนอ่านได้ เจ้าของเท่านั้นที่แก้ได้
-- (ให้ทุกคนอ่านได้ เพราะตอนส่งต่อรุ่นต้องเห็นว่าตอนนี้ใครดูแลอยู่บ้าง)
drop policy admin_full_access on admins;

create policy admin_read on admins
  for select to authenticated using (private.is_admin());

create policy owner_insert on admins
  for insert to authenticated with check (private.is_owner());

create policy owner_update on admins
  for update to authenticated
  using (private.is_owner()) with check (private.is_owner());

create policy owner_delete on admins
  for delete to authenticated using (private.is_owner());

-- ── กันระบบไร้เจ้าของ ──
-- ถ้าเจ้าของคนสุดท้ายลบตัวเอง (หรือลดตัวเองเป็น editor) จะไม่เหลือใครเพิ่มคนได้อีก
-- ต้องเข้า SQL Editor ของ Supabase ไปแก้มือ — กันไว้ตั้งแต่แรกดีกว่า
create or replace function private.require_one_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where role = 'owner') then
    raise exception 'ต้องเหลือเจ้าของระบบอย่างน้อย 1 คนเสมอ — ตั้งคนใหม่เป็นเจ้าของก่อนแล้วค่อยถอดคนเดิม';
  end if;
  return null;
end $$;

create trigger require_one_owner
  after delete or update on admins
  for each statement execute function private.require_one_owner();

-- ── บันทึกประวัติการเปลี่ยนผู้ดูแลด้วย ──
-- เรื่องสิทธิ์เป็นเรื่องที่ต้องตรวจย้อนหลังได้มากที่สุด แต่เดิมกลับเป็นตารางเดียว
-- ที่ไม่มี trigger ประวัติ
create trigger audit after insert or update or delete on admins
  for each row execute function private.write_audit();

-- ตาราง admins ใช้ email เป็น primary key ไม่ใช่ id/key เหมือนตารางอื่น
-- write_audit เดิมจึงบันทึก row_id เป็น null
create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new   jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_old   jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_row   jsonb := coalesce(v_new, v_old);
  v_diff  jsonb := '{}'::jsonb;
  k       text;
begin
  if TG_OP = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      if k not in ('updated_at', 'updated_by')
         and (v_new -> k) is distinct from (v_old -> k) then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return null; end if;
  end if;

  insert into audit_log (actor, action, table_name, row_id, summary, changed)
  values (
    lower(coalesce(auth.jwt() ->> 'email', 'system')),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'email'),
    left(coalesce(
      case when TG_TABLE_NAME = 'admins' then v_row ->> 'email' end,
      v_row ->> 'title_th', v_row ->> 'title',
      v_row ->> 'name', v_row ->> 'key', ''), 120),
    case when TG_OP = 'UPDATE' then v_diff else null end
  );
  return null;
end $$;
