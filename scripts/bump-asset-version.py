#!/usr/bin/env python3
"""ตั้งเลขเวอร์ชัน ?v= ของไฟล์ CSS/JS ในทุกหน้า HTML ให้เป็นค่าใหม่ค่าเดียวกัน

ทำไมต้องมี: Vercel เก็บ cache /assets/*.css|js ไว้ 10 นาที + stale-while-revalidate 7 วัน
ถ้าแก้ CSS/JS แล้วไม่เปลี่ยน ?v= คนที่เคยเข้าเว็บจะได้ HTML ใหม่คู่กับ JS เก่า → หน้าพัง

ใช้: python3 scripts/bump-asset-version.py            (ใช้วันนี้ + ตัวอักษรถัดไป เช่น 20261013c)
     python3 scripts/bump-asset-version.py 20261020a  (กำหนดเอง)
รันทุกครั้งก่อน deploy ที่มีการแก้ไฟล์ใน assets/
"""
import datetime
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = sorted(ROOT.glob('*.html')) + [ROOT / 'admin' / 'index.html']
REF = re.compile(r'((?:href|src)="/?assets/[\w./-]+\.(?:css|js))(?:\?v=[\w-]+)?"')


def current_versions():
    found = set()
    for p in PAGES:
        found |= set(re.findall(r'assets/[\w./-]+\.(?:css|js)\?v=([\w-]+)"', p.read_text(encoding='utf-8')))
    return found


def next_version():
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).strftime('%Y%m%d')
    used = sorted(v for v in current_versions() if v.startswith(today))
    letter = chr(ord(used[-1][-1]) + 1) if used else 'a'
    return today + letter


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else next_version()
    if not re.fullmatch(r'[\w-]+', version):
        sys.exit('เวอร์ชันใช้ได้แค่ตัวอักษร ตัวเลข _ และ -')
    for p in PAGES:
        text = p.read_text(encoding='utf-8')
        new, n = REF.subn(lambda m: f'{m.group(1)}?v={version}"', text)
        if n:
            p.write_text(new, encoding='utf-8')
            print(f'{p.relative_to(ROOT)}: {n} ไฟล์ → ?v={version}')


if __name__ == '__main__':
    main()
