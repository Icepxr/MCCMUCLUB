/**
 * ══════════════════════════════════════════════════════════════════
 *  Vercel Edge Function — แหล่งข้อมูลของหน้าเว็บ (edge-cached)
 *
 *  รองรับ 2 แหล่ง สลับได้ด้วย environment variable ตัวเดียว:
 *    DATA_SOURCE=sheets    (ค่าเริ่มต้น) → Google Apps Script + Sheets
 *    DATA_SOURCE=supabase                → Supabase (Postgres)
 *
 *  ทดสอบก่อนสลับจริงได้ด้วย ?src=supabase ต่อท้าย URL
 *  คนทั่วไปยังเห็นของเดิมจนกว่าจะเปลี่ยนค่า DATA_SOURCE
 *
 *  ถ้าสลับแล้วมีปัญหา: เปลี่ยน DATA_SOURCE กลับเป็น sheets แล้ว redeploy
 *  ใช้เวลาไม่ถึงนาที ไม่ต้องแก้โค้ด
 *
 *  ⚠️ รูปร่าง JSON ที่ส่งกลับต้องเหมือนกันทั้งสองแหล่ง
 *     ไม่งั้น assets/api.js ฝั่งหน้าเว็บจะพัง
 * ══════════════════════════════════════════════════════════════════ */
export const config = { runtime: 'edge' };

const APPS_SCRIPT = process.env.APPS_SCRIPT_URL
  || 'https://script.google.com/macros/s/AKfycbyS8PY6nJ4FmFYf4KS8chC4Jej3bZEnA5yPupDw0FvFavoWe1h5q1hJ1VuE_Ga-yKx5Ag/exec';
const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_ANON_KEY;
const DEFAULT_SOURCE = (process.env.DATA_SOURCE || 'sheets').toLowerCase();

const EDGE_TTL = 600;   // วินาที — ต้นทางถูกเรียกไม่เกิน 1 ครั้ง/10 นาที
const CACHE = `public, max-age=120, s-maxage=${EDGE_TTL}, stale-while-revalidate=60`;

/* ── ตัวช่วยสร้าง URL ของ Google Drive — ต้องตรงกับ backend/Code.gs เป๊ะ ── */
const driveId = (s) => {
  const m = String(s || '').trim().match(/[-\w]{25,}/);
  return m ? m[0] : String(s || '').trim();
};
const img = (id, w) => (id ? `https://drive.google.com/thumbnail?id=${driveId(id)}&sz=w${w}` : '');
const preview = (id) => (id ? `https://drive.google.com/file/d/${driveId(id)}/preview` : '');
const download = (id) => (id ? `https://drive.google.com/uc?export=download&id=${driveId(id)}` : '');

const json = (body, status = 200, cache = CACHE) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'access-control-allow-origin': '*',
    },
  });

/* ══════════════════════════════════════════════════════════════════
   แหล่งที่ 1 — Apps Script (ของเดิม ส่งต่อทั้งดุ้น)
   ══════════════════════════════════════════════════════════════════ */
async function fromSheets(search) {
  const res = await fetch(APPS_SCRIPT + search, { redirect: 'follow' });
  const body = await res.text();
  return new Response(body, {
    status: res.ok ? 200 : res.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': CACHE,
      'access-control-allow-origin': '*',
    },
  });
}

/* ══════════════════════════════════════════════════════════════════
   แหล่งที่ 2 — Supabase
   ══════════════════════════════════════════════════════════════════ */
async function sb(table, query = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`supabase ${table}: ${res.status}`);
  return res.json();
}

/* เติมฟิลด์ที่หน้าเว็บใช้ ให้เหมือนที่ Apps Script เคยสร้างให้ */
const shapeActivities = (rows) => rows.map((d) => ({ ...d, image_url: img(d.cover_id, 1200) }));
const shapeDocs = (rows) => rows.map((d) => ({
  ...d,
  view_url: preview(d.file_id),
  download_url: download(d.file_id),
  thumb_url: img(d.file_id, 800),
}));
const shapeMembers = (rows) => rows.map((d) => ({
  ...d,
  order: d.sort_order,                    // หน้าเว็บยังเรียกชื่อเดิมว่า order
  image_url: img(d.cover_id, 800),
}));
/* albums: photos เคยได้จากการไล่อ่านโฟลเดอร์ Drive ซึ่ง Supabase ทำแทนไม่ได้
   จะกลับมาครบตอนย้ายไฟล์เข้า Supabase Storage — ระหว่างนี้แสดงแค่รูปปก */
const shapeAlbums = (rows) => rows.map((d) => ({
  ...d, cover_url: img(d.cover_id, 1000), photos: [], count: 0,
}));

async function settingsFromSb() {
  const rows = await sb('settings', 'select=key,value');
  const out = {};
  rows.forEach((r) => { out[r.key] = r.value ?? ''; });
  /* คีย์ที่ลงท้าย _id จะมี _url คู่กันเสมอ — เหมือนที่ Apps Script ทำ */
  Object.keys({ ...out }).forEach((k) => {
    if (/_id$/.test(k) && out[k]) out[k.replace(/_id$/, '_url')] = img(out[k], 800);
  });
  return out;
}

/* เวลาละหมาด — เรียก aladhan เจ้าเดียวกับที่ Apps Script เรียก
   ต้องส่งคืนรูปร่างเดิมเป๊ะ: date/hijri เป็นข้อความ (หน้าเว็บเอาไปต่อกันแสดงผล)
   และต้องมี tune=0,... ไม่งั้นเวลา Asr จะต่างจากของเดิม 1 นาที */
const LAT = 18.7883, LNG = 98.9853;
async function prayerTimes(dateStr, methodSetting) {
  const method = parseInt(methodSetting, 10) || 2;
  const d = dateStr || new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date()).replace(/\//g, '-');
  const url = `https://api.aladhan.com/v1/timings/${d}`
    + `?latitude=${LAT}&longitude=${LNG}&method=${method}&tune=0,0,0,0,0,0,0,0,0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('aladhan ' + res.status);
  const j = await res.json();
  const t = j.data.timings, dt = j.data.date;
  return {
    date: dt.readable,
    hijri: `${dt.hijri.date} ${dt.hijri.month.en} ${dt.hijri.year}`,
    Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr,
    Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha,
    method,
  };
}

async function fromSupabase(url) {
  if (!SB_URL || !SB_KEY) {
    return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_ANON_KEY' }, 500, 'no-store');
  }
  const sheet = (url.searchParams.get('sheet') || '').toLowerCase().trim();
  const P = 'status=eq.published';

  try {
    if (sheet === 'all') {
      const [activities, docs, places, members, settings] = await Promise.all([
        sb('activities', `select=*&${P}&order=date.asc`),
        sb('docs', `select=*&${P}&order=date.desc`),
        sb('places', `select=*&${P}`),
        sb('members', `select=*&${P}&order=sort_order.asc`),
        settingsFromSb(),
      ]);
      let prayer = {};
      try { prayer = await prayerTimes('', settings.prayer_method); } catch { /* ไม่มีเวลาละหมาดดีกว่าหน้าพัง */ }
      return json({
        ok: true, source: 'supabase', cached_at: new Date().toISOString(),
        data: {
          activities: shapeActivities(activities),
          docs: shapeDocs(docs),
          settings,
          places,
          members: shapeMembers(members),
          prayer,
        },
      });
    }

    if (sheet === 'activities') return json({ ok: true, data: shapeActivities(await sb('activities', `select=*&${P}&order=date.asc`)) });
    if (sheet === 'docs')       return json({ ok: true, data: shapeDocs(await sb('docs', `select=*&${P}&order=date.desc`)) });
    if (sheet === 'members')    return json({ ok: true, data: shapeMembers(await sb('members', `select=*&${P}&order=sort_order.asc`)) });
    if (sheet === 'albums')     return json({ ok: true, data: shapeAlbums(await sb('albums', `select=*&${P}&order=date.desc`)) });
    if (sheet === 'settings')   return json({ ok: true, data: await settingsFromSb() });
    if (sheet === 'places') {
      const type = url.searchParams.get('type');
      const q = `select=*&${P}` + (type ? `&type=eq.${encodeURIComponent(type)}` : '');
      return json({ ok: true, data: await sb('places', q) });
    }
    if (sheet === 'prayer') {
      const s = await settingsFromSb();
      return json({ ok: true, data: await prayerTimes(url.searchParams.get('date'), s.prayer_method) });
    }

    return json({ ok: false, error: 'unknown sheet: ' + sheet }, 400, 'no-store');
  } catch (err) {
    return json({ ok: false, error: err.message }, 502, 'no-store');
  }
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler(request) {
  const url = new URL(request.url);
  /* ?src= ใช้ทดสอบก่อนสลับจริง — ไม่ระบุก็ใช้ค่าจาก DATA_SOURCE */
  const src = (url.searchParams.get('src') || DEFAULT_SOURCE).toLowerCase();

  try {
    return src === 'supabase' ? await fromSupabase(url) : await fromSheets(url.search);
  } catch (err) {
    return json({ ok: false, error: 'upstream fetch failed: ' + err.message }, 502, 'no-store');
  }
}
