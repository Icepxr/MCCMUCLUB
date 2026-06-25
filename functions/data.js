/**
 * Cloudflare Pages Function — edge-cached proxy ของ Google Apps Script
 * เส้นทาง: /data?sheet=all  (และ ?sheet=albums, ?sheet=prayer&date=... ฯลฯ)
 *
 * ทำไม: ให้ browser ยิงมาที่ Cloudflare edge แทนที่จะยิง Apps Script ตรง ๆ
 * → Cloudflare cache ผลไว้ที่ edge (cacheTtl) → Apps Script ถูกเรียกแค่ ~1 ครั้ง
 *   ต่อรอบ cache ไม่ว่าคนดูกี่พัน = รองรับผู้อ่านพร้อมกันได้ไม่จำกัด + ซ่อน URL + ไม่มี CORS
 */
const UPSTREAM = 'https://script.google.com/macros/s/AKfycbyS8PY6nJ4FmFYf4KS8chC4Jej3bZEnA5yPupDw0FvFavoWe1h5q1hJ1VuE_Ga-yKx5Ag/exec';
const EDGE_TTL = 600;   // วินาที — Apps Script ถูกเรียกไม่เกิน 1 ครั้ง/10 นาที

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const upstream = UPSTREAM + reqUrl.search;   // ส่งต่อ ?sheet=...&... ทั้งหมด

  const res = await fetch(upstream, {
    redirect: 'follow',
    cf: { cacheTtl: EDGE_TTL, cacheEverything: true },   // cache ที่ Cloudflare edge
  });

  const body = await res.text();
  return new Response(body, {
    status: res.ok ? 200 : res.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=120, s-maxage=' + EDGE_TTL,
      'access-control-allow-origin': '*',
    },
  });
}
