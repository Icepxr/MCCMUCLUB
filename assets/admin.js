/* ============================================================
   MCCMU — ระบบหลังบ้าน

   เบราว์เซอร์คุยกับ Supabase โดยตรง ไม่มี API ตรงกลาง
   ความปลอดภัยอยู่ที่ Row Level Security ในฐานข้อมูล:
     • คนทั่วไปอ่านได้เฉพาะแถวที่ status = 'published'
     • คนที่อีเมลอยู่ในตาราง admins เท่านั้นที่แก้ไขได้
   ต่อให้มีคนเปิดหน้านี้ได้ ก็ทำอะไรไม่ได้ถ้าไม่อยู่ในตาราง admins

   ส่งต่อรุ่น: เพิ่ม/ลบอีเมลในหน้า "ผู้ดูแลระบบ" ไม่ต้องแก้โค้ด
   ============================================================ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/admin/config.js';

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

const SCHEMA = {
  activities: {
    label: 'กิจกรรม', title: 'title_th', order: 'date.desc',
    cols: [['cover_id', 'รูป', 'img'], ['title_th', 'ชื่อกิจกรรม'], ['date', 'วันที่'], ['status', 'สถานะ', 'status']],
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
    label: 'อัลบั้มภาพ', title: 'title', order: 'date.desc',
    cols: [['cover_id', 'ปก', 'img'], ['title', 'ชื่ออัลบั้ม'], ['date', 'วันที่'], ['status', 'สถานะ', 'status']],
    fields: [
      { k: 'title', label: 'ชื่ออัลบั้ม', type: 'text', required: true },
      { k: 'date', label: 'วันที่', type: 'date' },
      { k: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { k: 'folder_id', label: 'โฟลเดอร์รูป', type: 'drive', hint: 'วางลิงก์โฟลเดอร์ Drive ที่ตั้งแชร์ "ทุกคนที่มีลิงก์" แล้ว' },
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

/* ดึง Drive id จากลิงก์เต็ม — ให้แอดมินวางลิงก์ได้เลย ไม่ต้องหา id เอง */
const driveId = (s) => {
  const m = String(s || '').trim().match(/[-\w]{25,}/);
  return m ? m[0] : String(s || '').trim();
};
const driveThumb = (id) => (id ? `https://drive.google.com/thumbnail?id=${driveId(id)}&sz=w200` : '');

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
   ล็อกอิน
   ══════════════════════════════════════════════════════════════ */
$('#btnLogin').addEventListener('click', async () => {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + '/admin' },
  });
  if (error) showLoginError(error.message);
});

$('#btnLogout').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

function showLoginError(msg) {
  const box = $('#loginMsg');
  clear(box);
  box.appendChild(el('div', 'alert', msg));
}

async function boot() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;                       // ยังไม่ล็อกอิน → คงหน้า login ไว้

  /* เช็คสิทธิ์จากฐานข้อมูลจริง ไม่ใช่เชื่อ token ฝั่งเบราว์เซอร์
     RLS ทำให้คนที่ไม่ใช่ผู้ดูแลอ่านตาราง admins ได้ผลลัพธ์ว่าง */
  const email = (session.user.email || '').toLowerCase();
  const { data: rows, error } = await db.from('admins').select('email').eq('email', email);
  if (error) { showLoginError('ตรวจสอบสิทธิ์ไม่สำเร็จ: ' + error.message); return; }
  if (!rows || !rows.length) {
    showLoginError(`บัญชี ${email} ยังไม่มีสิทธิ์เข้าระบบ — ให้ผู้ดูแลคนปัจจุบันเพิ่มอีเมลนี้ในหน้า "ผู้ดูแลระบบ"`);
    await db.auth.signOut();
    return;
  }

  me = { email, name: session.user.user_metadata?.full_name || email,
         avatar: session.user.user_metadata?.avatar_url || '' };
  $('#meName').textContent = me.name;
  $('#meEmail').textContent = me.email;
  if (me.avatar) $('#meAvatar').src = me.avatar;

  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  buildNav();
  await refreshCounts();
  go('overview');
}

/* ══════════════════════════════════════════════════════════════
   เมนูข้าง
   ══════════════════════════════════════════════════════════════ */
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
  b.appendChild(el('span', null, label));
  if (withCount) { const n = el('span', 'count'); n.dataset.count = id; b.appendChild(n); }
  b.dataset.view = id;
  b.addEventListener('click', () => go(id));
  return b;
}
function markActive() {
  document.querySelectorAll('.navbtn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.view === view));
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
async function go(v) {
  view = v; markActive();
  const main = $('#main'); clear(main);
  main.appendChild(el('p', null, 'กำลังโหลด…'));
  try {
    if (v === 'overview') await renderOverview(main);
    else if (v === 'settings') await renderSettings(main);
    else if (v === 'admins') await renderAdmins(main);
    else if (v === 'audit') await renderAudit(main);
    else await renderList(main, v);
  } catch (err) {
    clear(main);
    main.appendChild(el('div', 'alert', 'โหลดข้อมูลไม่สำเร็จ: ' + err.message));
  }
}

/* ── ภาพรวม ── */
const PAGE_TH = {
  '/': 'หน้าแรก', '/activities.html': 'กิจกรรม', '/halal-map.html': 'สถานที่ฮาลาล',
  '/knowledge.html': 'คลังความรู้', '/about.html': 'เกี่ยวกับเรา', '/admin': 'หลังบ้าน',
};
const thDay = (d) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

async function renderOverview(main) {
  clear(main);
  const head = el('div', 'head');
  head.appendChild(el('h2', null, `สวัสดี ${me.name.split(' ')[0]}`));
  main.appendChild(head);
  const site = el('a', 'btn btn--ghost', 'เปิดหน้าเว็บ ↗');
  site.href = '/?fresh'; site.target = '_blank'; site.rel = 'noopener';
  head.appendChild(site);
  main.appendChild(el('p', 'sub',
    'เลือกหัวข้อจากเมนูซ้ายเพื่อแก้ไขข้อมูล · ของที่แก้จะขึ้นหน้าเว็บภายใน ~3 นาที '
    + 'กด "เปิดหน้าเว็บ" เพื่อดูของล่าสุดทันทีโดยข้าม cache ในเครื่อง'));

  const stack = el('div', 'stack');
  main.appendChild(stack);

  /* แถวบน: สถิติผู้เข้าชม + หน้ายอดนิยม */
  const two = el('div', 'two-col');
  const visits = el('div', 'panel-card');
  const top = el('div', 'panel-card');
  two.append(visits, top);
  stack.appendChild(two);
  await renderVisits(visits, top);

  /* การ์ดนับเนื้อหา */
  const tiles = el('div', 'tiles');
  Object.entries(SCHEMA).forEach(([k, s]) => {
    const t = el('button', 'tile');
    t.appendChild(el('b', null, String(counts[k] ?? 0)));
    t.appendChild(el('span', null, s.label));
    t.addEventListener('click', () => go(k));
    tiles.appendChild(t);
  });
  stack.appendChild(tiles);

  /* แก้ไขล่าสุด */
  const { data } = await db.from('audit_log')
    .select('at,actor,action,table_name,summary').order('at', { ascending: false }).limit(8);
  if (data?.length) {
    const card = el('div', 'panel-card');
    const h = el('div', 'panel-card__head');
    h.appendChild(el('h3', null, 'แก้ไขล่าสุด'));
    const more = el('button', 'linkbtn note', 'ดูทั้งหมด');
    more.style.color = 'var(--grape-600)';
    more.addEventListener('click', () => go('audit'));
    h.appendChild(more);
    card.appendChild(h);

    const wrap = el('div', 'tablewrap'); const tb = el('table');
    const th = el('thead'); const hr = el('tr');
    ['เมื่อไหร่', 'ใคร', 'ทำอะไร', 'รายการ'].forEach((x) => hr.appendChild(el('th', null, x)));
    th.appendChild(hr); tb.appendChild(th);
    const body = el('tbody');
    data.forEach((r) => {
      const tr = el('tr');
      tr.appendChild(el('td', null, new Date(r.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })));
      tr.appendChild(el('td', null, r.actor || '—'));
      tr.appendChild(el('td', null, ACTION_TH[r.action] || r.action));
      tr.appendChild(el('td', 'title', r.summary || '—'));
      body.appendChild(tr);
    });
    tb.appendChild(body); wrap.appendChild(tb); card.appendChild(wrap);
    stack.appendChild(card);
  }
}

/* สถิติผู้เข้าชม 14 วันล่าสุด */
async function renderVisits(box, topBox) {
  const from = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await db.from('page_stats')
    .select('day,path,views,visitors').gte('day', from).order('day');

  const head = el('div', 'panel-card__head');
  head.appendChild(el('h3', null, 'ผู้เข้าชมเว็บ'));
  head.appendChild(el('span', 'note', '14 วันล่าสุด'));
  box.appendChild(head);

  if (error) {
    box.appendChild(el('div', 'chart-empty',
      'ยังเปิดใช้สถิติไม่ได้ — ต้องรัน supabase/migrations/0004_page_stats.sql ก่อน'));
    topBox.appendChild(el('div', 'panel-card__head')).appendChild(el('h3', null, 'หน้ายอดนิยม'));
    topBox.appendChild(el('div', 'chart-empty', 'ยังไม่มีข้อมูล'));
    return;
  }

  /* รวมยอดรายวัน */
  const byDay = new Map();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    byDay.set(d, { views: 0, visitors: 0 });
  }
  (data || []).forEach((r) => {
    const e = byDay.get(r.day);
    if (e) { e.views += r.views; e.visitors += r.visitors; }
  });
  const days = [...byDay.entries()];
  const todayKey = days[days.length - 1][0];

  const sum = (arr, k) => arr.reduce((a, [, v]) => a + v[k], 0);
  const last7 = days.slice(-7), prev7 = days.slice(-14, -7);
  const v7 = sum(last7, 'visitors'), vPrev = sum(prev7, 'visitors');
  const delta = vPrev ? Math.round(((v7 - vPrev) / vPrev) * 100) : null;

  const kpis = el('div', 'kpis');
  const kpi = (n, label, extra) => {
    const k = el('div', 'kpi');
    k.appendChild(el('b', null, n.toLocaleString('th-TH')));
    k.appendChild(el('span', null, label));
    if (extra) k.appendChild(extra);
    return k;
  };
  kpis.appendChild(kpi(byDay.get(todayKey).visitors, 'ผู้เข้าชมวันนี้'));
  const wk = kpi(v7, 'ผู้เข้าชม 7 วัน');
  if (delta !== null) {
    wk.appendChild(el('em', delta >= 0 ? 'up' : 'down',
      (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% จากสัปดาห์ก่อน'));
  }
  kpis.appendChild(wk);
  kpis.appendChild(kpi(sum(days, 'views'), 'เปิดหน้าเว็บรวม 14 วัน'));
  box.appendChild(kpis);

  const max = Math.max(1, ...days.map(([, v]) => v.views));
  if (!sum(days, 'views')) {
    box.appendChild(el('div', 'chart-empty',
      'ยังไม่มีคนเข้าชมในช่วง 14 วันนี้ — ตัวเลขจะเริ่มขึ้นหลังมีคนเปิดเว็บ'));
  } else {
    box.appendChild(barChart(days, max, todayKey));
  }

  /* หน้ายอดนิยม */
  const th2 = el('div', 'panel-card__head');
  th2.appendChild(el('h3', null, 'หน้ายอดนิยม'));
  th2.appendChild(el('span', 'note', '14 วันล่าสุด'));
  topBox.appendChild(th2);

  const byPath = new Map();
  (data || []).forEach((r) => byPath.set(r.path, (byPath.get(r.path) || 0) + r.views));
  const list = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!list.length) {
    topBox.appendChild(el('div', 'chart-empty', 'ยังไม่มีข้อมูล'));
    return;
  }
  const top = list[0][1];
  const wrap = el('div', 'toplist');
  list.forEach(([path, n]) => {
    const row = el('div', 'toprow');
    row.appendChild(el('span', 'nm', PAGE_TH[path] || path));
    const track = el('span', 'track');
    const fill = el('span', 'fill');
    fill.style.width = Math.max(4, Math.round((n / top) * 100)) + '%';
    track.appendChild(fill);
    row.appendChild(track);
    row.appendChild(el('span', 'n', n.toLocaleString('th-TH')));
    wrap.appendChild(row);
  });
  topBox.appendChild(wrap);
}

/* กราฟแท่ง SVG — ไม่ใช้ไลบรารีภายนอก */
function barChart(days, max, todayKey) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 100, H = 100, gap = 1.4;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 10}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label',
    `กราฟผู้เข้าชม ${days.length} วัน สูงสุด ${max} ครั้งต่อวัน`);

  [0, 0.5, 1].forEach((f) => {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('class', 'grid');
    l.setAttribute('x1', 0); l.setAttribute('x2', W);
    l.setAttribute('y1', H * f); l.setAttribute('y2', H * f);
    l.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(l);
  });

  const bw = (W - gap * (days.length - 1)) / days.length;
  days.forEach(([day, v], i) => {
    const h = Math.max(v.views ? 2 : 0, (v.views / max) * H);
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('class', 'bar' + (day === todayKey ? ' today' : ''));
    r.setAttribute('x', i * (bw + gap));
    r.setAttribute('y', H - h);
    r.setAttribute('width', bw);
    r.setAttribute('height', h);
    r.setAttribute('rx', 0.8);
    const t = document.createElementNS(NS, 'title');
    t.textContent = `${thDay(day)} · เปิด ${v.views} ครั้ง · ผู้เข้าชม ${v.visitors} คน`;
    r.appendChild(t);
    svg.appendChild(r);
  });

  [0, days.length - 1].forEach((i) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'lbl');
    t.setAttribute('x', i === 0 ? 0 : W);
    t.setAttribute('y', H + 8);
    t.setAttribute('text-anchor', i === 0 ? 'start' : 'end');
    t.textContent = thDay(days[i][0]);
    svg.appendChild(t);
  });
  return svg;
}
const ACTION_TH = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ' };

/* ── รายการ ── */
async function renderList(main, table) {
  const s = SCHEMA[table];
  const [col, dir] = s.order.split('.');
  const { data, error } = await db.from(table).select('*').order(col, { ascending: dir === 'asc' });
  if (error) throw error;

  clear(main);
  const head = el('div', 'head');
  head.appendChild(el('h2', null, s.label));
  const add = el('button', 'btn btn--primary', '+ เพิ่มใหม่');
  add.addEventListener('click', () => openForm(table, null));
  head.appendChild(add);
  main.appendChild(head);

  const tools = el('div', 'tools');
  const search = el('input'); search.type = 'search'; search.placeholder = 'ค้นหา…';
  const filter = el('select');
  filter.appendChild(new Option('ทุกสถานะ', ''));
  STATUS.forEach((x) => filter.appendChild(new Option(x.label, x.v)));
  tools.append(search, filter); main.appendChild(tools);

  const card = el('div', 'card'); const wrap = el('div', 'tablewrap');
  const tb = el('table'); const thead = el('thead'); const hr = el('tr');
  s.cols.forEach(([, label]) => hr.appendChild(el('th', null, label)));
  hr.appendChild(el('th', null, ''));
  thead.appendChild(hr); tb.appendChild(thead);
  const body = el('tbody'); tb.appendChild(body);
  wrap.appendChild(tb); card.appendChild(wrap); main.appendChild(card);

  function draw() {
    clear(body);
    const q = search.value.trim().toLowerCase();
    const st = filter.value;
    const rows = data.filter((r) =>
      (!st || r.status === st) &&
      (!q || String(r[s.title] || '').toLowerCase().includes(q)));
    if (!rows.length) {
      clear(card); card.appendChild(el('div', 'empty', 'ไม่มีรายการที่ตรงกับที่ค้นหา'));
      return;
    }
    if (!card.contains(wrap)) { clear(card); card.appendChild(wrap); }
    rows.forEach((r) => {
      const tr = el('tr');
      s.cols.forEach(([k, , kind]) => {
        const td = el('td');
        if (kind === 'img') {
          const im = el('img', 'thumb');
          im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.alt = '';
          if (r[k]) im.src = driveThumb(r[k]);
          td.appendChild(im);
        } else if (kind === 'status') {
          td.appendChild(el('span', 'tag tag--' + r[k], (STATUS.find((x) => x.v === r[k]) || {}).label || r[k]));
        } else if (k === 'date') {
          td.textContent = fmtDate(r[k]);
        } else {
          td.textContent = r[k] ?? '—';
          if (k === s.title) td.className = 'title';
        }
        tr.appendChild(td);
      });
      const act = el('td'); const box = el('div', 'rowacts');
      const edit = el('button', 'btn btn--ghost btn--sm', 'แก้ไข');
      edit.addEventListener('click', () => openForm(table, r));
      box.appendChild(edit); act.appendChild(box); tr.appendChild(act);
      body.appendChild(tr);
    });
  }
  search.addEventListener('input', draw);
  filter.addEventListener('change', draw);
  draw();
}

/* ── ฟอร์มเพิ่ม/แก้ไข ── */
function openForm(table, row) {
  const s = SCHEMA[table];
  const isNew = !row;
  const val = { ...(row || {}) };
  if (isNew) val.status = 'draft';

  const scrim = el('div', 'scrim');
  const panel = el('div', 'panel');
  const head = el('div', 'panel__head');
  head.appendChild(el('h3', null, (isNew ? 'เพิ่ม' : 'แก้ไข') + s.label));
  const close = el('button', 'btn btn--ghost btn--sm', 'ปิด');
  head.appendChild(close); panel.appendChild(head);

  const body = el('div', 'panel__body'); panel.appendChild(body);
  const inputs = {};

  s.fields.forEach((f) => {
    const wrap = el('div', f.type === 'bool' ? 'field check' : 'field');
    const id = 'f_' + f.k;
    const lab = el('label', null, f.label + (f.required ? ' *' : ''));
    lab.htmlFor = id;

    let input;
    if (f.type === 'textarea') { input = el('textarea'); input.value = val[f.k] ?? ''; }
    else if (f.type === 'bool') { input = el('input'); input.type = 'checkbox'; input.checked = !!val[f.k]; }
    else if (f.type === 'select') {
      input = el('select');
      input.appendChild(new Option('— เลือก —', ''));
      f.options.forEach((o) => input.appendChild(new Option(o, o)));
      input.value = val[f.k] ?? '';
    } else if (f.type === 'status') {
      input = el('select');
      STATUS.forEach((x) => input.appendChild(new Option(x.label, x.v)));
      input.value = val[f.k] ?? 'draft';
    } else if (f.type === 'number') { input = el('input'); input.type = 'number'; input.value = val[f.k] ?? ''; }
    else if (f.type === 'date') { input = el('input'); input.type = 'date'; input.value = val[f.k] ?? ''; }
    else { input = el('input'); input.type = 'text'; input.value = val[f.k] ?? ''; }
    input.id = id;
    inputs[f.k] = input;

    if (f.type === 'bool') { wrap.append(input, lab); }
    else if (f.type === 'drive') {
      wrap.appendChild(lab);
      const dv = el('div', 'drive');
      const prev = el('img', 'drive__prev');
      prev.referrerPolicy = 'no-referrer'; prev.alt = '';
      if (val[f.k]) prev.src = driveThumb(val[f.k]);
      const col = el('div', 'drive__in');
      col.appendChild(input);
      col.appendChild(el('span', 'hint', f.hint || 'วางลิงก์ Drive ได้เลย ระบบจะดึงรหัสไฟล์ให้เอง · ไฟล์ต้องตั้งแชร์ "ทุกคนที่มีลิงก์"'));
      input.addEventListener('input', () => {
        const id2 = driveId(input.value);
        if (id2) prev.src = driveThumb(id2); else prev.removeAttribute('src');
      });
      dv.append(prev, col); wrap.appendChild(dv);
    } else {
      wrap.appendChild(lab); wrap.appendChild(input);
      if (f.hint) wrap.appendChild(el('span', 'hint', f.hint));
    }
    body.appendChild(wrap);
  });

  if (!isNew && row.updated_by) {
    body.appendChild(el('span', 'hint', `แก้ไขล่าสุดโดย ${row.updated_by}`));
  }

  const foot = el('div', 'panel__foot');
  const cancel = el('button', 'btn btn--ghost', 'ยกเลิก');
  const save = el('button', 'btn btn--primary', 'บันทึก');
  foot.append(cancel, save); panel.appendChild(foot);

  function shut() { scrim.remove(); panel.remove(); document.removeEventListener('keydown', esc); }
  function esc(e) { if (e.key === 'Escape') shut(); }
  [close, cancel, scrim].forEach((n) => n.addEventListener('click', shut));
  document.addEventListener('keydown', esc);

  save.addEventListener('click', async () => {
    const payload = {};
    for (const f of s.fields) {
      const i = inputs[f.k];
      let v = f.type === 'bool' ? i.checked : i.value.trim();
      if (f.type === 'drive') v = driveId(v);
      if (f.type === 'number') v = v === '' ? null : Number(v);
      if (v === '' && f.type !== 'bool') v = null;
      if (f.required && (v === null || v === '')) {
        toast(`กรุณากรอก "${f.label}"`, true); i.focus(); return;
      }
      payload[f.k] = v;
    }
    save.disabled = true; save.textContent = 'กำลังบันทึก…';
    const q = isNew ? db.from(table).insert(payload) : db.from(table).update(payload).eq('id', row.id);
    const { error } = await q;
    save.disabled = false; save.textContent = 'บันทึก';
    if (error) { toast('บันทึกไม่สำเร็จ: ' + error.message, true); return; }
    shut();
    toast(isNew ? 'เพิ่มแล้ว' : 'บันทึกแล้ว');
    await refreshCounts();
    go(table);
  });

  document.body.append(scrim, panel);
  const first = body.querySelector('input,textarea,select');
  if (first) first.focus();
}

/* ── ตั้งค่าเว็บ ── */
async function renderSettings(main) {
  const { data, error } = await db.from('settings').select('*').order('key');
  if (error) throw error;
  clear(main);
  main.appendChild(el('div', 'head')).appendChild(el('h2', null, 'ตั้งค่าเว็บ'));
  main.appendChild(el('p', 'sub', 'ค่าเหล่านี้แสดงบนหน้าเว็บ เช่น อีเมลติดต่อและลิงก์โซเชียล'));

  const card = el('div', 'card');
  const box = el('div'); box.style.padding = '20px';
  const inputs = {};
  data.forEach((r) => {
    const w = el('div', 'field'); w.style.marginBottom = '14px';
    const lab = el('label', null, r.key); lab.htmlFor = 's_' + r.key;
    const i = el('input'); i.type = 'text'; i.value = r.value ?? ''; i.id = 's_' + r.key;
    inputs[r.key] = i;
    w.append(lab, i); box.appendChild(w);
  });
  const save = el('button', 'btn btn--primary', 'บันทึกทั้งหมด');
  save.addEventListener('click', async () => {
    save.disabled = true;
    const rows = Object.entries(inputs).map(([key, i]) => ({ key, value: i.value.trim() }));
    const { error: e2 } = await db.from('settings').upsert(rows, { onConflict: 'key' });
    save.disabled = false;
    toast(e2 ? 'บันทึกไม่สำเร็จ: ' + e2.message : 'บันทึกแล้ว', !!e2);
  });
  box.appendChild(save); card.appendChild(box); main.appendChild(card);
}

/* ── ผู้ดูแลระบบ ── */
async function renderAdmins(main) {
  const { data, error } = await db.from('admins').select('*').order('created_at');
  if (error) throw error;
  clear(main);
  const head = el('div', 'head'); head.appendChild(el('h2', null, 'ผู้ดูแลระบบ'));
  main.appendChild(head);
  main.appendChild(el('p', 'sub', 'คนที่อยู่ในรายการนี้เท่านั้นที่เข้าหลังบ้านได้ · ตอนเปลี่ยนรุ่นให้เพิ่มคนใหม่ก่อนแล้วค่อยลบคนเก่า'));

  const tools = el('div', 'tools');
  const em = el('input'); em.type = 'text'; em.placeholder = 'อีเมล Google ของคนใหม่';
  const nm = el('input'); nm.type = 'text'; nm.placeholder = 'ชื่อ (ไม่บังคับ)';
  const add = el('button', 'btn btn--primary', 'เพิ่ม');
  add.addEventListener('click', async () => {
    const email = em.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('อีเมลไม่ถูกต้อง', true); return; }
    const { error: e2 } = await db.from('admins').insert({ email, name: nm.value.trim() || null });
    toast(e2 ? 'เพิ่มไม่สำเร็จ: ' + e2.message : 'เพิ่มแล้ว', !!e2);
    if (!e2) go('admins');
  });
  tools.append(em, nm, add); main.appendChild(tools);

  const card = el('div', 'card'); const wrap = el('div', 'tablewrap'); const tb = el('table');
  const th = el('thead'); const hr = el('tr');
  ['อีเมล', 'ชื่อ', 'เพิ่มเมื่อ', ''].forEach((h) => hr.appendChild(el('th', null, h)));
  th.appendChild(hr); tb.appendChild(th);
  const body = el('tbody');
  data.forEach((r) => {
    const tr = el('tr');
    tr.appendChild(el('td', 'title', r.email));
    tr.appendChild(el('td', null, r.name || '—'));
    tr.appendChild(el('td', null, fmtDate(r.created_at)));
    const act = el('td'); const box = el('div', 'rowacts');
    if (r.email !== me.email) {
      const del = el('button', 'btn btn--ghost btn--sm', 'ถอดสิทธิ์');
      del.addEventListener('click', async () => {
        if (!confirm(`ถอดสิทธิ์ ${r.email} ออกจากระบบหลังบ้าน?`)) return;
        const { error: e3 } = await db.from('admins').delete().eq('email', r.email);
        toast(e3 ? 'ไม่สำเร็จ: ' + e3.message : 'ถอดสิทธิ์แล้ว', !!e3);
        if (!e3) go('admins');
      });
      box.appendChild(del);
    } else {
      box.appendChild(el('span', 'tag tag--published', 'คุณ'));
    }
    act.appendChild(box); tr.appendChild(act); body.appendChild(tr);
  });
  tb.appendChild(body); wrap.appendChild(tb); card.appendChild(wrap); main.appendChild(card);
}

/* ── ประวัติการแก้ไข ── */
async function renderAudit(main) {
  const { data, error } = await db.from('audit_log')
    .select('*').order('at', { ascending: false }).limit(200);
  if (error) throw error;
  clear(main);
  main.appendChild(el('div', 'head')).appendChild(el('h2', null, 'ประวัติการแก้ไข'));
  main.appendChild(el('p', 'sub', 'บันทึกอัตโนมัติจากฐานข้อมูล แก้ไขหรือลบไม่ได้ · แสดง 200 รายการล่าสุด'));

  if (!data.length) {
    const c = el('div', 'card'); c.appendChild(el('div', 'empty', 'ยังไม่มีประวัติ'));
    main.appendChild(c); return;
  }
  const card = el('div', 'card'); const wrap = el('div', 'tablewrap'); const tb = el('table');
  const th = el('thead'); const hr = el('tr');
  ['เมื่อไหร่', 'ใคร', 'ทำอะไร', 'ที่ไหน', 'รายการ', 'เปลี่ยนอะไร'].forEach((h) => hr.appendChild(el('th', null, h)));
  th.appendChild(hr); tb.appendChild(th);
  const body = el('tbody');
  data.forEach((r) => {
    const tr = el('tr');
    tr.appendChild(el('td', null, new Date(r.at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })));
    tr.appendChild(el('td', null, r.actor || '—'));
    tr.appendChild(el('td', null, ACTION_TH[r.action] || r.action));
    tr.appendChild(el('td', null, (SCHEMA[r.table_name] || {}).label || r.table_name));
    tr.appendChild(el('td', null, r.summary || '—'));
    tr.appendChild(el('td', null, r.changed ? Object.keys(r.changed).join(', ') : '—'));
    body.appendChild(tr);
  });
  tb.appendChild(body); wrap.appendChild(tb); card.appendChild(wrap); main.appendChild(card);
}

/* เริ่มทำงาน — และตอบสนองตอนกลับมาจากหน้าล็อกอินของ Google */
db.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') boot(); });
boot();
