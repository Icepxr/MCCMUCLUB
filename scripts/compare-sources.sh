#!/usr/bin/env bash
# เทียบว่า JSON ที่ได้จาก Supabase มีรูปร่างเหมือนของ Apps Script มั้ย
# ถ้าไม่เหมือน หน้าเว็บจะพังตอนสลับ DATA_SOURCE — ต้องผ่านสคริปต์นี้ก่อนสลับ
#
# หมายเหตุ: เทียบแบบตัดช่องว่างหน้า/หลัง เพราะตอนนำเข้าเราตั้งใจตัดออก
# (ชีตมีข้อมูลที่ติดช่องว่างเกินมาอยู่หลายที่ เช่น 'ร้านรอฟีอีย์ ')
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_URL:?ต้องตั้ง SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?ต้องตั้ง SUPABASE_ANON_KEY}"

API=$(grep -o "https://script.google.com/macros/s/[A-Za-z0-9_-]*/exec" assets/api.js | head -1)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
curl -sSLf "$API?sheet=all" -o "$T/sheets.json"
for t in activities docs places members settings; do
  curl -sSLf "$SUPABASE_URL/rest/v1/$t?select=*" -H "apikey: $SUPABASE_ANON_KEY" -o "$T/$t.json"
done

python3 - "$T" <<'PY'
import json, re, sys, pathlib
T = pathlib.Path(sys.argv[1])
sheets = json.load(open(T/'sheets.json', encoding='utf-8'))['data']
load = lambda t: json.load(open(T/f'{t}.json', encoding='utf-8'))
pub  = lambda rows: [r for r in rows if r.get('status') == 'published']
n    = lambda v: str(v if v is not None else '').strip()

def did(s):
    m = re.search(r'[-\w]{25,}', str(s or '').strip())
    return m.group(0) if m else str(s or '').strip()
img = lambda i, w: f'https://drive.google.com/thumbnail?id={did(i)}&sz=w{w}' if i else ''

# จำลองสิ่งที่ api/data.js สร้างจาก Supabase — ต้องตรงกับโค้ดในไฟล์นั้น
sb = {
 'activities': [{**d, 'image_url': img(d.get('cover_id'), 1200)} for d in pub(load('activities'))],
 'docs': [{**d,
    'view_url': f"https://drive.google.com/file/d/{did(d['file_id'])}/preview" if d.get('file_id') else '',
    'download_url': f"https://drive.google.com/uc?export=download&id={did(d['file_id'])}" if d.get('file_id') else '',
    'thumb_url': img(d.get('file_id'), 800)} for d in pub(load('docs'))],
 'members': [{**d, 'order': d.get('sort_order'), 'image_url': img(d.get('cover_id'), 800)}
             for d in pub(load('members'))],
 'places': pub(load('places')),
}
st = {r['key']: r['value'] or '' for r in load('settings')}
for k in list(st):
    if k.endswith('_id') and st[k]: st[k[:-3]+'_url'] = img(st[k], 800)

NEED = {
 'activities': ('title_th', ['title_th','date','location','description','image_url','status']),
 'docs':       ('title',    ['title','description','date','view_url','download_url','thumb_url','status']),
 'members':    ('name',     ['name','title','description','order','image_url','status']),
 'places':     ('name',     ['name','type','description','map_url','coords','status']),
}
ok = True
for t, (kf, fields) in NEED.items():
    a, b = sheets[t], sb[t]
    line = f'{t:11} apps-script={len(a):2}  supabase={len(b):2}  '
    if len(a) != len(b):
        print(line + '✗ จำนวนไม่ตรง'); ok = False; continue
    missing = [f for f in fields if b and f not in b[0]]
    if missing:
        print(line + f'✗ ขาดฟิลด์ {missing}'); ok = False; continue
    idx = {}
    for r in a: idx.setdefault(n(r.get(kf)), []).append(r)
    bad = [r.get(kf) for r in b
           if not any(all(n(c.get(f)) == n(r.get(f)) for f in fields)
                      for c in idx.get(n(r.get(kf)), []))]
    print(line + ('✓ ตรงกัน' if not bad else f'✗ ไม่ตรง {bad[:3]}'))
    if bad: ok = False

keys = ['club_email','club_facebook','club_instagram','club_line','club_youtube',
        'halal_map_url','map_embed_url','logo_url']
diff = [k for k in keys if n(sheets['settings'].get(k)) != n(st.get(k))]
print(f"settings    คีย์ที่หน้าเว็บใช้ {len(keys)}   ต่าง {diff or 0}   " + ('✓' if not diff else '✗'))
if diff: ok = False

print()
print('รูปร่างเหมือนกัน สลับ DATA_SOURCE ได้ปลอดภัย ✓' if ok else 'ยังไม่ตรง ห้ามสลับ ✗')
sys.exit(0 if ok else 1)
PY
