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

/* 🔧 ตั้งค่า — วาง Web App URL ที่ deploy แล้วตรงนี้ */
MCCMU.API_URL = 'https://script.google.com/macros/s/AKfycbyS8PY6nJ4FmFYf4KS8chC4Jej3bZEnA5yPupDw0FvFavoWe1h5q1hJ1VuE_Ga-yKx5Ag/exec';

/* ── core fetch (ใช้ตรงสำหรับ albums + fallback) ── */
MCCMU.get = function (sheet, params) {
  var url = MCCMU.API_URL + '?sheet=' + encodeURIComponent(sheet);
  if (params) {
    Object.keys(params).forEach(function (k) {
      if (params[k] !== '' && params[k] != null)
        url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    });
  }
  return fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (json) {
      if (!json.ok) throw new Error(json.error || 'API error');
      return json.data;
    });
};

/* ══════════════════════════════════════════════════════════════════
   COMBINED LOAD — ดึง ?sheet=all "ครั้งเดียว" ต่อการเข้าเว็บ
   • เก็บใน localStorage มี TTL → เปิดหน้าถัดไปแทบไม่ยิงเลย
   • stale-while-revalidate: ถ้าหมดอายุ ใช้ของเก่าทันที แล้วรีเฟรชเบื้องหลัง
   ทุก getX ด้านล่างอ่านจากก้อนนี้ (กรองฝั่ง client) — ไม่ยิงสดรายอัน
   ══════════════════════════════════════════════════════════════════ */
var LS_KEY = 'mccmu_all_v1';
var LS_TTL = 10 * 60 * 1000; // 10 นาที

function _readLS() {
  try {
    var raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    return (o && o.data) ? o : null;
  } catch (e) { return null; }
}
function _writeLS(data) {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ t: Date.now(), data: data }));
  } catch (e) {}
}
function _fetchAll() {
  return MCCMU.get('all').then(function (data) { _writeLS(data); return data; });
}
function _refreshAll() {
  _fetchAll().then(function (data) {
    MCCMU._allPromise = Promise.resolve(data); // อัปเดต cache ในหน่วยความจำรอบหน้า
  }).catch(function () {});
}

MCCMU._loadAll = function () {
  if (MCCMU._allPromise) return MCCMU._allPromise;
  var stored = _readLS();
  if (stored) {
    MCCMU._allPromise = Promise.resolve(stored.data);
    _refreshAll(); // โชว์ cache ทันที แต่ดึงสดเบื้องหลังเสมอ → รีเฟรชรอบหน้าได้ของล่าสุด
  } else {
    MCCMU._allPromise = _fetchAll();
  }
  return MCCMU._allPromise;
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
/* albums ยังยิงตรง (หนักเพราะอ่าน Drive) — เรียกเฉพาะหน้าที่ใช้ */
MCCMU.getAlbums = function (opts) {
  opts = opts || {};
  return MCCMU.get('albums', { status: (opts && opts.status) || 'published' });
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
/* ใส่รูปลงใน wrapper .ph — โหลดไม่ได้ก็คง placeholder เดิมไว้ */
function _fillImg(ph, url, alt) {
  if (!ph || !url || !/^https:\/\//.test(url)) return;
  var img = new Image();
  img.loading = 'lazy';
  img.alt = alt || '';
  var triedAlt = false;
  img.onload = function () { ph.classList.add('has-img'); ph.appendChild(img); };
  img.onerror = function () {
    /* lh3 โหลดไม่ได้ → ลอง thumbnail endpoint อีกแบบหนึ่งครั้ง */
    if (!triedAlt) {
      triedAlt = true;
      var m = url.match(/lh3\.googleusercontent\.com\/d\/([-\w]+)/);
      if (m) { img.src = 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600'; return; }
    }
    /* ยังไม่ได้ → คง placeholder เดิม */
  };
  img.src = url;
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

/* ── กิจกรรมเด่น (หน้า activities #featuredEvt) — เลือกแถว featured=yes ล่าสุด ── */
MCCMU.renderFeatured = function (sel) {
  var box = _q(sel); if (!box) return;
  MCCMU.getActivities({}).then(function (items) {
    var feat = items.filter(function (d) {
      return String(d.featured).toLowerCase() === 'yes' || d.featured === true;
    });
    var pool = feat.length ? feat : items;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var upcoming = pool.filter(function (d) { return d.date && new Date(d.date) >= today; })
                       .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var d = upcoming.length ? upcoming[0] : pool[pool.length - 1]; // ใกล้สุดที่ยังไม่ถึง, ไม่งั้นล่าสุด
    if (!d) return;
    function setTxt(name, val) {
      var t = box.querySelector('[data-feat="' + name + '"]');
      if (t && val) t.textContent = val;
    }
    setTxt('title', d.title_th);
    setTxt('description', d.description);
    setTxt('date', _thaiDate(d.date));
    setTxt('location', d.location);
    /* สคีมาใหม่ไม่มี category/time → ซ่อน placeholder ที่ฝังในหน้า */
    var cc = box.querySelector('[data-feat="category"]'); if (cc) cc.style.display = 'none';
    var tt = box.querySelector('[data-feat="time"]'); if (tt && tt.parentElement) tt.parentElement.style.display = 'none';
    if (d.image_url) _fillImg(box.querySelector('.ph'), d.image_url, d.title_th);
  }).catch(function (err) { console.error('[MCCMU] featured:', err); });
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

/* ── แกลเลอรีแบบอัลบัม (หน้า gallery) ──
   1 อัลบัม = 1 โฟลเดอร์กิจกรรม → การ์ดปก → คลิกเปิดดูรูปทั้งหมดใน viewer
   ใช้ overlay เดิม (#lb / #lbImg / #lbCap / #lbClose) ── */
MCCMU.renderGallery = function (gridSel, tabsSel) {
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
    if (!items.length) return; // เงียบไว้ ถ้ายังไม่ใส่ข้อมูล
    _clear(grid);
    items.forEach(function (d) {
      var m = _el('div', 'member');
      m.appendChild(_phWithImg('', '1/1', d.image_url, d.name, d.name || 'รูปสมาชิก'));
      m.appendChild(_el('h4', null, d.name || ''));
      if (d.title) m.appendChild(_el('span', null, d.title));        // ตำแหน่ง
      if (d.description) m.appendChild(_el('p', 'muted', d.description));
      grid.appendChild(m);
    });
  }).catch(function (err) { console.error('[MCCMU] members:', err); });
};

/* ── ร้านฮาลาล / มัสยิด (หน้า halal-map #placeGrid) ── */
var _PLACE_TYPEMAP = { 'ร้านอาหาร': 'food', 'มัสยิด': 'masjid', 'ห้องละหมาด': 'masjid' };

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
    card.appendChild(media);
  }

  var body = _el('div', 'place__body');
  body.appendChild(_el('span', d.type === 'ร้านอาหาร' ? 'chip chip--gold' : 'chip', d.type === 'ร้านอาหาร' ? 'ฮาลาล' : d.type));
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
MCCMU.renderPlaces = function (gridSel, tabsSel) {
  var grid = _q(gridSel); if (!grid) return;
  var all = [];
  function paint(list) {
    _clear(grid);
    if (!list.length) return _emptyMsg(grid, 'ยังไม่มีข้อมูลในหมวดนี้');
    list.forEach(function (d) { grid.appendChild(_placeCard(d)); });
  }
  _skeleton(grid, 4, function () {
    var c = _el('article', 'card place');
    c.appendChild(_phWithImg('place__media skel'));
    return c;
  });
  MCCMU.getPlaces().then(function (items) {
    all = items;
    paint(all);
    var tabs = tabsSel && _q(tabsSel);
    if (tabs) tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      tabs.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      b.classList.add('active');
      var f = b.getAttribute('data-f');
      paint(f === 'all' ? all : all.filter(function (d) { return (_PLACE_TYPEMAP[d.type] || 'food') === f; }));
    });
  }).catch(function (err) {
    console.error('[MCCMU] places:', err);
    _emptyMsg(grid, 'ไม่สามารถโหลดข้อมูลสถานที่ได้');
  });
};

/* ── เวลาละหมาดแถบหน้าแรก (#pTimes / #pToday) ── */
MCCMU.renderPrayerStrip = function () {
  var wrap = document.getElementById('pTimes');
  if (!wrap) return;
  MCCMU.getPrayerTimes().then(function (p) {
    var order = [['ฟัจร์', p.Fajr], ['ดุฮ์ร', p.Dhuhr], ['อัศร์', p.Asr], ['มัฆริบ', p.Maghrib], ['อิชาอ์', p.Isha]];
    var now = new Date(); var mins = now.getHours() * 60 + now.getMinutes();
    function toMin(t) { var x = (t || '').split(':'); return (+x[0]) * 60 + (+x[1]); }
    var nextIdx = order.findIndex(function (t) { return toMin(t[1]) > mins; });
    if (nextIdx < 0) nextIdx = 0;
    _clear(wrap);
    order.forEach(function (t, i) {
      var d = _el('div', 'ptime' + (i === nextIdx ? ' next' : ''));
      d.appendChild(_el('span', null, t[0]));
      d.appendChild(_el('strong', null, t[1] || '—'));
      wrap.appendChild(d);
    });
    var pToday = document.getElementById('pToday');
    if (pToday && p.date) pToday.textContent = p.date + (p.hijri ? ' · ' + p.hijri : '');
  }).catch(function (err) { console.error('[MCCMU] prayer:', err); });
};

/* ── ปรับลิงก์โซเชียล/อีเมล/โลโก้ จาก settings (ทุกหน้า) ── */
MCCMU.applySettings = function () {
  MCCMU.getSettings().then(function (s) {
    function setHref(label, url) {
      if (!url) return;
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
    if (s.club_email) document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.href = 'mailto:' + s.club_email; a.textContent = s.club_email;
    });
    /* LINE id (แสดงในหน้า contact) */
    if (s.club_line) document.querySelectorAll('a[aria-label="LINE"]').forEach(function (a) {
      if (!/^https?:/.test(a.getAttribute('href') || '')) a.textContent = s.club_line;
    });
    /* โลโก้แบรนด์ จาก backend (ถ้าตั้ง logo_id) */
    if (s.logo_url) document.querySelectorAll('.brand__logo, .footer__brand img').forEach(function (img) {
      img.src = s.logo_url;
    });
    MCCMU._settings = s;
  }).catch(function (err) { console.error('[MCCMU] settings:', err); });
};

/* ── แผนที่ที่ตั้ง(หน้า about · settings map_embed_url → ฝัง iframe ใน #contactMap) ── */
MCCMU.renderContactMap = function () {
  var box = document.getElementById('contactMap');
  if (!box) return;
  MCCMU.getSettings().then(function (s) {
    var url = s.map_embed_url;
    if (!url || !/^https:\/\//.test(url)) return;
    var ifr = document.createElement('iframe');
    ifr.src = url; ifr.loading = 'lazy'; ifr.title = 'แผนที่ที่ตั้งชมรม';
    ifr.style.cssText = 'width:100%;height:100%;min-height:260px;border:0;border-radius:12px';
    ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    box.replaceChildren(ifr);
  }).catch(function () {});
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
    var card = track.querySelector('.poster-card');
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
MCCMU.init = function () {
  var page = (document.body && document.body.getAttribute('data-page')) || '';
  MCCMU.applySettings(); // ทุกหน้า (footer/social/logo)

  switch (page) {
    case 'home':
      MCCMU.renderFeatured('#homeFeatured');     // กิจกรรมเด่นเร็ว ๆ นี้
      MCCMU.renderPrayerStrip();
      /* hero เป็นการ์ดโลโก้ static (assets/club-logo.png) — ไม่ render สไลด์รูปแล้ว */
      break;
    case 'activities':
      MCCMU.renderFeatured('#featuredEvt');
      MCCMU.renderPastCarousel('#pastTrack');  // กิจกรรมที่ผ่านมา (carousel)
      MCCMU.renderGallery('#gal'); // อัลบัมภาพ (ยุบจากหน้า gallery เดิม)
      break;
    /* knowledge: หน้ามี renderer ของตัวเอง (template+lightbox) ดึงผ่าน MCCMU.getDocs() */
    case 'about':
      MCCMU.renderMembers('#boardGrid');
      MCCMU.renderContactMap();
      break;
    case 'halal':
      MCCMU.renderHalalMap();
      MCCMU.renderPlaces('#placeGrid', '#placeTabs');
      break;
  }
};

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', MCCMU.init);
else
  MCCMU.init();

window.MCCMU = MCCMU;
