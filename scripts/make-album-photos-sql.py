#!/usr/bin/env python3
"""
ดึงรายชื่อรูปในแต่ละอัลบั้มจาก Apps Script (ซึ่งไล่อ่านโฟลเดอร์ Drive ให้)
แล้วสร้าง SQL สำหรับใส่ลงตาราง album_photos

ต้องรันซ้ำทุกครั้งที่เพิ่มรูปในโฟลเดอร์ Drive จนกว่าจะย้ายรูปเข้า Supabase Storage
รันซ้ำได้ไม่เกิดข้อมูลซ้ำ เพราะมี unique index (album_id, file_id)

ใช้:  python3 scripts/make-album-photos-sql.py > supabase/seed/album_photos.sql
"""
import json, re, subprocess, sys, uuid, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NS = uuid.UUID('6f9619ff-8b86-d011-b42d-00c04fc964ff')

api = re.search(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec',
                (ROOT / 'assets' / 'api.js').read_text(encoding='utf-8')).group(0)
raw = subprocess.run(['curl', '-sSLf', '-m', '120', f'{api}?sheet=albums'],
                     capture_output=True, text=True, check=True).stdout
albums = json.loads(raw)['data']

def did(s):
    m = re.search(r'[-\w]{25,}', str(s or '').strip())
    return m.group(0) if m else None

rows = []
for a in albums:
    # id ของอัลบั้มต้องตรงกับที่ make-import-sql.py สร้างไว้ (ชื่อ + วันที่)
    album_id = str(uuid.uuid5(NS, 'albums|' + str(a.get('title') or '') + '|' + str(a.get('date') or '')))
    for i, p in enumerate(a.get('photos') or []):
        fid = did(json.dumps(p, ensure_ascii=False))
        if fid:
            rows.append({'album_id': album_id, 'file_id': fid, 'sort_order': i})

payload = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
print('-- สร้างอัตโนมัติจาก scripts/make-album-photos-sql.py — อย่าแก้ด้วยมือ')
print(f'-- {len(rows)} รูป จาก {len(albums)} อัลบั้ม')
print('insert into album_photos (album_id, file_id, sort_order)')
print("select (r->>'album_id')::uuid, r->>'file_id', (r->>'sort_order')::int")
print(f"from jsonb_array_elements($j${payload}$j$::jsonb) as r")
print('on conflict (album_id, file_id) do update set sort_order = excluded.sort_order;')
print(f'-- rows={len(rows)}', file=sys.stderr)
