# ย้าย MCCMU Website จาก Cloudflare Pages → Vercel

เอกสารนี้สรุปสิ่งที่เปลี่ยน + ขั้นตอน deploy ขึ้น Vercel

---

## สรุปสิ่งที่เปลี่ยน (เตรียมไว้ให้แล้ว)

| เดิม (Cloudflare) | ใหม่ (Vercel) | หน้าที่ |
|---|---|---|
| `functions/data.js` | `api/data.js` | proxy edge-cache ไป Apps Script |
| `_headers` | `vercel.json` (ส่วน `headers`) | ตั้งค่า cache ของไฟล์ static |
| route `/data` (อัตโนมัติ) | `vercel.json` (ส่วน `rewrites`) map `/data` → `/api/data` | ฝั่งหน้าเว็บยังเรียก `/data` เหมือนเดิม ไม่ต้องแก้โค้ด |

**หน้าเว็บ (`assets/api.js`) ไม่ต้องแก้อะไรเลย** — ยังเรียก `/data?sheet=...` เหมือนเดิม เพราะ `vercel.json` ทำ rewrite ให้ และถ้า proxy ล่มก็ยัง fallback ไปยิง Apps Script ตรงเหมือนเดิม

ไฟล์เดิม `functions/data.js` และ `_headers` **Vercel จะไม่สนใจ** (ปล่อยไว้ได้ ไม่กระทบ) — จะลบทิ้งภายหลังก็ได้เพื่อความสะอาด

---

## ขั้นตอน Deploy (Vercel Dashboard — แนะนำ)

1. **push โค้ดขึ้น GitHub ก่อน**
   ```bash
   git add api/data.js vercel.json .gitignore MIGRATION-VERCEL.md
   git commit -m "chore: migrate hosting from Cloudflare Pages to Vercel"
   git push origin main
   ```

2. เข้า <https://vercel.com> → **Sign up / Log in ด้วย GitHub**

3. กด **Add New… → Project** → เลือก repo `Icepxr/MCCMUCLUB` → **Import**

4. หน้า Configure Project ตั้งค่าดังนี้:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (ค่าเริ่มต้น)
   - **Build Command:** เว้นว่าง (ไม่มี build step — เป็น static)
   - **Output Directory:** เว้นว่าง
   - Environment Variables: ไม่ต้องใส่

5. กด **Deploy** → รอสักครู่ จะได้ URL เช่น `https://mccmuclub.vercel.app`

6. **ทดสอบ** (ดูหัวข้อ "ตรวจหลัง deploy" ด้านล่าง)

---

## เรื่อง URL / โดเมน

- เดิมใช้ `https://club.mccmu.workers.dev` (subdomain ฟรีของ Cloudflare — ย้ายตามมาไม่ได้)
- หลังย้าย URL จะกลายเป็น `https://<ชื่อโปรเจกต์>.vercel.app`
- อยากได้ชื่อสวย ๆ: ไปที่ **Project → Settings → Domains** ตั้งชื่อ subdomain `.vercel.app` ใหม่ได้ฟรี
- ถ้ามีโดเมนของตัวเองในอนาคต (เช่น `mccmu.com`) ก็เพิ่มที่หน้า Domains เดียวกันนี้แล้วชี้ DNS มาที่ Vercel

> ⚠️ ที่ไหนที่เคยแชร์ลิงก์ `club.mccmu.workers.dev` (LINE, โปสเตอร์, QR) ต้องอัปเดตเป็น URL ใหม่

---

## ตรวจหลัง deploy (Verify)

เปิด URL ใหม่แล้วเช็ก:

1. **หน้าเว็บโหลดครบ** ทุกหน้า (index, about, activities, knowledge, halal-map) รูป/สไตล์มาครบ
2. **ข้อมูลจาก Sheet โหลดได้** — เปิด DevTools (F12) → แท็บ Network → รีเฟรช → ดูว่ามี request ไป `/data?sheet=...` แล้วได้ status `200` และเป็น JSON `{"ok":true,...}`
3. **Edge cache ทำงาน** — ยิง `/data?sheet=all` สองครั้ง ครั้งที่สองควรเร็วขึ้น และ response header มี `cache-control: ...s-maxage=600...`
   ```bash
   curl -I "https://<โปรเจกต์>.vercel.app/data?sheet=all"
   ```
4. **cache header ของ static** — `curl -I https://<โปรเจกต์>.vercel.app/index.html` ควรเห็น `cache-control: public, max-age=0, must-revalidate`

ถ้าทั้ง 4 ข้อผ่าน = migration สำเร็จ ✅

---

## Auto-deploy

หลัง import แล้ว ทุกครั้งที่ `git push origin main` Vercel จะ build + deploy ให้อัตโนมัติ (เหมือน Cloudflare Pages) — push branch อื่นจะได้ Preview URL แยกให้ทดสอบก่อน merge
