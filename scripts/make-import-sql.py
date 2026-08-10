#!/usr/bin/env python3
"""
แปลงไฟล์สำรองใน data/backup/ เป็นคำสั่ง SQL สำหรับนำเข้า Supabase

ทำไมสร้างเป็นไฟล์ SQL แทนยิงเข้าฐานข้อมูลตรง ๆ:
  • ตรวจดูได้ก่อนรันว่าจะเขียนอะไรลงไป
  • เก็บใน git ได้ ย้อนดูได้ว่าย้ายอะไรเมื่อไหร่
  • ไม่ต้องใช้ service_role key ที่เป็นความลับ

รันซ้ำได้ไม่เกิดข้อมูลซ้ำ: id สร้างจาก uuid5 ของค่าประจำตัวแต่ละแถว
(เช่น ชื่อ+วันที่) แถวเดิมจึงได้ id เดิมเสมอ แล้วใช้ on conflict do update

ใช้:  python3 scripts/make-import-sql.py > supabase/seed/import.sql
"""
import json, re, sys, uuid, pathlib

BACKUP = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'backup'
NS = uuid.UUID('6f9619ff-8b86-d011-b42d-00c04fc964ff')

def drive_id(v):
    """ดึง Drive id ออกจากลิงก์ — ชีตเก็บมาไม่เหมือนกัน บางแถวเป็นลิงก์เต็ม บางแถวเป็น id"""
    s = str(v or '').strip()
    if not s: return None
    m = re.search(r'[-\w]{25,}', s)
    return m.group(0) if m else s

def clean(v):
    s = str(v or '').strip()
    return s or None

def rid(sheet, *parts):
    return str(uuid.uuid5(NS, sheet + '|' + '|'.join(str(p or '') for p in parts)))

def load(name):
    return json.loads((BACKUP / f'{name}.json').read_text(encoding='utf-8'))

def block(table, cols, rows, conflict='id'):
    """สร้าง insert ... select จาก jsonb — คำสั่งเดียวต่อตาราง อ่านง่ายกว่าเขียนซ้ำทีละแถว"""
    payload = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    sel = ',\n       '.join(f"{expr} as {name}" for name, expr in cols)
    upd = ', '.join(f"{name}=excluded.{name}" for name, _ in cols if name != conflict)
    names = ', '.join(name for name, _ in cols)
    return (f"-- {table} ({len(rows)} แถว)\n"
            f"insert into {table} ({names})\n"
            f"select {sel}\n"
            f"from jsonb_array_elements($j${payload}$j$::jsonb) as r\n"
            f"on conflict ({conflict}) do update set {upd};\n")

out = ["-- สร้างอัตโนมัติจาก scripts/make-import-sql.py — อย่าแก้ด้วยมือ",
       "-- รันซ้ำได้ ข้อมูลไม่ซ้ำ (id คงที่ต่อแถวเดิม + on conflict do update)",
       "begin;", ""]

S = "coalesce(nullif(r->>'status',''),'draft')::content_status"
D = lambda k: f"nullif(r->>'{k}','')::date"
T = lambda k: f"nullif(r->>'{k}','')"

out.append(block('activities',
    [('id', "(r->>'id')::uuid"), ('title_th', T('title_th')), ('date', D('date')),
     ('location', T('location')), ('description', T('description')),
     ('featured', "coalesce(lower(r->>'featured') in ('yes','true','1'), false)"),
     ('cover_id', T('cover_id')), ('status', S)],
    [{'id': rid('activities', r.get('title_th'), r.get('date')),
      'title_th': clean(r.get('title_th')), 'date': clean(r.get('date')),
      'location': clean(r.get('location')), 'description': clean(r.get('description')),
      'featured': str(r.get('featured') or '').lower(),
      'cover_id': drive_id(r.get('cover_id')), 'status': clean(r.get('status'))}
     for r in load('activities')]))

out.append(block('docs',
    [('id', "(r->>'id')::uuid"), ('title', T('title')), ('description', T('description')),
     ('date', D('date')), ('file_id', T('file_id')), ('status', S)],
    [{'id': rid('docs', r.get('title'), r.get('file_id')),
      'title': clean(r.get('title')), 'description': clean(r.get('description')),
      'date': clean(r.get('date')), 'file_id': drive_id(r.get('file_id')),
      'status': clean(r.get('status'))} for r in load('docs')]))

out.append(block('albums',
    [('id', "(r->>'id')::uuid"), ('title', T('title')), ('date', D('date')),
     ('description', T('description')), ('folder_id', T('folder_id')),
     ('cover_id', T('cover_id')), ('status', S)],
    [{'id': rid('albums', r.get('title'), r.get('date')),
      'title': clean(r.get('title')), 'date': clean(r.get('date')),
      'description': clean(r.get('description')), 'folder_id': drive_id(r.get('folder_id')),
      'cover_id': drive_id(r.get('cover_id')), 'status': clean(r.get('status'))}
     for r in load('albums')]))

out.append(block('places',
    [('id', "(r->>'id')::uuid"), ('name', T('name')), ('type', "(r->>'type')::place_type"),
     ('description', T('description')), ('map_url', T('map_url')),
     ('coords', T('coords')), ('status', S)],
    [{'id': rid('places', r.get('name')), 'name': clean(r.get('name')),
      'type': clean(r.get('type')), 'description': clean(r.get('description')),
      'map_url': clean(r.get('map_url')), 'coords': clean(r.get('coords')),
      'status': clean(r.get('status'))} for r in load('places')]))

out.append(block('members',
    [('id', "(r->>'id')::uuid"), ('name', T('name')), ('title', T('title')),
     ('description', T('description')), ('sort_order', "nullif(r->>'sort_order','')::int"),
     ('cover_id', T('cover_id')), ('status', S)],
    [{'id': rid('members', r.get('name')), 'name': clean(r.get('name')),
      'title': clean(r.get('title')), 'description': clean(r.get('description')),
      'sort_order': clean(r.get('order')), 'cover_id': drive_id(r.get('cover_id')),
      'status': clean(r.get('status'))} for r in load('members')]))

st = load('settings')
out.append(block('settings',
    [('key', "r->>'key'"), ('value', "coalesce(r->>'value','')")],
    [{'key': k, 'value': (drive_id(v) if k.endswith('_id') and v else str(v or ''))}
     for k, v in sorted(st.items())], conflict='key'))

out.append('commit;')
sys.stdout.write('\n'.join(out) + '\n')
