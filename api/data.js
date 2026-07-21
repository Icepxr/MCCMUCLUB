/**
 * Vercel Edge Function — edge-cached proxy ของ Google Apps Script
 * เส้นทางจริง: /api/data?sheet=all   (frontend เรียก /data ผ่าน rewrite ใน vercel.json)
 *
 * ทำไม: ให้ browser ยิงมาที่ Vercel edge แทนที่จะยิง Apps Script ตรง ๆ
 * → Vercel edge cache ผลไว้ (s-maxage) → Apps Script ถูกเรียกแค่ ~1 ครั้ง
 *   ต่อรอบ cache ไม่ว่าคนดูกี่พัน = รองรับผู้อ่านพร้อมกันได้ไม่จำกัด + ซ่อน URL + ไม่มี CORS
 *
 * (แปลงมาจาก functions/data.js เดิมของ Cloudflare Pages)
 */
export const config = { runtime: 'edge' };

const UPSTREAM = 'https://script.google.com/macros/s/AKfycbyS8PY6nJ4FmFYf4KS8chC4Jej3bZEnA5yPupDw0FvFavoWe1h5q1hJ1VuE_Ga-yKx5Ag/exec';
const EDGE_TTL = 600;   // วินาที — Apps Script ถูกเรียกไม่เกิน 1 ครั้ง/10 นาที

export default async function handler(request) {
  const reqUrl = new URL(request.url);
  const upstream = UPSTREAM + reqUrl.search;   // ส่งต่อ ?sheet=...&... ทั้งหมด

  let res;
  try {
    res = await fetch(upstream, { redirect: 'follow' });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream fetch failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const body = await res.text();
  return new Response(body, {
    status: res.ok ? 200 : res.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // browser cache 120s · Vercel edge cache (s-maxage) 600s · เสิร์ฟ stale ระหว่าง revalidate
      'cache-control': 'public, max-age=120, s-maxage=' + EDGE_TTL + ', stale-while-revalidate=60',
      'access-control-allow-origin': '*',
    },
  });
}
