# MCCMU — แผนงาน Backend ให้ครบทั้งระบบ

> เป้าหมาย: ทำให้ backend (Google Sheets + Apps Script) ทำงานได้จริงทุกหน้า และ **รูปภาพ/ไฟล์ทุกอย่างดึงมาจาก backend** (Google Drive ผ่านลิงก์ thumbnail)
> สถานะปัจจุบัน: backend เขียนโครงไว้แล้ว (`Code.gs`, `api.js`) แต่ **ยังไม่มีหน้าไหนเสียบ `api.js` เลย** — ทุกหน้ายังเป็น static + รูป placeholder ทั้งหมด

---

## 1. สรุปสถานะปัจจุบัน (ช่องว่างที่ต้องปิด)

| ส่วน | มีแล้ว | ยังขาด |
|------|--------|--------|
| Apps Script | router GET: `activities`, `docs`, `settings`, `prayer` | endpoint `media`, `places`; ตัวแปลง file_id → URL |
| Setup.gs | สร้าง sheet `activities`, `docs`, `settings` | sheet `media`, `places`; ฟิลด์รูป/โลโก้เพิ่มเติม |
| api.js | client + render activities/prayer | render docs, gallery, board, places, settings (โลโก้/ลิงก์โซเชียล), hero |
| หน้าเว็บ (9 หน้า) | ดีไซน์ครบ | **ไม่มีหน้าไหนเรียก API** — ทุกรูปเป็น `.ph` placeholder |
| รูปภาพ | โลโก้ใน repo | gallery, โปสเตอร์, กรรมการ, ร้านฮาลาล, รูปหมุนหน้าแรก ยัง hardcode/ว่าง |

---

## 2. สถาปัตยกรรมรวม

```
Google Drive (รูป/ไฟล์)  ─┐
                          │  file_id
Google Sheets (CMS) ──────┤  ← แอดมินกรอกข้อมูล + วาง file_id
   activities / docs /    │
   settings / media /     │
   places                 │
        │ doGet(?sheet=)   ▼
Apps Script Web App  ── แปลง file_id → thumbnail URL แล้วส่ง JSON
        │ HTTPS GET (อ่านอย่างเดียว)
assets/api.js  ── fetch + render เข้า DOM
        │
หน้าเว็บ (.html)  ── เรียก MCCMU.* ตอนโหลด
```

หลักการ: **แอดมินทำงานแค่ใน Google Sheets + Drive** ไม่ต้องแตะโค้ดอีกเลย เพิ่มรูป = อัปขึ้น Drive → วาง file_id ใน sheet → เว็บอัปเดตเอง

---

## 3. กลยุทธ์รูปภาพ (Drive + thumbnail)

ทุกรูปเก็บใน Google Drive โฟลเดอร์เดียว แชร์ "Anyone with the link" แล้วอ้างอิงด้วย **file_id** ใน Sheet เท่านั้น (ไม่วาง URL ยาว)

backend จะแปลง file_id เป็น URL อัตโนมัติก่อนส่งให้ frontend:

```
รูป   →  https://drive.google.com/thumbnail?id={FILE_ID}&sz=w1600
PDF   →  https://drive.google.com/file/d/{FILE_ID}/preview   (ฝัง/เปิดดู)
ดาวน์โหลด → https://drive.google.com/uc?export=download&id={FILE_ID}
```

ข้อดี: แอดมินกรอกแค่ id สั้น ๆ, เปลี่ยนขนาดภาพได้ที่ `sz=` , ไม่เปลือง quota Apps Script
ข้อควรระวัง: ไฟล์ต้องตั้งแชร์ "ทุกคนที่มีลิงก์" ไม่งั้นรูปไม่ขึ้น — จะใส่หมายเหตุเตือนใน Sheet

---

## 4. โครงสร้าง Google Sheets (หลัง update)

### 4.1 `media` — คลังรูปรวมศูนย์ (sheet ใหม่)
ใช้กับ gallery, รูปหมุนหน้าแรก, รูป about, กรรมการ, โปสเตอร์ — แยกด้วยคอลัมน์ `section`

| คอลัมน์ | ตัวอย่าง | หมายเหตุ |
|---------|---------|---------|
| `id` | MED001 | รหัสไม่ซ้ำ |
| `section` | gallery | `gallery` / `hero` / `about` / `board` / `activity` |
| `file_id` | 1BxiMVs0... | Drive file ID ของรูป |
| `title` | ค่ายอาสา 2569 | คำบรรยายภาพ / ชื่อ (กรณี board = ชื่อคน) |
| `subtitle` | ประธานชมรม | บรรทัดรอง (กรณี board = ตำแหน่ง) |
| `order` | 1 | ลำดับการแสดง (น้อย→มาก) |
| `status` | published | published / draft / archived |

### 4.2 `places` — ร้านฮาลาล / มัสยิด (sheet ใหม่)
หน้า halal-map ต้องมีข้อมูลมีโครงสร้าง จึงแยก sheet (แต่ยังใช้ file_id แบบเดียวกัน)

| คอลัมน์ | ตัวอย่าง | หมายเหตุ |
|---------|---------|---------|
| `id` | PLC001 | |
| `name` | ครัวฮาลาลหน้า มช. | ชื่อร้าน/สถานที่ |
| `type` | ร้านอาหาร | `ร้านอาหาร` / `มัสยิด` / `ห้องละหมาด` |
| `area` | สวนดอก | โซน/ย่าน |
| `distance` | 350 ม. | ระยะจากมหาวิทยาลัย |
| `hours` | 10:00–20:00 | เวลาเปิด |
| `map_url` | https://maps.app.goo.gl/... | ลิงก์ Google Maps |
| `file_id` | 1Bxi... | รูปร้าน |
| `status` | published | |

### 4.3 `activities` (ปรับ)
- เปลี่ยน `image_url` → `image_id` (ใช้ file_id เหมือนกันทั้งระบบ)

### 4.4 `docs` (คงเดิม)
- ใช้ `file_id` อยู่แล้ว — backend เพิ่มฟิลด์ `view_url` / `download_url` ให้พร้อมใช้

### 4.5 `settings` (เพิ่ม key รูป/แบรนด์)
เพิ่ม: `logo_id` (โลโก้หลัก), `hero_about_id` (รูปบล็อก About หน้าแรก), `club_instagram`, `club_tiktok` ฯลฯ — เพื่อให้โลโก้/รูปแบรนด์มาจาก backend ด้วย

---

## 5. Endpoint ที่ backend ต้องมี (หลัง update)

| Endpoint | คืนค่า |
|----------|--------|
| `?sheet=activities` | + แปลง `image_id` → `image_url` |
| `?sheet=docs` | + `view_url`, `download_url`, `thumb_url` |
| `?sheet=settings` | + แปลง `logo_id`/`hero_about_id` → URL |
| `?sheet=media&section=gallery` | รายการรูปตาม section เรียงตาม `order` |
| `?sheet=places&type=ร้านอาหาร` | รายการสถานที่ + `image_url` |
| `?sheet=prayer` | (คงเดิม) |

เพิ่ม helper กลางใน `Code.gs`: `driveImg(id, size)`, `drivePreview(id)`, `driveDownload(id)`

---

## 6. การเสียบ frontend ทีละหน้า

| หน้า | โหลดอะไรจาก backend | แทนที่ placeholder ตัวไหน |
|------|---------------------|--------------------------|
| `index.html` | กิจกรรมล่าสุด 3, เวลาละหมาด, รูปหมุน (media `hero`), รูป About (settings), โลโก้ | orbit photos, `.ph arch`, โปสเตอร์ 3 ใบ |
| `activities.html` | กิจกรรมทั้งหมด + filter หมวด | โปสเตอร์/ภาพข่าวทุกใบ |
| `knowledge.html` | docs ทั้งหมด + filter + เปิด/ดาวน์โหลด PDF | ภาพประกอบ/การ์ดความรู้ |
| `gallery.html` | media `section=gallery` | กริดรูปทั้งหมด |
| `about.html` | media `section=board` (กรรมการ), รูปหมู่ (media `about`) | 4 การ์ดกรรมการ + รูปหมู่ |
| `halal-map.html` | places (filter ตาม type) | การ์ดร้าน/มัสยิดทุกใบ |
| `prayer.html` | เวลาละหมาดเต็มเดือน | ตาราง |
| `contact.html` | settings (อีเมล/LINE/โซเชียล/แผนที่) | ข้อมูลติดต่อ |
| `join.html` | settings (ลิงก์ฟอร์มสมัคร) | ปุ่ม/ลิงก์ |

ทุกหน้าใส่ `<script src="assets/api.js"></script>` ก่อน `</body>` + เรียก render ใน `DOMContentLoaded`
ทุกการ์ดมี **skeleton loading** + **fallback** เมื่อโหลดไม่ได้ (กันจอว่าง)

---

## 7. ความปลอดภัย/ความเสถียร (ตาม CLAUDE.md)

- อ่านอย่างเดียว (GET) — ไม่มี endpoint เขียนข้อมูล ลดความเสี่ยง
- ไม่มี key/secret ใน frontend — Web App URL เป็น public read เท่านั้น
- ใช้ `textContent` ไม่ใช่ `innerHTML` ตอน render ข้อมูลจาก sheet (กัน XSS)
- รูปทุกใบ `loading="lazy"` + ขนาดผ่าน `sz=` (performance)
- cache ฝั่ง Apps Script (settings/media) ลดการอ่าน sheet ซ้ำ
- ทุก URL เป็น HTTPS

---

## 8. ลิสงานทั้งหมด (เรียงตามลำดับทำ)

**Phase A — Backend (Apps Script + Sheets)**
1. เพิ่ม helper `driveImg/drivePreview/driveDownload` ใน `Code.gs`
2. เพิ่ม endpoint `getMedia` (filter ตาม section, เรียง order)
3. เพิ่ม endpoint `getPlaces` (filter ตาม type)
4. ปรับ `getActivities` (image_id→url), `getDocs` (+view/download/thumb), `getSettings` (+โลโก้/รูป)
5. อัปเดต `Setup.gs` สร้าง sheet `media`, `places` + ฟิลด์ใหม่ + dropdown + ตัวอย่างข้อมูล
6. อัปเดต `SHEETS_SETUP.md` (วิธีกรอก file_id + ตั้งแชร์ Drive)

**Phase B — API client (`api.js`)**
7. เพิ่ม `getMedia`, `getPlaces`, `getDocs` render, `getSettings` apply (โลโก้/โซเชียล)
8. เพิ่ม helper: skeleton loader, image fallback, แปลง type→ไอคอน

**Phase C — เสียบหน้าเว็บ**
9. `index.html` — กิจกรรม/ละหมาด/รูปหมุน/about/โลโก้
10. `activities.html` — กิจกรรม + filter
11. `knowledge.html` — docs + filter + เปิด PDF
12. `gallery.html` — media gallery
13. `about.html` — กรรมการ + รูปหมู่
14. `halal-map.html` — places
15. `prayer.html` — ตารางเต็มเดือน
16. `contact.html` + `join.html` — settings/ลิงก์

**Phase D — ทดสอบ & เก็บงาน**
17. ทดสอบทุก endpoint คืน JSON ถูกต้อง
18. ทดสอบรูปขึ้นจริงทุกหน้า + กรณี API ล่ม (fallback)
19. เช็ค responsive + performance (lazy load) + ผ่านเช็ก XSS

---

## 9. สิ่งที่ต้องขอจากทีมชมรม (เพื่อให้รันได้จริง)
- โฟลเดอร์ Google Drive สำหรับรูป (ตั้งแชร์ "Anyone with the link")
- รูปจริง: gallery, โปสเตอร์กิจกรรม, รูปกรรมการ, รูปร้านฮาลาล/มัสยิด, โลโก้
- ข้อมูลร้านฮาลาล/มัสยิด (ชื่อ, พิกัด Maps, เวลาเปิด)
- ลิงก์ฟอร์มสมัครสมาชิก + ช่องทางโซเชียลล่าสุด
