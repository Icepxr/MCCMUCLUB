# MCCMU — โครงสร้าง Google Sheets (ฉบับลีน)

> อัปเดต 2026-06-20 · ใช้คู่กับ `backend/Code.gs`
> 1 Spreadsheet มีหลายชีต ชื่อชีตต้องตรงตามนี้ (ตัวพิมพ์เล็ก)
> หัวคอลัมน์ (แถวแรก) ต้องสะกดตรงตามนี้ · `status` ใช้ได้ 2 ค่า: `published` / `archived` (เว็บแสดงเฉพาะ published)
> รูป/ไฟล์เก็บใน Google Drive แล้วใส่ **id หรือ ลิงก์** ของไฟล์ — backend แปลงเป็น URL ให้ (ต้องตั้งแชร์ "Anyone with the link")

---

## 1) ชีต `activities` — กิจกรรม

| คอลัมน์ | คำอธิบาย |
|---|---|
| `title_th` | ชื่อกิจกรรม |
| `date` | วันที่จัด (YYYY-MM-DD) — ใช้แยกกิจกรรมที่ผ่านมา/กำลังจะมาถึง |
| `location` | สถานที่ |
| `description` | รายละเอียด (โชว์ในกิจกรรมเด่น) |
| `featured` | `yes` = ขึ้นเป็น "กิจกรรมเด่น" บนหน้าแรก/หน้ากิจกรรม |
| `cover_id` | Drive id ของโปสเตอร์ (อัตราส่วน 4:5 สวยสุด) |
| `status` | published / archived |

## 2) ชีต `docs` — คลังความรู้

| คอลัมน์ | คำอธิบาย |
|---|---|
| `title` | ชื่อไฟล์/หัวข้อ |
| `description` | คำอธิบายสั้น |
| `date` | วันที่ (YYYY-MM-DD) — เรียงใหม่สุดก่อน |
| `file_id` | Drive id ของไฟล์ (PDF หรือรูป ใช้ได้ทั้งคู่) |
| `status` | published / archived |

## 3) ชีต `albums` — อัลบัมภาพ

| คอลัมน์ | คำอธิบาย |
|---|---|
| `title` | ชื่ออัลบัม |
| `date` | วันที่ |
| `description` | คำอธิบาย |
| `folder_id` | Drive id ของ**โฟลเดอร์** — backend อ่านรูปทุกใบในโฟลเดอร์ให้เอง |
| `cover_id` | Drive id ภาพปก (ถ้าเว้นว่าง ใช้รูปแรกในโฟลเดอร์) |
| `status` | published / archived |

## 4) ชีต `places` — ฮาลาล / มัสยิด

| คอลัมน์ | คำอธิบาย |
|---|---|
| `name` | ชื่อสถานที่ |
| `type` | `ร้านอาหาร` / `มัสยิด` / `ห้องละหมาด` (ใช้จัดกลุ่มแท็บ) |
| `description` | รายละเอียด (เมนู/บริการ ฯลฯ) |
| `map_url` | ลิงก์ Google Maps เต็ม (ปุ่ม "เปิดแผนที่") — เว้นว่างได้ถ้ามี coords |
| `coords` | พิกัด `lat,lng` เช่น `18.7883,98.9853` (ใช้ฝังแผนที่เล็กในการ์ด) |
| `status` | published / archived |

## 5) ชีต `members` — คณะกรรมการ/บอร์ด

| คอลัมน์ | คำอธิบาย |
|---|---|
| `name` | ชื่อสมาชิก |
| `title` | ตำแหน่ง (เช่น ประธาน, เลขานุการ) |
| `description` | คำอธิบายสั้น (ถ้ามี) |
| `order` | ลำดับการแสดง (เลขน้อยขึ้นก่อน) |
| `cover_id` | Drive id รูปสมาชิก |
| `status` | published / archived |

## 6) ชีต `settings` — ตั้งค่าเว็บ (2 คอลัมน์: `key` | `value`)

| key | ใส่อะไร |
|---|---|
| `logo_id` | Drive id โลโก้แบรนด์ (nav/footer) |
| `club_email` | อีเมลติดต่อ |
| `club_facebook` | ลิงก์เพจ Facebook |
| `club_instagram` | ลิงก์ Instagram |
| `club_youtube` | ลิงก์ YouTube |
| `club_line` | LINE id/ลิงก์ (เว้นว่างได้) |
| `about_hero_id` | Drive id/ลิงก์ ภาพหมู่ในส่วน "จุดเริ่มต้น" หน้า About |
| `map_embed_url` | iframe src แผนที่ที่ตั้งชมรม (หน้า About) |
| `halal_map_url` | iframe src แผนที่รวมฮาลาล/มัสยิด (ด้านบนหน้า halal · ทำจาก Google My Maps → Embed) |
| `prayer_method` | เลขวิธีคำนวณเวลาละหมาด (Aladhan · default 2 = ISNA) |

> หมายเหตุ: ลิงก์โซเชียลฝัง default ไว้ในโค้ดแล้ว ถ้าใส่ใน settings ค่าจากชีตจะ override (เป็นตัวหลัก)

---

## Endpoints (อ่านอย่างเดียว · GET)

```
?sheet=all          รวมทุกชีต (ยกเว้น albums) — frontend ใช้อันนี้เป็นหลัก (cache 10 นาที)
?sheet=activities   ?sheet=docs     ?sheet=albums   ?sheet=places
?sheet=members      ?sheet=settings ?sheet=prayer
```

แก้ข้อมูลในชีตแล้วอยากให้ขึ้นทันที (ไม่รอ cache 10 นาที): เปิด Apps Script editor → รัน `invalidateCache()`
หลังแก้ `Code.gs` ต้อง **Deploy เวอร์ชันใหม่** ทุกครั้ง (Deploy → Manage deployments → Edit → New version)
