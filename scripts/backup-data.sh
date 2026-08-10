#!/usr/bin/env bash
# ============================================================
#  สำรองข้อมูลทั้งหมดจาก Google Sheets ออกมาเป็น JSON
#
#  ทำไมต้องมี: ตอนนี้ข้อมูลทั้งเว็บอยู่ในบัญชี Google บัญชีเดียว
#  ถ้าบัญชีนั้นหาย ข้อมูลหายตามทันทีโดยไม่มีสำเนา
#  สคริปต์นี้ทำให้ทุกคนที่ clone repo มีข้อมูลครบชุดติดเครื่องไว้
#
#  ใช้: ./scripts/backup-data.sh    แล้ว commit ไฟล์ใน data/backup/
#
#  หมายเหตุ: ดึงทั้ง published และ archived เพราะ endpoint ปกติ
#  ของหน้าเว็บกรองเฉพาะ published — ถ้าดึงแค่นั้นของที่เก็บเข้ากรุจะหาย
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=data/backup

API=$(grep -o "https://script.google.com/macros/s/[A-Za-z0-9_-]*/exec" assets/api.js | head -1)
if [ -z "$API" ]; then echo "หา API URL ใน assets/api.js ไม่เจอ" >&2; exit 1; fi

SHEETS="activities docs places members albums"
mkdir -p "$OUT"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

fetch() {  # fetch <sheet> <status> <outfile>
  curl -sSLf --max-time 90 "$API?sheet=$1&status=$2" -o "$3" \
    || { echo "ดึง $1 ($2) ไม่สำเร็จ" >&2; return 1; }
}

echo "ต้นทาง: $API"
for s in $SHEETS; do
  echo -n "  $s ... "
  fetch "$s" published "$TMP/$s.pub.json"
  fetch "$s" archived  "$TMP/$s.arc.json"
  python3 - "$TMP/$s.pub.json" "$TMP/$s.arc.json" "$OUT/$s.json" <<'PY'
import json, sys
pub, arc, out = sys.argv[1], sys.argv[2], sys.argv[3]

def rows(p):
    d = json.load(open(p, encoding='utf-8'))
    if not d.get('ok'): raise SystemExit('API ตอบ ok:false — ' + str(d.get('error')))
    return d.get('data') or []

items = rows(pub) + rows(arc)

# ตัดฟิลด์ที่ backend คำนวณขึ้นมาเอง — ไม่ใช่ข้อมูลต้นฉบับ และทำให้ diff รก
# (photos อ่านสดจากโฟลเดอร์ Drive ทุกครั้ง, *_url สร้างจาก *_id อยู่แล้ว)
DERIVED = ('photos', 'count')
def clean(r):
    return {k: v for k, v in r.items()
            if k not in DERIVED and not k.endswith('_url')}

items = [clean(r) for r in items]
# เรียงคงที่เพื่อให้ git diff อ่านรู้เรื่อง ไม่สลับที่ไปมาทุกครั้งที่รัน
items.sort(key=lambda r: json.dumps(r, sort_keys=True, ensure_ascii=False))

json.dump(items, open(out, 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2, sort_keys=True)
print(f'{len(items)} รายการ')
PY
done

echo -n "  settings ... "
curl -sSLf --max-time 60 "$API?sheet=settings" -o "$TMP/settings.json"
python3 - "$TMP/settings.json" "$OUT/settings.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
if not d.get('ok'): raise SystemExit('API ตอบ ok:false')
data = {k: v for k, v in (d.get('data') or {}).items() if not k.endswith('_url')}
json.dump(data, open(sys.argv[2], 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2, sort_keys=True)
print(f'{len(data)} ค่า')
PY

python3 - "$OUT" <<'PY'
import json, sys, os, datetime, glob
out = sys.argv[1]
counts = {}
for f in sorted(glob.glob(os.path.join(out, '*.json'))):
    name = os.path.basename(f)[:-5]
    if name == '_meta': continue
    d = json.load(open(f, encoding='utf-8'))
    counts[name] = len(d)
meta = {'generated_at_utc': datetime.datetime.now(datetime.timezone.utc)
                                    .strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': 'google-sheets-via-apps-script',
        'counts': counts}
json.dump(meta, open(os.path.join(out, '_meta.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2, sort_keys=True)
print('\nสรุป:', json.dumps(counts, ensure_ascii=False))
PY
echo "เสร็จ — ไฟล์อยู่ใน $OUT/"
