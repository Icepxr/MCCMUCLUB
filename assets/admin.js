/* ============================================================
   MCCMU — ระบบหลังบ้าน

   เบราว์เซอร์คุยกับ Supabase โดยตรง ไม่มี API ตรงกลาง
   ความปลอดภัยอยู่ที่ Row Level Security ในฐานข้อมูล:
     • คนทั่วไปอ่านได้เฉพาะแถวที่ status = 'published'
     • คนที่อีเมลอยู่ในตาราง admins เท่านั้นที่แก้ไขได้
     • เฉพาะ role = 'owner' เท่านั้นที่เพิ่ม/ถอด/เปลี่ยนระดับผู้ดูแลได้
   ต่อให้มีคนเปิดหน้านี้ได้ ก็ทำอะไรไม่ได้ถ้าไม่อยู่ในตาราง admins
   และปุ่มที่ซ่อนไว้ในหน้านี้ ต่อให้เรียกเองก็ไม่ผ่าน policy ฝั่งฐานข้อมูล

   ส่งต่อรุ่น: เพิ่ม/ลบอีเมลในหน้า "ผู้ดูแลระบบ" ไม่ต้องแก้โค้ด
   ============================================================ */
/* ล็อกเวอร์ชันตายตัว — @2 เฉย ๆ จะดึงเวอร์ชันใหม่สุดทุกครั้งที่ CDN ออกตัวใหม่ ซึ่งอาจเปลี่ยนพฤติกรรมโดยไม่มีใครรู้
   อัปเกรดเมื่อพร้อมทดสอบ: เปลี่ยนเลขตรงนี้ (และใน .claude/audit/admin-mock.html) */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/admin/config.js';

/* ต้องดูก่อนสร้าง client เพราะ supabase จะลบ token ออกจาก URL ทันที
   ใช้แยก "เพิ่งกลับมาจาก Google" (เล่นจังหวะต้อนรับเต็ม) กับ "เปิดหน้าใหม่ตอนล็อกอินค้างอยู่" (เข้าเร็ว) */
const fromOAuth = /[#&?](access_token|code)=/.test(location.href);

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ══════════════════════════════════════════════════════════════
   นิยามข้อมูลแต่ละชนิด — เพิ่มชนิดใหม่ = เพิ่มก้อนเดียวตรงนี้
   หน้ารายการและฟอร์มสร้างจากนิยามนี้ทั้งหมด ไม่ต้องเขียน UI ซ้ำ
   ══════════════════════════════════════════════════════════════ */
const STATUS = [
  { v: 'published', label: 'เผยแพร่' },
  { v: 'draft',     label: 'ร่าง' },
  { v: 'archived',  label: 'เก็บเข้ากรุ' },
];

/* ระดับสิทธิ์ — บังคับจริงที่ Row Level Security (migration 0006)
   หน้าเว็บแค่ซ่อนปุ่มที่กดไปก็ไม่ผ่าน ให้ใช้งานไม่สับสน */
const ROLES = [
  { v: 'owner',  label: 'เจ้าของระบบ' },
  { v: 'editor', label: 'ผู้แก้ไข' },
];
const ROLE_TH = { owner: 'เจ้าของระบบ', editor: 'ผู้แก้ไข' };
const isOwner = () => me && me.role === 'owner';

const SCHEMA = {
  activities: {
    label: 'กิจกรรม', title: 'title_th', order: 'date.desc',
    cols: [['cover_id', 'รูป', 'img'], ['title_th', 'ชื่อกิจกรรม', 'title+featured'],
         ['date', 'วันที่'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'title_th', label: 'ชื่อกิจกรรม', type: 'text', required: true },
      { k: 'date', label: 'วันที่จัด', type: 'date' },
      { k: 'location', label: 'สถานที่', type: 'text' },
      { k: 'description', label: 'รายละเอียด', type: 'textarea' },
      { k: 'featured', label: 'ปักหมุดเป็นกิจกรรมเด่น', type: 'bool' },
      { k: 'cover_id', label: 'รูปปก', type: 'drive' },
      { k: 'status', label: 'สถานะ', type: 'status' },
    ],
  },
  docs: {
    label: 'คลังความรู้', title: 'title', order: 'date.desc',
    cols: [['file_id', 'ไฟล์', 'img'], ['title', 'ชื่อเอกสาร'], ['date', 'วันที่'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'title', label: 'ชื่อเอกสาร', type: 'text', required: true },
      { k: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { k: 'date', label: 'วันที่', type: 'date' },
      { k: 'file_id', label: 'ไฟล์ PDF', type: 'drive' },
      { k: 'status', label: 'สถานะ', type: 'status' },
    ],
  },
  albums: {
    label: 'อัลบั้มภาพ', title: 'title', order: 'date.desc', photos: true,
    cols: [['cover_id', 'ปก', 'img'], ['title', 'ชื่ออัลบั้ม'], ['date', 'วันที่'],
           ['id', 'รูปข้างใน', 'photocount'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'title', label: 'ชื่ออัลบั้ม', type: 'text', required: true },
      { k: 'date', label: 'วันที่', type: 'date' },
      { k: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { k: 'folder_id', label: 'โฟลเดอร์รูป', type: 'drive',
        hint: 'วางลิงก์โฟลเดอร์ Drive ที่ตั้งแชร์ "ทุกคนที่มีลิงก์" แล้ว · '
            + 'ใส่ตรงนี้อย่างเดียวรูปยังไม่ขึ้นเว็บ ต้องกด "จัดการรูป" ในหน้ารายการเพื่อดึงรูปเข้าระบบ' },
      { k: 'cover_id', label: 'รูปปก', type: 'drive' },
      { k: 'status', label: 'สถานะ', type: 'status' },
    ],
  },
  places: {
    label: 'สถานที่ฮาลาล', title: 'name', order: 'name.asc',
    cols: [['name', 'ชื่อ'], ['type', 'ประเภท'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'name', label: 'ชื่อสถานที่', type: 'text', required: true },
      { k: 'type', label: 'ประเภท', type: 'select',
        options: ['ร้านอาหาร', 'มัสยิด', 'ห้องละหมาด'], required: true },
      { k: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { k: 'map_url', label: 'ลิงก์ Google Maps', type: 'text', hint: 'กดแชร์ใน Google Maps แล้ววางลิงก์ที่ได้' },
      { k: 'coords', label: 'พิกัด', type: 'text', hint: 'เช่น 18.8009,98.9525 (ไม่ใส่ก็ได้ ระบบใช้ลิงก์แผนที่แทน)' },
      { k: 'status', label: 'สถานะ', type: 'status' },
    ],
  },
  members: {
    label: 'กรรมการ', title: 'name', order: 'sort_order.asc',
    cols: [['cover_id', 'รูป', 'img'], ['name', 'ชื่อ'], ['title', 'ตำแหน่ง'], ['sort_order', 'ลำดับ'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'name', label: 'ชื่อ-นามสกุล', type: 'text', required: true },
      { k: 'title', label: 'ตำแหน่ง', type: 'text' },
      { k: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { k: 'sort_order', label: 'ลำดับการแสดง', type: 'number', hint: 'เลขน้อยขึ้นก่อน' },
      { k: 'cover_id', label: 'รูป', type: 'drive' },
      { k: 'status', label: 'สถานะ', type: 'status' },
    ],
  },
};

/* ══════════════════════════════════════════════════════════════
   ตัวช่วยสร้าง DOM — ใช้ textContent เสมอ ไม่ใช้ innerHTML
   ══════════════════════════════════════════════════════════════ */
const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function clear(n) { if (n) n.replaceChildren(); }

function toast(msg, bad = false) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', 'toast' + (bad ? ' toast--bad' : ''), msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 2600);
}

/* แถบแจ้งเตือนที่มีลิงก์ให้กด — ค้างไว้นานกว่าปกติให้ทันกด */
function toastLink(msg, href, label) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el('div', 'toast toast--link');
  t.appendChild(el('span', null, msg));
  const a = el('a', null, label);
  a.href = href; a.target = '_blank'; a.rel = 'noopener';
  a.addEventListener('click', () => t.remove());
  t.appendChild(a);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 12000);
}

/* ดึง Drive id จากลิงก์เต็ม — ให้แอดมินวางลิงก์ได้เลย ไม่ต้องหา id เอง */
const driveId = (s) => {
  const m = String(s || '').trim().match(/[-\w]{25,}/);
  return m ? m[0] : String(s || '').trim();
};
const driveThumb = (id) => (id ? `https://drive.google.com/thumbnail?id=${driveId(id)}&sz=w200` : '');

function starSvg() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z');
  svg.appendChild(path);
  return svg;
}

const fmtDate = (d) => {
  if (!d) return '—';
  const t = new Date(d);
  if (isNaN(t)) return d;
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${t.getDate()} ${m[t.getMonth()]} ${t.getFullYear() + 543}`;
};

/* ══════════════════════════════════════════════════════════════
   สถานะของหน้า
   ══════════════════════════════════════════════════════════════ */
let me = null;           // { email, name, avatar }
let view = 'overview';
let counts = {};

/* ══════════════════════════════════════════════════════════════
   ล็อกอิน และจังหวะเข้า/ออกจากระบบ
   ══════════════════════════════════════════════════════════════ */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion() ? 0 : ms));

function setLoginState(state, status) {
  $('#loginView').dataset.state = state;
  if (status != null) $('#loginStatus').textContent = status;
}

$('#btnLogin').addEventListener('click', async () => {
  const btn = $('#btnLogin');
  btn.disabled = true;
  $('#btnLoginText').textContent = 'กำลังไปหน้า Google…';
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + '/admin' },
  });
  if (error) {
    btn.disabled = false;
    $('#btnLoginText').textContent = 'เข้าสู่ระบบด้วย Google';
    showLoginError(error.message);
  }
});

/* ── ฉากหน้าล็อกอิน: ฝุ่นลอยในลำแสง + ฉากขยับตามเมาส์เล็กน้อยให้มีมิติ ──
   วาดบน canvas เดียว ไม่กี่สิบจุด หยุดเองเมื่อออกจากหน้าล็อกอิน และไม่วาดตอนแท็บถูกซ่อน */
function startScene() {
  const cv = $('#dust');
  if (reduceMotion()) {
    document.querySelectorAll('animateTransform').forEach((n) => n.remove());   // หยุดแสงวิ่งบนดาวทอง
    return;
  }
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, dots = [];
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.min(90, Math.round((w * h) / 16000));
    dots = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: 0.4 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.12, vy: -0.05 - Math.random() * 0.22,
      ph: Math.random() * Math.PI * 2, tw: 0.008 + Math.random() * 0.02,
    }));
  }
  size();
  addEventListener('resize', size);

  /* ฝุ่นใกล้กลางลำแสงสว่างกว่าฝุ่นที่อยู่ในเงา */
  function frame() {
    if ($('#loginView').classList.contains('hidden')) return;
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const cx = w * 0.28, cy = h * 0.24, reach = Math.max(w, h) * 0.6;
      for (const d of dots) {
        d.ph += d.tw;
        d.x += d.vx + Math.sin(d.ph) * 0.08; d.y += d.vy;
        if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
        if (d.x < -4) d.x = w + 4; else if (d.x > w + 4) d.x = -4;
        const lit = Math.max(0, 1 - Math.hypot(d.x - cx, d.y - cy) / reach);
        const a = (0.15 + 0.85 * lit) * (0.55 + 0.45 * Math.sin(d.ph * 1.7));
        const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3);
        g.addColorStop(0, `rgba(255,240,205,${a.toFixed(3)})`);
        g.addColorStop(1, 'rgba(255,240,205,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
      document.documentElement.style.setProperty('--px', (dx * -18).toFixed(1) + 'px');
      document.documentElement.style.setProperty('--py', (dy * -12).toFixed(1) + 'px');
    });
  }
}
startScene();

/* เข้าระบบ: หน้าทำงานโผล่ข้างใต้ หน้าล็อกอินจางออก — สั้น ลื่น ไม่ขวางการใช้งาน */
async function enterApp(greet) {
  const login = $('#loginView'), app = $('#appView');
  if (reduceMotion()) {
    login.classList.add('hidden'); app.classList.remove('hidden');
    return;
  }
  if (greet) {
    setLoginState('checking', `ยินดีต้อนรับ ${me.name.split(' ')[0]}`);
    await wait(700);
  }
  app.classList.add('is-entering');
  app.classList.remove('hidden');
  setLoginState('entering');
  await wait(900);
  login.classList.add('hidden');
  app.classList.remove('is-entering');
}

/* ลิ้นชักเมนูสำหรับจอเล็ก */
const side = () => $('#sideNav');
function openMenu(on) {
  side().classList.toggle('open', on);
  $('#sideScrim').hidden = !on;
  $('#btnMenu').setAttribute('aria-expanded', on ? 'true' : 'false');
  document.body.style.overflow = on ? 'hidden' : '';
}
$('#btnMenu').addEventListener('click', () => openMenu(!side().classList.contains('open')));
$('#sideScrim').addEventListener('click', () => openMenu(false));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openMenu(false); });

/* ออกจากระบบ: จางเป็นสีพื้นหน้าล็อกอิน แล้วโหลดกลับมาที่หน้าล็อกอิน */
$('#btnLogout').addEventListener('click', async () => {
  const btn = $('#btnLogout');
  btn.disabled = true;
  if (!reduceMotion()) {
    openMenu(false);
    document.body.appendChild(el('div', 'veil'));
    await wait(450);
  }
  await db.auth.signOut();
  location.reload();
});

function showLoginError(msg) {
  const box = $('#loginMsg');
  clear(box);
  box.appendChild(el('div', 'alert', msg));
}

/* onAuthStateChange กับการเรียกตอนโหลดหน้าอาจยิงพร้อมกัน — กันไม่ให้เข้าระบบซ้อนสองรอบ */
let booting = null, entered = false;
function boot() {
  if (entered) return Promise.resolve();
  if (!booting) booting = runBoot().finally(() => { booting = null; });
  return booting;
}

async function runBoot() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { setLoginState('signin'); return; }   // ยังไม่ล็อกอิน → โชว์ปุ่มเข้าสู่ระบบ

  setLoginState('checking', 'กำลังตรวจสิทธิ์ผู้ดูแล…');

  /* เช็คสิทธิ์จากฐานข้อมูลจริง ไม่ใช่เชื่อ token ฝั่งเบราว์เซอร์
     RLS ทำให้คนที่ไม่ใช่ผู้ดูแลอ่านตาราง admins ได้ผลลัพธ์ว่าง */
  const email = (session.user.email || '').toLowerCase();
  /* select('*') ไม่ใช่ 'email,role' เพราะถ้าโค้ดนี้ขึ้นเว็บก่อนรัน migration 0006
     การขอคอลัมน์ที่ยังไม่มีจะได้ error 400 กลับมา = ไม่มีใครเข้าหลังบ้านได้เลย */
  const { data: rows, error } = await db.from('admins').select('*').eq('email', email);
  if (error) {
    showLoginError('ตรวจสอบสิทธิ์ไม่สำเร็จ: ' + error.message);
    setLoginState('signin');
    return;
  }
  if (!rows || !rows.length) {
    showLoginError(`บัญชี ${email} ยังไม่มีสิทธิ์เข้าระบบ — ให้ผู้ดูแลคนปัจจุบันเพิ่มอีเมลนี้ในหน้า "ผู้ดูแลระบบ"`);
    await db.auth.signOut();
    setLoginState('signin');
    return;
  }
  entered = true;

  /* ระดับสิทธิ์มาจากฐานข้อมูล ไม่ใช่จาก token — และไม่ได้ใช้แค่ซ่อนปุ่ม
     ต่อให้แก้ค่านี้ในเบราว์เซอร์ RLS ฝั่งฐานข้อมูลก็ยังปฏิเสธอยู่ดี

     ยังไม่ได้รัน migration 0006 (ไม่มีคอลัมน์ role) → ถือว่าทุกคนเป็น owner
     เท่ากับพฤติกรรมเดิมก่อนมีระดับสิทธิ์ ไม่ใช่การเปิดสิทธิ์เกิน
     ลบเงื่อนไขนี้ทิ้งได้เมื่อรัน migration บนฐานข้อมูลจริงแล้ว */
  const role = ('role' in rows[0]) ? (rows[0].role || 'editor') : 'owner';
  me = { email, role,
         name: session.user.user_metadata?.full_name || email,
         avatar: session.user.user_metadata?.avatar_url || '' };
  $('#meName').textContent = me.name;
  $('#meEmail').textContent = ROLE_TH[me.role] + ' · ' + me.email;
  if (me.avatar) $('#meAvatar').src = me.avatar;

  /* เตรียมหน้าภาพรวมให้เสร็จก่อนเปิดม่าน — เข้ามาแล้วเห็นข้อมูลเลย ไม่เจอหน้าโหลด */
  if (!fromOAuth) setLoginState('checking', 'กำลังเตรียมข้อมูล…');
  buildNav();
  await refreshCounts();
  await go('overview');
  await enterApp(fromOAuth);
}

/* ══════════════════════════════════════════════════════════════
   เมนูข้าง
   ══════════════════════════════════════════════════════════════ */
/* ไอคอนเส้นขนาด 24 — path คงที่ในโค้ด ไม่มีข้อมูลผู้ใช้ปน */
const ICONS = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  activities: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  docs: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6',
  albums: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9.5h.01',
  places: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  members: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.9.7 3.2 2.5 3.5 5.2',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4.5v5M6 14.5v5',
  admins: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2 2 4-4',
  audit: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4',
};
function navIcon(id) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'navbtn__ic');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[id] || ICONS.overview);
  svg.appendChild(p);
  return svg;
}

function buildNav() {
  const c = $('#navContent'); clear(c);
  c.appendChild(navBtn('overview', 'ภาพรวม'));
  Object.entries(SCHEMA).forEach(([k, s]) => c.appendChild(navBtn(k, s.label, true)));
  const y = $('#navSystem'); clear(y);
  y.appendChild(navBtn('settings', 'ตั้งค่าเว็บ'));
  y.appendChild(navBtn('admins', 'ผู้ดูแลระบบ'));
  y.appendChild(navBtn('audit', 'ประวัติการแก้ไข'));
}
function navBtn(id, label, withCount) {
  const b = el('button', 'navbtn');
  b.appendChild(navIcon(id));
  b.appendChild(el('span', 'navbtn__lb', label));
  if (withCount) { const n = el('span', 'count'); n.dataset.count = id; b.appendChild(n); }
  b.dataset.view = id;
  b.addEventListener('click', () => go(id));
  return b;
}
function markActive() {
  document.querySelectorAll('.navbtn').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

/* ปิดแผงฟอร์มแบบเลื่อนออก แทนการหายวับ */
function closeLayer(scrim, panel) {
  scrim.classList.add('is-leaving'); panel.classList.add('is-leaving');
  setTimeout(() => { scrim.remove(); panel.remove(); }, reduceMotion() ? 0 : 230);
}

async function refreshCounts() {
  await Promise.all(Object.keys(SCHEMA).map(async (t) => {
    const { count } = await db.from(t).select('id', { count: 'exact', head: true });
    counts[t] = count ?? 0;
  }));
  document.querySelectorAll('[data-count]').forEach((n) => {
    n.textContent = counts[n.dataset.count] ?? '';
  });
}

/* ══════════════════════════════════════════════════════════════
   สลับหน้า
   ══════════════════════════════════════════════════════════════ */
const VIEW_TH = { overview: 'ภาพรวม', settings: 'ตั้งค่าเว็บ',
                  admins: 'ผู้ดูแลระบบ', audit: 'ประวัติการแก้ไข' };

/* ── ของที่ยังไม่ได้บันทึก ──
   ฟอร์มและหน้าตั้งค่าลงทะเบียนไว้ตรงนี้ ก่อนเปลี่ยนหน้า/รีเฟรช/ปิดแท็บจะถามก่อนเสมอ
   (เดิมแก้ตั้งค่าแล้วกดเมนูอื่น ค่าที่พิมพ์ไว้หายเงียบ ๆ) */
const unsaved = new Set();            // แต่ละตัวมี isDirty() และ discard()
const hasUnsaved = () => [...unsaved].some((u) => u.isDirty());
window.addEventListener('beforeunload', (e) => {
  if (!hasUnsaved()) return;
  e.preventDefault();
  e.returnValue = '';
});

let goSeq = 0;
async function go(v, { force = false } = {}) {
  if (!force && hasUnsaved()) {
    if (!confirm('มีการแก้ไขที่ยังไม่ได้บันทึก — ออกจากหน้านี้และทิ้งการแก้ไข?')) return;
    [...unsaved].forEach((u) => u.discard());
  }
  [...unsaved].filter((u) => u.page).forEach((u) => unsaved.delete(u));
  /* กดเมนูรัว ๆ: หน้าที่โหลดเสร็จช้ากว่าห้ามมาทับหน้าที่เลือกล่าสุด
     จึงวาดลงกล่องพักก่อน แล้วค่อยสลับเข้าเฉพาะถ้ายังเป็นหน้าล่าสุดอยู่ */
  const seq = ++goSeq;
  view = v; markActive();
  $('#topTitle').textContent = (SCHEMA[v] || {}).label || VIEW_TH[v] || '';
  openMenu(false);                       // จอเล็ก: เลือกแล้วปิดเมนูให้เลย
  const main = $('#main');
  clear(main);
  main.appendChild(el('p', 'loading-line', 'กำลังโหลด…'));
  const stage = document.createElement('div');
  try {
    if (v === 'overview') await renderOverview(stage);
    else if (v === 'settings') await renderSettings(stage);
    else if (v === 'admins') await renderAdmins(stage);
    else if (v === 'audit') await renderAudit(stage);
    else await renderList(stage, v);
  } catch (err) {
    clear(stage);
    stage.appendChild(el('div', 'alert', 'โหลดข้อมูลไม่สำเร็จ: ' + err.message));
    const retry = el('button', 'btn btn--ghost btn--sm', 'ลองอีกครั้ง');
    retry.type = 'button';
    retry.style.marginTop = '12px';
    retry.addEventListener('click', () => go(v, { force: true }));
    stage.appendChild(retry);
  }
  if (seq !== goSeq) return;
  main.replaceChildren(...stage.childNodes);
}

/* ── ภาพรวม ── */

/* วันที่ตามเวลาไทย (YYYY-MM-DD) — ฐานข้อมูลแบ่งวันตาม Asia/Bangkok
   เดิมใช้ toISOString() ตรง ๆ ซึ่งเป็นเวลา UTC ช่วงตีห้าถึงเจ็ดโมงเช้า "วันนี้" จึงกลายเป็นเมื่อวาน */
const bkkDay = (daysAgo = 0) =>
  new Date(Date.now() + 7 * 3600e3 - daysAgo * 864e5).toISOString().slice(0, 10);
const dayLabel = (d, opts = { day: 'numeric', month: 'short' }) =>
  new Date(d + 'T12:00:00+07:00').toLocaleDateString('th-TH', opts);

/* หน้าเว็บจริงของเรา — เว็บใช้ cleanUrls จึงเห็นทั้ง /activities และ /activities.html ปนกัน */
const SITE_PAGES = {
  '/': 'หน้าแรก', '/activities': 'กิจกรรม', '/halal-map': 'สถานที่ฮาลาล',
  '/knowledge': 'คลังความรู้', '/about': 'เกี่ยวกับเรา', '/gallery': 'แกลเลอรี',
};
function cleanPath(p) {
  let s = String(p || '/').toLowerCase()
    .replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}
/* แถวที่ไม่ใช่หน้าเว็บจริงทิ้งไป — เช่น /Users/... ที่เกิดจากเปิดไฟล์ในเครื่องตอนพัฒนา
   ไม่งั้นตัวเลขรวมทุกตัวจะเพี้ยนตามไปด้วย */
const isSitePath = (p) => p in SITE_PAGES || /^\/[a-z0-9-]+$/.test(p);

function relTime(iso) {
  const t = new Date(iso), mins = Math.round((Date.now() - t) / 60000);
  const hm = t.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  if (mins < 60 * 6) return `${Math.round(mins / 60)} ชั่วโมงที่แล้ว`;
  const days = Math.round((new Date(bkkDay()) - new Date(new Date(t.getTime() + 7 * 3600e3).toISOString().slice(0, 10))) / 864e5);
  if (days === 0) return `วันนี้ ${hm}`;
  if (days === 1) return `เมื่อวาน ${hm}`;
  if (days < 7) return `${days} วันที่แล้ว`;
  return t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function greetWord() {
  const h = new Date().getHours();
  return h < 11 ? 'สวัสดีตอนเช้า' : h < 16 ? 'สวัสดีตอนบ่าย' : h < 19 ? 'สวัสดีตอนเย็น' : 'สวัสดี';
}

function card(cls, title, note) {
  const c = el('section', 'ov-card ' + (cls || ''));
  if (title) {
    const h = el('div', 'ov-card__head');
    h.appendChild(el('h3', null, title));
    if (note) h.appendChild(note);
    c.appendChild(h);
  }
  return c;
}

async function renderOverview(main) {
  /* โหลดทุกอย่างพร้อมกัน แล้วค่อยวาดทีเดียว หน้าจะไม่กระตุกทีละกล่อง */
  const [stats, content, emptyAlbums, feed] = await Promise.all([
    loadStats(), loadContentStats(), albumsWithoutPhotos(),
    db.from('audit_log').select('at,actor,action,table_name,summary')
      .order('at', { ascending: false }).limit(6),
  ]);
  if (feed.error) throw feed.error;

  clear(main);
  const head = el('div', 'head ov-head');
  const hi = el('div', 'greet');
  const first = me.name.split(' ')[0];
  hi.appendChild(el('h2', null, `${greetWord()} ${first.charAt(0).toUpperCase() + first.slice(1)}`));
  hi.appendChild(el('span', 'greet__day', new Date().toLocaleDateString('th-TH',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));
  head.appendChild(hi);
  const site = el('a', 'btn btn--ghost', 'เปิดหน้าเว็บ ↗');
  site.href = '/?fresh'; site.target = '_blank'; site.rel = 'noopener';
  site.title = 'เปิดหน้าเว็บแบบข้าม cache ในเครื่อง · ของที่แก้จะขึ้นเว็บภายใน ~3 นาที';
  head.appendChild(site);
  main.appendChild(head);

  const grid = el('div', 'ov');
  main.appendChild(grid);
  grid.appendChild(visitsCard(stats));
  grid.appendChild(todoCard(content, emptyAlbums));
  grid.appendChild(shelf(content));
  grid.appendChild(topPagesCard(stats));
  grid.appendChild(feedCard(feed.data || []));
}

/* ── ข้อมูล ── */
async function loadStats() {
  const { data, error } = await db.from('page_stats')
    .select('day,path,views,visitors').gte('day', bkkDay(59)).order('day');
  if (error) return { error };
  const byDay = new Map();
  for (let i = 59; i >= 0; i--) byDay.set(bkkDay(i), { day: bkkDay(i), views: 0, visitors: 0 });
  const byPath = new Map();
  (data || []).forEach((r) => {
    const p = cleanPath(r.path);
    if (!isSitePath(p)) return;
    const d = byDay.get(r.day);
    if (!d) return;
    d.views += r.views; d.visitors += r.visitors;
    if (!byPath.has(p)) byPath.set(p, new Map());
    byPath.get(p).set(r.day, (byPath.get(p).get(r.day) || 0) + r.views);
  });
  return { days: [...byDay.values()], byPath };
}

async function loadContentStats() {
  const out = {};
  await Promise.all(Object.keys(SCHEMA).map(async (t) => {
    const { data, error } = await db.from(t).select('status');
    /* โหลดไม่ได้ต้องแจ้งเป็นข้อผิดพลาด ไม่ใช่นับเป็น 0 แล้วบอกว่า "ไม่มีอะไรค้าง" */
    if (error) throw error;
    const rows = data || [];
    out[t] = { total: rows.length, drafts: rows.filter((r) => r.status === 'draft').length };
  }));
  return out;
}

/* ชื่ออัลบั้มที่ยังไม่มีแถวในตาราง album_photos */
async function albumsWithoutPhotos() {
  const [{ data: albums, error }, counts2] = await Promise.all([
    db.from('albums').select('id,title'),
    albumPhotoCounts(),
  ]);
  if (error) throw error;
  return (albums || []).filter((a) => !counts2.get(a.id)).map((a) => a.title);
}

/* ── ผู้เข้าชม ── */
const METRIC = { visitors: 'ผู้เข้าชม', views: 'การเปิดหน้า' };
let ovRange = 14, ovMetric = 'visitors';

function seg(options, value, onPick, label) {
  const g = el('div', 'seg');
  g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
  options.forEach(([v, text]) => {
    const b = el('button', null, text);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(v === value));
    b.addEventListener('click', () => {
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(v);
    });
    g.appendChild(b);
  });
  return g;
}

function visitsCard(stats) {
  const c = card('ov-visits');
  const top = el('div', 'ov-visits__top');
  top.appendChild(el('h3', null, 'ผู้เข้าชมเว็บ'));
  c.appendChild(top);

  if (stats.error) {
    c.appendChild(el('div', 'chart-empty',
      /* แยกให้ออก: ตารางยังไม่ถูกสร้างจริง ๆ กับแค่โหลดไม่สำเร็จชั่วคราว */
      /42P01|PGRST205|does not exist|schema cache/i.test(`${stats.error.code} ${stats.error.message}`)
        ? 'ยังเปิดใช้สถิติไม่ได้ — ต้องรัน supabase/migrations/0004_page_stats.sql ก่อน'
        : 'โหลดสถิติผู้เข้าชมไม่สำเร็จ ลองรีเฟรชอีกครั้ง'));
    return c;
  }

  const ctrls = el('div', 'ov-visits__ctrls');
  ctrls.appendChild(seg([['visitors', 'ผู้เข้าชม'], ['views', 'การเปิดหน้า']], ovMetric,
    (v) => { ovMetric = v; draw(false); }, 'เลือกตัวเลขที่จะดู'));
  ctrls.appendChild(seg([[7, '7 วัน'], [14, '14 วัน'], [30, '30 วัน']], ovRange,
    (v) => { ovRange = v; draw(false); }, 'เลือกช่วงเวลา'));
  top.appendChild(ctrls);

  const summary = el('div', 'ov-sum');
  const chartBox = el('div');
  const foot = el('p', 'ov-visits__note',
    'ผู้เข้าชม = นับเบราว์เซอร์ละครั้งต่อวัน · การเปิดหน้า = ทุกครั้งที่มีคนเปิดหน้าใดก็ได้ · ไม่เก็บข้อมูลระบุตัวตน');
  c.append(summary, chartBox, foot);

  function draw(first) {
    const days = stats.days.slice(-ovRange);
    const prev = stats.days.slice(-ovRange * 2, -ovRange);
    const k = ovMetric;
    const total = days.reduce((a, d) => a + d[k], 0);
    const before = prev.reduce((a, d) => a + d[k], 0);
    const today = days[days.length - 1][k];

    clear(summary);
    const big = el('div', 'ov-sum__main');
    big.appendChild(el('b', 'num', total.toLocaleString('th-TH')));
    big.appendChild(el('span', null, `${METRIC[k]}รวม ${ovRange} วันล่าสุด`));
    if (before) {
      const pct = Math.round(((total - before) / before) * 100);
      big.appendChild(el('em', 'ov-delta ' + (pct >= 0 ? 'up' : 'down'),
        `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% จาก ${ovRange} วันก่อนหน้า`));
    }
    summary.appendChild(big);
    const side = el('div', 'ov-sum__side');
    const mini = (n, t) => {
      const m = el('div', 'ov-mini');
      m.append(el('b', 'num', n.toLocaleString('th-TH')), el('span', null, t));
      return m;
    };
    side.append(mini(today, 'วันนี้'),
                mini(Math.round((total / ovRange) * 10) / 10, 'เฉลี่ยต่อวัน'));
    summary.appendChild(side);

    clear(chartBox);
    chartBox.appendChild(total
      ? areaChart(days, k, first)
      : el('div', 'chart-empty', `ยังไม่มี${METRIC[k]}ในช่วง ${ovRange} วันนี้ — ตัวเลขจะขึ้นหลังมีคนเปิดเว็บ`));
  }
  draw(true);
  return c;
}

/* ค่าสูงสุดของแกนให้เป็นเลขกลม ๆ อ่านง่าย */
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = [1, 2, 2.5, 5, 10].find((m) => m * p >= v);
  return n * p;
}

/* เส้นโค้งแบบ monotone — โค้งนุ่มแต่ไม่พุ่งเกินจุดข้อมูลหรือจมต่ำกว่าศูนย์ */
function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const r = 3 / Math.sqrt(s); t[i] = r * a * m[i]; t[i + 1] = r * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

/* กราฟพื้นที่ — SVG ยืดเต็มกว้าง (preserveAspectRatio=none) จึงห้ามมีตัวหนังสือข้างใน
   ตัวเลขแกน จุด เส้นชี้ และกล่องบอกค่า เป็น HTML ทั้งหมด ตัวอักษรจึงไม่ถูกยืด */
function areaChart(days, k, reveal) {
  const NS = 'http://www.w3.org/2000/svg';
  const n = days.length;
  const max = niceMax(Math.max(...days.map((d) => d[k])));
  const X = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const Y = (v) => 100 - (v / max) * 100;
  const pts = days.map((d, i) => [X(i), Y(d[k])]);

  const box = el('div', 'area');
  const plot = el('div', 'area__plot');
  box.appendChild(plot);

  /* เส้นแกนนอน + ตัวเลข */
  [1, 0.5, 0].forEach((f) => {
    const g = el('div', 'area__grid');
    g.style.top = (100 - f * 100) + '%';
    g.appendChild(el('span', 'num', String(Math.round(max * f))));
    plot.appendChild(g);
  });

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'area__svg' + (reveal ? ' is-reveal' : ''));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${METRIC[k]}รายวัน ${n} วันล่าสุด สูงสุด ${Math.max(...days.map((d) => d[k]))} ต่อวัน`);
  const defs = document.createElementNS(NS, 'defs');
  const gid = 'areaFill' + Math.random().toString(36).slice(2, 7);
  const lg = document.createElementNS(NS, 'linearGradient');
  lg.setAttribute('id', gid); lg.setAttribute('x1', 0); lg.setAttribute('y1', 0);
  lg.setAttribute('x2', 0); lg.setAttribute('y2', 1);
  [[0, '.32'], [1, '0']].forEach(([o, op]) => {
    const s = document.createElementNS(NS, 'stop');
    s.setAttribute('offset', o); s.setAttribute('stop-color', '#7C3AED'); s.setAttribute('stop-opacity', op);
    lg.appendChild(s);
  });
  defs.appendChild(lg); svg.appendChild(defs);

  const line = smoothPath(pts);
  const fill = document.createElementNS(NS, 'path');
  fill.setAttribute('d', `${line} L100,100 L0,100 Z`);
  fill.setAttribute('fill', `url(#${gid})`);
  const stroke = document.createElementNS(NS, 'path');
  stroke.setAttribute('d', line);
  stroke.setAttribute('class', 'area__line');
  stroke.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(fill, stroke);
  plot.appendChild(svg);

  /* จุดวันนี้ */
  const today = el('span', 'area__dot area__dot--today');
  today.style.left = X(n - 1) + '%'; today.style.top = Y(days[n - 1][k]) + '%';
  plot.appendChild(today);

  /* ชี้แล้วเห็นค่าของวันนั้น */
  const guide = el('span', 'area__guide');
  const dot = el('span', 'area__dot');
  const tip = el('div', 'area__tip');
  plot.append(guide, dot, tip);
  function show(i) {
    const d = days[i];
    plot.classList.add('is-hover');
    guide.style.left = dot.style.left = X(i) + '%';
    dot.style.top = Y(d[k]) + '%';
    clear(tip);
    tip.appendChild(el('b', null, dayLabel(d.day, { weekday: 'short', day: 'numeric', month: 'short' })));
    tip.appendChild(el('span', null, `ผู้เข้าชม ${d.visitors.toLocaleString('th-TH')} · เปิดหน้า ${d.views.toLocaleString('th-TH')}`));
    tip.style.left = X(i) + '%';
    tip.classList.toggle('is-left', X(i) > 70);
    tip.classList.toggle('is-right', X(i) < 30);
  }
  plot.addEventListener('pointermove', (e) => {
    const r = plot.getBoundingClientRect();
    show(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  });
  plot.addEventListener('pointerleave', () => plot.classList.remove('is-hover'));

  /* วันที่ใต้กราฟ — ไม่ใส่ทุกวัน เดี๋ยวแน่นเกิน */
  const axis = el('div', 'area__axis');
  const step = n <= 7 ? 1 : n <= 14 ? 2 : 5;
  days.forEach((d, i) => {
    if ((n - 1 - i) % step) return;
    const t = el('span', 'num', i === n - 1 ? 'วันนี้' : dayLabel(d.day));
    t.style.left = X(i) + '%';
    axis.appendChild(t);
  });
  box.appendChild(axis);
  return box;
}

/* ── หน้ายอดนิยม ── */
function topPagesCard(stats) {
  const c = card('ov-top', 'หน้ายอดนิยม', el('span', 'note', '14 วันล่าสุด · นับการเปิดหน้า'));
  if (stats.error) { c.appendChild(el('div', 'chart-empty', 'ยังไม่มีข้อมูล')); return c; }
  const from = bkkDay(13);
  const list = [...stats.byPath.entries()]
    .map(([p, m]) => [p, [...m.entries()].filter(([d]) => d >= from).reduce((a, [, v]) => a + v, 0)])
    .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!list.length) { c.appendChild(el('div', 'chart-empty', 'ยังไม่มีคนเปิดหน้าไหนในช่วงนี้')); return c; }
  const sum = list.reduce((a, [, v]) => a + v, 0);
  const wrap = el('ol', 'ov-pages');
  list.forEach(([p, v]) => {
    const li = el('li');
    const row = el('div', 'ov-pages__row');
    row.appendChild(el('span', 'ov-pages__nm', SITE_PAGES[p] || p));
    row.appendChild(el('span', 'ov-pages__n num', v.toLocaleString('th-TH')));
    row.appendChild(el('span', 'ov-pages__pct num', Math.round((v / sum) * 100) + '%'));
    const bar = el('span', 'ov-pages__bar');
    const fillEl = el('span');
    fillEl.style.width = Math.max(3, (v / list[0][1]) * 100) + '%';
    bar.appendChild(fillEl);
    li.append(row, bar);
    wrap.appendChild(li);
  });
  c.appendChild(wrap);
  return c;
}

/* ── ชั้นนับเนื้อหา ── */
function shelf(content) {
  const s = el('div', 'ov-shelf');
  Object.entries(SCHEMA).forEach(([k, sc]) => {
    const st = content[k] || { total: 0, drafts: 0 };
    const b = el('button', 'ov-chip');
    b.type = 'button';
    const ic = el('span', 'ov-chip__ic'); ic.appendChild(navIcon(k));
    const tx = el('span', 'ov-chip__tx');
    tx.appendChild(el('b', 'num', String(st.total)));
    tx.appendChild(el('span', null, sc.label));
    b.append(ic, tx);
    if (st.drafts) b.appendChild(el('span', 'ov-chip__draft', `ร่าง ${st.drafts}`));
    b.addEventListener('click', () => go(k));
    s.appendChild(b);
  });
  return s;
}

/* ── งานค้าง + ทางลัด ── */
function todoCard(content, emptyAlbums) {
  const c = card('ov-todo', 'รอจัดการ');
  const list = el('ul', 'ov-todo__list');
  const item = (text, sub, to) => {
    const li = el('li');
    const b = el('button', 'ov-todo__item');
    b.type = 'button';
    const t = el('span', 'ov-todo__tx');
    t.appendChild(el('b', null, text));
    if (sub) t.appendChild(el('span', null, sub));
    b.append(el('span', 'ov-todo__dot'), t, el('span', 'ov-todo__go', '›'));
    b.addEventListener('click', () => go(to));
    li.appendChild(b); list.appendChild(li);
  };
  /* อัลบั้มที่ยังไม่มีรูปขึ้นเว็บแล้วเห็นแค่ปก — กับดักที่คนใหม่ตกบ่อยที่สุด จึงขึ้นก่อน */
  if (emptyAlbums.length) {
    item(`อัลบั้ม ${emptyAlbums.length} รายการยังไม่มีรูป`,
      emptyAlbums.slice(0, 2).join(' · ') + (emptyAlbums.length > 2 ? ' …' : ''), 'albums');
  }
  Object.entries(SCHEMA).forEach(([k, sc]) => {
    const n = content[k]?.drafts || 0;
    if (n) item(`${sc.label}: ร่าง ${n} รายการ`, 'ยังไม่ขึ้นหน้าเว็บ', k);
  });
  if (list.children.length) c.appendChild(list);
  else c.appendChild(el('p', 'ov-todo__clear', 'ไม่มีอะไรค้าง ทุกอย่างขึ้นเว็บเรียบร้อย'));

  const quick = el('div', 'ov-quick');
  quick.appendChild(el('span', 'ov-quick__lb', 'เพิ่มใหม่'));
  const btns = el('div', 'ov-quick__btns');
  [['activities', 'กิจกรรม'], ['docs', 'เอกสาร'], ['albums', 'อัลบั้ม'], ['places', 'สถานที่']].forEach(([t, lb]) => {
    const b = el('button', 'btn btn--ghost btn--sm', '+ ' + lb);
    b.type = 'button';
    b.addEventListener('click', async () => { await go(t); openForm(t, null); });
    btns.appendChild(b);
  });
  quick.appendChild(btns);
  c.appendChild(quick);
  return c;
}

/* ── ความเคลื่อนไหวล่าสุด ── */
function feedCard(rows) {
  const more = el('button', 'linkbtn', 'ดูทั้งหมด');
  more.addEventListener('click', () => go('audit'));
  const c = card('ov-feed', 'แก้ไขล่าสุด', more);
  if (!rows.length) { c.appendChild(el('div', 'chart-empty', 'ยังไม่มีใครแก้ไขอะไร')); return c; }
  const ul = el('ul', 'feed');
  rows.forEach((r) => {
    const who = String(r.actor || '—').split('@')[0];
    const li = el('li', 'feed__item');
    const av = el('span', 'feed__av feed__av--' + (r.action || 'update'), who.charAt(0).toUpperCase());
    av.setAttribute('aria-hidden', 'true');
    const body = el('div', 'feed__body');
    const line = el('p', 'feed__line');
    line.append(el('b', null, who), document.createTextNode(' ' + (ACTION_TH[r.action] || r.action) + ' '),
                el('span', 'feed__where', (SCHEMA[r.table_name] || {}).label || r.table_name || ''));
    body.append(line, el('p', 'feed__what', r.summary || '—'));
    const time = el('time', 'feed__time', relTime(r.at));
    time.dateTime = r.at;
    time.title = new Date(r.at).toLocaleString('th-TH');
    li.append(av, body, time);
    ul.appendChild(li);
  });
  c.appendChild(ul);
  return c;
}

const ACTION_TH = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ' };

/* ══════════════════════════════════════════════════════════════
   ตัวอย่างบนเว็บจริง — เปิดหน้าที่รายการนั้นไปแสดง พร้อม ?preview
   หน้าเว็บจะดึงข้อมูลด้วยสิทธิ์ผู้ดูแลที่ล็อกอินอยู่ จึงเห็น "ร่าง" ด้วย (คนอื่นไม่เห็น)
   ══════════════════════════════════════════════════════════════ */
const PREVIEW_PAGE = {
  activities: '/activities.html', docs: '/knowledge.html', albums: '/gallery.html',
  places: '/halal-map.html', members: '/about.html', settings: '/',
};
const previewUrl = (t) => (PREVIEW_PAGE[t] || '/') + '?preview';
function previewLink(t, label = 'ดูตัวอย่างบนเว็บ') {
  const a = el('a', 'btn btn--ghost');
  a.href = previewUrl(t); a.target = '_blank'; a.rel = 'noopener';
  a.title = 'เปิดหน้าเว็บจริงที่รวมรายการที่เป็นร่างไว้ด้วย · คนทั่วไปยังไม่เห็นร่าง';
  a.append(el('span', null, label), icon('out'));
  return a;
}

/* ไอคอนเส้นเล็ก ๆ ที่ใช้ในหน้าจัดการ */
const UI_ICONS = {
  out: 'M14 4h6v6M20 4l-9 9M10 5H4v15h15v-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  photo: 'M3 6h14v12H3zM7 3h14v12M3 15l4-4 3 3 2-2 5 5',
  pin: 'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z',
  chev: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  image: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01',
};
function icon(name, cls) {
  const NS = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', UI_ICONS[name]);
  s.appendChild(p);
  return s;
}

/* หัวหน้า: ชื่อ + คำอธิบายสั้น + ปุ่มด้านขวา */
function pageHead(title, sub, ...actions) {
  const h = el('div', 'pg-head');
  const t = el('div', 'pg-head__tx');
  t.appendChild(el('h2', null, title));
  if (sub) t.appendChild(el('p', 'pg-sub', sub));
  h.appendChild(t);
  if (actions.length) {
    const a = el('div', 'pg-head__acts');
    actions.filter(Boolean).forEach((x) => a.appendChild(x));
    h.appendChild(a);
  }
  return h;
}

/* ปุ่มกลุ่มแบบแคปซูล — คืน element ที่มี .value ให้อ่านค่าปัจจุบัน */
function segmented(options, value, onChange, label, cls = '') {
  const g = el('div', 'seg ' + cls);
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', label);
  g.value = value;
  options.forEach((o) => {
    const b = el('button');
    b.type = 'button';
    b.dataset.v = o.v;
    b.appendChild(el('span', null, o.label));
    if (o.count != null) b.appendChild(el('span', 'seg__n', String(o.count)));
    if (o.title) b.title = o.title;
    b.setAttribute('aria-pressed', String(o.v === value));
    b.addEventListener('click', () => {
      g.value = o.v;
      g.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onChange(o.v);
    });
    g.appendChild(b);
  });
  return g;
}

/* ── รายการ ── */
/* บรรทัดรองใต้ชื่อของแต่ละชนิด — ให้รู้ว่าเป็นรายการไหนโดยไม่ต้องเปิด */
const ROW_META = {
  activities: (r) => [fmtDate(r.date), r.location],
  docs: (r) => [fmtDate(r.date), r.file_id ? 'มีไฟล์ PDF' : 'ยังไม่มีไฟล์'],
  albums: (r, ctx) => [fmtDate(r.date), ctx.photos ? ctx.photos + ' รูป' : null],
  places: (r) => [r.type, r.coords || (r.map_url ? 'มีลิงก์แผนที่' : 'ยังไม่มีแผนที่')],
  members: (r) => [r.title, r.sort_order != null ? 'ลำดับ ' + r.sort_order : null],
};
const IMG_KEY = { activities: 'cover_id', albums: 'cover_id', members: 'cover_id', docs: 'file_id' };
const ADD_LABEL = { activities: 'เพิ่มกิจกรรม', docs: 'เพิ่มเอกสาร', albums: 'สร้างอัลบั้ม', places: 'เพิ่มสถานที่', members: 'เพิ่มกรรมการ' };

async function renderList(main, table) {
  const s = SCHEMA[table];
  const [col, dir] = s.order.split('.');
  const { data, error } = await db.from(table).select('*').order(col, { ascending: dir === 'asc' });
  if (error) throw error;
  const photoCount = s.photos ? await albumPhotoCounts() : null;

  clear(main);
  const nPub = data.filter((r) => r.status === 'published').length;
  const add = el('button', 'btn btn--primary');
  add.append(icon('plus'), el('span', null, ADD_LABEL[table] || 'เพิ่มใหม่'));
  add.addEventListener('click', () => openForm(table, null));
  main.appendChild(pageHead(s.label,
    data.length ? `${data.length} รายการ · ขึ้นเว็บอยู่ ${nPub}` : 'ยังไม่มีรายการ',
    previewLink(table), add));

  /* ตัวกรอง: สถานะเป็นแท็บพร้อมจำนวน · ค้นหา · (กิจกรรม) เฉพาะที่ปักหมุด */
  const st = { status: '', q: '', pinned: false };
  const count = (v) => data.filter((r) => r.status === v).length;
  const bar = el('div', 'filters');
  bar.appendChild(segmented(
    [{ v: '', label: 'ทั้งหมด', count: data.length }]
      .concat(STATUS.map((x) => ({ v: x.v, label: x.label, count: count(x.v) }))),
    '', (v) => { st.status = v; draw(); }, 'กรองตามสถานะ'));
  const sw = el('label', 'search');
  sw.appendChild(icon('search'));
  const search = el('input');
  search.type = 'search'; search.placeholder = 'ค้นหาชื่อ…';
  search.setAttribute('aria-label', 'ค้นหาในรายการ');
  search.addEventListener('input', () => { st.q = search.value.trim().toLowerCase(); draw(); });
  sw.appendChild(search);
  bar.appendChild(sw);
  if (table === 'activities') {
    const pin = el('button', 'chip-toggle');
    pin.type = 'button';
    pin.setAttribute('aria-pressed', 'false');
    pin.append(icon('pin'), el('span', null, 'เฉพาะที่ปักหมุด'));
    pin.addEventListener('click', () => {
      st.pinned = !st.pinned;
      pin.setAttribute('aria-pressed', String(st.pinned));
      draw();
    });
    bar.appendChild(pin);
  }
  main.appendChild(bar);

  const listBox = el('div', 'rows');
  main.appendChild(listBox);

  function row(r) {
    const li = el('div', 'row');
    const btn = el('button', 'row__main');
    btn.type = 'button';
    btn.addEventListener('click', () => openForm(table, r));

    const k = IMG_KEY[table];
    if (k) {
      const th = el('span', 'row__thumb' + (table === 'members' ? ' row__thumb--round' : ''));
      if (r[k]) {
        const im = el('img');
        im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.alt = '';
        im.src = driveThumb(r[k]);
        th.appendChild(im);
      } else th.appendChild(icon('image'));
      btn.appendChild(th);
    }

    const tx = el('span', 'row__tx');
    const t = el('span', 'row__title');
    t.appendChild(el('span', null, r[s.title] || '(ไม่มีชื่อ)'));
    if (table === 'activities' && r.featured) {
      const p = el('span', 'pin');
      p.title = 'ปักหมุดเป็นกิจกรรมเด่น';
      p.append(starSvg(), el('span', null, 'เด่น'));
      t.appendChild(p);
    }
    tx.appendChild(t);
    const meta = (ROW_META[table] || (() => []))(r, { photos: photoCount && photoCount.get(r.id) })
      .filter((x) => x && x !== '—');
    if (table === 'albums' && !(photoCount && photoCount.get(r.id))) meta.push('ยังไม่มีรูป');
    if (meta.length) tx.appendChild(el('span', 'row__meta', meta.join(' · ')));
    btn.appendChild(tx);

    btn.appendChild(el('span', 'tag tag--' + r.status, (STATUS.find((x) => x.v === r.status) || {}).label || r.status));
    btn.appendChild(icon('chev', 'row__go'));
    li.appendChild(btn);

    if (s.photos) {
      const ph = el('button', 'btn btn--ghost btn--sm row__side');
      ph.type = 'button';
      ph.append(icon('photo'), el('span', null, 'จัดการรูป'));
      ph.addEventListener('click', () => openPhotos(r));
      li.appendChild(ph);
    }
    return li;
  }

  function draw() {
    clear(listBox);
    const rows = data.filter((r) =>
      (!st.status || r.status === st.status) &&
      (!st.pinned || r.featured) &&
      (!st.q || String(r[s.title] || '').toLowerCase().includes(st.q)));
    if (!rows.length) {
      const e = el('div', 'empty-state');
      if (!data.length) {
        e.appendChild(el('b', null, `ยังไม่มี${s.label}`));
        e.appendChild(el('span', null, 'เริ่มจากเพิ่มรายการแรก — บันทึกเป็นร่างไว้ก่อนแล้วกดดูตัวอย่างได้'));
        const b = el('button', 'btn btn--primary');
        b.append(icon('plus'), el('span', null, ADD_LABEL[table] || 'เพิ่มใหม่'));
        b.addEventListener('click', () => openForm(table, null));
        e.appendChild(b);
      } else {
        e.appendChild(el('b', null, 'ไม่พบรายการที่ตรงกับตัวกรอง'));
        e.appendChild(el('span', null, 'ลองเปลี่ยนคำค้นหรือเลือก "ทั้งหมด"'));
      }
      listBox.appendChild(e);
      return;
    }
    rows.forEach((r) => listBox.appendChild(row(r)));
  }
  draw();
}

/* ══════════════════════════════════════════════════════════════
   รูปในอัลบั้ม

   รูปที่ขึ้นหน้าเว็บอ่านจากตาราง album_photos ไม่ใช่จากโฟลเดอร์ Drive
   (เบราว์เซอร์กับ Supabase ไล่อ่านโฟลเดอร์ Drive แทน Apps Script ไม่ได้)
   หน้านี้คือที่เดียวที่เขียนตารางนั้น — ไม่มีหน้านี้ อัลบั้มใหม่จะมีแต่ปก
   ══════════════════════════════════════════════════════════════ */
async function albumPhotoCounts() {
  const { data, error } = await db.from('album_photos').select('album_id');
  if (error) throw error;
  const m = new Map();
  (data || []).forEach((p) => m.set(p.album_id, (m.get(p.album_id) || 0) + 1));
  return m;
}

function openPhotos(album) {
  let photos = [];

  const scrim = el('div', 'scrim');
  const panel = el('div', 'panel panel--wide');
  const head = el('div', 'panel__head');
  const ht = el('div', 'panel__title');
  ht.append(el('span', 'panel__kicker', 'รูปในอัลบั้ม'), el('h3', null, album.title || ''));
  const close = el('button', 'iconbtn-round');
  close.type = 'button'; close.setAttribute('aria-label', 'ปิด'); close.appendChild(icon('close'));
  head.append(ht, close); panel.appendChild(head);

  const body = el('div', 'panel__body'); panel.appendChild(body);
  body.appendChild(el('p', 'sub',
    'รูปที่อยู่ในรายการนี้เท่านั้นที่ขึ้นหน้าเว็บ · ไฟล์จริงยังอยู่บน Google Drive '
    + 'และต้องตั้งแชร์ "ทุกคนที่มีลิงก์" ไม่งั้นคนนอกจะเห็นเป็นรูปว่าง'));

  /* ── ดึงจากโฟลเดอร์ Drive ทีเดียวทั้งอัลบั้ม ── */
  const tools = el('div', 'tools');
  const sync = el('button', 'btn btn--primary', 'ดึงรูปจากโฟลเดอร์ Drive');
  sync.disabled = !album.folder_id;
  sync.addEventListener('click', () => importFolder());
  tools.appendChild(sync);
  const openFolder = el('a', 'btn btn--ghost', 'เปิดโฟลเดอร์ ↗');
  if (album.folder_id) {
    openFolder.href = 'https://drive.google.com/drive/folders/' + driveId(album.folder_id);
    openFolder.target = '_blank'; openFolder.rel = 'noopener';
    tools.appendChild(openFolder);
  }
  body.appendChild(tools);
  if (!album.folder_id) {
    body.appendChild(el('span', 'hint',
      'อัลบั้มนี้ยังไม่ได้ใส่ "โฟลเดอร์รูป" — ใส่ในหน้าแก้ไขอัลบั้มก่อน แล้วค่อยกดดึงรูป '
      + 'หรือวางลิงก์รูปทีละใบด้านล่างก็ได้'));
  }

  /* ── วางลิงก์เอง (ใช้ตอนอยากเลือกเฉพาะบางรูป) ── */
  const addWrap = el('div', 'field');
  const addLab = el('label', null, 'หรือวางลิงก์รูปเอง (บรรทัดละ 1 ลิงก์)');
  addLab.htmlFor = 'photoPaste';
  const ta = el('textarea'); ta.id = 'photoPaste';
  ta.placeholder = 'https://drive.google.com/file/d/xxxxxxxx/view\nhttps://drive.google.com/file/d/yyyyyyyy/view';
  const addBtn = el('button', 'btn btn--ghost', 'เพิ่มรูปที่วางไว้');
  addBtn.style.alignSelf = 'flex-start';
  addBtn.addEventListener('click', async () => {
    const ids = String(ta.value).match(/[-\w]{25,}/g) || [];
    if (!ids.length) { toast('ไม่พบลิงก์ Drive ในข้อความที่วาง', true); return; }
    if (await addPhotos([...new Set(ids)])) ta.value = '';
  });
  addWrap.append(addLab, ta, addBtn);
  body.appendChild(addWrap);

  const listBox = el('div');
  body.appendChild(listBox);

  const foot = el('div', 'panel__foot');
  const done = el('button', 'btn btn--primary', 'เสร็จแล้ว');
  foot.appendChild(done); panel.appendChild(foot);

  function shut() {
    closeLayer(scrim, panel);
    document.removeEventListener('keydown', esc);
    go('albums');                       // กลับไปหน้ารายการเพื่อให้ตัวเลขจำนวนรูปตรง
  }
  function esc(e) { if (e.key === 'Escape') shut(); }
  [close, done, scrim].forEach((n) => n.addEventListener('click', shut));
  document.addEventListener('keydown', esc);

  /* ── งานกับฐานข้อมูล ── */
  async function load() {
    const { data, error } = await db.from('album_photos')
      .select('*').eq('album_id', album.id).order('sort_order');
    if (error) { listBox.replaceChildren(el('div', 'alert', 'โหลดรูปไม่สำเร็จ: ' + error.message)); return; }
    photos = data || [];
    draw();
  }

  async function addPhotos(ids) {
    const have = new Set(photos.map((p) => p.file_id));
    const fresh = ids.map(driveId).filter((id) => id && !have.has(id));
    if (!fresh.length) { toast('รูปเหล่านี้อยู่ในอัลบั้มอยู่แล้ว'); return false; }
    const base = photos.length ? Math.max(...photos.map((p) => p.sort_order)) + 1 : 0;
    const rows = fresh.map((file_id, i) => ({ album_id: album.id, file_id, sort_order: base + i }));
    const { error } = await db.from('album_photos')
      .upsert(rows, { onConflict: 'album_id,file_id', ignoreDuplicates: true });
    if (error) { toast('เพิ่มรูปไม่สำเร็จ: ' + error.message, true); return false; }
    toast('เพิ่ม ' + fresh.length + ' รูปแล้ว');
    await load();
    return true;
  }

  /* โฟลเดอร์ Drive อ่านผ่าน /data?sheet=folder (ต้องตั้ง GOOGLE_API_KEY บน Vercel)
     ถ้ายังไม่ได้ตั้ง ปุ่มนี้จะบอกวิธี แล้วใช้ช่องวางลิงก์แทนได้ */
  async function importFolder() {
    sync.disabled = true; sync.textContent = 'กำลังอ่านโฟลเดอร์…';
    try {
      const res = await fetch('/data?sheet=folder&id=' + encodeURIComponent(driveId(album.folder_id)));
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'อ่านโฟลเดอร์ไม่สำเร็จ');
      if (!j.data.length) { toast('ไม่พบไฟล์รูปในโฟลเดอร์นี้', true); return; }
      await addPhotos(j.data.map((f) => f.file_id));
    } catch (err) {
      toast(err.message, true);
    } finally {
      sync.disabled = !album.folder_id; sync.textContent = 'ดึงรูปจากโฟลเดอร์ Drive';
    }
  }

  async function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= photos.length) return;
    const a = photos[i], b = photos[j];
    const [sa, sb] = [a.sort_order, b.sort_order];
    const { error } = await db.from('album_photos').upsert([
      { ...a, sort_order: sb }, { ...b, sort_order: sa },
    ]);
    if (error) { toast('สลับลำดับไม่สำเร็จ: ' + error.message, true); return; }
    await load();
  }

  async function remove(p) {
    if (!confirm('เอารูปนี้ออกจากอัลบั้ม? (ไฟล์บน Drive ยังอยู่เหมือนเดิม)')) return;
    const { error } = await db.from('album_photos').delete().eq('id', p.id);
    if (error) { toast('ลบไม่สำเร็จ: ' + error.message, true); return; }
    await load();
  }

  async function setCover(p) {
    const { error } = await db.from('albums').update({ cover_id: p.file_id }).eq('id', album.id);
    if (error) { toast('ตั้งปกไม่สำเร็จ: ' + error.message, true); return; }
    album.cover_id = p.file_id;
    toast('ตั้งเป็นรูปปกแล้ว');
    draw();
  }

  /* ── วาดรายการรูป ── */
  function draw() {
    clear(listBox);
    const h = el('div', 'panel-card__head');
    h.appendChild(el('h3', null, 'รูปทั้งหมด'));
    h.appendChild(el('span', 'note', photos.length + ' รูป'));
    listBox.appendChild(h);

    if (!photos.length) {
      listBox.appendChild(el('div', 'empty',
        'ยังไม่มีรูปในอัลบั้มนี้ — หน้าเว็บจะเห็นแค่รูปปก'));
      return;
    }
    const grid = el('div', 'photos');
    photos.forEach((p, i) => {
      const t = el('figure', 'photo');
      const im = el('img');
      im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.alt = '';
      im.src = driveThumb(p.file_id);
      t.appendChild(im);
      if (album.cover_id && driveId(album.cover_id) === p.file_id) {
        t.appendChild(el('span', 'photo__badge', 'ปก'));
      }
      const acts = el('div', 'photo__acts');
      const mk = (label, title, fn, cls) => {
        const b = el('button', 'iconbtn' + (cls ? ' ' + cls : ''), label);
        b.title = title; b.setAttribute('aria-label', title);
        b.addEventListener('click', fn);
        return b;
      };
      acts.appendChild(mk('‹', 'เลื่อนไปก่อนหน้า', () => move(i, -1)));
      acts.appendChild(mk('›', 'เลื่อนไปถัดไป', () => move(i, 1)));
      acts.appendChild(mk('★', 'ตั้งเป็นรูปปก', () => setCover(p)));
      acts.appendChild(mk('✕', 'เอาออกจากอัลบั้ม', () => remove(p), 'iconbtn--bad'));
      t.appendChild(acts);
      grid.appendChild(t);
    });
    listBox.appendChild(grid);
  }

  document.body.append(scrim, panel);
  listBox.appendChild(el('p', null, 'กำลังโหลด…'));
  load();
}

/* ── ฟอร์มเพิ่ม/แก้ไข ──
   สถานะอยู่บนสุด เพราะเป็นตัวตัดสินว่าคนทั่วไปจะเห็นหรือไม่
   ปุ่ม "บันทึกและดูตัวอย่าง" = บันทึกแล้วเปิดหน้าเว็บจริงในโหมดตัวอย่าง (เห็นร่างด้วย) โดยไม่ปิดฟอร์ม */
const STATUS_HINT = {
  published: 'ขึ้นหน้าเว็บ คนทั่วไปเห็น',
  draft: 'ยังไม่ขึ้นเว็บ เห็นเฉพาะผู้ดูแลในโหมดตัวอย่าง',
  archived: 'ซ่อนจากหน้าเว็บ เก็บไว้ดูย้อนหลัง',
};
const SAVE_LABEL = { published: 'บันทึกและเผยแพร่', draft: 'บันทึกร่าง', archived: 'บันทึก' };

function openForm(table, row) {
  const s = SCHEMA[table];
  let isNew = !row;
  let current = { ...(row || {}) };
  let dirty = false;
  if (isNew) current.status = 'draft';

  const scrim = el('div', 'scrim');
  const panel = el('div', 'panel panel--form');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const head = el('div', 'panel__head');
  const ht = el('div', 'panel__title');
  ht.appendChild(el('span', 'panel__kicker', s.label));
  const h3 = el('h3', null, isNew ? (ADD_LABEL[table] || 'เพิ่มใหม่') : (row[s.title] || 'แก้ไข'));
  h3.id = 'formTitle';
  panel.setAttribute('aria-labelledby', 'formTitle');
  ht.appendChild(h3);
  const close = el('button', 'iconbtn-round');
  close.type = 'button';
  close.setAttribute('aria-label', 'ปิด');
  close.appendChild(icon('close'));
  head.append(ht, close);
  panel.appendChild(head);

  /* แถบสถานะ */
  const statusBar = el('div', 'statusbar');
  const statusHint = el('p', 'statusbar__hint', STATUS_HINT[current.status]);
  const statusSeg = segmented(STATUS.map((x) => ({ v: x.v, label: x.label })), current.status || 'draft', (v) => {
    statusHint.textContent = STATUS_HINT[v];
    statusSeg.dataset.state = v;
    save.textContent = SAVE_LABEL[v];
    markDirty();
  }, 'สถานะ', 'seg--status');
  statusSeg.dataset.state = current.status || 'draft';
  statusBar.append(statusSeg, statusHint);
  panel.appendChild(statusBar);

  const body = el('div', 'panel__body');
  panel.appendChild(body);
  const inputs = {};

  s.fields.filter((f) => f.type !== 'status').forEach((f) => {
    const id = 'f_' + f.k;
    const wrap = el('div', 'field' + (f.type === 'bool' ? ' field--switch' : '') + (f.type === 'drive' ? ' field--drive' : ''));
    const lab = el('label', null, f.label);
    lab.htmlFor = id;
    if (f.required) lab.appendChild(el('span', 'req', ' *'));

    let input;
    const v = current[f.k];
    if (f.type === 'textarea') { input = el('textarea'); input.value = v ?? ''; }
    else if (f.type === 'bool') { input = el('input'); input.type = 'checkbox'; input.checked = !!v; input.setAttribute('role', 'switch'); }
    else if (f.type === 'select') {
      input = el('select');
      input.appendChild(new Option('— เลือก —', ''));
      f.options.forEach((o) => input.appendChild(new Option(o, o)));
      input.value = v ?? '';
    } else if (f.type === 'number') { input = el('input'); input.type = 'number'; input.value = v ?? ''; }
    else if (f.type === 'date') { input = el('input'); input.type = 'date'; input.value = v ?? ''; }
    else { input = el('input'); input.type = 'text'; input.value = v ?? ''; }
    input.id = id;
    if (f.required) input.required = true;
    inputs[f.k] = input;
    input.addEventListener('input', markDirty);
    input.addEventListener('change', markDirty);

    if (f.type === 'bool') {
      const tx = el('div', 'switch__tx');
      tx.appendChild(lab);
      if (f.k === 'featured') tx.appendChild(el('span', 'hint', 'กิจกรรมที่ยังไม่ถึงวันขึ้นเว็บอยู่แล้ว · ปักหมุดเพื่อให้ขึ้นเป็นใบแรกในการ์ดใหญ่หน้าแรกและหน้ากิจกรรม'));
      const sw = el('span', 'switch');
      sw.append(input, el('span', 'switch__track'));
      wrap.append(tx, sw);
    } else if (f.type === 'drive') {
      wrap.appendChild(lab);
      /* รูปตัวอย่างใหญ่พอให้เห็นว่าเลือกรูปถูก — สัดส่วนตามที่หน้าเว็บใช้จริง */
      const prev = el('div', 'drive-prev' + (table === 'members' ? ' drive-prev--square' : ''));
      const img = el('img');
      img.referrerPolicy = 'no-referrer'; img.alt = '';
      const empty = el('span', 'drive-prev__empty');
      empty.append(icon('image'), el('span', null, 'ยังไม่มีรูป · วางลิงก์ Google Drive ด้านล่าง'));
      prev.append(img, empty);
      const show = (raw) => {
        const idv = driveId(raw);
        if (idv) { img.src = driveThumb(idv); prev.classList.add('has-img'); }
        else { img.removeAttribute('src'); prev.classList.remove('has-img'); }
      };
      img.addEventListener('error', () => prev.classList.remove('has-img'));
      show(v);
      input.placeholder = 'https://drive.google.com/file/d/…';
      input.addEventListener('input', () => show(input.value));
      wrap.append(prev, input,
        el('span', 'hint', f.hint || 'วางลิงก์ Drive ได้เลย ระบบดึงรหัสไฟล์ให้เอง · ไฟล์ต้องตั้งแชร์ "ทุกคนที่มีลิงก์"'));
    } else {
      wrap.append(lab, input);
      if (f.hint) wrap.appendChild(el('span', 'hint', f.hint));
    }
    body.appendChild(wrap);
  });

  const foot = el('div', 'panel__foot');
  const info = el('span', 'panel__info',
    !isNew && row.updated_by ? `แก้ไขล่าสุดโดย ${String(row.updated_by).split('@')[0]}` : '');
  const previewBtn = el('button', 'btn btn--ghost');
  previewBtn.type = 'button';
  previewBtn.append(el('span', null, 'บันทึกและดูตัวอย่าง'), icon('out'));
  const save = el('button', 'btn btn--primary', SAVE_LABEL[current.status] || 'บันทึก');
  save.type = 'button';
  foot.append(info, previewBtn, save);
  panel.appendChild(foot);

  function markDirty() {
    if (dirty) return;
    dirty = true;
    info.textContent = 'มีการแก้ไขที่ยังไม่บันทึก';
    info.classList.add('is-dirty');
  }

  const guard = { isDirty: () => dirty, discard: () => shut(true) };
  unsaved.add(guard);
  function shut(force) {
    if (dirty && !force && !confirm('ปิดโดยไม่บันทึก? การแก้ไขที่ทำไว้จะหายไป')) return;
    unsaved.delete(guard);
    closeLayer(scrim, panel);
    document.removeEventListener('keydown', keys);
  }
  function keys(e) {
    if (e.key === 'Escape') shut();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!e.repeat) submit(false);
    }
  }
  close.addEventListener('click', () => shut());
  scrim.addEventListener('click', () => shut());
  document.addEventListener('keydown', keys);

  /* กันบันทึกซ้อน — ปุ่มบันทึก ปุ่มดูตัวอย่าง และ Ctrl/Cmd+S ใช้ล็อกเดียวกัน
     ไม่งั้นรายการใหม่ถูก insert สองแถวเมื่อกดติดกัน */
  let saving = false;
  async function submit(andPreview) {
    if (saving) return;
    const payload = { status: statusSeg.value };
    for (const f of s.fields) {
      if (f.type === 'status') continue;
      const i = inputs[f.k];
      let v = f.type === 'bool' ? i.checked : i.value.trim();
      if (f.type === 'drive') v = driveId(v);
      if (f.type === 'number') v = v === '' ? null : Number(v);
      if (v === '' && f.type !== 'bool') v = null;
      if (f.required && (v === null || v === '')) {
        toast(`กรุณากรอก "${f.label}"`, true);
        i.focus();
        return;
      }
      payload[f.k] = v;
    }

    /* เปิดแท็บไว้ก่อน "ระหว่างที่ยังอยู่ในจังหวะคลิก" ไม่งั้นเบราว์เซอร์จะบล็อกป๊อปอัป
       แล้วค่อยพาไปหน้าตัวอย่างเมื่อบันทึกเสร็จ */
    const win = andPreview ? window.open('about:blank', '_blank') : null;
    const busy = andPreview ? previewBtn : save;
    const oldText = busy.firstChild.textContent;
    saving = true;
    save.disabled = previewBtn.disabled = true;
    busy.firstChild.textContent = 'กำลังบันทึก…';

    const q = isNew
      ? db.from(table).insert(payload).select().single()
      : db.from(table).update(payload).eq('id', current.id).select().single();
    const { data, error } = await q;
    saving = false;
    save.disabled = previewBtn.disabled = false;
    busy.firstChild.textContent = oldText;

    if (error) {
      if (win) win.close();
      toast('บันทึกไม่สำเร็จ: ' + error.message, true);
      return;
    }
    const wasNew = isNew;
    current = data || { ...current, ...payload };
    isNew = false;
    dirty = false;
    info.classList.remove('is-dirty');
    info.textContent = 'บันทึกแล้ว · ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    h3.textContent = current[s.title] || h3.textContent;

    await refreshCounts();
    go(table);                                   // หน้ารายการข้างหลังอัปเดตตาม (ฟอร์มยังเปิดอยู่)
    if (andPreview) {
      const msg = payload.status === 'published' ? 'บันทึกแล้ว · หน้าเว็บจริงอัปเดตภายใน ~3 นาที' : 'บันทึกร่างแล้ว';
      if (win) {
        win.opener = null;
        win.location.href = previewUrl(table);
        toast(msg + ' · เปิดหน้าตัวอย่างในแท็บใหม่แล้ว');
      } else {
        /* เบราว์เซอร์บล็อกป๊อปอัป — ให้ลิงก์กดเปิดเองแทน ฟอร์มยังเปิดค้างไว้ */
        toastLink(msg, previewUrl(table), 'เปิดหน้าตัวอย่าง');
      }
    } else {
      shut(true);
      toast(payload.status === 'published'
        ? (wasNew ? 'เพิ่มและเผยแพร่แล้ว · ขึ้นเว็บภายใน ~3 นาที' : 'บันทึกแล้ว · ขึ้นเว็บภายใน ~3 นาที')
        : 'บันทึกแล้ว');
    }
  }
  save.addEventListener('click', () => submit(false));
  previewBtn.addEventListener('click', () => submit(true));

  document.body.append(scrim, panel);
  const first = body.querySelector('input:not([type=checkbox]),textarea,select');
  if (first) first.focus();
}

/* ── ตั้งค่าเว็บ ──
   เดิมโชว์ชื่อคีย์ดิบ ๆ (club_youtube, halal_map_url) ตอนนี้มีชื่อและคำอธิบายภาษาคน
   คีย์ใหม่ที่ยังไม่มีคำอธิบายยังแก้ได้ ไปอยู่กลุ่ม "อื่น ๆ" */
const PRAYER_METHODS = [
  ['2', 'ISNA — อเมริกาเหนือ (ค่าเริ่มต้นของเว็บ)'], ['3', 'Muslim World League'], ['4', 'Umm al-Qura, Makkah'],
  ['5', 'Egyptian General Authority'], ['1', 'University of Islamic Sciences, Karachi'],
  ['11', 'Majlis Ugama Islam Singapura'], ['17', 'JAKIM (มาเลเซีย)'], ['20', 'KEMENAG (อินโดนีเซีย)'],
];
const SETTINGS_META = {
  club_email:     { g: 'ช่องทางติดต่อ', label: 'อีเมลชมรม', hint: 'แสดงในหน้าเกี่ยวกับเราและท้ายเว็บ' },
  club_facebook:  { g: 'ช่องทางติดต่อ', label: 'Facebook', hint: 'ลิงก์เพจแบบเต็ม เช่น https://facebook.com/…' },
  club_instagram: { g: 'ช่องทางติดต่อ', label: 'Instagram', hint: 'ลิงก์โปรไฟล์แบบเต็ม' },
  club_line:      { g: 'ช่องทางติดต่อ', label: 'LINE', hint: 'ใส่ @ไอดี หรือลิงก์ line.me ก็ได้' },
  club_youtube:   { g: 'ช่องทางติดต่อ', label: 'YouTube', hint: 'ลิงก์ช่อง เช่น https://www.youtube.com/@muslimcmu' },
  halal_map_url:  { g: 'แผนที่', label: 'แผนที่ฮาลาล', hint: 'ลิงก์ฝัง (embed) ของ Google My Maps ที่แสดงในหน้าสถานที่ฮาลาล' },
  map_embed_url:  { g: 'แผนที่', label: 'แผนที่ที่ตั้งชมรม', hint: 'ลิงก์ฝังของ Google Maps ในหน้าเกี่ยวกับเรา · เว้นว่างได้' },
  prayer_method:  { g: 'เวลาละหมาด', label: 'วิธีคำนวณเวลาละหมาด', type: 'select', options: PRAYER_METHODS,
                    hint: 'เปลี่ยนแล้วเวลาบนหน้าแรกจะเปลี่ยนตาม · ถ้าไม่แน่ใจให้คงค่าเดิม' },
  about_hero_id:  { g: 'รูปภาพ', label: 'รูปหัวหน้าเกี่ยวกับเรา', type: 'drive' },
  logo_id:        { g: 'รูปภาพ', label: 'โลโก้', type: 'drive', hint: 'เว้นว่างไว้ = ใช้โลโก้เดิมของเว็บ' },
};
const SETTINGS_GROUPS = ['ช่องทางติดต่อ', 'แผนที่', 'เวลาละหมาด', 'รูปภาพ', 'อื่น ๆ'];

async function renderSettings(main) {
  const { data, error } = await db.from('settings').select('*').order('key');
  if (error) throw error;
  clear(main);
  main.appendChild(pageHead('ตั้งค่าเว็บ', 'ข้อมูลที่ใช้ร่วมกันทุกหน้า เช่น ช่องทางติดต่อและแผนที่', previewLink('settings', 'ดูหน้าเว็บ')));

  const orig = {}, inputs = {};
  data.forEach((r) => { orig[r.key] = r.value ?? ''; });

  const wrap = el('div', 'settings');
  SETTINGS_GROUPS.forEach((g) => {
    const rows = data.filter((r) => ((SETTINGS_META[r.key] || {}).g || 'อื่น ๆ') === g);
    if (!rows.length) return;
    const sec = el('section', 'set-card');
    sec.appendChild(el('h3', null, g));
    rows.forEach((r) => {
      const m = SETTINGS_META[r.key] || { label: r.key };
      const id = 's_' + r.key;
      const line = el('div', 'set-row');
      const tx = el('div', 'set-row__tx');
      const lab = el('label', null, m.label); lab.htmlFor = id;
      tx.appendChild(lab);
      if (m.hint) tx.appendChild(el('span', 'hint', m.hint));
      const field = el('div', 'set-row__in');
      let i;
      if (m.type === 'select') {
        i = el('select');
        const opts = m.options.slice();
        if (orig[r.key] && !opts.some(([v]) => v === orig[r.key])) opts.push([orig[r.key], 'ค่าที่ตั้งไว้ (' + orig[r.key] + ')']);
        opts.forEach(([v, t]) => i.appendChild(new Option(t, v)));
      } else { i = el('input'); i.type = 'text'; }
      i.id = id; i.value = orig[r.key];
      field.appendChild(i);
      if (m.type === 'drive') {
        const pv = el('img', 'set-row__img');
        pv.referrerPolicy = 'no-referrer'; pv.alt = '';
        const upd = () => { const v = driveId(i.value); if (v) { pv.src = driveThumb(v); pv.hidden = false; } else pv.hidden = true; };
        i.addEventListener('input', upd); upd();
        field.prepend(pv);
      }
      inputs[r.key] = i;
      i.addEventListener('input', sync); i.addEventListener('change', sync);
      line.append(tx, field);
      sec.appendChild(line);
    });
    wrap.appendChild(sec);
  });
  main.appendChild(wrap);

  /* แถบบันทึกลอยล่างจอ โผล่เฉพาะตอนมีของที่ยังไม่บันทึก */
  const bar = el('div', 'savebar');
  const msg = el('span', 'savebar__msg');
  const reset = el('button', 'btn btn--ghost btn--sm', 'ยกเลิกการแก้ไข');
  const save = el('button', 'btn btn--primary btn--sm', 'บันทึก');
  bar.append(msg, reset, save);
  main.appendChild(bar);

  const changed = () => Object.keys(inputs).filter((k) => inputs[k].value.trim() !== orig[k]);
  /* ผูกกับหน้านี้ (page:true) — go() ถอดออกเองเมื่อออกจากหน้า */
  const guard = { page: true, isDirty: () => changed().length > 0, discard: () => unsaved.delete(guard) };
  unsaved.add(guard);
  function sync() {
    const n = changed().length;
    bar.classList.toggle('is-on', n > 0);
    msg.textContent = `แก้ไข ${n} ช่อง ยังไม่ได้บันทึก`;
  }
  reset.addEventListener('click', () => {
    Object.keys(inputs).forEach((k) => { inputs[k].value = orig[k]; inputs[k].dispatchEvent(new Event('input')); });
    sync();
  });
  /* ตรวจก่อนบันทึก: ลิงก์ต้องเป็น https:// (หน้าเว็บจะไม่ใช้ลิงก์แบบอื่นอยู่แล้ว) และอีเมลต้องเป็นรูปแบบอีเมล */
  function invalid(key, v) {
    if (!v) return '';
    if (key === 'club_email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'อีเมลไม่ถูกต้อง';
    if (key === 'club_line') return /^@[\w.-]+$/.test(v) || /^https:\/\/\S+$/i.test(v) ? '' : 'ใส่ @ไอดี หรือลิงก์ที่ขึ้นต้นด้วย https://';
    if (/^club_|_url$/.test(key)) return /^https:\/\/\S+$/i.test(v) ? '' : 'ลิงก์ต้องขึ้นต้นด้วย https://';
    return '';
  }
  save.addEventListener('click', async () => {
    const keys = changed();
    if (!keys.length) return;
    for (const k of keys) {
      const why = invalid(k, inputs[k].value.trim());
      if (why) {
        toast(`${(SETTINGS_META[k] || {}).label || k}: ${why}`, true);
        inputs[k].focus();
        return;
      }
    }
    save.disabled = true;
    const rows = keys.map((key) => ({ key, value: inputs[key].value.trim() }));
    const { error: e2 } = await db.from('settings').upsert(rows, { onConflict: 'key' });
    save.disabled = false;
    if (e2) { toast('บันทึกไม่สำเร็จ: ' + e2.message, true); return; }
    rows.forEach((r) => { orig[r.key] = r.value; });
    sync();
    toast('บันทึกแล้ว · ขึ้นเว็บภายใน ~3 นาที');
  });
}

/* ── ผู้ดูแลระบบ ── */
async function renderAdmins(main) {
  const { data, error } = await db.from('admins').select('*').order('role').order('created_at');
  if (error) throw error;
  clear(main);
  const owners = data.filter((r) => r.role === 'owner');
  main.appendChild(pageHead('ผู้ดูแลระบบ',
    `${data.length} คน · เฉพาะอีเมลในรายชื่อนี้เท่านั้นที่เข้าหลังบ้านได้`));

  /* อธิบายระดับสิทธิ์ไว้ตรงนี้เลย คนใหม่จะได้ไม่ต้องเดา */
  const legend = el('div', 'role-legend');
  [['owner', 'เจ้าของระบบ', 'แก้เนื้อหาได้ทั้งหมด และเพิ่ม ถอด หรือเปลี่ยนสิทธิ์คนอื่นได้'],
   ['editor', 'ผู้แก้ไข', 'แก้เนื้อหาได้ทั้งหมด แต่แตะรายชื่อผู้ดูแลไม่ได้']].forEach(([k, t, d]) => {
    const it = el('div', 'role-legend__item');
    it.append(el('span', 'tag tag--' + k, t), el('span', null, d));
    legend.appendChild(it);
  });
  main.appendChild(legend);

  if (isOwner()) {
    const form = el('form', 'invite');
    form.appendChild(el('h3', null, 'เพิ่มผู้ดูแล'));
    const row = el('div', 'invite__row');
    const em = el('input'); em.type = 'email'; em.placeholder = 'อีเมล Google'; em.required = true;
    em.setAttribute('aria-label', 'อีเมล Google ของคนใหม่');
    const nm = el('input'); nm.type = 'text'; nm.placeholder = 'ชื่อ (ไม่บังคับ)';
    nm.setAttribute('aria-label', 'ชื่อ');
    /* ค่าเริ่มต้นคือสิทธิ์น้อยที่สุดเสมอ */
    const rl = segmented(ROLES.map((x) => ({ v: x.v, label: x.label })), 'editor', () => {}, 'ระดับสิทธิ์');
    const add = el('button', 'btn btn--primary', 'เพิ่ม');
    add.type = 'submit';
    row.append(em, nm, rl, add);
    form.appendChild(row);
    form.appendChild(el('span', 'hint', 'คนที่เพิ่มเข้าสู่ระบบด้วยบัญชี Google ของอีเมลนี้ได้ทันที'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = em.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('อีเมลไม่ถูกต้อง', true); return; }
      add.disabled = true;
      const { error: e2 } = await db.from('admins').insert({ email, name: nm.value.trim() || null, role: rl.value });
      add.disabled = false;
      toast(e2 ? 'เพิ่มไม่สำเร็จ: ' + e2.message : 'เพิ่ม ' + email + ' แล้ว', !!e2);
      if (!e2) go('admins');
    });
    main.appendChild(form);
  } else {
    main.appendChild(el('div', 'notice',
      'คุณเป็น "ผู้แก้ไข" จึงดูรายชื่อได้อย่างเดียว · ต้องการเพิ่มหรือถอดใครให้บอกเจ้าของระบบ: '
      + (owners.map((o) => o.email).join(', ') || 'ยังไม่มีเจ้าของระบบ')));
  }

  const grid = el('div', 'people');
  data.forEach((r) => {
    const c = el('div', 'person' + (r.email === me.email ? ' is-me' : ''));
    const who = r.name || r.email.split('@')[0];
    c.appendChild(el('span', 'person__av person__av--' + r.role, who.charAt(0).toUpperCase()));
    const tx = el('div', 'person__tx');
    const nmLine = el('b', null, who);
    if (r.email === me.email) nmLine.appendChild(el('span', 'tag tag--you', 'คุณ'));
    tx.append(nmLine, el('span', null, r.email), el('span', 'person__since', 'เพิ่มเมื่อ ' + fmtDate(r.created_at)));
    c.appendChild(tx);

    const acts = el('div', 'person__acts');
    if (isOwner()) {
      const sel = el('select', 'rolesel');
      sel.setAttribute('aria-label', 'ระดับสิทธิ์ของ ' + r.email);
      ROLES.forEach((x) => sel.appendChild(new Option(x.label, x.v)));
      sel.value = r.role;
      sel.addEventListener('change', async () => {
        const to = sel.value;
        if (r.role === 'owner' && to !== 'owner' && owners.length < 2) {
          toast('ต้องเหลือเจ้าของระบบอย่างน้อย 1 คน — ตั้งคนใหม่เป็นเจ้าของก่อน', true);
          sel.value = r.role; return;
        }
        if (r.email === me.email && to !== 'owner'
            && !confirm('ลดสิทธิ์ตัวเองเป็น "ผู้แก้ไข"? หลังจากนี้คุณจะเพิ่มหรือถอดผู้ดูแลไม่ได้อีก')) {
          sel.value = r.role; return;
        }
        const { error: e4 } = await db.from('admins').update({ role: to }).eq('email', r.email);
        toast(e4 ? 'เปลี่ยนไม่สำเร็จ: ' + e4.message : 'เปลี่ยนเป็น ' + ROLE_TH[to] + ' แล้ว', !!e4);
        if (e4) sel.value = r.role; else go('admins');
      });
      acts.appendChild(sel);
      if (r.email !== me.email) {
        const del = el('button', 'iconbtn-round iconbtn-round--danger');
        del.type = 'button';
        del.title = 'ถอดสิทธิ์'; del.setAttribute('aria-label', 'ถอดสิทธิ์ ' + r.email);
        del.appendChild(icon('trash'));
        del.addEventListener('click', async () => {
          if (r.role === 'owner' && owners.length < 2) { toast('ถอดเจ้าของระบบคนสุดท้ายไม่ได้', true); return; }
          if (!confirm(`ถอดสิทธิ์ ${r.email} ออกจากระบบหลังบ้าน?`)) return;
          const { error: e3 } = await db.from('admins').delete().eq('email', r.email);
          toast(e3 ? 'ไม่สำเร็จ: ' + e3.message : 'ถอดสิทธิ์แล้ว', !!e3);
          if (!e3) go('admins');
        });
        acts.appendChild(del);
      }
    } else {
      acts.appendChild(el('span', 'tag tag--' + r.role, ROLE_TH[r.role] || r.role));
    }
    c.appendChild(acts);
    grid.appendChild(c);
  });
  main.appendChild(grid);
}

/* ── ประวัติการแก้ไข ──
   จัดกลุ่มตามวัน อ่านไล่ลงมาเหมือนไทม์ไลน์ · ชื่อช่องที่เปลี่ยนแปลงเป็นภาษาคน */
const FIELD_TH = Object.values(SCHEMA).reduce((m, s) => {
  s.fields.forEach((f) => { m[f.k] = f.label; });
  return m;
}, { updated_by: 'ผู้แก้ไข', role: 'ระดับสิทธิ์', value: 'ค่า', name: 'ชื่อ' });
const TABLE_TH = { ...Object.fromEntries(Object.entries(SCHEMA).map(([k, s]) => [k, s.label])),
  settings: 'ตั้งค่าเว็บ', admins: 'ผู้ดูแลระบบ', album_photos: 'รูปในอัลบั้ม' };

async function renderAudit(main) {
  const { data, error } = await db.from('audit_log')
    .select('*').order('at', { ascending: false }).limit(200);
  if (error) throw error;
  clear(main);
  main.appendChild(pageHead('ประวัติการแก้ไข', 'บันทึกอัตโนมัติจากฐานข้อมูล แก้ไขหรือลบไม่ได้ · 200 รายการล่าสุด'));

  const tables = [...new Set(data.map((r) => r.table_name))];
  const st = { t: '' };
  const filters = el('div', 'filters');
  filters.appendChild(segmented(
    [{ v: '', label: 'ทั้งหมด', count: data.length }]
      .concat(tables.map((t) => ({ v: t, label: TABLE_TH[t] || t, count: data.filter((r) => r.table_name === t).length }))),
    '', (v) => { st.t = v; draw(); }, 'กรองตามหมวด', 'seg--wrap'));
  main.appendChild(filters);

  const box = el('div', 'timeline');
  main.appendChild(box);

  const dayKey = (iso) => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  function dayTitle(k) {
    if (k === bkkDay()) return 'วันนี้';
    if (k === bkkDay(1)) return 'เมื่อวาน';
    return dayLabel(k, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function draw() {
    clear(box);
    const rows = data.filter((r) => !st.t || r.table_name === st.t);
    if (!rows.length) {
      const e = el('div', 'empty-state');
      e.append(el('b', null, 'ยังไม่มีประวัติ'), el('span', null, 'ทุกการเพิ่ม แก้ไข และลบจะถูกบันทึกไว้ที่นี่โดยอัตโนมัติ'));
      box.appendChild(e);
      return;
    }
    let lastDay = '', list = null;
    rows.forEach((r) => {
      const k = dayKey(r.at);
      if (k !== lastDay) {
        lastDay = k;
        const g = el('section', 'tl-day');
        g.appendChild(el('h3', 'tl-day__h', dayTitle(k)));
        list = el('ul', 'feed tl-list');
        g.appendChild(list);
        box.appendChild(g);
      }
      const who = String(r.actor || '—').split('@')[0];
      const li = el('li', 'feed__item');
      li.appendChild(el('span', 'feed__av feed__av--' + (r.action || 'update'), who.charAt(0).toUpperCase()));
      const b = el('div', 'feed__body');
      const line = el('p', 'feed__line');
      line.append(el('b', null, who), document.createTextNode(' ' + (ACTION_TH[r.action] || r.action) + ' '),
                  el('span', 'feed__where', TABLE_TH[r.table_name] || r.table_name));
      /* ตั้งค่าเว็บเก็บ summary เป็นชื่อคีย์ (club_youtube) — แปลงเป็นชื่อที่หน้าตั้งค่าใช้ */
      const what = r.table_name === 'settings' && SETTINGS_META[r.summary] ? SETTINGS_META[r.summary].label : r.summary;
      b.append(line, el('p', 'feed__what', what || '—'));
      const keys = r.changed ? Object.keys(r.changed).filter((x) => !['updated_at', 'updated_by', 'id'].includes(x)) : [];
      if (keys.length) {
        const chips = el('div', 'tl-chips');
        keys.slice(0, 6).forEach((x) => chips.appendChild(el('span', 'tl-chip', FIELD_TH[x] || x)));
        if (keys.length > 6) chips.appendChild(el('span', 'tl-chip', '+' + (keys.length - 6)));
        b.appendChild(chips);
      }
      const t = el('time', 'feed__time', new Date(r.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
      t.dateTime = r.at;
      li.append(b, t);
      list.appendChild(li);
    });
  }
  draw();
}

/* เริ่มทำงาน — และตอบสนองตอนกลับมาจากหน้าล็อกอินของ Google */
/* เลื่อน boot ออกไปนอก callback — supabase-js ค้างได้ถ้าเรียก db.* ซ้อนใน onAuthStateChange */
db.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') setTimeout(boot, 0); });
boot();
