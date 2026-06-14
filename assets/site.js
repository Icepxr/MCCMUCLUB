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
    { id:'home',      th:'หน้าแรก',        en:'Home',       href:'index.html' },
    { id:'about',     th:'เกี่ยวกับชมรม',   en:'About',      href:'about.html' },
    { id:'activities',th:'กิจกรรม',         en:'Activities', href:'activities.html' },
    { id:'prayer',    th:'เวลาละหมาด',      en:'Prayer',     href:'prayer.html' },
    { id:'halal',     th:'ฮาลาล & มัสยิด',  en:'Halal Map',  href:'halal-map.html' },
    { id:'knowledge', th:'คลังความรู้',      en:'Knowledge',  href:'knowledge.html' },
    { id:'gallery',   th:'ภาพถ่าย',         en:'Gallery',    href:'gallery.html' },
    { id:'contact',   th:'ติดต่อ',          en:'Contact',    href:'contact.html' }
  ];

  var logo = P + 'assets/logo.png';

  /* ---------- NAV ---------- */
  var navLinks = links.map(function (l) {
    return '<a href="' + P + l.href + '"' + (l.id === current ? ' class="is-active"' : '') + '>' + l.th + '</a>';
  }).join('');

  var nav =
    '<header class="nav"><div class="container nav__in">' +
      '<a class="brand" href="' + P + 'index.html" aria-label="MCCMU home">' +
        '<img class="brand__logo" src="' + logo + '" alt="MCCMU logo">' +
        '<span class="brand__txt"><span class="brand__th">ชมรมมุสลิม มช.</span>' +
        '<span class="brand__en">CMU Muslim Club</span></span>' +
      '</a>' +
      '<nav class="nav__links">' + navLinks + '</nav>' +
      '<div class="nav__cta"><a class="btn btn--primary btn--sm" href="' + P + 'join.html">สมัครสมาชิก</a></div>' +
      '<button class="nav__burger" aria-label="เมนู" id="mccBurger">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
      '</button>' +
    '</div></header>' +
    '<div class="drawer" id="mccDrawer">' +
      links.map(function (l) {
        return '<a href="' + P + l.href + '">' + l.th + ' <span class="en">' + l.en + '</span></a>';
      }).join('') +
      '<a href="' + P + 'join.html" style="color:var(--grape-600);font-weight:600">สมัครสมาชิก <span class="en">Join us</span></a>' +
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
            '<a href="#" aria-label="Facebook">' + sicon(ic.fb) + '</a>' +
            '<a href="#" aria-label="Instagram">' + sicon(ic.ig) + '</a>' +
            '<a href="#" aria-label="LINE">' + sicon(ic.line) + '</a>' +
            '<a href="#" aria-label="YouTube">' + sicon(ic.yt) + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer__col"><h4>เมนู</h4>' +
          '<a href="' + P + 'about.html">เกี่ยวกับชมรม</a>' +
          '<a href="' + P + 'activities.html">กิจกรรม & ข่าวสาร</a>' +
          '<a href="' + P + 'prayer.html">เวลาละหมาด</a>' +
          '<a href="' + P + 'gallery.html">อัลบัมภาพถ่าย</a>' +
        '</div>' +
        '<div class="footer__col"><h4>บริการ</h4>' +
          '<a href="' + P + 'halal-map.html">ร้านอาหารฮาลาล</a>' +
          '<a href="' + P + 'halal-map.html">แผนที่มัสยิด</a>' +
          '<a href="' + P + 'knowledge.html">คลังความรู้</a>' +
          '<a href="' + P + 'join.html">สมัครสมาชิก</a>' +
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
    burger.addEventListener('click', function () { drawer.classList.toggle('open'); });
  }

  // reveal on scroll
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
})();
