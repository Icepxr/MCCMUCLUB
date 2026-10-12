# ผลตรวจเว็บก่อน deploy — 13 ตุลาคม 2026

**ผล: ยังไม่ผ่านสำหรับ deploy โค้ดชุดปัจจุบัน** มีข้อผิดพลาดที่ยืนยันได้ในการอัปเกรดอัลบั้มและการบันทึกหลังบ้าน ควรแก้แล้วตรวจซ้ำก่อนเผยแพร่

ทีมตรวจ 3 agents: frontend, security/admin, data/release รวมรายงานเฉพาะด้าน 4 ฉบับ ผู้ประสานงานตรวจ syntax JavaScript และเส้นทางหน้า/API เพิ่มเติม การตรวจนี้ไม่มีการแก้โค้ดแอป เขียนฐานข้อมูล ลงชื่อเข้าใช้จริง push หรือ deploy

## จุดที่ควรแก้ก่อน deploy

| ลำดับ | ระดับ | ปัญหาและผลกระทบ | หลักฐาน | แนวทางแก้ |
| --- | --- | --- | --- | --- |
| 1 | P1 | HTML อัลบั้มใหม่ใช้ URL JavaScript เดิม ผู้ใช้ที่ cache API เก่ากดอัลบั้มแล้วเกิด TypeError | activities.html:19; vercel.json:18; ทดสอบฟังก์ชันที่ production ใช้กับ DOM ใหม่ | เปลี่ยนเวอร์ชัน URL ของ assets ที่เปลี่ยนให้สอดคล้องทุกหน้า แล้วทดสอบ cold/warm cache |
| 2 | P2 | กดบันทึกและดูตัวอย่างระหว่างคำขอแรกค้าง สร้างรายการใหม่ซ้ำสองครั้งได้; Ctrl/Cmd+S ก็ข้ามการปิดปุ่มได้ | assets/admin.js:1459,1481; ทดสอบโค้ดจริงกับ DB จำลองที่หน่วง response | ใช้ submitting guard ร่วมและปิดทั้งสองปุ่ม/shortcut ระหว่างบันทึก |
| 3 | P2 | พิมพ์เพิ่มระหว่างบันทึก แล้ว response ล้าง dirty state ทำให้ปิดฟอร์มแล้วทิ้งการแก้ไขใหม่โดยไม่เตือน | assets/admin.js:1439,1497; actual-source deferred-save fixture | ปิดการแก้ input ระหว่างบันทึก หรือเทียบ edit revision ก่อนล้าง dirty |
| 4 | P2 | เวลาละหมาดไม่เปลี่ยนวันเมื่อเปิดหน้าค้างข้ามเที่ยงคืน และใช้ตารางวันเก่าเมื่อ refresh ล้มเหลว | assets/api.js:994,1026,1034; fixed-clock Node VM | โหลดวันใหม่เมื่อวันในเชียงใหม่เปลี่ยน และไม่แสดงวันเก่าเป็นข้อมูลวันนี้ |

## ปัญหาที่มีอยู่เดิมและการเตรียม release

- API สาธารณะใช้ `select=*` จึงคืน `updated_by` ซึ่ง trigger ใส่อีเมลผู้แก้ไข ตรวจ flow ได้ด้วย fixture; ไม่ได้อ้างว่าพบอีเมลส่วนตัวใน production การแก้ต้องครอบคลุม direct Supabase REST ด้วย ดู api/data.js:175 และ migration 0003:79
- Backend Sheets รับ status draft/archived จาก request โดยไม่ตรวจสิทธิ์ และ proxy เปิด `src=sheets` พร้อม public cache ทดสอบ logic ได้ในเครื่อง; ไม่ได้ทดลองอ่านร่างจริง และไม่ใช่หลักฐานว่าร่าง Supabase รั่ว
- เว็บจริงเสิร์ฟไฟล์สำรอง SQL และเอกสารพัฒนาได้ ตัวอย่าง `/data/backup/places.json` และ `/supabase/seed/parts/places.sql` ตอบ 200 ตัวอย่าง backup ที่ตรวจมีเฉพาะข้อมูล published ไม่พบข้อมูลลับ ควรแยก public deployment output จาก backup/review/import/scripts/dev fixtures ก่อน deploy; ไฟล์ใหม่บางชุดยังตอบ 404 ใน production ปัจจุบัน
- Workflow สำรองข้อมูลยังอ่าน Google Sheets จึงไม่ครอบคลุมข้อมูลเฉพาะ Supabase ควรตรวจวิธีกู้คืนจากแหล่งข้อมูลที่เว็บใช้จริง
- หมุดฝัง 10 ร้านที่ไม่มี coords ค้นจากชื่อร้านและเชียงใหม่ ไม่ใช้ที่อยู่ในลิงก์ที่เตรียมไว้ เป็นข้อจำกัดเรื่องตำแหน่งที่ยังไม่ยืนยัน แผนที่รวม Google My Maps เป็นข้อมูลอีกชุดหนึ่ง ไม่เพิ่ม pin อัตโนมัติเมื่อเพิ่มแถว places
- จุดรอง: เปิดคลิปด้วยคีย์บอร์ดแล้ว focus หลุดไป BODY; หน้ากิจกรรมเรียกกิจกรรมที่ผ่านมาแล้วว่า upcoming

## สิ่งที่ตรวจผ่านและสถานะข้อมูลจริง

- JavaScript 8 ไฟล์ผ่าน syntax check; `git diff --check` ไม่พบปัญหา whitespace
- หน้า /, /activities, /gallery, /knowledge, /halal-map, /about, /admin และ JS อัลบั้ม/วิดีโอตอบ 200 บน Vercel-like server ในเครื่อง
- API all/places ตอบ 200; preview ที่ไม่มี Authorization ตอบ 401 พร้อม no-store
- ตัวอย่าง gallery ผ่าน desktop/มือถือ 1280,375,320px; เปิด/เปลี่ยนรูป/ปิดและคืน focus ได้; ไม่พบ target ไฟล์ภายในหายในการตรวจที่ระบุ
- YouTube player โหลดและเล่นได้หลังผู้ใช้กดเปิด; preview JWT/cache ตรวจผ่านใน controlled handler fixtures
- production ใช้ Supabase มี **29 สถานที่ / ร้านอาหาร 23 ร้าน** ทั้ง **11 ร้านที่อนุมัติ** อยู่ครบครั้งเดียวและทุกฟิลด์ตรงกับชุดนำเข้า ไม่ต้องนำเข้าซ้ำ
- SQL/JSON/CSV สำหรับร้านทั้ง 11 ตรงกัน โครงสร้างและการรันซ้ำตรวจด้วย inspection; ไม่ได้ execute SQL ในการตรวจนี้

## ขอบเขตและข้อจำกัด

รอบนี้เป็นการตรวจ working tree กับ Git HEAD พร้อมอ่าน production เพื่อเทียบ ไม่ใช่ Vercel Preview deployment ของโค้ดใหม่ ทุกผล browser เป็นตัวอย่าง viewport ไม่ใช่การทดสอบอุปกรณ์ทุกชนิด ไม่ได้ตรวจ Google OAuth, การเขียนฐานข้อมูลจริง, policy/grants ที่ติดตั้งจริง, WCAG หรือ screen reader แบบครบชุด ผลหลังบ้านเป็น actual-source logic fixtures เพราะเครื่องมือ browser ของ reviewer คนนั้นใช้งานไม่ได้

ชุดหลักฐานและ SHA-256 ของโค้ดที่ตรวจเก็บไว้ใน snapshot เพื่อใช้เทียบหลังแก้ไข เอกสารวิจัยร้านบางช่องยังระบุสถานะเก่า ควรแยกการขึ้นข้อมูลจริงออกจากการ deploy โค้ดใหม่

## รายงานเฉพาะด้าน

- [Frontend / responsive / keyboard](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-frontend.md)
- [Security](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-security.md)
- [Admin functionality](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-admin.md)
- [Data / release](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-data-release.md)
- [Route smoke checks](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-route-checks.json)
- [Code snapshot](/Users/daiyazwaehama/Documents/mccmu-website/data/review/predeploy-2026-10-13-snapshot.json)
