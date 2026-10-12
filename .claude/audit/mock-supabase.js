// AUDIT TEST FIXTURE ONLY — fake Supabase client so the admin UI can be exercised without Google sign-in.
// Writes go to in-memory arrays; nothing touches the real database.
const K = 'mock_session';
const bkk = (i) => new Date(Date.now() + 7 * 3600e3 - i * 864e5).toISOString().slice(0, 10);
const now = Date.now();
const FAIL = () => localStorage.getItem('mock_fail') === '1';   // set to simulate failed requests
const DATA = {
  admins: [{ email: 'owner@example.com', name: 'Owner Test', role: 'owner', created_at: '2026-06-01' },
           { email: 'editor@example.com', name: 'Editor Test', role: 'editor', created_at: '2026-07-11' }],
  activities: [
    { id: 1, title_th: 'กิจกรรมปฐมนิเทศนักศึกษามุสลิม', date: '2026-08-15', location: 'มช.วิทยาเขตแม่เหียะ', status: 'published', featured: true, cover_id: '1BQqbY-Yg03tyWfLX5iEuolXhUD-f1x_N', updated_by: 'owner@example.com' },
    { id: 2, title_th: 'โครงการแจกข้าวน้องปี1', date: '2026-07-03', location: 'ศูนย์กีฬาและสุขภาพ', status: 'published' },
    { id: 3, title_th: 'กีฬาสัมพันธ์มุสลิมภาคเหนือ <img src=x onerror=alert(1)>', date: '2026-11-20', status: 'draft' },
    { id: 4, title_th: 'ค่ายเยาวชนมุสลิม', date: '2025-12-10', status: 'archived' }],
  docs: [{ id: 1, title: 'คู่มือการละหมาดสำหรับนักศึกษาใหม่', date: '2026-05-01', status: 'published', file_id: 'x' }],
  albums: [{ id: 1, title: 'ละศีลอด 2569', date: '2026-03-02', status: 'published', folder_id: 'abcdefghijklmnopqrstuvwxyz123' },
           { id: 2, title: 'ปฐมนิเทศ', date: '2026-08-15', status: 'draft' }],
  album_photos: [{ id: 1, album_id: 1, file_id: '1BQqbY-Yg03tyWfLX5iEuolXhUD-f1x_N', sort_order: 0 }],
  places: [{ id: 1, name: 'มัตอัมเชียงใหม่', type: 'ร้านอาหาร', status: 'published', map_url: 'https://maps.app.goo.gl/x' }],
  members: [{ id: 1, name: 'ประธานชมรม', title: 'ประธานชมรม', sort_order: 1, status: 'published' }],
  settings: [{ key: 'club_email', value: 'club@example.com' }, { key: 'club_facebook', value: '' }, { key: 'club_youtube', value: 'https://www.youtube.com/@muslimcmu' },
             { key: 'halal_map_url', value: 'https://www.google.com/maps/d/embed?mid=1' }, { key: 'prayer_method', value: '2' }, { key: 'logo_id', value: '' }],
  page_stats: [...Array(30)].flatMap((_, i) => [{ day: bkk(i), path: '/', views: 10 + i, visitors: 5 + (i % 4) },
                                                { day: bkk(i), path: '/activities', views: 4, visitors: 0 }]),
  audit_log: [
    { at: new Date(now - 12 * 6e4).toISOString(), actor: 'owner@example.com', action: 'update', table_name: 'activities', summary: 'กิจกรรมปฐมนิเทศนักศึกษามุสลิม', changed: { status: 1, title_th: 1 } },
    { at: new Date(now - 30 * 36e5).toISOString(), actor: 'editor@example.com', action: 'delete', table_name: 'places', summary: 'ร้านเก่า' }],
};
function q(t) {
  let rows = [...(DATA[t] || [])], head = false, count = false, single = false, write = null, del = false;
  const b = { select(_, o) { if (o?.head) head = true; if (o?.count) count = true; return b; },
    eq(k, v) { rows = rows.filter((r) => r[k] === v); return b; }, gte(k, v) { rows = rows.filter((r) => r[k] >= v); return b; },
    order() { return b; }, limit(n) { rows = rows.slice(0, n); return b; }, single() { single = true; return b; },
    insert(p) { const arr = Array.isArray(p) ? p : [p]; rows = arr.map((x) => ({ ...x, id: x.id ?? Date.now() + Math.random() })); DATA[t].push(...rows); return b; },
    update(p) { write = p; return b; }, upsert(p) { (Array.isArray(p) ? p : [p]).forEach((x) => { const i = DATA[t].findIndex((r) => (x.key && r.key === x.key) || (x.id && r.id === x.id)); if (i >= 0) Object.assign(DATA[t][i], x); else DATA[t].push(x); }); return b; },
    delete() { del = true; return b; },
    then(res) {
      if (FAIL()) return new Promise((r) => setTimeout(r, 300)).then(() => res({ data: null, error: { message: 'simulated network failure' }, count: null }));
      if (write) rows.forEach((r) => Object.assign(r, write));
      if (del) rows.forEach((r) => { const i = DATA[t].indexOf(r); if (i >= 0) DATA[t].splice(i, 1); });
      return new Promise((r) => setTimeout(r, 150)).then(() => res({ data: head ? null : (single ? rows[0] : rows), error: null, count: count ? rows.length : null }));
    } };
  return b;
}
export function createClient() {
  return { from: q, auth: {
    async getSession() { await new Promise((r) => setTimeout(r, 200));
      return { data: { session: localStorage.getItem(K) ? { user: { email: 'owner@example.com', user_metadata: { full_name: 'Owner Test' } } } : null } }; },
    async signInWithOAuth() { localStorage.setItem(K, '1'); location.reload(); return { error: null }; },
    async signOut() { localStorage.removeItem(K); return { error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } } };
}
