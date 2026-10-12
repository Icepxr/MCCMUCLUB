/**
 * ══════════════════════════════════════════════════════════════════
 *  MCCMU API Client  —  assets/api.js   (Read-only · GET only)
 *
 *  ดึงข้อมูล + รูปภาพทั้งหมดจาก Google Apps Script backend
 *  รูปทุกใบมาจาก Google Drive (file_id → URL แปลงที่ backend)
 *
 *  วิธีใช้: ใส่ Web App URL ใน MCCMU.API_URL แล้ว
 *           <script src="assets/api.js"></script> ก่อน </body>
 *           (ทำงานอัตโนมัติตาม <body data-page="...">)
 * ══════════════════════════════════════════════════════════════════ */

var MCCMU = window.MCCMU || {};

/* 🔧 ตั้งค่า — Web App URL ของ Apps Script (ตรง · ใช้เป็น fallback + ตอนเปิดแบบ file://) */
MCCMU.API_URL  = 'https://script.google.com/macros/s/AKfycbyS8PY6nJ4FmFYf4KS8chC4Jej3bZEnA5yPupDw0FvFavoWe1h5q1hJ1VuE_Ga-yKx5Ag/exec';
/* proxy edge-cached บน Cloudflare Pages (functions/data.js) — ใช้ตอนเสิร์ฟผ่านโฮสต์ */
MCCMU.PROXY_URL = '/data';

/* เปิดหน้าเว็บด้วย ?src=supabase เพื่อทดสอบแหล่งข้อมูลใหม่ทั้งหน้า
   โดยที่คนอื่นยังเห็นของเดิม — ค่านี้ถูกส่งต่อไปให้ /data ตัดสินใจ */
var _SRC = (function () {
  var m = /[?&]src=(sheets|supabase)\b/.exec(location.search);
  return m ? m[1] : '';
})();

/* ══════════════════════════════════════════════════════════════════
   โหมดตัวอย่าง (?preview) — เปิดจากหลังบ้านเพื่อดูหน้าจริงที่รวม "ร่าง" ไว้ด้วย
   ใช้ token ของผู้ดูแลที่ล็อกอินหลังบ้านไว้ในเบราว์เซอร์เดียวกัน (supabase-js เก็บไว้ใน localStorage)
   สิทธิ์จริงตัดสินที่ RLS: คนที่ไม่ใช่ผู้ดูแลต่อให้เปิด ?preview ก็เห็นแค่ของที่เผยแพร่แล้ว
   จำโหมดไว้ใน sessionStorage ให้กดไปหน้าอื่นในแท็บเดียวกันแล้วยังเป็นตัวอย่างอยู่
   ══════════════════════════════════════════════════════════════════ */
var _SB_TOKEN_KEY = 'sb-bzbqzohygnraqquabffg-auth-token';
function _previewToken() {
  try {
    var s = JSON.parse(localStorage.getItem(_SB_TOKEN_KEY) || 'null');
    if (!s || !s.access_token) return '';
    if (s.expires_at && s.expires_at * 1000 < Date.now()) return '';   // หมดอายุ — หลังบ้านต่ออายุให้เองตอนเปิดค้างไว้
    return s.access_token;
  } catch (e) { return ''; }
}
/* จำโหมดไว้เฉพาะตอนมี token จริง — เปิด ?preview โดยไม่ได้ล็อกอินจะเห็นแถบเตือนแค่หน้านั้น
   ไม่ติดค้างไปทุกหน้าในแท็บ */
MCCMU.PREVIEW = (function () {
  var asked = /[?&]preview\b/.test(location.search);
  try {
    if (asked && _previewToken()) sessionStorage.setItem('mccmu_preview', '1');
    return asked || sessionStorage.getItem('mccmu_preview') === '1';
  } catch (e) { return asked; }
})();

function _query(sheet, params) {
  var qs = '?sheet=' + encodeURIComponent(sheet);
  if (params) Object.keys(params).forEach(function (k) {
    if (params[k] !== '' && params[k] != null)
      qs += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  });
  if (_SRC) qs += '&src=' + _SRC;
  return qs;
}
function _handle(r) {
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json().then(function (json) {
    if (!json.ok) throw new Error(json.error || 'API error');
    return json.data;
  });
}

/* ติดป้าย "ร่าง ·" หน้าชื่อของที่ยังไม่เผยแพร่ ให้เห็นชัดว่าอันไหนคนทั่วไปยังไม่เห็น */
function _markDrafts(data) {
  function mark(r) {
    if (!r || r.status !== 'draft') return r;
    ['title_th', 'title', 'name'].forEach(function (k) { if (r[k]) r[k] = 'ร่าง · ' + r[k]; });
    return r;
  }
  if (Array.isArray(data)) data.forEach(mark);
  else if (data && typeof data === 'object') Object.keys(data).forEach(function (k) {
    if (Array.isArray(data[k])) data[k].forEach(mark);
  });
  return data;
}

/* ── core fetch ── ยิงผ่าน proxy edge-cache ก่อน (บนโฮสต์), ล่ม → fallback ยิง Apps Script ตรง ── */
MCCMU.get = function (sheet, params) {
  var qs = _query(sheet, params);
  var onHost = (location.protocol === 'http:' || location.protocol === 'https:');
  if (!onHost) return fetch(MCCMU.API_URL + qs).then(_handle);   // file:// (เปิดไฟล์ในเครื่อง) → Apps Script ตรง
  function publicFetch() { return fetch(MCCMU.PROXY_URL + qs).then(_handle); }
  /* โหมดตัวอย่างแต่ไม่มี token หรือ token ถูกปฏิเสธ → ใช้ข้อมูลสาธารณะตามปกติ แล้วเปลี่ยนแถบเป็นคำเตือน
     หน้าเว็บต้องใช้งานได้เสมอ ไม่ใช่ว่างเปล่าทั้งหน้า */
  var tok = MCCMU.PREVIEW && _previewToken();
  if (tok) {
    return fetch(MCCMU.PROXY_URL + qs + '&preview=1', { headers: { authorization: 'Bearer ' + tok }, cache: 'no-store' })
      .then(_handle).then(_markDrafts)
      .catch(function () {
        MCCMU._previewFailed = true;
        if (MCCMU.previewBar) MCCMU.previewBar();
        return publicFetch();
      });
  }
  /* ไม่ถอยไปใช้ Apps Script แล้ว — ข้อมูลในชีตเก่ากว่าฐานข้อมูลจริงมาก (ขาดกิจกรรมและร้านใหม่)
     ถ้าดึงไม่ได้ _loadAll จะใช้ของที่เก็บไว้ในเครื่องแทน หรือให้แต่ละส่วนแสดงข้อความโหลดไม่สำเร็จ */
  return publicFetch();
};

/* ══════════════════════════════════════════════════════════════════
   COMBINED LOAD — ดึง ?sheet=all "ครั้งเดียว" ต่อการเข้าเว็บ
   • เก็บใน localStorage มี TTL → เปิดหน้าถัดไปแทบไม่ยิงเลย
   • stale-while-revalidate: ถ้าหมดอายุ ใช้ของเก่าทันที แล้วรีเฟรชเบื้องหลัง
   ทุก getX ด้านล่างอ่านจากก้อนนี้ (กรองฝั่ง client) — ไม่ยิงสดรายอัน
   ══════════════════════════════════════════════════════════════════ */
/* โหลด ?sheet=all แบบ cache มี TTL (เร็ว + ไม่ยิง request ทุกครั้งที่รีโหลด)
   • cache ยังสด (< TTL) → ใช้เลย ไม่ยิง network
   • cache หมดอายุ/ไม่มี → ดึงใหม่ (โชว์ skeleton ระหว่างรอ) แล้ววาดด้วยข้อมูลใหม่ทั้งชุด
   ไม่มีการ "วาดของเก่าแล้วค่อยสลับ" จึงไม่เกิดปัญหารูป/ข้อมูลค้าง
   อยากบังคับโหลดใหม่ทันที: เรียก MCCMU.refresh() หรือเปิดด้วย ?fresh */
var LS_KEY = 'mccmu_all_v1' + (_SRC ? '_' + _SRC : '');   // แยก cache ต่อแหล่ง กันข้อมูลทดสอบปนของจริง
var LS_TTL = 3 * 60 * 1000;           // 3 นาที — ให้ใกล้เคียงกับ cache ฝั่ง edge
var LS_MAX = 7 * 24 * 60 * 60 * 1000; // 7 วัน  — เกิน TTL แต่ยังไม่เกินนี้ = ใช้ของเก่าไปก่อน แล้วรีเฟรชเบื้องหลัง

function _readCache() {
  try {
    var o = JSON.parse(window.localStorage.getItem(LS_KEY) || 'null');
    return (o && o.data && typeof o.t === 'number') ? o : null;
  } catch (e) { return null; }
}
function _writeCache(data) {
  try { window.localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
}
function _fetchAll() {
  return MCCMU.get('all').then(function (data) {
    if (!MCCMU.PREVIEW) _writeCache(data);    // ข้อมูลตัวอย่างมีร่างปน ห้ามเก็บลง cache ปกติ
    return data;
  });
}

MCCMU._loadAll = function () {
  if (MCCMU._allPromise) return MCCMU._allPromise;

  var bypass = MCCMU.PREVIEW || /[?&#]fresh\b/.test(location.search + location.hash);
  var c = bypass ? null : _readCache();

  if (c) {
    var age = Date.now() - c.t;
    if (age < LS_TTL) {
      MCCMU._allPromise = Promise.resolve(c.data);   // สด → ไม่ยิง network
      return MCCMU._allPromise;
    }
    if (age < LS_MAX) {
      /* stale-while-revalidate: วาดด้วยของเก่า "ทันที" (หน้าไม่ค้างรอ Apps Script)
         แล้วดึงของใหม่เบื้องหลังเก็บไว้ให้รอบถัดไป */
      MCCMU._allPromise = Promise.resolve(c.data);
      _fetchAll().catch(function () {});
      return MCCMU._allPromise;
    }
  }

  /* ไม่มี cache เลย (หรือเก่ามาก) → จำเป็นต้องรอ network รอบเดียว */
  MCCMU._allPromise = _fetchAll().catch(function (err) {
    if (c) return c.data;   // network ล่ม แต่ยังมีของเก่า → ดีกว่าหน้าว่าง
    throw err;
  });
  return MCCMU._allPromise;
};

/* ล้าง cache ฝั่งเบราว์เซอร์แล้วโหลดใหม่ (ใช้ตอนเพิ่งแก้ข้อมูลในชีตแล้วอยากเห็นทันที) */
MCCMU.refresh = function () {
  try { window.localStorage.removeItem(LS_KEY); } catch (e) {}
  MCCMU._allPromise = null;
  location.reload();
};

/* ══════════════════════════════════════════════════════════════════
   DATA METHODS — อ่านจากก้อนรวม (กรองฝั่ง client)
   หมายเหตุ: ก้อนรวมเป็น status=published เสมอ (ตรงกับการใช้งานจริงทุกหน้า)
   ══════════════════════════════════════════════════════════════════ */
MCCMU.getActivities = function (opts) {
  opts = opts || {};
  return MCCMU._loadAll().then(function (all) {
    var items = (all.activities || []).slice();
    return opts.limit ? items.slice(0, opts.limit) : items;
  });
};
MCCMU.getDocs = function (opts) {
  opts = opts || {};
  return MCCMU._loadAll().then(function (all) {
    return (all.docs || []).slice();
  });
};
MCCMU.getMembers = function (opts) {
  opts = opts || {};
  return MCCMU._loadAll().then(function (all) {
    var items = (all.members || []).slice();
    return opts.limit ? items.slice(0, opts.limit) : items;
  });
};
/* Cache public album metadata across page visits; never cache image binaries here. */
MCCMU.getAlbums = function (opts) {
  opts = opts || {};
  var status = opts.status || 'published';
  var key = 'mccmu_albums_v2_' + (_SRC || 'sheets') + '_' + status;
  var fresh = opts.fresh || MCCMU.PREVIEW || /[?&#]fresh\b/.test(location.search + location.hash);
  MCCMU._albumRequests = MCCMU._albumRequests || {};
  if (!fresh && MCCMU._albumRequests[key]) return MCCMU._albumRequests[key];
  if (!fresh) {
    try {
      var cached = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (cached && Array.isArray(cached.data) && Date.now() - cached.t < 180000) {
        return Promise.resolve(cached.data);
      }
    } catch (e) {}
  }
  var request = MCCMU.get('albums', { status: status }).then(function (items) {
    if (!Array.isArray(items)) throw new Error('Invalid album response');
    if (!MCCMU.PREVIEW) try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), data: items })); } catch (e) {}
    return items;
  });
  MCCMU._albumRequests[key] = request;
  request.then(function () { delete MCCMU._albumRequests[key]; }, function () { delete MCCMU._albumRequests[key]; });
  return request;
};
MCCMU.getPlaces = function (opts) {
  opts = opts || {};
  return MCCMU._loadAll().then(function (all) {
    var items = (all.places || []).slice();
    if (opts.type) items = items.filter(function (d) { return d.type === opts.type; });
    return items;
  });
};
MCCMU.getSettings = function () {
  return MCCMU._loadAll().then(function (all) { return all.settings || {}; });
};
MCCMU.getPrayerTimes = function (date) {
  if (!date) return MCCMU._loadAll().then(function (all) { return all.prayer || {}; });
  return MCCMU.get('prayer', { date: date }); // ขอวันอื่น → ยิงตรง
};

/* ══════════════════════════════════════════════════════════════════
   DOM HELPERS  (ปลอดภัยจาก XSS — ใช้ textContent เสมอ, ไม่ใช้ innerHTML)
   ══════════════════════════════════════════════════════════════════ */
function _q(sel, root) { return (root || document).querySelector(sel); }
function _clear(el) { if (el) el.replaceChildren(); }
function _el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
/* ย่อขนาดรูป Drive ให้พอดีกับที่แสดงจริง — การ์ดกว้างสุด ~400px → w800 พอสำหรับจอ 2x
   (เดิมขอ w1600 ทุกใบ = โหลดข้อมูลเกินความจำเป็นราว 4 เท่า) */
var IMG_W = 800;
function _sizeDriveUrl(url, w) {
  w = w || IMG_W;
  return url
    .replace(/([?&]sz=)w\d+/, '$1w' + w)          // drive.google.com/thumbnail?...&sz=w1600
    .replace(/=w\d+(-h\d+)?$/, '=w' + w);        // lh3.googleusercontent.com/d/ID=w1600
}

/* ใส่รูปลงใน wrapper .ph — โหลดไม่ได้ก็คง placeholder เดิมไว้
   แนบ <img> เข้า DOM ตั้งแต่แรกเพื่อให้ loading="lazy" ทำงาน (รูปนอกจอไม่ถูกโหลด)
   CSS ซ่อนรูปด้วย opacity จนกว่าจะ onload → ยังไม่เห็นกรอบรูปแตกระหว่างรอ */
function _fillImg(ph, url, alt) {
  if (!ph || !url || !/^https:\/\//.test(url)) return;
  var img = new Image();
  img.referrerPolicy = 'no-referrer';   // จำเป็นสำหรับรูป Google Drive (กัน Referer block)
  img.alt = alt || '';
  img.loading = 'lazy';
  img.decoding = 'async';
  var triedAlt = false;
  img.onload = function () { ph.classList.add('has-img'); };
  img.onerror = function () {
    /* รูปหลักโหลดไม่ได้ → ลองอีก endpoint หนึ่งครั้ง (ดึง id แล้วสลับไป lh3) */
    if (!triedAlt) {
      triedAlt = true;
      var m = url.match(/[-\w]{25,}/);
      if (m) { img.src = 'https://lh3.googleusercontent.com/d/' + m[0] + '=w' + IMG_W; return; }
    }
    /* ยังไม่ได้ → เอารูปออก คง placeholder เดิม */
    ph.classList.remove('has-img');
    img.remove();
  };
  ph.appendChild(img);
  img.src = _sizeDriveUrl(url);
}
/* สร้าง wrapper .ph พร้อมรูป (สำหรับการ์ดที่สร้างใหม่) */
function _phWithImg(cls, ratio, url, alt, label) {
  var ph = _el('div', 'ph ' + (cls || ''));
  if (ratio) ph.style.aspectRatio = ratio;
  if (label) ph.setAttribute('data-label', label);
  _fillImg(ph, url, alt);
  return ph;
}
function _skeleton(container, n, builder) {
  if (!container) return;
  _clear(container);
  for (var i = 0; i < n; i++) container.appendChild(builder());
}
function _emptyMsg(container, text) {
  _clear(container);
  container.appendChild(_el('p', 'muted', text));
}
function _thaiDate(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr);
    var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  } catch (e) { return dateStr; }
}

/* ══════════════════════════════════════════════════════════════════
   RENDERERS
   ══════════════════════════════════════════════════════════════════ */

/* ── การ์ดกิจกรรม (ใช้ในหน้า home + activities) ── */
function _activityCard(d) {
  var card = _el('article', 'card card--hover evt');
  if (d.category) card.setAttribute('data-cat', d.category);

  card.appendChild(_phWithImg('arch-sm', '4/5', d.image_url, d.title_th, 'โปสเตอร์'));

  var body = _el('div', 'evt__body');
  var dt = d.date ? new Date(d.date) : null;
  var date = _el('div', 'evt__date');
  if (dt) {
    var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    date.appendChild(_el('span', null, ('0' + dt.getDate()).slice(-2)));
    date.appendChild(_el('small', null, m[dt.getMonth()]));
  }
  body.appendChild(date);

  var info = _el('div');
  info.appendChild(_el('h3', null, d.title_th || ''));
  var sub = [d.location, d.time].filter(Boolean).join(' · ');
  if (sub) info.appendChild(_el('p', 'muted', sub));
  body.appendChild(info);
  card.appendChild(body);
  return card;
}

MCCMU.renderActivities = function (selector, opts) {
  var el = _q(selector); if (!el) return;
  _skeleton(el, opts && opts.limit ? opts.limit : 3, function () {
    return _phWithImg('arch-sm skel', '4/5');
  });
  MCCMU.getActivities(opts).then(function (items) {
    if (!items.length) return _emptyMsg(el, 'ยังไม่มีกิจกรรมในขณะนี้');
    _clear(el);
    items.forEach(function (d) { el.appendChild(_activityCard(d)); });
  }).catch(function (err) {
    console.error('[MCCMU] activities:', err);
    _emptyMsg(el, 'ไม่สามารถโหลดกิจกรรมได้ในขณะนี้');
  });
};

/* ── โปสเตอร์กิจกรรมที่ผ่านมา (หน้าแรก #actGrid) — วันที่ < วันนี้ ใหม่สุดก่อน ── */
function _posterCard(d) {
  var card = _el('article', 'poster-card');
  card.appendChild(_phWithImg('poster-ph', '4/5', d.image_url, d.title_th, 'โปสเตอร์'));
  var body = _el('div', 'poster-card__body');
  body.appendChild(_el('h3', null, d.title_th || ''));
  var dt = _thaiDate(d.date);
  if (dt) body.appendChild(_el('span', 'poster-card__date', dt));
  card.appendChild(body);
  return card;
}
MCCMU.renderPosters = function (sel, opts) {
  opts = opts || {};
  var el = _q(sel); if (!el) return;
  var n = opts.limit || 3;
  _skeleton(el, n, function () {
    var c = _el('article', 'poster-card');
    c.appendChild(_phWithImg('poster-ph skel', '4/5'));
    return c;
  });
  MCCMU.getActivities({}).then(function (items) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var past = items.filter(function (d) {
      if (!d.date) return false;
      return new Date(d.date) < today;
    });
    past.sort(function (a, b) { return a.date > b.date ? -1 : 1; }); // ใหม่สุดก่อน
    past = past.slice(0, n);
    if (!past.length) return _emptyMsg(el, 'ยังไม่มีกิจกรรมที่ผ่านมา');
    _clear(el);
    past.forEach(function (d) { el.appendChild(_posterCard(d)); });
  }).catch(function (err) {
    console.error('[MCCMU] posters:', err);
    _emptyMsg(el, 'ไม่สามารถโหลดกิจกรรมได้ในขณะนี้');
  });
};

/* ── กิจกรรมเด่น — เติมข้อมูลลงการ์ด 1 ใบ (ใช้ทั้งหน้า home และ activities) ── */
function _fillFeatCard(box, d, today) {
  function setTxt(name, val) {
    var t = box.querySelector('[data-feat="' + name + '"]');
    if (t && val) t.textContent = val;
  }
  setTxt('title', d.title_th);
  setTxt('description', d.description);
  setTxt('date', _thaiDate(d.date));
  setTxt('location', d.location);
  /* ลูกเล่น: ป้ายวันที่บนโปสเตอร์ + ชิปบอกวัน (วันนี้/พรุ่งนี้/วัน...นี้/เร็ว ๆ นี้) */
  if (d.date) {
    var ev = new Date(d.date); ev.setHours(0, 0, 0, 0);
    var diff = Math.round((ev - today) / 86400000);
    var cd = box.querySelector('[data-feat="countdown"]');
    if (cd) {
      var thDay = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสฯ','ศุกร์','เสาร์'];
      var past = diff < 0;
      var lbl = past       ? 'จัดไปแล้ว'
              : diff === 0 ? 'วันนี้'
              : diff === 1 ? 'พรุ่งนี้'
              : diff <= 7  ? 'วัน' + thDay[ev.getDay()] + 'นี้'
              : 'เร็ว ๆ นี้';
      cd.hidden = false;
      /* สีชิปบอกสถานะทันทีโดยไม่ต้องอ่าน: เขียว = กำลังจะมาถึง · ม่วง = จัดไปแล้ว */
      cd.classList.add(past ? 'feat-count--past' : 'feat-count--up');
      if (!past && diff <= 1) cd.classList.add('is-today');   // วันนี้/พรุ่งนี้ = เขียวเข้มเน้นกว่า
      var bEl = cd.querySelector('b'); if (bEl) bEl.textContent = lbl;
    }
    var badge = box.querySelector('.feat-date');
    if (badge) {
      var mth = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      badge.hidden = false;
      var bd = badge.querySelector('strong'); if (bd) bd.textContent = ('0' + ev.getDate()).slice(-2);
      var bm = badge.querySelector('small');  if (bm) bm.textContent = mth[ev.getMonth()];
    }
  }
  /* สคีมาใหม่ไม่มี category/time → ซ่อน placeholder ที่ฝังในหน้า */
  var cc = box.querySelector('[data-feat="category"]'); if (cc) cc.style.display = 'none';
  var tt = box.querySelector('[data-feat="time"]'); if (tt && tt.parentElement) tt.parentElement.style.display = 'none';
  if (d.image_url) _fillImg(box.querySelector('.ph'), d.image_url, d.title_th);
}

/* สไลเดอร์กิจกรรมเด่น: จุดบอกตำแหน่ง + ลูกศร + เลื่อนอัตโนมัติ (แสดงเมื่อมี >1 ใบ) */
function _initFeatSlider(track, n) {
  var slider = track.closest('.feat-slider'); if (!slider) return;
  var nav = slider.querySelector('.feat-slider__nav');
  if (n <= 1) { if (nav) nav.hidden = true; return; }
  if (nav) nav.hidden = false;

  var dotsWrap = slider.querySelector('.feat-dots');
  var prev = slider.querySelector('[data-feat-nav="prev"]');
  var next = slider.querySelector('[data-feat-nav="next"]');
  var idx = 0, paused = false, resumeT = null, dots = [];

  if (dotsWrap) {
    _clear(dotsWrap);
    for (var i = 0; i < n; i++) (function (i) {
      var b = _el('button', i === 0 ? 'is-active' : null);
      b.type = 'button';
      b.setAttribute('aria-label', 'กิจกรรมเด่นที่ ' + (i + 1));
      b.addEventListener('click', function () { goTo(i); nudge(); });
      dotsWrap.appendChild(b); dots.push(b);
    })(i);
  }

  function offsetOf(i) { return track.children[i].offsetLeft - track.children[0].offsetLeft; }
  function goTo(i) {
    idx = (i + n) % n;
    track.scrollTo({ left: offsetOf(idx), behavior: 'smooth' });
    setDots(idx);
  }
  function setDots(i) {
    dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); });
  }
  /* sync จุดตอนผู้ใช้ปัดเอง */
  var tick = false;
  track.addEventListener('scroll', function () {
    if (tick) return; tick = true;
    requestAnimationFrame(function () {
      tick = false;
      var step = offsetOf(1) || 1;
      var i = Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / step)));
      if (i !== idx) { idx = i; setDots(i); }
    });
  }, { passive: true });

  if (prev) prev.addEventListener('click', function () { goTo(idx - 1); nudge(); });
  if (next) next.addEventListener('click', function () { goTo(idx + 1); nudge(); });

  function nudge() { paused = true; clearTimeout(resumeT); resumeT = setTimeout(function () { paused = false; }, 8000); }
  track.addEventListener('pointerdown', nudge, { passive: true });
  slider.addEventListener('mouseenter', function () { paused = true; });
  slider.addEventListener('mouseleave', function () { paused = false; });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    setInterval(function () { if (!paused) goTo(idx + 1); }, 6500);
}

/* หัวข้อ section กิจกรรมเด่น — มีงานล่วงหน้า = "เร็ว ๆ นี้", ไม่มี = ป้ายย้อนหลัง, ว่างเปล่า = ซ่อนทั้ง section
   (หน้าแรกไม่โหรงเหรงเพราะมี section "หยิบมาอ่าน" รับช่วงต่ออยู่แล้ว) */
function _setFeatHeading(mode) {
  var h = _q('[data-feat-heading]'); if (!h) return;
  var sec = h.closest('section');
  if (mode === 'upcoming') return;               // ข้อความใน HTML ถูกอยู่แล้ว
  if (mode === 'none') { if (sec) sec.hidden = true; return; }
  h.textContent = 'กิจกรรมล่าสุดที่ผ่านมา';
  var eyebrow = sec && _q('.eyebrow', sec);
  if (eyebrow) eyebrow.replaceChildren(document.createTextNode('ย้อนดู '), _el('span', 'en', 'Recap'));
  /* ป้ายจุดกะพริบ "เร็ว ๆ นี้" บนการ์ด (หน้ากิจกรรม) ต้องเปลี่ยนตามด้วย ไม่งั้นงานที่จบแล้วยังดูเหมือนกำลังจะมา */
  if (sec) sec.querySelectorAll('.feat-upcoming').forEach(function (p) {
    p.replaceChildren(document.createTextNode('กิจกรรมล่าสุดที่ผ่านมา'));
  });
}

/* ── กิจกรรมที่กำลังจะมาถึง (สูงสุด 5) — ที่ปักหมุดเป็นกิจกรรมเด่นขึ้นก่อน แล้วตามด้วยกิจกรรมอื่นที่ยังไม่ถึงวัน
   เดิมพอมีกิจกรรมเด่นสักอัน กิจกรรมที่ไม่ได้ปักหมุดจะไม่ขึ้นที่ไหนเลยจนกว่าจะเลยวันงาน
   มี >1 → แสดงเป็นสไลด์เลื่อนได้ (ต้องมี wrapper .feat-slider ในหน้า เช่น home) ── */
MCCMU.renderFeatured = function (sel) {
  var box = _q(sel); if (!box) return;
  MCCMU.getActivities({}).then(function (items) {
    var isFeat = function (d) { return String(d.featured).toLowerCase() === 'yes' || d.featured === true; };
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var byDate = function (a, b) { return a.date < b.date ? -1 : 1; };
    var future = items.filter(function (d) { return d.date && new Date(d.date) >= today; }).sort(byDate);
    var upcoming = future.filter(isFeat).concat(future.filter(function (d) { return !isFeat(d); }));
    var past = items.filter(function (d) { return d.date && new Date(d.date) < today; }).sort(byDate);
    var pastFeat = past.filter(isFeat);
    var list = upcoming.length ? upcoming.slice(0, 5)
             : (pastFeat.length ? [pastFeat[pastFeat.length - 1]]          // ไม่มีงานล่วงหน้า → งานเด่นล่าสุดใบเดียว
             : (past.length ? [past[past.length - 1]] : []));
    if (!list.length) { _setFeatHeading('none'); return; }
    /* ใบที่โชว์เป็นงานที่จบไปแล้ว → เปลี่ยนหัวข้อ ไม่ให้อ่านว่า "เร็ว ๆ นี้" ทั้งที่ผ่านไปแล้ว */
    _setFeatHeading(upcoming.length ? 'upcoming' : 'past');

    /* มีหลายใบ + หน้ามีสไลเดอร์ → โคลนการ์ดเปล่าเป็นสไลด์เพิ่มก่อนเติมข้อมูล */
    var track = box.closest('.feat-slider__track');
    var cards = [box];
    if (track && list.length > 1) {
      for (var i = 1; i < list.length; i++) {
        var c = box.cloneNode(true);
        c.removeAttribute('id');
        track.appendChild(c);
        cards.push(c);
      }
    }
    cards.forEach(function (card, i) { _fillFeatCard(card, list[i], today); });
    if (track) _initFeatSlider(track, cards.length);
  }).catch(function (err) {
    console.error('[MCCMU] featured:', err);
    _setFeatHeading('none');
  });
};


/* ── เอกสาร / ไฟล์ความรู้ (หน้า knowledge #docGrid) ── */
function _docCard(d) {
  var card = _el('article', 'card card--hover doc');
  if (d.category) card.setAttribute('data-cat', d.category);

  card.appendChild(_phWithImg('arch-sm', '4/5', d.thumb_url, d.title, d.type === 'img' ? 'รูปภาพ' : 'PDF'));

  var body = _el('div', 'article__body');
  if (d.category) body.appendChild(_el('span', 'chip', d.category));
  body.appendChild(_el('h3', null, d.title || ''));
  var meta = [d.session, _thaiDate(d.date)].filter(Boolean).join(' · ');
  if (meta) {
    var mw = _el('div', 'article__meta');
    mw.appendChild(_el('span', null, meta));
    body.appendChild(mw);
  }
  var actions = _el('div'); actions.style.cssText = 'display:flex;gap:10px;margin-top:14px;flex-wrap:wrap';
  if (d.view_url) {
    var v = _el('a', 'btn btn--primary btn--sm', d.type === 'img' ? 'ดูรูป' : 'เปิดอ่าน');
    v.href = d.view_url; v.target = '_blank'; v.rel = 'noopener';
    actions.appendChild(v);
  }
  if (d.download_url) {
    var dl = _el('a', 'btn btn--ghost btn--sm', 'ดาวน์โหลด');
    dl.href = d.download_url; dl.target = '_blank'; dl.rel = 'noopener';
    actions.appendChild(dl);
  }
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

MCCMU.renderDocs = function (gridSel, tabsSel, countSel, emptySel) {
  var grid = _q(gridSel); if (!grid) return;
  var all = [];
  function paint(list) {
    var empty = emptySel && _q(emptySel);
    if (!list.length) {
      _clear(grid);
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    _clear(grid);
    list.forEach(function (d) { grid.appendChild(_docCard(d)); });
  }
  _skeleton(grid, 3, function () { return _phWithImg('arch-sm skel', '4/5'); });

  MCCMU.getDocs().then(function (items) {
    all = items;
    var count = countSel && _q(countSel);
    if (count) count.textContent = items.length + ' ไฟล์';
    paint(all);

    var tabs = tabsSel && _q(tabsSel);
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      b.classList.add('active');
      var f = b.getAttribute('data-f');
      paint(f === 'all' ? all : all.filter(function (d) { return d.category === f; }));
    });
  }).catch(function (err) {
    console.error('[MCCMU] docs:', err);
    _emptyMsg(grid, 'ไม่สามารถโหลดไฟล์ได้ในขณะนี้');
  });
};

/* ══════════════════════════════════════════════════════════════════
   หยิบมาอ่าน — สุ่มไฟล์จากคลังความรู้ขึ้นหน้าแรก (#homePicks)
   • ใช้ข้อมูลก้อนเดียวกับหน้าอื่น (?sheet=all) → ไม่มี request เพิ่ม
   • สุ่มแบบ seed ตามวันที่: เปิดหน้าแรกกี่รอบในวันเดียวกันก็ได้ชุดเดิม
     (cache เป็น stale-while-revalidate 3 นาที ถ้าสุ่มสดทุกครั้งการ์ดจะเด้ง
      สลับไปมาทุกครั้งที่กดย้อนกลับ ดูเหมือนหน้าเว็บพัง) — ขึ้นวันใหม่ค่อยเปลี่ยนชุด
   ══════════════════════════════════════════════════════════════════ */
function _daySeed() {
  var d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
/* mulberry32 — PRNG ขนาดจิ๋ว ให้ผลเหมือนเดิมทุกครั้งเมื่อ seed เท่ากัน */
function _seededRand(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Fisher-Yates ด้วย PRNG ที่ seed ไว้ → ลำดับคงที่ต่อ seed หนึ่ง ๆ */
function _pickSome(items, n, seed) {
  var a = items.slice(), rnd = _seededRand(seed);
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rnd() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a.slice(0, n);
}

/* file_id ในชีตกรอกได้ทั้ง id ล้วนและ URL เต็มของ Drive → ดึงเฉพาะ id ออกมา */
function _driveId(s) {
  s = (s || '').toString().trim();
  var m = s.match(/[-\w]{25,}/);
  return m ? m[0] : s;
}

function _pickCard(d) {
  /* การ์ดทั้งใบเป็นลิงก์ → ไปหน้า knowledge แล้วเปิด preview ไฟล์นั้นให้เลย */
  var card = _el('a', 'card card--hover pick');
  card.href = 'knowledge.html' + (d.file_id ? '#doc=' + encodeURIComponent(_driveId(d.file_id)) : '');
  card.appendChild(_phWithImg('arch-sm', '4/3', d.thumb_url, d.title, 'คลังความรู้'));

  var body = _el('div', 'article__body');
  body.appendChild(_el('span', 'chip', 'คลังความรู้'));
  body.appendChild(_el('h3', null, d.title || ''));
  if (d.description) body.appendChild(_el('p', null, d.description));
  var date = _thaiDate(d.date);
  if (date) {
    var mw = _el('div', 'article__meta');
    mw.appendChild(_el('span', null, date));
    body.appendChild(mw);
  }
  body.appendChild(_el('span', 'svc__go pick__go', 'เปิดอ่าน'));
  card.appendChild(body);
  return card;
}

MCCMU.renderKnowledgePicks = function (sel, n) {
  var grid = _q(sel); if (!grid) return;
  n = n || 3;
  var sec = grid.closest('section');
  function hide() { if (sec) sec.hidden = true; }

  _skeleton(grid, n, function () {
    var c = _el('div', 'card pick');
    c.appendChild(_phWithImg('arch-sm skel', '4/3'));
    c.appendChild(_el('div', 'article__body'));
    return c;
  });

  MCCMU.getDocs().then(function (items) {
    var pool = items.filter(function (d) { return d.title && d.file_id; });
    if (!pool.length) return hide();   // คลังยังว่าง → ไม่ต้องโชว์ section เปล่า
    _clear(grid);
    _pickSome(pool, n, _daySeed()).forEach(function (d) { grid.appendChild(_pickCard(d)); });
  }).catch(function (err) {
    console.error('[MCCMU] picks:', err);
    hide();
  });
};

/* ── แกลเลอรีแบบอัลบัม (หน้า gallery) ──
   1 อัลบัม = 1 โฟลเดอร์กิจกรรม → การ์ดปก → คลิกเปิดดูรูปทั้งหมดใน viewer
   ใช้ overlay เดิม (#lb / #lbImg / #lbCap / #lbClose) ── */
MCCMU.renderGallery = function (gridSel, tabsSel) {
  if (window.MCCMUGallery) return window.MCCMUGallery.mount(gridSel, tabsSel);
  var grid = _q(gridSel); if (!grid) return;
  var tabs = tabsSel && _q(tabsSel);
  var albums = [];

  _skeleton(grid, 6, function () {
    var t = _el('div', 'gtile');
    t.appendChild(_phWithImg('skel', '4/3'));
    return t;
  });

  /* ---- viewer (lightbox) ---- */
  var lb     = document.getElementById('lb');
  var lbImg  = document.getElementById('lbImg');
  var lbCap  = document.getElementById('lbCap');
  var cur    = { photos: [], i: 0, title: '' };

  function ensureNav() {
    if (!lb || lb._navReady) return;
    lb._navReady = true;
    var prev = _el('button', 'lb-nav lb-prev', '‹');
    var next = _el('button', 'lb-nav lb-next', '›');
    prev.setAttribute('aria-label', 'ก่อนหน้า');
    next.setAttribute('aria-label', 'ถัดไป');
    prev.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    next.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
    lb.appendChild(prev); lb.appendChild(next);
  }
  function showPhoto() {
    var p = cur.photos[cur.i]; if (!p) return;
    _clear(lbImg);
    var im = new Image();
    im.referrerPolicy = 'no-referrer';
    im.src = p.image_url || p.thumb_url; im.alt = cur.title;
    im.style.cssText = 'width:100%;height:100%;object-fit:contain';
    lbImg.classList.add('has-img');
    lbImg.appendChild(im);
    if (lbCap) lbCap.textContent = cur.title + ' · ' + (cur.i + 1) + '/' + cur.photos.length;
  }
  function step(d) {
    if (!cur.photos.length) return;
    cur.i = (cur.i + d + cur.photos.length) % cur.photos.length;
    showPhoto();
  }
  function openAlbum(a, idx) {
    if (!a.photos || !a.photos.length) return;
    ensureNav();
    cur.photos = a.photos; cur.i = idx || 0; cur.title = a.title || '';
    showPhoto();
    if (lb) lb.classList.add('open');
  }
  function close() { if (lb) lb.classList.remove('open'); }
  if (lb) {
    var c = document.getElementById('lbClose');
    if (c) c.addEventListener('click', close);
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
  }

  /* ---- album cards ---- */
  function paint(list) {
    _clear(grid);
    if (!list.length) return _emptyMsg(grid, 'ยังไม่มีอัลบัมภาพ');
    list.forEach(function (a) {
      var tile = _el('div', 'gtile album');
      tile.setAttribute('data-cat', a.category || '');
      tile.appendChild(_phWithImg('', '4/3', a.cover_url, a.title, a.title || 'อัลบัม'));
      var cap = _el('span', 'gcap', a.title + (a.count ? ' · ' + a.count + ' รูป' : ''));
      tile.appendChild(cap);
      tile.addEventListener('click', function () { openAlbum(a, 0); });
      grid.appendChild(tile);
    });
  }

  MCCMU.getAlbums().then(function (items) {
    albums = items;
    paint(albums);
    _initCarousel(grid, { prev: '#galPrev', next: '#galNext' }); // แถวเดียว + ปุ่มเลื่อน
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      b.classList.add('active');
      var f = b.getAttribute('data-f');
      paint(f === 'all' ? albums : albums.filter(function (a) { return a.category === f; }));
    });
  }).catch(function (err) {
    console.error('[MCCMU] albums:', err);
    _emptyMsg(grid, 'ไม่สามารถโหลดอัลบัมได้ในขณะนี้');
  });
};

/* ── คณะกรรมการ/สมาชิกบอร์ด (หน้า about · ชีต members) ── */
MCCMU.renderMembers = function (gridSel) {
  var grid = _q(gridSel); if (!grid) return;
  _skeleton(grid, 4, function () {
    var m = _el('div', 'member');
    m.appendChild(_phWithImg('skel', '1/1'));
    return m;
  });
  MCCMU.getMembers().then(function (items) {
    if (!items.length) return _emptyMsg(grid, 'ยังไม่มีรายชื่อกรรมการ');   // ไม่ปล่อยกล่องโหลดกะพริบค้าง
    _clear(grid);
    items.forEach(function (d) {
      var m = _el('div', 'member');
      m.appendChild(_phWithImg('', '1/1', d.image_url, d.name, d.name || 'รูปสมาชิก'));
      m.appendChild(_el('h4', null, d.name || ''));
      if (d.title) m.appendChild(_el('span', null, d.title));        // ตำแหน่ง
      if (d.description) m.appendChild(_el('p', 'muted', d.description));
      grid.appendChild(m);
    });
    _initCarousel(grid, { prev: '#memberPrev', next: '#memberNext' }); // แถวเดียว + ปุ่มเลื่อน
  }).catch(function (err) {
    console.error('[MCCMU] members:', err);
    _emptyMsg(grid, 'โหลดรายชื่อกรรมการไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง');
  });
};

/* ── ร้านฮาลาล / มัสยิด (หน้า halal-map · carousel #foodTrack / #masjidTrack) ── */
var _PLACE_TYPEMAP = { 'ร้านอาหาร': 'food', 'มัสยิด': 'masjid', 'ห้องละหมาด': 'masjid' };
var _PLACE_ICONS = {
  masjid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.8 1.9 2.8 3.3 2.8 4.8A2.8 2.8 0 0 1 12 9.6 2.8 2.8 0 0 1 9.2 6.8C9.2 5.3 10.2 3.9 12 2Z"/><path d="M4 21v-6.5a8 8 0 0 1 16 0V21"/><path d="M3.5 21h17"/><path d="M9.5 21v-2.5a2.5 2.5 0 0 1 5 0V21"/></svg>',
  food:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v6a2.5 2.5 0 0 0 5 0V3M7.5 3v18"/><path d="M17.5 3c-1.7 0-3 2.2-3 5s1.3 4 3 4v9"/></svg>'
};
/* แปลง markup คงที่ -> SVG node (เลี่ยง innerHTML) */
function _svgNode(markup) {
  return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
}
/* badge เล็กแบบ glass วางมุมการ์ด */
function _placeBadge(d) {
  var type = _PLACE_TYPEMAP[d.type] || 'food';
  var isFood = d.type === 'ร้านอาหาร';
  var b = _el('span', 'place__badge' + (isFood ? ' place__badge--gold' : ''));
  b.appendChild(_svgNode(_PLACE_ICONS[type] || _PLACE_ICONS.food));   // SVG คงที่ ไม่ใช่ข้อมูลผู้ใช้
  b.appendChild(document.createTextNode(isFood ? 'อาหารฮาลาล' : (d.type || '')));
  return b;
}

/* สร้าง src แผนที่ Google แบบฝัง (ไม่ต้องใช้ API key) จากพิกัด/ชื่อสถานที่ */
function _gmapEmbedSrc(d) {
  var q = '';
  if (d.coords && /\d/.test(d.coords)) q = String(d.coords).trim();           // "18.79,98.95" (แม่นสุด)
  else if (d.name)  q = [d.name, 'เชียงใหม่'].filter(Boolean).join(' ');        // เดาจากชื่อ
  if (!q) return '';
  return 'https://maps.google.com/maps?q=' + encodeURIComponent(q) + '&z=16&output=embed';
}
/* ลิงก์เปิด Google Maps เต็ม (ปุ่ม "เปิดแผนที่") */
function _gmapLink(d) {
  if (d.map_url && /^https:\/\//.test(d.map_url)) return d.map_url;
  if (d.coords && /\d/.test(d.coords))
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(String(d.coords).trim());
  return '';
}
function _placeCard(d) {
  var card = _el('article', 'card place');
  card.setAttribute('data-type', _PLACE_TYPEMAP[d.type] || 'food');

  /* media ฝั่งซ้าย: แผนที่เล็กฝังจากพิกัด/ชื่อ (ถ้ามี) */
  var embed = _gmapEmbedSrc(d);
  if (embed) {
    var media = _el('div', 'place__media place__map');
    var ifr = document.createElement('iframe');
    ifr.src = embed; ifr.loading = 'lazy';
    ifr.title = 'แผนที่ ' + (d.name || '');
    ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    ifr.setAttribute('allowfullscreen', '');
    media.appendChild(ifr);
    media.appendChild(_placeBadge(d));   // badge เล็ก มุมบนซ้ายของแผนที่
    card.appendChild(media);
  }

  var body = _el('div', 'place__body');
  if (!embed) body.appendChild(_placeBadge(d));   // fallback: ไม่มีแผนที่ -> วาง badge ในเนื้อหา
  body.appendChild(_el('h3', null, d.name || ''));
  if (d.description) body.appendChild(_el('p', 'muted', d.description));

  var mapHref = _gmapLink(d);
  if (mapHref) {
    var a = _el('a', 'btn btn--ghost btn--sm', 'เปิดแผนที่');
    a.href = mapHref; a.target = '_blank'; a.rel = 'noopener';
    a.style.marginTop = '12px';
    body.appendChild(a);
  }
  card.appendChild(body);
  return card;
}

/* ── แผนที่รวมด้านบนหน้าฮาลาล (#halalMap) — settings.halal_map_url หรือพื้นที่ มช. ── */
MCCMU.renderHalalMap = function () {
  var box = document.getElementById('halalMap'); if (!box) return;
  function fill(url) {
    var ifr = document.createElement('iframe');
    ifr.src = url; ifr.loading = 'lazy';
    ifr.title = 'แผนที่ฮาลาล & มัสยิด รอบ มช.';
    ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    ifr.setAttribute('allowfullscreen', '');
    box.classList.add('has-map', 'has-img'); // ซ่อน placeholder
    box.replaceChildren(ifr);
  }
  var def = 'https://maps.google.com/maps?q=' + encodeURIComponent('มหาวิทยาลัยเชียงใหม่') + '&z=14&output=embed';
  MCCMU.getSettings().then(function (s) {
    fill(s.halal_map_url && /^https:\/\//.test(s.halal_map_url) ? s.halal_map_url : def);
  }).catch(function () { fill(def); });
};
/* แยกเป็น 2 โซน (ร้านอาหาร / มัสยิด) แบบ carousel เลื่อนข้าง + ป้ายจำนวน */
MCCMU.renderPlaces = function () {
  var foodTrack   = document.getElementById('foodTrack');
  var masjidTrack = document.getElementById('masjidTrack');
  if (!foodTrack && !masjidTrack) return;

  function skel(track) {
    if (!track) return;
    _skeleton(track, 3, function () {
      var c = _el('article', 'card place place--v');
      c.appendChild(_phWithImg('place__media skel', '16/10'));
      return c;
    });
  }
  skel(foodTrack); skel(masjidTrack);

  function fill(track, list, countId, nav) {
    if (!track) return;
    var count = document.getElementById(countId);
    if (count) count.textContent = list.length ? list.length + ' แห่ง' : '';
    if (!list.length) return _emptyMsg(track, 'ยังไม่มีข้อมูลในหมวดนี้ — แนะนำเข้ามาได้เลย!');
    _clear(track);
    list.forEach(function (d) {
      var c = _placeCard(d);
      c.classList.add('place--v');
      track.appendChild(c);
    });
    _initCarousel(track, nav);
  }

  MCCMU.getPlaces().then(function (items) {
    function ofType(t) {
      return items.filter(function (d) { return (_PLACE_TYPEMAP[d.type] || 'food') === t; });
    }
    fill(foodTrack,   ofType('food'),   'foodCount',   { prev: '#foodPrev',   next: '#foodNext' });
    fill(masjidTrack, ofType('masjid'), 'masjidCount', { prev: '#masjidPrev', next: '#masjidNext' });
  }).catch(function (err) {
    console.error('[MCCMU] places:', err);
    if (foodTrack)   _emptyMsg(foodTrack,   'ไม่สามารถโหลดข้อมูลได้ในขณะนี้');
    if (masjidTrack) _emptyMsg(masjidTrack, 'ไม่สามารถโหลดข้อมูลได้ในขณะนี้');
  });
};

/* ── เวลาละหมาดแถบหน้าแรก (#pTimes / #pToday) ── */
/* ── เวลาละหมาดวันนี้ (หน้าแรก) ──
   แสดงเป็นเส้นเวลาของวัน: ผ่านไปแล้ว · ถัดไป (สีทอง) · ยังไม่ถึง
   ทุกอย่างคิดตามเวลาเชียงใหม่ ไม่ใช่นาฬิกาเครื่องคนดู (นักศึกษาต่างชาติอาจตั้งเขตเวลาบ้านเกิดไว้)
   ข้อความเขียนเป็นภาษาไทยเสมอ แล้วให้ i18n.js แปลเป็นอังกฤษ (กติกาวันที่/ฮิจเราะฮ์/นับถอยหลังอยู่ที่นั่น) */
var _HIJRI_TH = ['มุฮัรรอม', 'ศอฟัร', 'รอบีอุลเอาวัล', 'รอบีอุษษานี', 'ญุมาดัลอูลา', 'ญุมาดัษษานียะฮ์',
                 'รอญับ', 'ชะอ์บาน', 'รอมะฎอน', 'เชาวาล', 'ซุลเกาะอ์ดะฮ์', 'ซุลหิจญะฮ์'];
var _DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
var _MON_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var _MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function _bkkNow() { return new Date(Date.now() + 7 * 3600e3); }   // อ่านค่าด้วย getUTC* เท่านั้น
function _hhmm(t) { var m = String(t || '').match(/(\d{1,2}):(\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; }
function _toMin(t) { var x = _hhmm(t).split(':'); return x.length === 2 ? (+x[0]) * 60 + (+x[1]) : NaN; }
function _eta(diff) {
  var h = Math.floor(diff / 60), m = diff % 60;
  if (!h) return 'อีก ' + m + ' นาที';
  return m ? 'อีก ' + h + ' ชม. ' + m + ' นาที' : 'อีก ' + h + ' ชม.';
}
/* aladhan ส่งมาเป็น "01-05-1448 Jumādá al-ūlá 1448" — ใช้แค่ตัวเลขหน้าสุด แล้วตั้งชื่อเดือนเอง */
function _hijriTH(raw) {
  var m = String(raw || '').match(/^(\d{1,2})-(\d{1,2})-(\d{3,4})/);
  if (!m || !_HIJRI_TH[+m[2] - 1]) return '';
  return (+m[1]) + ' ' + _HIJRI_TH[+m[2] - 1] + ' ฮ.ศ. ' + m[3];
}

MCCMU.renderPrayerStrip = function () {
  var track = document.getElementById('pTimes');
  if (!track) return;
  var today = document.getElementById('pToday');
  var hijri = document.getElementById('pHijri');
  var next = document.getElementById('pNext');

  var b = _bkkNow();
  if (today) today.textContent = 'วัน' + _DAY_TH[b.getUTCDay()] + 'ที่ ' + b.getUTCDate() + ' '
    + _MON_TH[b.getUTCMonth()] + ' ' + (b.getUTCFullYear() + 543);

  /* โครงรอข้อมูล — ไม่ใส่เวลาสมมติ เวลาละหมาดที่ผิดแม้แวบเดียวก็ไม่ควรเห็น */
  _clear(track);
  track.classList.add('is-loading');
  for (var i = 0; i < 5; i++) track.appendChild(_el('li', 'pstop pstop--skel'));

  function draw(p) {
    var list = [['ฟัจร์', p.Fajr], ['ดุฮ์ร', p.Dhuhr], ['อัศร์', p.Asr], ['มัฆริบ', p.Maghrib], ['อิชาอ์', p.Isha]]
      .map(function (x) { return { name: x[0], time: _hhmm(x[1]), min: _toMin(x[1]) }; });
    if (list.some(function (x) { return isNaN(x.min); })) throw new Error('bad prayer times');

    _clear(track);
    track.classList.remove('is-loading');
    list.forEach(function (x) {
      var li = _el('li', 'pstop');
      li.appendChild(_el('span', 'pstop__dot'));
      li.appendChild(_el('span', 'pstop__name', x.name));
      li.appendChild(_el('strong', 'pstop__time', x.time));
      x.li = li;
      track.appendChild(li);
    });
    if (hijri) hijri.textContent = _hijriTH(p.hijri);

    function tick() {
      var n = _bkkNow(), mins = n.getUTCHours() * 60 + n.getUTCMinutes();
      var idx = -1;
      for (var k = 0; k < list.length; k++) if (list[k].min > mins) { idx = k; break; }
      var tomorrow = idx < 0;
      if (tomorrow) idx = 0;

      /* เส้นความคืบหน้า: 0 = ก่อนฟัจร์ · 1 = หลังอิชาอ์ เติมตามสัดส่วนเวลาจริงระหว่างสองเวลา */
      var prog = 0;
      if (tomorrow) prog = 1;
      else if (idx > 0) {
        var a = list[idx - 1].min, z = list[idx].min;
        prog = (idx - 1 + (mins - a) / (z - a)) / (list.length - 1);
      }
      track.style.setProperty('--prog', prog.toFixed(4));

      list.forEach(function (x, k) {
        x.li.classList.toggle('is-past', x.min <= mins && !(tomorrow && k === 0));
        x.li.classList.toggle('is-next', k === idx);
        if (k === idx) x.li.setAttribute('aria-current', 'time'); else x.li.removeAttribute('aria-current');
      });

      if (next) {
        _clear(next);
        next.appendChild(_el('span', 'pstrip__tag', 'ถัดไป'));
        next.appendChild(_el('b', null, list[idx].name));
        if (tomorrow) next.appendChild(_el('span', null, 'พรุ่งนี้'));
        next.appendChild(_el('span', 'pstrip__eta', _eta((list[idx].min - mins + 1440) % 1440)));
      }
    }
    tick();
    clearInterval(MCCMU._prayerTimer);
    MCCMU._prayerTimer = setInterval(tick, 30000);
  }

  MCCMU.getPrayerTimes().then(function (p) {
    /* ข้อมูลรวมถูก cache ไว้ในเครื่อง ถ้าข้ามเที่ยงคืนมาแล้วจะเป็นเวลาของเมื่อวาน → ขอของวันนี้ใหม่ */
    var want = b.getUTCDate() + ' ' + _MON_EN[b.getUTCMonth()] + ' ' + b.getUTCFullYear();
    if (p && p.date && String(p.date).replace(/^0/, '') !== want) {
      var dd = String(b.getUTCDate()).padStart(2, '0') + '-' + String(b.getUTCMonth() + 1).padStart(2, '0') + '-' + b.getUTCFullYear();
      return MCCMU.getPrayerTimes(dd).catch(function () { return p; });
    }
    return p;
  }).then(draw).catch(function (err) {
    console.error('[MCCMU] prayer:', err);
    _clear(track);
    track.classList.remove('is-loading');
    track.appendChild(_el('li', 'pstrip__err', 'โหลดเวลาละหมาดไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง'));
  });
};

/* ── ปรับลิงก์โซเชียล/อีเมล/โลโก้ จาก settings (ทุกหน้า) ── */
MCCMU.applySettings = function () {
  MCCMU.getSettings().then(function (s) {
    /* ลิงก์โซเชียลมาจากหน้าตั้งค่าที่ผู้ดูแลพิมพ์เอง — รับเฉพาะ https เท่านั้น
       กัน javascript:/data: และลิงก์ที่ลืมใส่ https:// (กลายเป็นลิงก์ภายในที่พัง) */
    function setHref(label, url) {
      url = String(url || '').trim();
      if (!/^https:\/\/[^\s]+$/i.test(url)) return;
      document.querySelectorAll('a[aria-label="' + label + '"]').forEach(function (a) {
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
      });
    }
    setHref('Facebook',  s.club_facebook);
    setHref('Instagram', s.club_instagram);
    setHref('YouTube',   s.club_youtube);
    if (s.club_line) setHref('LINE', s.club_line.charAt(0) === '@'
      ? 'https://line.me/R/ti/p/' + encodeURIComponent(s.club_line)
      : s.club_line);

    /* อีเมล (footer/contact) */
    if (s.club_email && /^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(s.club_email)) document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.href = 'mailto:' + s.club_email; a.textContent = s.club_email;
    });
    /* LINE id (แสดงในหน้า contact) */
    if (s.club_line) document.querySelectorAll('a[aria-label="LINE"]').forEach(function (a) {
      if (!/^https?:/.test(a.getAttribute('href') || '')) a.textContent = s.club_line;
    });
    /* โลโก้แบรนด์ จาก backend (ถ้าตั้ง logo_id) — รูป Drive ต้องตั้ง no-referrer */
    if (s.logo_url) document.querySelectorAll('.brand__logo, .footer__brand img').forEach(function (img) {
      img.referrerPolicy = 'no-referrer';
      img.src = s.logo_url;
    });
    MCCMU._settings = s;
  }).catch(function (err) { console.error('[MCCMU] settings:', err); });
};

/* แผนที่สำรอง — ใช้เมื่อยังไม่ได้ตั้ง map_embed_url ในชีต
   พิกัดมาจากที่อยู่ที่แสดงอยู่บนหน้า contact อยู่แล้ว (ไม่ได้ตั้งขึ้นเอง)
   ตั้งค่า map_embed_url ในชีตเมื่อไหร่ ค่านั้นจะถูกใช้แทนทันที */
MCCMU.MAP_FALLBACK = 'https://www.google.com/maps?q=' +
  encodeURIComponent('มหาวิทยาลัยเชียงใหม่ 239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200') +
  '&output=embed';

/* ── แผนที่ที่ตั้ง(หน้า about · settings map_embed_url → ฝัง iframe ใน #contactMap) ── */
MCCMU.renderContactMap = function () {
  var box = document.getElementById('contactMap');
  if (!box) return;
  function show(url) {
    /* ชีตยังว่าง หรือโหลดตั้งค่าไม่ได้ → ใช้แผนที่สำรอง จะได้ไม่ค้างเป็นกล่องเปล่า */
    if (!url || !/^https:\/\//.test(url)) url = MCCMU.MAP_FALLBACK;
    var ifr = document.createElement('iframe');
    ifr.src = url; ifr.loading = 'lazy'; ifr.title = 'แผนที่ที่ตั้งชมรม';
    ifr.style.cssText = 'width:100%;height:100%;min-height:260px;border:0;border-radius:12px';
    ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    box.replaceChildren(ifr);
  }
  MCCMU.getSettings().then(function (s) { show(s.map_embed_url); }).catch(function () { show(''); });
};


/* ── กิจกรรมที่ผ่านมา แบบ carousel เลื่อนได้ (ปุ่ม + เลื่อนอัตโนมัติ) ──
   การ์ดเล็ก 4:5 · ดึงกิจกรรมวันที่ < วันนี้ ใหม่สุดก่อน ── */
MCCMU.renderPastCarousel = function (trackSel, opts) {
  opts = opts || {};
  var track = _q(trackSel); if (!track) return;
  var n = opts.limit || 12;

  _skeleton(track, 5, function () {
    var c = _el('article', 'poster-card');
    c.appendChild(_phWithImg('poster-ph skel', '4/5'));
    return c;
  });

  MCCMU.getActivities({}).then(function (items) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var past = items.filter(function (d) { return d.date && new Date(d.date) < today; });
    past.sort(function (a, b) { return a.date > b.date ? -1 : 1; }); // ใหม่สุดก่อน
    past = past.slice(0, n);
    if (!past.length) return _emptyMsg(track, 'ยังไม่มีกิจกรรมที่ผ่านมา');
    _clear(track);
    past.forEach(function (d) { track.appendChild(_posterCard(d)); });
    _initCarousel(track, opts);
  }).catch(function (err) {
    console.error('[MCCMU] past carousel:', err);
    _emptyMsg(track, 'ไม่สามารถโหลดกิจกรรมได้ในขณะนี้');
  });
};

/* กลไก carousel: ปุ่มเลื่อน + auto-scroll (หยุดเมื่อ hover/แตะ, วนกลับเมื่อสุด) */
function _initCarousel(track, opts) {
  opts = opts || {};
  var prev = _q(opts.prev || '#pastPrev');
  var next = _q(opts.next || '#pastNext');
  var paused = false, timer = null, resumeT = null;

  function stepPx() {
    var card = track.firstElementChild;   // รองรับทั้ง .poster-card และ .gtile
    if (!card) return 220;
    var cs = getComputedStyle(track);
    var gap = parseInt(cs.columnGap || cs.gap, 10) || 18;
    return card.offsetWidth + gap;
  }
  function go(dir) { track.scrollBy({ left: dir * stepPx(), behavior: 'smooth' }); }
  function overflowing() { return track.scrollWidth > track.clientWidth + 8; }

  if (prev) prev.addEventListener('click', function () { go(-1); nudge(); });
  if (next) next.addEventListener('click', function () { go(1);  nudge(); });

  /* หยุดชั่วคราวหลังผู้ใช้กดเอง แล้วค่อยเล่นต่อ */
  function nudge() {
    paused = true; clearTimeout(resumeT);
    resumeT = setTimeout(function () { paused = false; }, 7000);
  }
  track.addEventListener('mouseenter', function () { paused = true; });
  track.addEventListener('mouseleave', function () { paused = false; });
  track.addEventListener('pointerdown', nudge, { passive: true });

  function tick() {
    if (paused || !overflowing()) return;
    var maxLeft = track.scrollWidth - track.clientWidth - 4;
    if (track.scrollLeft >= maxLeft) track.scrollTo({ left: 0, behavior: 'smooth' });
    else go(1);
  }
  if (overflowing()) timer = setInterval(tick, opts.interval || 3800);
}

/* ══════════════════════════════════════════════════════════════════
   AUTO DISPATCH  ตาม <body data-page="...">
   ══════════════════════════════════════════════════════════════════ */
/* แถบบอกว่ากำลังอยู่ในโหมดตัวอย่าง — ติดล่างจอตลอด กันคนลืมว่าที่เห็นยังไม่ใช่หน้าจริง */
MCCMU.previewBar = function () {
  if (!MCCMU.PREVIEW || !document.body) return;
  var old = document.querySelector('.pv-bar');
  if (old) old.remove();
  var ok = !!_previewToken() && !MCCMU._previewFailed;
  var bar = _el('div', 'pv-bar' + (ok ? '' : ' pv-bar--warn'));
  bar.setAttribute('role', 'status');
  var tx = _el('p', 'pv-bar__tx');
  tx.appendChild(_el('b', null, ok ? 'โหมดตัวอย่าง' : 'ดูตัวอย่างไม่ได้'));
  tx.appendChild(_el('span', null, ok
    ? 'รายการที่ขึ้นต้นด้วย "ร่าง ·" คนทั่วไปยังไม่เห็นจนกว่าจะกดเผยแพร่'
    : 'ตอนนี้แสดงเฉพาะที่เผยแพร่แล้ว — เข้าสู่ระบบหลังบ้านในเบราว์เซอร์นี้ก่อน หรือเซสชันหมดอายุแล้ว'));
  var acts = _el('div', 'pv-bar__acts');
  var admin = _el('a', 'pv-bar__btn', ok ? 'กลับหลังบ้าน' : 'เข้าสู่ระบบ');
  admin.href = '/admin';
  var exit = _el('button', 'pv-bar__btn pv-bar__btn--ghost', 'ออกจากโหมดตัวอย่าง');
  exit.type = 'button';
  exit.addEventListener('click', function () {
    try { sessionStorage.removeItem('mccmu_preview'); } catch (e) {}
    location.href = location.pathname + location.hash;
  });
  acts.append(admin, exit);
  bar.append(tx, acts);
  document.body.appendChild(bar);
  document.body.classList.add('is-preview');
};

MCCMU.init = function () {
  var page = (document.body && document.body.getAttribute('data-page')) || '';
  MCCMU.previewBar();
  MCCMU.applySettings(); // ทุกหน้า (footer/social/logo)

  switch (page) {
    case 'home':
      MCCMU.renderFeatured('#homeFeatured');     // กิจกรรมเด่นเร็ว ๆ นี้
      MCCMU.renderKnowledgePicks('#homePicks', 3); // หยิบมาอ่าน (สุ่มรายวัน)
      MCCMU.renderPrayerStrip();
      /* hero เป็นการ์ดโลโก้ static (assets/club-logo.png) — ไม่ render สไลด์รูปแล้ว */
      break;
    case 'activities':
      MCCMU.renderFeatured('#featuredEvt');
      MCCMU.renderPastCarousel('#pastTrack');  // กิจกรรมที่ผ่านมา (carousel)
      MCCMU.renderGallery('#gal'); // อัลบัมภาพ (ยุบจากหน้า gallery เดิม)
      break;
    case 'gallery':
      MCCMU.renderGallery('#albumGrid');
      break;
    /* knowledge: หน้ามี renderer ของตัวเอง (template+lightbox) ดึงผ่าน MCCMU.getDocs() */
    case 'about':
      MCCMU.renderMembers('#boardGrid');
      MCCMU.renderContactMap();
      break;
    case 'halal':
      MCCMU.renderHalalMap();
      MCCMU.renderPlaces(); // 2 carousel: #foodTrack / #masjidTrack
      break;
  }
};

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', MCCMU.init);
else
  MCCMU.init();

window.MCCMU = MCCMU;
