/* ============================================================
   MCCMU i18n — TH/EN toggle (รองรับนักศึกษาต่างชาติ)
   • ปุ่ม EN/ไทย บน navbar · จำภาษาไว้ใน localStorage
   • แปลข้อความ static ทั้งหมดด้วยพจนานุกรม + กติกา (ตัวเลข/วันที่)
   • เนื้อหาที่โหลดทีหลัง (จากชีต) ถูกแปลผ่าน MutationObserver
   • ข้อความกิจกรรมที่กรอกในชีตเป็นภาษาไทย จะแสดงตามต้นฉบับ
   ============================================================ */
(function () {
  var KEY = 'mccmu_lang';
  var lang = 'th';
  try { lang = window.localStorage.getItem(KEY) || 'th'; } catch (e) {}

  /* ---------- dictionary (normalize ช่องว่างเป็น 1 เคาะก่อน lookup) ---------- */
  var MAP = {
    /* nav / drawer / footer */
    'หน้าแรก': 'Home',
    'กิจกรรม': 'Activities',
    'สถานที่ & อาหารฮาลาล': 'Halal Map',
    'คลังความรู้': 'Knowledge',
    'เกี่ยวกับเรา': 'About us',
    'ติดต่อเรา': 'Contact us',
    '˚𝜗𝜚˚ชมรมมุสลิม': '˚𝜗𝜚˚Muslim Club',
    'มหาวิทยาลัยเชียงใหม่ MCCMU': 'Chiang Mai University MCCMU',
    'ชมรมมุสลิม มช.': 'CMU Muslim Club',
    'ชมรมมุสลิมมหาวิทยาลัยเชียงใหม่ — บ้านของพี่น้องมุสลิม พื้นที่แห่งการเรียนรู้ มิตรภาพ และการเติบโตทางจิตวิญญาณในรั้วมหาวิทยาลัย':
      'CMU Muslim Club — a home for Muslim students; a space for learning, friendship, and spiritual growth on campus.',
    'เมนู': 'Menu',
    'เนื้อหา': 'Content',
    'อัลบัมภาพกิจกรรม': 'Photo albums',
    'เวลาละหมาดวันนี้': "Today's prayer times",
    'แผนที่ฮาลาล & มัสยิด': 'Halal & masjid map',
    'มหาวิทยาลัยเชียงใหม่': 'Chiang Mai University',
    '239 ถ.ห้วยแก้ว ต.สุเทพ': '239 Huay Kaew Rd., Suthep',
    'อ.เมือง จ.เชียงใหม่ 50200': 'Mueang, Chiang Mai 50200',

    /* home — hero */
    'พื้นที่ของนักศึกษามุสลิม': 'A home for Muslim students',
    'ในมหาวิทยาลัยเชียงใหม่': 'at Chiang Mai University',
    'เชื่อมพี่น้องใหม่กับชุมชนที่ช่วยกันดูแลเรื่องละหมาด อาหารฮาลาล การเรียน และกิจกรรมที่ทำให้ชีวิตในรั้ว มช. ง่ายขึ้น':
      'Connecting new students with a community that supports prayer, halal food, studies, and activities that make life at CMU easier.',
    'กิจกรรมล่าสุด': 'Latest activities',
    'รู้จักชมรม': 'About the club',
    'สมาชิกปัจจุบัน': 'Current members',
    'คณะที่มีสมาชิก': 'Faculties represented',
    'กิจกรรม / ปี': 'Activities / year',
    'เรียนรู้ · ดูแล · เติบโต': 'Learn · Care · Grow',

    /* prayer strip */
    'เวลาละหมาดวันนี้ · เชียงใหม่': 'Prayer times today · Chiang Mai',
    'ฟัจร์': 'Fajr', 'ดุฮ์ร': 'Dhuhr', 'อัศร์': 'Asr', 'มัฆริบ': 'Maghrib', 'อิชาอ์': 'Isha',

    /* featured */
    'ไฮไลต์': 'Featured',
    'กิจกรรมเด่นเร็ว ๆ นี้': 'Upcoming featured events',
    'กำลังโหลดกิจกรรม…': 'Loading event…',
    'รอสักครู่ กำลังดึงข้อมูลกิจกรรมล่าสุด': 'Please wait — fetching the latest event.',
    'กำลังโหลดโปสเตอร์…': 'Loading poster…',
    'หมวดกิจกรรม': 'Category',
    'ดูกิจกรรมทั้งหมด': 'View all activities',
    'วันนี้': 'Today', 'พรุ่งนี้': 'Tomorrow', 'เร็ว ๆ นี้': 'Coming soon',
    'วันอาทิตย์นี้': 'This Sunday', 'วันจันทร์นี้': 'This Monday', 'วันอังคารนี้': 'This Tuesday',
    'วันพุธนี้': 'This Wednesday', 'วันพฤหัสฯนี้': 'This Thursday', 'วันศุกร์นี้': 'This Friday', 'วันเสาร์นี้': 'This Saturday',

    /* home — services */
    'บริการของชมรม': 'Club services',
    'ทางลัดไปยังสิ่งที่ใช้บ่อย': 'Quick links to what you need',
    'เวลาละหมาด': 'Prayer times',
    'เช็กเวลาละหมาดประจำวันของเชียงใหม่ พร้อมไฮไลต์เวลาถัดไป': "Check Chiang Mai's daily prayer times with the next prayer highlighted.",
    'ดูเวลาวันนี้': "See today's times",
    'ฮาลาล & มัสยิด': 'Halal & Masjid',
    'รวมร้านอาหารฮาลาล มัสยิด และจุดละหมาดรอบมหาวิทยาลัย': 'Halal restaurants, masjids, and prayer spots around campus.',
    'ดูแผนที่': 'View map',
    'บทความ ดุอาอ์ คู่มือ และสื่อที่ช่วยให้ใช้ชีวิตในมหาวิทยาลัยได้มั่นใจขึ้น': 'Articles, duas, guides, and media to help you live campus life with confidence.',
    'อ่านต่อ': 'Read more',
    'อัลบัมกิจกรรม': 'Activity albums',
    'ดูบรรยากาศจริงจากกิจกรรมที่สมาชิกช่วยกันสร้างตลอดปี': 'See real moments from activities our members create all year round.',
    'เปิดอัลบัม': 'Open albums',

    /* halal page */
    'กินอุ่นใจ ละหมาดสะดวก': 'Eat & pray with ease',
    'ร้านอาหารฮาลาล': 'Halal restaurants',
    'และมัสยิดรอบ มช.': 'and masjids around CMU',
    'รวมพิกัดร้านอาหารฮาลาลที่ไว้ใจได้ และมัสยิด/ห้องละหมาดใกล้มหาวิทยาลัย ให้ชีวิตมุสลิมในเชียงใหม่ง่ายขึ้น':
      'Trusted halal restaurants and nearby masjids & prayer rooms — making Muslim life in Chiang Mai easier.',
    'กำลังโหลดแผนที่…': 'Loading map…',
    'มัสยิด / ห้องละหมาด': 'Masjids / prayer rooms',
    'กินอุ่นใจ': 'Eat with confidence',
    'ละหมาดสะดวก': 'Pray with ease',
    'รู้จักร้านฮาลาลหรือที่ละหมาดดี ๆ ที่ยังไม่อยู่ในรายการ? ช่วยกันแนะนำเข้ามาได้ที่หน้า':
      'Know a great halal restaurant or prayer spot not listed yet? Recommend it via our',
    'เพื่อให้ข้อมูลครบและเป็นประโยชน์กับทุกคน': 'page — so everyone benefits.',
    'อาหารฮาลาล': 'Halal food', 'มัสยิด': 'Masjid', 'ห้องละหมาด': 'Prayer room',
    'เปิดแผนที่': 'Open map',
    'ยังไม่มีข้อมูลในหมวดนี้ — แนะนำเข้ามาได้เลย!': 'Nothing here yet — send us your recommendations!',
    'ไม่สามารถโหลดข้อมูลได้ในขณะนี้': 'Unable to load data right now',

    /* knowledge page */
    'เรียนรู้ไปด้วยกัน': 'Learning together',
    'คลังความรู้อิสลาม': 'Islamic knowledge hub',
    'สรุปเนื้อหาบรรยาย ฮาลาเกาะฮ์ และสื่อการเรียนรู้ที่คัดสรรเพื่อชีวิตมุสลิมในมหาวิทยาลัย':
      'Lecture summaries, halaqah notes, and curated learning materials for Muslim campus life.',
    'สรุปเนื้อหา · ฮาลาเกาะฮ์': 'Lecture notes · Halaqah',
    'คลังความรู้ศาสนา': 'Religious knowledge library',
    'ดาวน์โหลดและแชร์ต่อได้เลย — PDF อ่านบนมือถือ': 'Download and share — mobile-friendly PDFs',
    'เพิ่มล่าสุดก่อน': 'Newest first',
    'กำลังโหลด…': 'Loading…',
    'แหล่งข้อมูลแนะนำ': 'Recommended resources',
    'ตารางเวลาละหมาดประจำวันของเชียงใหม่': 'Daily prayer timetable for Chiang Mai',
    'แผนที่ฮาลาล': 'Halal map',
    'ร้านอาหารและมัสยิดรอบมหาวิทยาลัย': 'Restaurants and masjids around campus',
    'ถามคำถามศาสนา': 'Ask a religious question',
    'ส่งคำถามมาพูดคุยกับพี่ ๆ ในชมรม': 'Send your questions to our senior members',
    'พรีวิว': 'Preview', 'โหลด': 'Download', 'ดาวน์โหลด': 'Download',
    'ดูรูป': 'View image', 'เปิดอ่าน': 'Open',
    'ยังไม่มีไฟล์ในหมวดนี้': 'No files in this category yet',
    'ไฟล์เอกสาร': 'Document',
    'ไม่สามารถโหลดไฟล์ได้ในขณะนี้': 'Unable to load files right now',

    /* activities page */
    'เกิดอะไรขึ้นบ้าง': "What's happening",
    'กิจกรรมและข่าวสาร': 'Activities & news',
    'ของชมรม': 'from the club',
    'กิจกรรม & ข่าวสาร': 'Activities & news',
    'ติดตามกิจกรรมที่กำลังจะมาถึง ย้อนดูสิ่งที่ผ่านมา และไม่พลาดทุกข่าวสารสำคัญจากครอบครัวมุสลิม มช.':
      'Follow upcoming activities, look back at past ones, and never miss news from the CMU Muslim family.',
    'ย้อนดูบรรยากาศ': 'Looking back',
    'กิจกรรมที่ผ่านมา': 'Past activities',
    'ความทรงจำของเรา': 'Our memories',
    'บรรยากาศจริงจากกิจกรรมที่สมาชิกช่วยกันสร้างตลอดปี — คลิกที่อัลบัมเพื่อดูภาพทั้งหมด':
      'Real moments from our activities all year — click an album to view all photos.',
    'ยังไม่มีกิจกรรมที่ผ่านมา': 'No past activities yet',
    'ไม่สามารถโหลดกิจกรรมได้ในขณะนี้': 'Unable to load activities right now',
    'ยังไม่มีอัลบัมภาพ': 'No albums yet',
    'ไม่สามารถโหลดอัลบัมได้ในขณะนี้': 'Unable to load albums right now',
    'ยังไม่มีกิจกรรมในขณะนี้': 'No activities right now',
    'โปสเตอร์': 'Poster',

    /* about page */
    'เกี่ยวกับชมรม': 'About the club',
    'เรื่องราวของครอบครัว': 'The story of the',
    'จากกลุ่มนักศึกษามุสลิมไม่กี่คน สู่ชุมชนที่อบอุ่นและเข้มแข็ง ที่คอยดูแลพี่น้องในรั้วมหาวิทยาลัยเชียงใหม่มากว่าสิบปี':
      'From a handful of Muslim students to a warm, strong community caring for one another at CMU for over a decade.',
    'จุดเริ่มต้น': 'Our story',
    'เริ่มจากความตั้งใจเล็ก ๆ': 'It began with a small intention',
    'ที่จะมีบ้านสักหลัง': '— to have a home',
    'ชมรมมุสลิมมหาวิทยาลัยเชียงใหม่ก่อตั้งขึ้นจากการรวมตัวของนักศึกษามุสลิมที่มาจาก ต่างจังหวัด ต่างวัฒนธรรม แต่มีหัวใจเดียวกัน — อยากมีพื้นที่สำหรับละหมาดร่วมกัน มีพี่คอยให้คำปรึกษา และมีเพื่อนที่เข้าใจวิถีชีวิตแบบเดียวกัน':
      'The CMU Muslim Club was founded by Muslim students from different provinces and cultures who shared one heart — wanting a place to pray together, seniors to turn to for advice, and friends who understand the same way of life.',
    'วันนี้เราเติบโตเป็นชุมชนที่มีสมาชิกกว่า': 'Today we have grown into a community of over',
    '120 คน': '120 members',
    'จากหลากหลายคณะ จัดกิจกรรมทั้งด้านศาสนา วิชาการ และสังคมอย่างต่อเนื่องตลอดทั้งปี':
      'from many faculties, running religious, academic, and social activities all year long.',
    'เส้นทางของเรา': 'Our journey',
    'พ.ศ. 2554': '2011', 'พ.ศ. 2558': '2015', 'พ.ศ. 2562': '2019', 'ปัจจุบัน': 'Today',
    'ก่อตั้งชมรม': 'Club founded',
    'นักศึกษามุสลิมกลุ่มแรกรวมตัวกันเพื่อขอพื้นที่ละหมาดในมหาวิทยาลัย': 'The first group of Muslim students gathered to request a prayer space on campus.',
    'มีห้องละหมาดประจำ': 'Permanent prayer room',
    'ได้รับการสนับสนุนพื้นที่ละหมาดถาวรและเริ่มจัดฮาลาเกาะฮ์ประจำสัปดาห์': 'Received a permanent prayer space and started weekly halaqah.',
    'ค่ายอาสาครั้งแรก': 'First volunteer camp',
    'ขยายบทบาทสู่ชุมชน จัดค่ายอาสาพัฒนาและกิจกรรมเพื่อสังคม': 'Expanded into the community with volunteer camps and social activities.',
    'ชุมชน 120+ คน': 'A community of 120+',
    'เครือข่ายพี่น้องมุสลิมที่เข้มแข็งและเปิดกว้างสำหรับทุกคน': 'A strong, open network of Muslim brothers and sisters for everyone.',

    /* donate */
    'ร่วมสนับสนุน': 'Support us',
    'ร่วมเป็นส่วนหนึ่งในการดูแลกัน': 'Be part of caring for one another',
    'ทุกการสนับสนุนช่วยให้ชมรมจัดกิจกรรมและดูแลพี่น้องได้อย่างต่อเนื่อง': 'Every contribution helps the club run activities and care for our members.',
    'ธนาคารไทยพาณิชย์': 'Siam Commercial Bank',
    'บัญชีบริจาค': 'Donation account',
    'เลขที่บัญชี': 'Account number',
    'คัดลอก': 'Copy', 'คัดลอกแล้ว': 'Copied!',
    'ชื่อบัญชี': 'Account name',
    'ชมรมนักศึกษามุสลิมสโมสรนักศึกษา มหาวิทยาลัยเชียงใหม่': 'Muslim Student Club, Student Union, Chiang Mai University',

    /* committee + contact */
    'คณะกรรมการ': 'Committee',
    'ทีมที่ขับเคลื่อนชมรม': 'The team behind the club',
    'นักศึกษาอาสาที่สละเวลาเพื่อดูแลพี่น้องทุกคน': 'Student volunteers who give their time to care for everyone.',
    'เราพร้อมรับฟัง': "We're here to listen",
    'ติดต่อชมรม': 'Contact the club',
    'มีคำถาม ข้อเสนอแนะ หรืออยากร่วมงานกับเรา? ทักมาได้เลยทุกช่องทาง': 'Questions, suggestions, or want to work with us? Reach out on any channel.',
    'ที่ตั้ง': 'Location',
    'มหาวิทยาลัยเชียงใหม่ · 239 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200': 'Chiang Mai University · 239 Huay Kaew Rd., Suthep, Mueang, Chiang Mai 50200',
    'แผนที่ที่ตั้งชมรม': 'Club location map',

    /* aria / misc */
    'ก่อนหน้า': 'Previous', 'ถัดไป': 'Next', 'ปิด': 'Close', 'กลับขึ้นด้านบน': 'Back to top'
  };

  /* ---------- กติกาสำหรับข้อความมีตัวเลข/วันที่ ---------- */
  var THM = { 'ม.ค.': 'Jan', 'ก.พ.': 'Feb', 'มี.ค.': 'Mar', 'เม.ย.': 'Apr', 'พ.ค.': 'May', 'มิ.ย.': 'Jun',
              'ก.ค.': 'Jul', 'ส.ค.': 'Aug', 'ก.ย.': 'Sep', 'ต.ค.': 'Oct', 'พ.ย.': 'Nov', 'ธ.ค.': 'Dec' };
  var THD = { 'อาทิตย์': 'Sunday', 'จันทร์': 'Monday', 'อังคาร': 'Tuesday', 'พุธ': 'Wednesday',
              'พฤหัสบดี': 'Thursday', 'ศุกร์': 'Friday', 'เสาร์': 'Saturday' };
  var MON_RE = '(ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.)';
  var RULES = [
    [new RegExp('^(\\d{1,2}) ' + MON_RE + ' (\\d{4})$'),
      function (m) { return m[1] + ' ' + THM[m[2]] + ' ' + (+m[3] - 543); }],
    [new RegExp('^วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)ที่ (\\d{1,2}) ' + MON_RE + ' (\\d{4})$'),
      function (m) { return THD[m[1]] + ' ' + m[2] + ' ' + THM[m[3]] + ' ' + (+m[4] - 543); }],
    [/^(\d+)\s*แห่ง$/, function (m) { return m[1] + ' places'; }],
    [/^(\d+)\s*ไฟล์$/, function (m) { return m[1] + ' files'; }],
    [/^© (\d{4}) ชมรมมุสลิมมหาวิทยาลัยเชียงใหม่ · MCCMU$/, function (m) { return '© ' + m[1] + ' CMU Muslim Club · MCCMU'; }],
    [/^กิจกรรมเด่นที่ (\d+)$/, function (m) { return 'Featured event ' + m[1]; }]
  ];

  function translate(raw) {
    var m = raw.match(/^\s*([\s\S]*?)\s*$/);
    var core = m ? m[1] : '';
    if (!core) return null;
    var norm = core.replace(/\s+/g, ' ');
    var tr = MAP[norm];
    if (tr == null) {
      for (var i = 0; i < RULES.length; i++) {
        var mm = norm.match(RULES[i][0]);
        if (mm) { tr = RULES[i][1](mm); break; }
      }
    }
    if (tr == null || tr === core) return null;
    return raw.replace(core, tr); // คงช่องว่างหัว-ท้ายเดิมไว้
  }

  /* ---------- แปลแบบจำต้นฉบับไว้ → สลับกลับได้โดยไม่ต้องรีเฟรช ---------- */
  var textOrig = new Map(); // TextNode → ข้อความไทยต้นฉบับ
  var attrOrig = new Map(); // Element  → { attr: ค่าเดิม }
  var ATTRS = ['data-label', 'aria-label', 'placeholder', 'title'];

  function trTextNode(n) {
    var tr = translate(n.nodeValue);
    if (tr == null) return;
    if (!textOrig.has(n)) textOrig.set(n, n.nodeValue);
    n.nodeValue = tr;
  }
  function trAttrs(el) {
    if (!el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (!v) continue;
      var tr = translate(v);
      if (tr == null) continue;
      var rec = attrOrig.get(el) || {};
      if (!(a in rec)) { rec[a] = v; attrOrig.set(el, rec); }
      el.setAttribute(a, tr);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return trTextNode(root);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE') return;
    trAttrs(root);
    if (root.querySelectorAll) {
      var els = root.querySelectorAll('[data-label],[aria-label],[placeholder],[title]');
      for (var k = 0; k < els.length; k++) trAttrs(els[k]);
    }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return (p === 'SCRIPT' || p === 'STYLE') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) trTextNode(n);
  }
  function restoreThai() {
    textOrig.forEach(function (orig, n) { n.nodeValue = orig; });
    textOrig.clear();
    attrOrig.forEach(function (rec, el) { for (var a in rec) el.setAttribute(a, rec[a]); });
    attrOrig.clear();
  }

  /* เนื้อหาที่ render ทีหลัง (api.js / นาฬิกา / ปุ่ม copy ฯลฯ) — แปลเฉพาะตอนอยู่โหมด EN */
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++)
      for (var j = 0; j < muts[i].addedNodes.length; j++) walk(muts[i].addedNodes[j]);
  });
  function enableEN()  { walk(document.body); mo.observe(document.body, { childList: true, subtree: true }); }
  function disableEN() { mo.disconnect(); restoreThai(); }

  /* ---------- สลับภาษาแบบมีอนิเมชัน (เฟดเนื้อหา ไม่รีเฟรชหน้า) ---------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var switching = false;
  function setLang(l) {
    if (l === lang || switching) return;
    switching = true;
    function swap() {
      if (l === 'en') enableEN(); else disableEN();
      lang = l;
      try { window.localStorage.setItem(KEY, l); } catch (e) {}
      document.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'th');
      updateSwitch();
      requestAnimationFrame(function () {
        document.body.classList.remove('lang-fade');
        switching = false;
      });
    }
    if (reduceMotion) { swap(); return; }
    document.body.classList.add('lang-fade');
    setTimeout(swap, 200); // รอเฟดออกก่อนค่อยสลับข้อความ
  }

  /* ---------- สวิตช์ TH/EN บน navbar (แคปซูล + thumb เลื่อน) ---------- */
  var switchEl = null;
  function updateSwitch() {
    if (!switchEl) return;
    switchEl.classList.toggle('is-en', lang === 'en');
    var btns = switchEl.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle('is-on', btns[i].getAttribute('data-lang') === lang);
  }
  function addSwitch() {
    var cta = document.querySelector('.nav__cta');
    if (!cta || document.querySelector('.lang-switch')) return;
    switchEl = document.createElement('div');
    switchEl.className = 'lang-switch';
    switchEl.setAttribute('role', 'group');
    switchEl.setAttribute('aria-label', 'Language / ภาษา');
    var thumb = document.createElement('span');
    thumb.className = 'lang-switch__thumb';
    thumb.setAttribute('aria-hidden', 'true');
    switchEl.appendChild(thumb);
    ['th', 'en'].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-lang', l);
      b.textContent = l === 'th' ? 'ไทย' : 'EN';
      b.setAttribute('aria-label', l === 'th' ? 'ภาษาไทย' : 'English');
      b.addEventListener('click', function () { setLang(l); });
      switchEl.appendChild(b);
    });
    cta.appendChild(switchEl);
    updateSwitch();
  }

  /* ---------- init ---------- */
  if (lang === 'en') {
    document.documentElement.setAttribute('lang', 'en');
    enableEN(); // โหลดมาเป็น EN อยู่แล้ว → แปลทันที ไม่ต้องเฟด
  }
  addSwitch();
})();
