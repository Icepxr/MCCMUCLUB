-- ============================================================
--  ประวัติการแก้ไข + คุณภาพข้อมูล
--
--  1. ตาราง audit_log — บันทึกทุกการเพิ่ม/แก้/ลบ อัตโนมัติด้วย trigger
--     ไม่ต้องให้โค้ดฝั่งแอปเรียกเอง จึงลืมบันทึกไม่ได้
--  2. คอลัมน์ updated_by — รู้ว่าใครแก้ล่าสุด สำคัญตอนหลายคนช่วยกันดูแล
--  3. จำกัดค่า places.type — ทำ dropdown ได้ และกันพิมพ์ผิดจนเว็บกรองไม่เจอ
-- ============================================================

-- ── 1. ประวัติการแก้ไข ──
create table audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,          -- อีเมลคนที่ทำ ('system' ถ้ามาจากสคริปต์)
  action     text not null, -- insert | update | delete
  table_name text not null,
  row_id     text,          -- uuid ของเนื้อหา หรือ key ของ settings
  summary    text,          -- ชื่อรายการ ไว้อ่านให้รู้เรื่องโดยไม่ต้องเปิดดู
  changed    jsonb          -- เฉพาะ update: {คอลัมน์: [ค่าเดิม, ค่าใหม่]}
);
create index on audit_log (at desc);
create index on audit_log (table_name, at desc);

alter table audit_log enable row level security;
-- อ่านได้เฉพาะผู้ดูแล · ไม่มีใครเขียนตรงได้ trigger เป็นคนเขียนให้เท่านั้น
create policy admin_read on audit_log
  for select to authenticated using (private.is_admin());

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
      -- updated_at/updated_by เปลี่ยนทุกครั้งอยู่แล้ว ไม่ใช่สาระ
      if k not in ('updated_at', 'updated_by')
         and (v_new -> k) is distinct from (v_old -> k) then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return null; end if;   -- ไม่มีอะไรเปลี่ยนจริง
  end if;

  insert into audit_log (actor, action, table_name, row_id, summary, changed)
  values (
    lower(coalesce(auth.jwt() ->> 'email', 'system')),
    lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(v_row ->> 'id', v_row ->> 'key'),
    left(coalesce(v_row ->> 'title_th', v_row ->> 'title',
                  v_row ->> 'name', v_row ->> 'key', ''), 120),
    case when TG_OP = 'UPDATE' then v_diff else null end
  );
  return null;
end $$;

-- ── 2. ใครแก้ล่าสุด ──
alter table activities add column updated_by text;
alter table docs       add column updated_by text;
alter table albums     add column updated_by text;
alter table places     add column updated_by text;
alter table members    add column updated_by text;
alter table settings   add column updated_by text;

-- เติม updated_by ให้เองตอนแก้ ไม่ต้องหวังว่าโค้ดฝั่งแอปจะส่งมา
create or replace function touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.jwt() ->> 'email', new.updated_by);
  return new;
end;
$$;

-- ── ผูก trigger ประวัติกับทุกตารางเนื้อหา ──
do $$
declare t text;
begin
  foreach t in array array['activities','docs','albums','places','members','settings'] loop
    execute format(
      'create trigger audit after insert or update or delete on %I
         for each row execute function private.write_audit()', t);
  end loop;
end $$;

-- ── 3. จำกัดประเภทสถานที่ ──
-- ค่าที่ใช้จริงในชีต: ร้านอาหาร 12 · มัสยิด 3 · ห้องละหมาด 3
-- เพิ่มประเภทใหม่ทีหลัง: alter type place_type add value 'ชื่อใหม่';
create type place_type as enum ('ร้านอาหาร', 'มัสยิด', 'ห้องละหมาด');
alter table places alter column type type place_type using type::place_type;
