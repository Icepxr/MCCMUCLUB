#!/usr/bin/env bash
# เทียบข้อมูลใน Supabase กับไฟล์สำรองจาก Google Sheets ทีละฟิลด์
# ต้องต่างกัน 0 รายการก่อนจะสลับให้เว็บใช้ Supabase
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_URL:?ต้องตั้ง SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?ต้องตั้ง SUPABASE_ANON_KEY}"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
for t in activities docs albums places members settings; do
  curl -sSLf "$SUPABASE_URL/rest/v1/$t?select=*" \
       -H "apikey: $SUPABASE_ANON_KEY" -o "$TMP/$t.json"
done

python3 - "$TMP" <<'PY'
import json, re, sys, pathlib
tmp = pathlib.Path(sys.argv[1]); bk = pathlib.Path('data/backup')

def did(v):
    s = str(v or '').strip()
    m = re.search(r'[-\w]{25,}', s)
    return m.group(0) if m else (s or None)
def norm(v):
    s = str(v).strip() if v is not None else ''
    return s or None

# ฟิลด์ที่ต้องตรงกัน: ชื่อในชีต -> ชื่อใน Supabase + วิธีแปลง
# คีย์ผสมต้องตรงกับที่ make-import-sql.py ใช้สร้าง id
# activities มีชื่อซ้ำกัน 2 คู่ (คนละวัน) ใช้ชื่ออย่างเดียวจับคู่ผิดแน่นอน
SPEC = {
 'activities': (('title_th','date'), {'title_th':('title_th',norm),'date':('date',norm),
    'location':('location',norm),'description':('description',norm),
    'cover_id':('cover_id',did),'status':('status',norm),
    'featured':('featured', lambda v: str(v).strip().lower() in ('yes','true','1'))}),
 'docs': (('title','file_id'), {'title':('title',norm),'description':('description',norm),
    'date':('date',norm),'file_id':('file_id',did),'status':('status',norm)}),
 'albums': (('title','date'), {'title':('title',norm),'date':('date',norm),
    'description':('description',norm),'folder_id':('folder_id',did),
    'cover_id':('cover_id',did),'status':('status',norm)}),
 'places': (('name',), {'name':('name',norm),'type':('type',norm),
    'description':('description',norm),'map_url':('map_url',norm),
    'coords':('coords',norm),'status':('status',norm)}),
 'members': (('name',), {'name':('name',norm),'title':('title',norm),
    'description':('description',norm),'cover_id':('cover_id',did),
    'status':('status',norm),'order':('sort_order', lambda v: norm(v) and str(int(v)))}),
}

def conv_key(table, f, v):
    return did(v) if f.endswith('_id') else v

def conv_key(table, f, v):
    return did(v) if f.endswith('_id') else v

bad = 0
for table, (key, fields) in SPEC.items():
    src = json.loads((bk/f'{table}.json').read_text(encoding='utf-8'))
    def kof_src(r): return tuple(norm(conv_key(table, f, r.get(f))) for f in key)
    def kof_dst(r): return tuple(norm(r.get(fields[f][0])) for f in key)
    dst = {kof_dst(r): r for r in json.loads((tmp/f'{table}.json').read_text(encoding='utf-8'))}
    miss = 0; diff = 0
    for row in src:
        k = kof_src(row)
        if k not in dst:
            print(f'  ✗ {table}: ไม่พบใน Supabase — {' / '.join(str(x) for x in k)}'); miss += 1; bad += 1; continue
        got = dst[k]
        for sheet_f, (db_f, conv) in fields.items():
            a = conv(row.get(sheet_f))
            b = got.get(db_f)
            if isinstance(a, bool): b = bool(b)
            else: b = norm(b)
            if a != b:
                print(f'  ✗ {table}[{k[0]}].{sheet_f}: ชีต={a!r} ≠ ฐานข้อมูล={b!r}'); diff += 1; bad += 1
    mark = '✓' if not (miss or diff) else '✗'
    print(f'{mark} {table:11} {len(src):2} รายการ · ขาด {miss} · ต่าง {diff}')

s_src = json.loads((bk/'settings.json').read_text(encoding='utf-8'))
s_dst = {r['key']: r['value'] for r in json.loads((tmp/'settings.json').read_text(encoding='utf-8'))}
sbad = 0
for k, v in s_src.items():
    exp = did(v) if k.endswith('_id') and v else norm(v)
    if norm(s_dst.get(k)) != exp:
        print(f'  ✗ settings[{k}]: ชีต={exp!r} ≠ ฐานข้อมูล={norm(s_dst.get(k))!r}'); sbad += 1; bad += 1
print(f"{'✓' if not sbad else '✗'} settings    {len(s_src):2} คีย์ · ต่าง {sbad}")

print()
print('ผลรวม: ตรงกันทั้งหมด ✓' if bad == 0 else f'ผลรวม: ไม่ตรงกัน {bad} จุด ✗')
sys.exit(1 if bad else 0)
PY
