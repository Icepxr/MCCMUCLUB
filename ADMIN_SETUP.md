# ระบบหลังบ้าน MCCMU — คู่มือติดตั้งและส่งต่อ

ระบบนี้ให้ฝ่ายไอทีแก้ไขข้อมูลบนเว็บได้จากหน้า dashboard โดยไม่ต้องแตะฐานข้อมูลตรง ๆ

| ส่วนประกอบ | ใช้อะไร |
|---|---|
| หน้าเว็บ | HTML/CSS/JS ธรรมดา deploy บน Vercel |
| ฐานข้อมูล | Supabase (Postgres) |
| ล็อกอิน | Supabase Auth ผ่านบัญชี Google |
| ไฟล์/รูป | Google Drive (จะย้ายมา Supabase Storage ในเฟสถัดไป) |

---

## ตั้งค่าครั้งแรก

### 1. โปรเจกต์ Supabase

โปรเจกต์ปัจจุบัน: **MCCMU's Project** · region `ap-southeast-1` (สิงคโปร์)

โครงสร้างฐานข้อมูลอยู่ในโฟลเดอร์ `supabase/migrations/` รันตามลำดับเลข
ถ้าต้องสร้างโปรเจกต์ใหม่ก็รันสองไฟล์นี้ซ้ำได้เลย

> **แผนฟรีให้ 2 โปรเจกต์เท่านั้น** ถ้ามีโปรเจกต์เก่าที่เลิกใช้แล้วให้ลบทิ้ง
> ไม่งั้นจะสร้างโปรเจกต์ใหม่ไม่ได้เมื่อต้องการ

### 2. เปิดล็อกอินด้วย Google

ต้องตั้งค่า 2 ฝั่ง — ฝั่ง Google ก่อน แล้วเอาค่ามาใส่ฝั่ง Supabase

**ฝั่ง Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com))

1. สร้างโปรเจกต์ใหม่ (หรือใช้ของเดิม) — ใช้บัญชีกลางของชมรม ไม่ใช่บัญชีส่วนตัว
2. **APIs & Services → OAuth consent screen**
   - เลือก **External**
   - App name: `MCCMU Admin`
   - User support email + Developer contact: อีเมลชมรม
   - บันทึก (ไม่ต้องส่ง verification เพราะใช้กันในกลุ่มเล็ก)
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs** ใส่:
     ```
     https://bzbqzohygnraqquabffg.supabase.co/auth/v1/callback
     ```
   - กด Create แล้ว **คัดลอก Client ID กับ Client Secret เก็บไว้**

**ฝั่ง Supabase**

4. Dashboard → **Authentication → Sign In / Providers → Google**
5. เปิด **Enable Sign in with Google**
6. วาง **Client ID** และ **Client Secret** จากขั้นที่ 3
7. กด Save

**ตั้ง URL ปลายทางหลังล็อกอิน**

8. **Authentication → URL Configuration**
   - Site URL: `https://<โดเมนเว็บของชมรม>`
   - Additional Redirect URLs: ใส่ `http://localhost:8899/admin` ด้วย ถ้าจะทดสอบในเครื่อง

> **Client Secret เป็นความลับ** อย่าใส่ในโค้ดหรือ commit ขึ้น GitHub
> ใส่ในหน้า Supabase เท่านั้น

### 3. เพิ่มคนที่เข้าหลังบ้านได้

สิทธิ์ดูจากตาราง `admins` ในฐานข้อมูล — **ไม่ได้อยู่ในโค้ด**
เปลี่ยนรุ่นแค่เพิ่ม/ลบแถวในตารางนี้ ไม่ต้องแก้โค้ดหรือ deploy ใหม่

คนแรกต้องใส่ผ่าน SQL Editor ใน Supabase (เพราะยังไม่มีใครมีสิทธิ์เข้าหน้า admin):

```sql
insert into admins (email, name, note)
values ('อีเมล@gmail.com', 'ชื่อ นามสกุล', 'หัวหน้าฝ่ายไอที 2569');
```

หลังจากนั้นคนที่อยู่ในตารางแล้วเพิ่มคนอื่นผ่านหน้า dashboard ได้เลย

**อีเมลต้องตรงกับบัญชี Google ที่ใช้ล็อกอิน** และระบบเทียบแบบตัวพิมพ์เล็กทั้งหมด

---

## เรื่องที่ยังค้างอยู่ (สำคัญ)

### รูปและไฟล์ยังอยู่บน Google Drive

ตอนนี้คอลัมน์ `cover_id` / `file_id` / `folder_id` ยังเก็บค่าที่ชี้ไป Google Drive
และไฟล์เหล่านั้น **เป็นของบัญชี Google ส่วนตัวของนักศึกษา**

แปลว่าถ้าบัญชีนั้นถูกปิด (เช่นเจ้าของเรียนจบ) **รูปทั้งหมดบนเว็บจะหายทันที**

จะแก้จบเมื่อย้ายไฟล์มา Supabase Storage ในเฟสถัดไป ระหว่างนี้อย่าเพิ่งปิดบัญชีนั้น

### ยังไม่ได้ใส่คนอื่นใน Supabase organization

ตอนนี้ organization มีคนเดียว ถ้าคนนั้นเข้าบัญชีไม่ได้ ก็ไม่มีใครจัดการฐานข้อมูลได้

**Organization Settings → Team → Invite** ใส่หัวหน้าฝ่ายไอทีหรือประธานชมรมไว้ด้วย

---

## เช็กลิสต์ตอนส่งต่อรุ่น

- [ ] เพิ่มอีเมลรุ่นใหม่ในตาราง `admins`
- [ ] ลบอีเมลรุ่นเก่าที่ไม่ได้ดูแลแล้วออก
- [ ] เชิญรุ่นใหม่เข้า Supabase organization
- [ ] เชิญรุ่นใหม่เข้า GitHub repo
- [ ] ส่งต่อรหัสบัญชีกลางของชมรม (Google) ให้ถูกคน
- [ ] เล่าให้ฟังว่า GitHub Action `backup-data` ทำอะไร — **ห้ามลบ** เพราะเป็นตัวสำรองข้อมูล

---

## ข้อมูลสำรอง

`data/backup/` เก็บสำเนาข้อมูลทั้งหมด อัปเดตอัตโนมัติทุกคืนตี 2
ดูรายละเอียดใน [data/backup/README.md](data/backup/README.md)
