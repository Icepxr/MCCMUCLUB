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
/* คีย์ Google Drive API (ไม่บังคับ) — มีไว้ให้หลังบ้านกด "ดึงรูปจากโฟลเดอร์" ได้
   ไม่ตั้งก็ใช้เว็บได้ปกติ แค่ต้องวางลิงก์รูปเองในหน้าจัดการรูป */
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;
const DEFAULT_SOURCE = (process.env.DATA_SOURCE || 'sheets').toLowerCase();

/* 180 วินาที — ของที่แก้ในหลังบ้านขึ้นเว็บภายใน ~3 นาที
   สั้นกว่านี้ได้แต่จะยิง Supabase ถี่ขึ้น (คิดเป็น egress ~450MB/เดือน ที่ค่านี้) */
const EDGE_TTL = 180;
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
/* auth = JWT ของผู้ใช้ (เฉพาะโหมดตัวอย่าง) — ไม่ส่งก็ใช้สิทธิ์ anon เหมือนคนทั่วไป
   สิทธิ์ที่ได้ตัดสินโดย RLS ในฐานข้อมูล ไม่ใช่โค้ดนี้: ผู้ดูแลเห็นร่าง คนอื่นเห็นแค่ที่เผยแพร่ */
async function sb(table, query = '', auth = SB_KEY) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SB_KEY, authorization: `Bearer ${auth}` },
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
/* albums: เดิม Apps Script ไล่อ่านโฟลเดอร์ Drive เพื่อหารูปในอัลบั้ม
   Supabase ทำแบบนั้นไม่ได้ จึงเก็บ "รายชื่อรูป" ไว้ในตาราง album_photos แทน
   ตัวไฟล์รูปยังอยู่บน Drive เหมือนเดิม รูปร่างที่ส่งกลับต้องตรงกับของเดิมเป๊ะ
   (name, file_id, thumb_url, image_url) เพราะ lightbox ฝั่งหน้าเว็บใช้ฟิลด์เหล่านี้ */
async function shapeAlbums(rows, auth) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const photos = await sb('album_photos',
    `select=album_id,file_id,sort_order&album_id=in.(${ids.join(',')})&order=sort_order`, auth);
  const byAlbum = new Map();
  photos.forEach((p) => {
    if (!byAlbum.has(p.album_id)) byAlbum.set(p.album_id, []);
    byAlbum.get(p.album_id).push({
      name: p.file_id,
      file_id: p.file_id,
      thumb_url: img(p.file_id, 600),
      image_url: img(p.file_id, 1600),
    });
  });
  return rows.map((d) => {
    const ph = byAlbum.get(d.id) || [];
    return {
      ...d,
      photos: ph,
      count: ph.length,
      cover_url: d.cover_id ? img(d.cover_id, 1000) : (ph[0] ? ph[0].thumb_url : ''),
    };
  });
}

async function settingsFromSb(auth) {
  const rows = await sb('settings', 'select=key,value', auth);
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

/* คอลัมน์ที่หน้าเว็บสาธารณะขอ — ระบุชื่อตรง ๆ แทน select=* เพราะ anon ถูกถอนสิทธิ์อ่าน updated_by
   (อีเมลผู้ดูแล — migration 0007) ถ้าขอ * ด้วยสิทธิ์ anon หลังรัน migration จะได้ permission denied ทั้งตาราง
   เพิ่มคอลัมน์ใหม่ในตารางเมื่อไหร่: เพิ่มชื่อที่นี่ และ grant ให้ anon ใน migration ด้วย */
const PUBLIC_COLS = {
  activities: 'id,title_th,date,location,description,featured,cover_id,status,created_at,updated_at',
  docs:       'id,title,description,date,file_id,status,created_at,updated_at',
  albums:     'id,title,date,description,folder_id,cover_id,status,created_at,updated_at',
  places:     'id,name,type,description,map_url,coords,status,created_at,updated_at',
  members:    'id,name,title,description,sort_order,cover_id,status,created_at,updated_at',
};

async function fromSupabase(url, auth) {
  if (!SB_URL || !SB_KEY) {
    return json({ ok: false, error: 'ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_ANON_KEY' }, 500, 'no-store');
  }
  const sheet = (url.searchParams.get('sheet') || '').toLowerCase().trim();
  /* โหมดตัวอย่าง: ขอทั้งที่เผยแพร่และร่าง (ไม่เอาที่เก็บเข้ากรุ) แล้วให้ RLS ตัดสินว่าเห็นอะไรได้จริง
     ห้าม cache เด็ดขาด — ไม่งั้นร่างจะหลุดไปให้คนถัดไปที่ขอ URL เดียวกัน */
  const preview = !!auth;
  const P = preview ? 'status=in.(published,draft)' : 'status=eq.published';
  const out = (body, status) => json(body, status, preview ? 'private, no-store' : undefined);
  auth = auth || SB_KEY;
  /* updated_by เก็บอีเมลผู้ดูแล — หน้าเว็บสาธารณะไม่ใช้ และไม่ควรแจกให้ทุกคนที่เปิดเว็บ */
  /* โหมดตัวอย่างใช้ token ผู้ดูแล อ่านได้ทุกคอลัมน์ · คนทั่วไปขอเฉพาะคอลัมน์สาธารณะ */
  const cols = (t) => (preview ? '*' : PUBLIC_COLS[t]);
  const clean = (rows) => (preview ? rows : rows.map(({ updated_by, ...r }) => r));

  try {
    if (sheet === 'all') {
      const [activities, docs, places, members, settings] = await Promise.all([
        sb('activities', `select=${cols('activities')}&${P}&order=date.asc`, auth).then(clean),
        sb('docs', `select=${cols('docs')}&${P}&order=date.desc`, auth).then(clean),
        sb('places', `select=${cols('places')}&${P}`, auth).then(clean),
        sb('members', `select=${cols('members')}&${P}&order=sort_order.asc`, auth).then(clean),
        settingsFromSb(auth),
      ]);
      let prayer = {};
      try { prayer = await prayerTimes('', settings.prayer_method); } catch { /* ไม่มีเวลาละหมาดดีกว่าหน้าพัง */ }
      return out({
        ok: true, source: 'supabase', preview, cached_at: new Date().toISOString(),
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

    if (sheet === 'activities') return out({ ok: true, data: shapeActivities(await sb('activities', `select=${cols('activities')}&${P}&order=date.asc`, auth).then(clean)) });
    if (sheet === 'docs')       return out({ ok: true, data: shapeDocs(await sb('docs', `select=${cols('docs')}&${P}&order=date.desc`, auth).then(clean)) });
    if (sheet === 'members')    return out({ ok: true, data: shapeMembers(await sb('members', `select=${cols('members')}&${P}&order=sort_order.asc`, auth).then(clean)) });
    if (sheet === 'albums')     return out({ ok: true, data: await shapeAlbums(await sb('albums', `select=${cols('albums')}&${P}&order=date.desc`, auth).then(clean), auth) });
    if (sheet === 'settings')   return out({ ok: true, data: await settingsFromSb(auth) });
    if (sheet === 'places') {
      const type = url.searchParams.get('type');
      const q = `select=${cols('places')}&${P}` + (type ? `&type=eq.${encodeURIComponent(type)}` : '');
      return out({ ok: true, data: await sb('places', q, auth).then(clean) });
    }
    if (sheet === 'prayer') {
      const s = await settingsFromSb(auth);
      return out({ ok: true, data: await prayerTimes(url.searchParams.get('date'), s.prayer_method) });
    }

    return json({ ok: false, error: 'unknown sheet: ' + sheet }, 400, 'no-store');
  } catch (err) {
    return json({ ok: false, error: err.message }, 502, 'no-store');
  }
}

/* ══════════════════════════════════════════════════════════════════
   รายชื่อรูปในโฟลเดอร์ Drive — ใช้จากหน้าหลังบ้านตอนสร้างอัลบั้มใหม่
   (เดิมงานนี้เป็นของ Apps Script ที่ไล่อ่าน Drive ให้ พอย้ายมา Supabase
    ก็ไม่มีใครทำแทน อัลบั้มใหม่เลยมีแต่ปก)

   อ่านอย่างเดียว และเห็นได้เฉพาะโฟลเดอร์ที่ตั้งแชร์ "ทุกคนที่มีลิงก์" อยู่แล้ว
   — API key แบบนี้เปิดไฟล์ส่วนตัวของใครไม่ได้ ต่อให้รู้ id
   คนที่ "เขียน" รายชื่อรูปลงฐานข้อมูลยังต้องเป็นผู้ดูแลที่ล็อกอินแล้วเสมอ (RLS)
   ══════════════════════════════════════════════════════════════════ */
async function listDriveFolder(url) {
  const id = driveId(url.searchParams.get('id') || '');
  if (!/^[-\w]{25,}$/.test(id)) {
    return json({ ok: false, error: 'ลิงก์โฟลเดอร์ไม่ถูกต้อง' }, 400, 'no-store');
  }
  if (!GOOGLE_KEY) {
    return json({ ok: false, error:
      'ยังไม่ได้ตั้งค่า GOOGLE_API_KEY บน Vercel — ระหว่างนี้ใช้ช่อง "วางลิงก์รูปเอง" แทนได้ '
      + '(วิธีตั้งค่าอยู่ใน ADMIN_SETUP.md)' }, 501, 'no-store');
  }

  const out = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      q: `'${id}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken,files(id,name)',
      orderBy: 'name',
      pageSize: '200',
      key: GOOGLE_KEY,
    });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch('https://www.googleapis.com/drive/v3/files?' + q);
    if (!res.ok) {
      return json({ ok: false, error: `อ่านโฟลเดอร์ไม่ได้ (drive ${res.status}) — `
        + 'ตรวจว่าตั้งแชร์ "ทุกคนที่มีลิงก์" แล้วหรือยัง' }, 502, 'no-store');
    }
    const j = await res.json();
    (j.files || []).forEach((f) => out.push({ file_id: f.id, name: f.name }));
    pageToken = j.nextPageToken || '';
  } while (pageToken && out.length < 1000);

  return json({ ok: true, count: out.length, data: out }, 200, 'no-store');
}

/* ══════════════════════════════════════════════════════════════════
   คลิปจากช่อง YouTube ของชมรม — ใช้ในหน้าคลังความรู้

   อ่านจาก RSS สาธารณะของช่อง ไม่ต้องใช้ API key และไม่มีโควตา
   อัปคลิปใหม่ขึ้นช่องแล้วหน้าเว็บเห็นเองภายใน ~30 นาที ไม่ต้องเข้าหลังบ้าน
   (RSS ให้มาสูงสุด 15 คลิปล่าสุด) · เบราว์เซอร์อ่าน RSS ของ YouTube ตรง ๆ ไม่ได้เพราะติด CORS
   Edge runtime ไม่มี DOMParser จึงแกะ XML ด้วย regex — รูปแบบ feed นี้คงที่มาหลายปีแล้ว
   ══════════════════════════════════════════════════════════════════ */
const YT_CHANNEL = process.env.YOUTUBE_CHANNEL_ID || 'UCpi1ogZDgOqnXF6G94tRqYg';   // @muslimcmu
const YT_CACHE = 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400';

const xmlText = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .trim();
const xmlTag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? xmlText(m[1]) : '';
};

async function youtubeFeed() {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`);
  if (!res.ok) return json({ ok: false, error: `youtube ${res.status}` }, 502, 'no-store');
  const xml = await res.text();
  const data = xml.split('<entry>').slice(1).map((e) => ({
    id: xmlTag(e, 'yt:videoId'),
    title: xmlTag(e, 'title'),
    published: xmlTag(e, 'published'),
    description: xmlTag(e, 'media:description'),
  })).filter((v) => /^[-\w]{11}$/.test(v.id));
  return json({ ok: true, channel_id: YT_CHANNEL, data }, 200, YT_CACHE);
}

/* ══════════════════════════════════════════════════════════════════ */
export default async function handler(request) {
  const url = new URL(request.url);
  /* ?src= ใช้ทดสอบก่อนสลับจริง — ไม่ระบุก็ใช้ค่าจาก DATA_SOURCE */
  const src = (url.searchParams.get('src') || DEFAULT_SOURCE).toLowerCase();

  try {
    /* ไม่ผูกกับ DATA_SOURCE เพราะเป็นเครื่องมือของหลังบ้าน ไม่ใช่ข้อมูลของหน้าเว็บ */
    const sheet = (url.searchParams.get('sheet') || '').toLowerCase().trim();
    if (sheet === 'folder') return await listDriveFolder(url);
    /* คลิป YouTube ไม่ได้อยู่ทั้งใน Sheets และ Supabase จึงไม่ผูกกับ DATA_SOURCE เช่นกัน */
    if (sheet === 'youtube') return await youtubeFeed();
    /* โหมดตัวอย่างจากหลังบ้าน — อ่านจาก Supabase เสมอด้วย token ของผู้ดูแลที่ส่งมา */
    if (url.searchParams.get('preview') === '1') {
      const m = (request.headers.get('authorization') || '').match(/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/);
      if (!m) return json({ ok: false, error: 'ต้องเข้าสู่ระบบหลังบ้านก่อนจึงจะดูตัวอย่างได้' }, 401, 'no-store');
      return await fromSupabase(url, m[1]);
    }
    return src === 'supabase' ? await fromSupabase(url) : await fromSheets(url.search);
  } catch (err) {
    return json({ ok: false, error: 'upstream fetch failed: ' + err.message }, 502, 'no-store');
  }
}
