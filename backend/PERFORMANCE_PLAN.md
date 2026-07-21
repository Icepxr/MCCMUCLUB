# MCCMU — แผนปรับสถาปัตยกรรมการดึงข้อมูล (Performance Plan)

> สถานะ: **เอกสารออกแบบ — ยังไม่แก้โค้ด** · จัดทำ 2026-06-20
> เป้าหมาย: โหลดข้อมูลจาก Google Sheet → หน้าเว็บให้ **เร็วขึ้นมาก** โดย **ยังฟรี 100%**

---

## 1. วิเคราะห์ต้นตอความช้า (ของจริงในโค้ดตอนนี้)

ปัจจุบัน flow คือ `Browser → fetch สด → Apps Script /exec → เปิด Google Sheet อ่านใหม่ → JSON`
คอขวดเรียงตามความรุนแรง:

1. **ยิงสดหลายครั้งต่อ 1 หน้า ไม่มี cache เลย**
   หน้าแรก (`data-page="home"`) เรียก Apps Script **5 ครั้ง** ตอนโหลด:
   `applySettings`(settings) · `renderFeatured`(activities) · `renderPosters`(activities) · `renderPrayerStrip`(prayer) · `renderHeroSlideshow`(media)

2. **บั๊ก: ดึงข้อมูลชุดเดียวซ้ำ 2 รอบ**
   `renderFeatured` กับ `renderPosters` ต่างก็เรียก `MCCMU.getActivities({})` แยกกัน = โหลด activities ทั้งก้อน 2 ครั้งโดยไม่จำเป็น

3. **Apps Script ช้าโดยธรรมชาติ**
   แต่ละ request มี cold start + `SpreadsheetApp.getDataRange().getValues()` อ่านทั้งชีตใหม่ทุกครั้ง ไม่มีการ cache ผลลัพธ์ที่ serialize แล้ว

4. **Redirect 302 = 2 round trip ต่อ 1 fetch**
   `script.google.com/.../exec` ตอบ 302 เด้งไป `*.googleusercontent.com` `fetch()` ตามให้อัตโนมัติ แต่นับเป็น 2 ครั้งเสมอ

5. **รูปภาพเป็นคอขวดแยกอีกชั้น**
   ทุกรูปมาจาก `lh3.googleusercontent.com/d/<id>` หรือ Drive ซึ่งช้า/บางใบโหลดไม่ติด (โค้ดมี fallback ไป `drive.google.com/thumbnail` อยู่แล้ว = ยิ่งเพิ่ม request)

6. **`albums` หนักเป็นพิเศษ**
   `getAlbums` วนอ่านไฟล์ทุกใบในโฟลเดอร์ Drive ด้วย `DriveApp` (มี cache 6 ชม. แล้ว แต่ครั้งแรกหลัง cache หมดอายุจะช้ามาก)

**สรุป:** ความช้าหลักไม่ได้มาจากปริมาณข้อมูล แต่มาจาก *จำนวนครั้งที่ยิงสด × ความช้าต่อครั้งของ Apps Script × ไม่มี cache ทุกชั้น*

---

## 2. เป้าหมายที่วัดได้

| ตัวชี้วัด | ตอนนี้ (ประมาณ) | เป้าหมาย |
|---|---|---|
| จำนวน Apps Script call / โหลดหน้าแรก | 5 | 1 (หรือ 0 ในระดับ ②) |
| เวลาเห็นข้อมูลครั้งแรก | ~3–8 วิ | < 1 วิ |
| เปิดหน้าถัดไป (navigate ในเว็บ) | ยิงใหม่หมด | เกือบทันที (จาก cache) |
| ค่าใช้จ่าย | ฟรี | ฟรี |

---

## 3. หลักการออกแบบใหม่

แยก **"เขียน/อ่านชีต" (ช้า, ทำไม่บ่อย)** ออกจาก **"คนเข้าเว็บ" (ต้องเร็ว, เกิดบ่อย)**
ใส่ cache ให้ครบ 3 ชั้น: **Apps Script (server) → CDN (edge) → Browser (localStorage)**

---

## 4. ระดับ ① — Quick Win (ไม่ย้ายโฮสต์ ไม่ตั้ง token อะไรเพิ่ม)

ปรับ 2 ไฟล์เดิม: `backend/Code.gs` และ `assets/api.js`

### 4.1 Backend — `Code.gs`
- เพิ่ม endpoint รวม **`?sheet=all`** คืนทุก dataset ในก้อนเดียว:
  ```
  { ok:true, data:{ activities:[...], docs:[...], settings:{...},
                    media:[...], places:[...], prayer:{...} } }
  ```
  (ยกเว้น `albums` ที่หนัก — แยกไว้เรียกเฉพาะหน้าที่ใช้)
- ห่อผลลัพธ์ด้วย **`CacheService.getScriptCache()`** key เช่น `payload_all`
  อ่านจาก cache ก่อน ถ้าไม่มีค่อยเปิดชีต แล้ว `cache.put(..., 21600)` (6 ชม. = สูงสุดที่ Apps Script ให้)
  → ส่วนใหญ่ request จะ **ไม่แตะ SpreadsheetApp เลย**
- เพิ่มฟังก์ชัน `invalidateCache()` ไว้กดล้าง cache เองหลังแอดมินแก้ข้อมูล (หรือผูกกับ `onEdit` trigger ก็ได้)
- คง endpoint เดิมทั้งหมดไว้ (ไม่ทำ breaking change)

### 4.2 Frontend — `api.js`
- เพิ่ม **`MCCMU.bootstrap()`**: fetch `?sheet=all` **ครั้งเดียว** แล้วเก็บไว้ใน `MCCMU._cache`
- ทุก renderer เปลี่ยนไปอ่านจาก `MCCMU._cache` แทนการ `fetch` เอง (ผ่าน helper เช่น `MCCMU.getActivities()` ที่คืน Promise จาก cache)
- ใส่ **`localStorage` + TTL** (เช่น 10 นาที): โหลดหน้าถัดไปอ่านจาก localStorage ทันที แล้วค่อย refresh เบื้องหลัง (pattern: *stale-while-revalidate*)
- **ลบบั๊ก call ซ้ำ:** `renderPosters` + `renderFeatured` ใช้ activities ชุดเดียวกันจาก cache

### 4.3 ผลที่คาดและความเสี่ยง
- 5 calls → 1 call, หน้าถัดไปแทบ 0 call → เร็วขึ้นหลายเท่าทันที
- ความเสี่ยงต่ำมาก: ไม่เปลี่ยนที่โฮสต์ ไม่ใช้ token ใหม่ rollback ง่าย
- ข้อควรรู้: ข้อมูลอาจ "ช้า" สุด 6 ชม.ตาม cache (ปรับ TTL ได้ หรือกด `invalidateCache` หลังแก้)

---

## 5. ระดับ ② — อัปเกรดบน Netlify (เร็วขึ้นด้วย CDN, ยังฟรี)

> บริบท: เว็บกำลังย้ายจาก GitHub Pages → **Netlify**

### 5.0 ⚠️ Netlify free tier เป็นระบบ credits แล้ว (ไม่ใช่ 100GB/300 build-min แบบเดิม)
ตามหน้าราคาทางการ (ตรวจ 2026-06-20):
- **300 credits / เดือน** ใช้รวมกันทุกอย่าง · หมดแล้วเว็บหยุด (ไม่ auto-charge)
- **deploy = 15 credits/ครั้ง** → ถ้าใช้เครดิตกับ deploy ล้วน ๆ ได้แค่ ~20 ครั้ง/เดือน
- **bandwidth = 20 credits/GB** (≈ 15GB) · **functions = 10 credits/GB-hour**

**ข้อสรุปออกแบบที่สำคัญ:** **อย่าผูกความสดของข้อมูลไว้กับการ rebuild**
แผน "แอดมินแก้ชีต → trigger rebuild → bake data.json" ที่เคยฟรีไม่จำกัดบน GitHub Pages
จะกิน deploy credit จนทะลุง่าย ๆ (rebuild วันละครั้งก็เกินแล้ว) → **build-time bake ตกไปสำหรับ Netlify**

### 5.1 Flow ที่แนะนำบน Netlify
```
Deploy ไซต์เฉพาะตอนแก้โค้ด (นาน ๆ ที — กัน credit รั่ว)

ข้อมูล runtime:
Browser ──▶ Netlify Function (proxy)  ──▶ Apps Script ?sheet=all
                │  ใส่ Cache-Control
                ▼
         Netlify CDN cache (edge)  ──▶ ส่วนใหญ่เสิร์ฟจากตรงนี้ ไม่เด้งเข้า function
                │
                ▼
            Browser → localStorage
```
ได้ของแถม: **ตัด redirect 302 ของ Apps Script ทิ้ง** + คุม cache header ได้ (GitHub Pages ทำไม่ได้)

### 5.2 ขั้นตอน
1. ทำระดับ ① ให้เสร็จก่อน (เป็นทั้งฐานและ fallback)
2. เพิ่ม Netlify Function สั้น ๆ เช่น `netlify/functions/data.js`:
   - `fetch` Apps Script `?sheet=all` ฝั่ง server (ตาม redirect ให้เรียบร้อย)
   - ตอบกลับพร้อม header: `Cache-Control: public, s-maxage=600, stale-while-revalidate=86400`
   - (เก็บ `API_URL` เป็น Netlify env var ได้ ไม่ต้องโผล่ในโค้ด frontend)
3. `api.js` ชี้ `API_URL` → `/.netlify/functions/data` (โดเมนเดียวกัน ไม่มี CORS/redirect)
4. **ไม่ต้องใช้ GitHub token / sha / trigger publish** เหมือนแผน GitHub เดิม — ง่ายลงมาก
5. ความสดข้อมูลคุมที่ `s-maxage` (เช่น 10 นาที) ไม่ผูกกับ deploy

### 5.3 ผลที่คาดและความเสี่ยง
- first load ของคนเข้าใหม่เร็วขึ้น (เสิร์ฟจาก CDN cache, ไม่เจอ cold start/redirect ของ Apps Script ในกรณีที่ cache ยังสด)
- อยู่ใน free tier สบาย เพราะ CDN cache ทำให้ function ถูกเรียกจริงน้อยมาก
- ความเสี่ยง/งานเพิ่ม: มี function ให้ดูแล 1 ตัว + ต้องเข้าใจพฤติกรรม cache (`s-maxage` = อายุที่ CDN, `stale-while-revalidate` = ยอมเสิร์ฟของเก่าระหว่างรีเฟรชเบื้องหลัง)
- `albums` (อ่าน Drive ช้า) แยก endpoint ไว้เหมือนเดิม เรียกเฉพาะหน้าที่ใช้ + cache ยาวขึ้น

---

## 6. ระดับ ③ — รูปภาพ (คอขวดแยก ทำเมื่อไหร่ก็ได้)

- รูปที่อยู่ถาวรและสำคัญ (logo, hero, ปกอัลบั้ม) → ย้ายเข้าโฟลเดอร์เว็บ/CDN แทน `lh3`/Drive
- คงรูปที่แอดมินอัปบ่อยไว้บน Drive ได้ แต่ใส่ `width`/`height` กัน layout shift และคุม `loading="lazy"` (โค้ดมี lazy แล้ว)
- พิจารณาบีบขนาด/ใช้ `=w800` แทน `=w1600` ในจุดที่เป็น thumbnail

---

## 7. ลำดับการลงมือที่แนะนำ (ฉบับย้ายไป Netlify)

1. **ทำระดับ ① ก่อน** — ผลตอบแทนต่อแรงสูงสุด ความเสี่ยงต่ำสุด **ไม่กิน Netlify credit เลย** (browser คุย Apps Script ตรง)
2. วัดผล (DevTools → Network: นับจำนวน request + เวลา) เทียบก่อน/หลัง
3. **เฉพาะถ้า first load ยังช้ากวนใจ** → เติม Netlify Function caching proxy (ระดับ ②) โดยใช้ ① เป็น fallback
4. **บีบรูป/ทำหลายขนาด** (ระดับ ③) ควรทำไม่ว่าเลือกทางไหน — เป็นความเสี่ยง bandwidth credit ที่จับต้องได้สุด
5. ตั้ง deploy ให้เกิด **เฉพาะตอนแก้โค้ด** อย่าผูกกับการแก้ข้อมูล

---

## 8. สรุปข้อแลกเปลี่ยน

| | ① Quick Win | ② Netlify Function proxy | ✗ Build-time bake |
|---|---|---|---|
| ความเร็ว | เร็วขึ้นมาก | + first load เร็วขึ้น (CDN) | เร็วสุด *แต่* |
| งานที่ต้องทำ | แก้ 2 ไฟล์ | + 1 function | + build script + build hook |
| ความสด | ทันที–คุม TTL ได้ | คุมที่ `s-maxage` | ตามรอบ rebuild |
| Netlify credit | 0 | น้อยมาก (CDN cache) | **เปลือง deploy credit** |
| ความเสี่ยง | ต่ำ | ต่ำ–ปานกลาง | สูง (อาจทะลุ free tier) |
| ค่าใช้จ่าย | ฟรี | ฟรี | เสี่ยงเกินฟรี |

**คำแนะนำสุดท้าย:** เริ่ม ① ก่อนเสมอ แล้วเติม ② (Netlify Function proxy) เท่าที่จำเป็นหลังเห็นตัวเลขจริง
**หลีกเลี่ยง** build-time bake บน Netlify เพราะผูกความสดข้อมูลกับ deploy = กิน credit

---

## 9. แหล่งอ้างอิง (Netlify free tier)
- หน้าราคาทางการ Netlify — https://www.netlify.com/pricing/ (ตรวจ 2026-06-20: โมเดล 300 credits/เดือน)
- บทความสรุปลิมิต 2026 — https://temps.sh/compare/vs-netlify
