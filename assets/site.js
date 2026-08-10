/* ============================================================
   MCCMU shared chrome — nav + footer, injected on every page
   Usage:  <body data-page="home"> ... and at end load this file.
   ============================================================ */
(function () {
  // khatam pattern as a data-uri (white stroke; opacity handled in CSS)
  var khatam = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
    '<g fill="none" stroke="%23ffffff" stroke-width="1.1">' +
    '<rect x="30" y="30" width="60" height="60"/>' +
    '<rect x="30" y="30" width="60" height="60" transform="rotate(45 60 60)"/>' +
    '<circle cx="60" cy="60" r="16"/></g></svg>'
  );
  document.documentElement.style.setProperty('--khatam-url', 'url("' + khatam + '")');

  var P = (window.MCCMU_BASE || '');           // path prefix if needed
  var current = document.body.getAttribute('data-page') || '';

  var links = [
    { id:'home',      th:'หน้าแรก',              en:'Home',       href:'index.html' },
    { id:'activities',th:'กิจกรรม',              en:'Activities', href:'activities.html' },
    { id:'halal',     th:'สถานที่ & อาหารฮาลาล',  en:'Halal Map',  href:'halal-map.html' },
    { id:'knowledge', th:'คลังความรู้',            en:'Knowledge',  href:'knowledge.html' },
    { id:'about',     th:'เกี่ยวกับเรา',           en:'About',      href:'about.html' }
  ];

  var logo = P + 'assets/logo_white_bc.png';

  /* ---------- NAV ---------- */
  var navLinks = links.map(function (l) {
    return '<a href="' + P + l.href + '"' + (l.id === current ? ' class="is-active"' : '') + '>' + l.th + '</a>';
  }).join('');

  var nav =
    '<header class="nav"><div class="container nav__in">' +
      '<a class="brand" href="' + P + 'index.html" aria-label="MCCMU home">' +
        '<span class="brand__logo-wrap"><img class="brand__logo" src="' + logo + '" alt="MCCMU logo"></span>' +
        '<span class="brand__txt"><span class="brand__th">˚𝜗𝜚˚ชมรมมุสลิม</span>' +
        '<span class="brand__en">มหาวิทยาลัยเชียงใหม่ MCCMU</span></span>' +
      '</a>' +
      '<nav class="nav__links">' + navLinks + '</nav>' +
      '<div class="nav__cta"><a class="btn btn--primary btn--sm" href="' + P + 'about.html#contact">ติดต่อเรา</a></div>' +
      '<button class="nav__burger" aria-label="เมนู" aria-expanded="false" aria-controls="mccDrawer" id="mccBurger">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
      '</button>' +
    '</div></header>' +
    '<div class="drawer" id="mccDrawer">' +
      links.map(function (l) {
        return '<a href="' + P + l.href + '">' + l.th + ' <span class="en">' + l.en + '</span></a>';
      }).join('') +
      '<a href="' + P + 'about.html#contact" style="color:var(--grape-600);font-weight:600">ติดต่อเรา <span class="en">Contact</span></a>' +
    '</div>';

  /* ---------- FOOTER ---------- */
  var ic = {
    fb:'<path d="M14 9h3l.5-3H14V4.5C14 3.6 14.3 3 15.7 3H17V.2C16.6.1 15.5 0 14.3 0 11.8 0 10 1.5 10 4.3V6H7v3h3v9h4z"/>',
    ig:'<rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.4"/>',
    line:'<path d="M12 3C6.5 3 2 6.6 2 11c0 4 3.6 7.3 8.4 7.9.3.07.8.22.9.5.08.26.05.66.03.92l-.14.86c-.04.26-.2 1 .88.55s5.86-3.45 8-5.9C21.4 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    yt:'<rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3z"/>'
  };
  function sicon(p){return '<svg viewBox="0 0 24 24" fill="currentColor">'+p+'</svg>';}

  var footer =
    '<footer class="footer"><div class="footer__pattern"></div><div class="container">' +
      '<div class="footer__grid">' +
        '<div class="footer__about">' +
          '<div class="footer__brand"><img src="' + logo + '" alt="MCCMU">' +
            '<span><span class="th">ชมรมมุสลิม มช.</span><br><span class="en">CMU Muslim Club</span></span></div>' +
          '<p>ชมรมมุสลิมมหาวิทยาลัยเชียงใหม่ — บ้านของพี่น้องมุสลิม ' +
          'พื้นที่แห่งการเรียนรู้ มิตรภาพ และการเติบโตทางจิตวิญญาณในรั้วมหาวิทยาลัย</p>' +
          '<div class="footer__social">' +
            '<a href="https://www.facebook.com/MuslimClubCMU" target="_blank" rel="noopener" aria-label="Facebook">' + sicon(ic.fb) + '</a>' +
            '<a href="https://www.instagram.com/muslimclub.cmu" target="_blank" rel="noopener" aria-label="Instagram">' + sicon(ic.ig) + '</a>' +
            '<a href="https://www.youtube.com/@muslimcmu" target="_blank" rel="noopener" aria-label="YouTube">' + sicon(ic.yt) + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer__col"><h4>เมนู</h4>' +
          '<a href="' + P + 'index.html">หน้าแรก</a>' +
          '<a href="' + P + 'activities.html">กิจกรรม</a>' +
          '<a href="' + P + 'halal-map.html">สถานที่ & อาหารฮาลาล</a>' +
          '<a href="' + P + 'knowledge.html">คลังความรู้</a>' +
          '<a href="' + P + 'about.html">เกี่ยวกับเรา</a>' +
        '</div>' +
        '<div class="footer__col"><h4>เนื้อหา</h4>' +
          '<a href="' + P + 'activities.html#gallery">อัลบัมภาพกิจกรรม</a>' +
          '<a href="' + P + 'index.html#prayer">เวลาละหมาดวันนี้</a>' +
          '<a href="' + P + 'halal-map.html">แผนที่ฮาลาล & มัสยิด</a>' +
          '<a href="' + P + 'about.html#contact">ติดต่อเรา</a>' +
        '</div>' +
        '<div class="footer__col"><h4>ติดต่อเรา</h4>' +
          '<p style="margin-bottom:10px">มหาวิทยาลัยเชียงใหม่<br>239 ถ.ห้วยแก้ว ต.สุเทพ<br>อ.เมือง จ.เชียงใหม่ 50200</p>' +
          '<a href="mailto:muslimclub@cmu.ac.th">muslimclub@cmu.ac.th</a>' +
        '</div>' +
      '</div>' +
      '<div class="footer__bottom">' +
        '<span>© ' + new Date().getFullYear() + ' ชมรมมุสลิมมหาวิทยาลัยเชียงใหม่ · MCCMU</span>' +
        '<span>وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَىٰ</span>' +
      '</div>' +
    '</div></footer>';

  // inject
  var navMount = document.getElementById('site-nav');
  var footMount = document.getElementById('site-footer');
  if (navMount) navMount.outerHTML = nav;
  if (footMount) footMount.outerHTML = footer;

  // burger
  var burger = document.getElementById('mccBurger');
  var drawer = document.getElementById('mccDrawer');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    drawer.addEventListener('click', function (e) {
      if (!e.target.closest('a')) return;
      drawer.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  }

  /* ---------- prefetch หน้าถัดไปตอนชี้เมาส์/แตะค้าง ----------
     ผู้ใช้ยังไม่ทันคลิก เบราว์เซอร์ก็ดึง HTML ของหน้านั้นไว้ก่อนแล้ว
     → กดเมนูแล้วขึ้นแทบทันที (แต่ละหน้าถูก prefetch ครั้งเดียว) */
  (function () {
    var done = {};
    var slow = navigator.connection &&
      (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''));
    if (slow) return;                       // เน็ตช้า/ประหยัดดาต้า → ไม่ต้อง prefetch

    function prefetch(href) {
      if (!href || done[href]) return;
      done[href] = 1;
      var l = document.createElement('link');
      l.rel = 'prefetch';
      l.as = 'document';
      l.href = href;
      document.head.appendChild(l);
    }
    function onHover(e) {
      var a = e.target.closest && e.target.closest('.nav__links a, .drawer a, .nav__cta a');
      if (!a) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      prefetch(u.pathname + u.search);
    }
    document.addEventListener('mouseover', onHover, { passive: true });
    document.addEventListener('touchstart', onHover, { passive: true });
  })();

  // back-to-top — ปุ่มลอยกลับขึ้นบน โผล่เมื่อเลื่อนลงลึก (ช่วยหน้าที่รายการยาว)
  var toTop = document.createElement('button');
  toTop.className = 'to-top';
  toTop.type = 'button';
  toTop.setAttribute('aria-label', 'กลับขึ้นด้านบน');
  (function () { // สร้างไอคอนลูกศรด้วย DOM API (เลี่ยง innerHTML)
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M12 19V5M5 12l7-7 7 7');
    svg.appendChild(path);
    toTop.appendChild(svg);
  })();
  toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(toTop);
  var toTopTick = false;
  window.addEventListener('scroll', function () {
    if (toTopTick) return;
    toTopTick = true;
    requestAnimationFrame(function () {
      toTop.classList.toggle('show', window.scrollY > 600);
      toTopTick = false;
    });
  }, { passive: true });

  /* ---------- นับผู้เข้าชม ----------
     ส่งแค่ชื่อหน้ากับธงว่า "วันนี้เคยนับเบราว์เซอร์นี้แล้วหรือยัง"
     ไม่ส่ง IP ไม่ส่งอะไรที่ระบุตัวตน · ธงเก็บใน localStorage ของเครื่องผู้ใช้เอง
     ล้มเหลวเมื่อไหร่ก็เงียบ ๆ ไป สถิติไม่ควรทำให้หน้าเว็บพัง */
  (function () {
    if (!window.MCCMU_SUPABASE) return;          // ยังไม่ตั้งค่า → ไม่ต้องนับ
    var today = new Date().toISOString().slice(0, 10);
    var key = 'mccmu_seen_' + today;
    var fresh = false;
    try {
      fresh = !localStorage.getItem(key);
      if (fresh) localStorage.setItem(key, '1');
    } catch (e) {}

    var path = location.pathname.replace(/index\.html$/, '') || '/';
    fetch(window.MCCMU_SUPABASE.url + '/rest/v1/rpc/track_view', {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: window.MCCMU_SUPABASE.key },
      body: JSON.stringify({ p_path: path, p_new_visitor: fresh }),
      keepalive: true,
    }).catch(function () {});
  })();

  // reveal on scroll
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  // count-up — ตัวเลขสถิติ (120+, 15, 20+) วิ่งขึ้นเมื่อเลื่อนมาเห็น
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        nio.unobserve(e.target);
        var el = e.target;
        var m = (el.textContent || '').trim().match(/^(\d+)(.*)$/);
        if (!m) return;
        var target = +m[1], suffix = m[2] || '';
        var t0 = null, DUR = 1100;
        function frame(ts) {
          if (!t0) t0 = ts;
          var p = Math.min((ts - t0) / DUR, 1);
          p = 1 - Math.pow(1 - p, 3); // ease-out
          el.textContent = Math.round(target * p) + suffix;
          if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.hero__meta strong, .stat strong').forEach(function (el) { nio.observe(el); });
  }
})();
