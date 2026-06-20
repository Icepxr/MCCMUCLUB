/**
 * ══════════════════════════════════════════════════════════════════
 *  MCCMU WEBSITE — Google Apps Script Backend  (Read-Only · GET only)
 *
 *  Deploy → Web app → Execute as: Me · Who has access: Anyone
 *
 *  Sheets (สคีมาแบบลีน):
 *    activities : title_th, date, location, description, featured, cover_id, status
 *    docs       : title, description, date, file_id, status
 *    albums     : title, date, description, folder_id, cover_id, status
 *    places     : name, type, description, map_url, coords, status
 *    members    : name, title, description, order, cover_id, status
 *    settings   : key | value  (logo_id, club_email, club_facebook, club_instagram,
 *                 club_youtube, club_line, map_embed_url, halal_map_url, prayer_method)
 *
 *  status: ใช้ได้ 2 ค่า → published | archived  (เว็บแสดงเฉพาะ published)
 *  รูป/ไฟล์ทุกอย่างเก็บใน Google Drive อ้างด้วย id — backend แปลงเป็น URL ให้
 *  (รูปต้องตั้งแชร์ "Anyone with the link")
 * ══════════════════════════════════════════════════════════════════ */

/* ── Location: Chiang Mai ── */
var LAT    = 18.7883;
var LNG    = 98.9853;
var METHOD = 2;   // ISNA — ปรับได้ใน settings (key: prayer_method)

/* ══════════════════════════════════════════════════════════════════
   ROUTER
   ══════════════════════════════════════════════════════════════════ */
function doGet(e) {
  try {
    var sheet = (e.parameter.sheet || '').toLowerCase().trim();

    if (sheet === 'all')        return respond(getAll());
    if (sheet === 'activities') return respond(getActivities(e.parameter));
    if (sheet === 'docs')       return respond(getDocs(e.parameter));
    if (sheet === 'settings')   return respond(getSettings());
    if (sheet === 'albums')     return respond(getAlbums(e.parameter));
    if (sheet === 'places')     return respond(getPlaces(e.parameter));
    if (sheet === 'members')    return respond(getMembers(e.parameter));
    if (sheet === 'prayer')     return respond(getPrayerTimes(e.parameter));

    return respond({ ok: false, error: 'unknown sheet: ' + sheet }, 400);
  } catch (err) {
    return respond({ ok: false, error: err.message }, 500);
  }
}

function doPost() { return respond({ ok: false, error: 'Method not allowed' }, 405); }

function respond(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══════════════════════════════════════════════════════════════════
   COMBINED ENDPOINT  ?sheet=all  — frontend ยิงครั้งเดียว (cache 10 นาที)
   (albums แยกไว้ เพราะอ่าน Drive หนัก → เรียกเฉพาะหน้าที่ใช้)
   ══════════════════════════════════════════════════════════════════ */
var PAYLOAD_TTL = 600; // วินาที — กดล้างก่อนได้ด้วย invalidateCache()

function getAll() {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('payload_all');
  if (cached) return JSON.parse(cached);

  var payload = {
    ok: true,
    cached_at: new Date().toISOString(),
    data: {
      activities: getActivities({}).data,
      docs:       getDocs({}).data,
      settings:   getSettings().data,
      places:     getPlaces({}).data,
      members:    getMembers({}).data,
      prayer:     getPrayerTimes({}).data
    }
  };

  try { cache.put('payload_all', JSON.stringify(payload), PAYLOAD_TTL); } catch (e) {}
  return payload;
}

/* ล้าง cache เอง — รันใน Apps Script editor หลังแก้ข้อมูลแล้วอยากให้ขึ้นทันที */
function invalidateCache() {
  CacheService.getScriptCache().remove('payload_all');
  Logger.log('payload_all cache cleared');
}

/* ══════════════════════════════════════════════════════════════════
   HELPER: sheet → array of objects
   ══════════════════════════════════════════════════════════════════ */
function sheetToObjects(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet "' + sheetName + '" not found');

  var rows   = sh.getDataRange().getValues();
  if (!rows.length) return [];
  var header = rows[0].map(function (h) { return h.toString().trim().toLowerCase(); });
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue; // ข้ามแถวว่าง
    var obj = {};
    header.forEach(function (key, idx) {
      var val = rows[i][idx];
      obj[key] = val instanceof Date
        ? Utilities.formatDate(val, 'Asia/Bangkok', 'yyyy-MM-dd')
        : val;
    });
    result.push(obj);
  }
  return result;
}

/* ── filter เฉพาะ status (default published) ── */
function byStatus(items, status) {
  status = status || 'published';
  return items.filter(function (d) { return d.status === status; });
}

/* ══════════════════════════════════════════════════════════════════
   HELPER: Google Drive id → URL
   ══════════════════════════════════════════════════════════════════ */
function driveImg(id, size) {
  id = extractDriveId(id);
  if (!id) return '';
  return 'https://lh3.googleusercontent.com/d/' + id + '=w' + (size || 1600);
}
function drivePreview(id) {
  id = extractDriveId(id);
  return id ? 'https://drive.google.com/file/d/' + id + '/preview' : '';
}
function driveDownload(id) {
  id = extractDriveId(id);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : '';
}
function extractDriveId(s) {
  s = (s || '').toString().trim();
  if (!s) return '';
  var m = s.match(/[-\w]{25,}/);   // Drive id ยาว ≥ 25 ตัว
  return m ? m[0] : s;
}
/* อ่านรูปทุกใบในโฟลเดอร์ Drive (cache 6 ชม.) — เรียงตามชื่อไฟล์ */
function listFolderImages(folderId) {
  folderId = extractDriveId(folderId);
  if (!folderId) return [];
  var cacheKey = 'album_' + folderId;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var out = [];
  try {
    var files = DriveApp.getFolderById(folderId).getFiles();
    while (files.hasNext()) {
      var f = files.next();
      if ((f.getMimeType() || '').indexOf('image/') === 0) {
        var id = f.getId();
        out.push({ name: f.getName(), file_id: id,
                   thumb_url: driveImg(id, 600), image_url: driveImg(id, 1600) });
      }
    }
    out.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  } catch (e) { out = []; }
  try { cache.put(cacheKey, JSON.stringify(out), 21600); } catch (e) {}
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   ① ACTIVITIES  — title_th, date, location, description, featured, cover_id, status
   ══════════════════════════════════════════════════════════════════ */
function getActivities(params) {
  var items = byStatus(sheetToObjects('activities'), params.status);
  items.forEach(function (d) { d.image_url = driveImg(d.cover_id, 1200); });
  items.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return { ok: true, count: items.length, data: items };
}

/* ══════════════════════════════════════════════════════════════════
   ② DOCS  — title, description, date, file_id, status
   ══════════════════════════════════════════════════════════════════ */
function getDocs(params) {
  var items = byStatus(sheetToObjects('docs'), params.status);
  items.forEach(function (d) {
    var id = (d.file_id || '').toString().trim();
    d.view_url     = id ? drivePreview(id)  : '';
    d.download_url = id ? driveDownload(id) : '';
    d.thumb_url    = id ? driveImg(id, 800) : '';
  });
  items.sort(function (a, b) { return a.date > b.date ? -1 : 1; }); // ใหม่สุดก่อน
  return { ok: true, count: items.length, data: items };
}

/* ══════════════════════════════════════════════════════════════════
   ③ SETTINGS  — key | value  (คีย์ลงท้าย _id จะแปลงเป็น _url ให้)
   ══════════════════════════════════════════════════════════════════ */
function getSettings() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('settings');
  if (!sh) throw new Error('Sheet "settings" not found');

  var rows = sh.getDataRange().getValues();
  var out  = {};
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0] ? rows[i][0].toString().trim() : '';
    var val = rows[i][1] !== undefined ? rows[i][1].toString().trim() : '';
    if (key) out[key] = val;
  }
  Object.keys(out).forEach(function (k) {
    if (/_id$/.test(k) && out[k]) out[k.replace(/_id$/, '_url')] = driveImg(out[k], 800);
  });
  return { ok: true, data: out };
}

/* ══════════════════════════════════════════════════════════════════
   ④ ALBUMS  — title, date, description, folder_id, cover_id, status
      backend ไล่อ่านรูปทุกใบในโฟลเดอร์เองอัตโนมัติ
   ══════════════════════════════════════════════════════════════════ */
function getAlbums(params) {
  var items = byStatus(sheetToObjects('albums'), params.status);
  items.forEach(function (d) {
    var photos = listFolderImages(d.folder_id || '');
    d.photos    = photos;
    d.count     = photos.length;
    d.cover_url = d.cover_id ? driveImg(d.cover_id, 1000)
                            : (photos[0] ? photos[0].thumb_url : '');
  });
  items.sort(function (a, b) {
    var ao = a.order === '' || a.order == null ? 9999 : Number(a.order);
    var bo = b.order === '' || b.order == null ? 9999 : Number(b.order);
    if (ao !== bo) return ao - bo;
    return (a.date > b.date) ? -1 : 1;
  });
  return { ok: true, count: items.length, data: items };
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ PLACES  — name, type, description, map_url, coords, status
      type: ร้านอาหาร | มัสยิด | ห้องละหมาด
   ══════════════════════════════════════════════════════════════════ */
function getPlaces(params) {
  var items = byStatus(sheetToObjects('places'), params.status);
  if (params.type) items = items.filter(function (d) { return d.type === params.type; });
  return { ok: true, count: items.length, data: items };
}

/* ══════════════════════════════════════════════════════════════════
   ⑥ MEMBERS  — name, title (ตำแหน่ง), description, order, cover_id, status
   ══════════════════════════════════════════════════════════════════ */
function getMembers(params) {
  var items = byStatus(sheetToObjects('members'), params.status);
  items.forEach(function (d) { d.image_url = driveImg(d.cover_id, 800); });
  items.sort(function (a, b) {
    var ao = a.order === '' || a.order == null ? 9999 : Number(a.order);
    var bo = b.order === '' || b.order == null ? 9999 : Number(b.order);
    return ao - bo;
  });
  return { ok: true, count: items.length, data: items };
}

/* ══════════════════════════════════════════════════════════════════
   ⑦ PRAYER TIMES  — Aladhan API (cache 6 ชม.)
   ══════════════════════════════════════════════════════════════════ */
function getPrayerTimes(params) {
  var date     = params.date || '';
  var today    = date || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd-MM-yyyy');
  var cacheKey = 'prayer_' + today;
  var cache    = CacheService.getScriptCache();
  var cached   = cache.get(cacheKey);
  if (cached) return { ok: true, source: 'cache', data: JSON.parse(cached) };

  var method = getMethodSetting();
  var url = 'https://api.aladhan.com/v1/timings/' + today
    + '?latitude=' + LAT + '&longitude=' + LNG + '&method=' + method
    + '&tune=0,0,0,0,0,0,0,0,0';

  var res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Aladhan API returned ' + res.getResponseCode());

  var json    = JSON.parse(res.getContentText());
  var timings = json.data.timings;
  var data = {
    date:    json.data.date.readable,
    hijri:   json.data.date.hijri.date + ' ' + json.data.date.hijri.month.en + ' ' + json.data.date.hijri.year,
    Fajr:    timings.Fajr,    Sunrise: timings.Sunrise, Dhuhr: timings.Dhuhr,
    Asr:     timings.Asr,     Maghrib: timings.Maghrib, Isha:  timings.Isha,
    method:  method
  };
  cache.put(cacheKey, JSON.stringify(data), 21600);
  return { ok: true, source: 'aladhan', data: data };
}

function getMethodSetting() {
  try { return parseInt(getSettings().data.prayer_method || METHOD, 10) || METHOD; }
  catch (e) { return METHOD; }
}

/* ══════════════════════════════════════════════════════════════════
   TEST FUNCTIONS (รันใน Apps Script editor)
   ══════════════════════════════════════════════════════════════════ */
function testActivities() { Logger.log(JSON.stringify(getActivities({}), null, 2)); }
function testDocs()       { Logger.log(JSON.stringify(getDocs({}), null, 2)); }
function testSettings()   { Logger.log(JSON.stringify(getSettings(), null, 2)); }
function testAlbums()     { Logger.log(JSON.stringify(getAlbums({}), null, 2)); }
function testPlaces()     { Logger.log(JSON.stringify(getPlaces({}), null, 2)); }
function testMembers()    { Logger.log(JSON.stringify(getMembers({}), null, 2)); }
function testPrayer()     { Logger.log(JSON.stringify(getPrayerTimes({}), null, 2)); }
