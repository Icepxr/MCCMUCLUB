/**
 * ══════════════════════════════════════════════════════════════════
 *  MCCMU CMS — Setup Script  (Read-Only Backend)
 *
 *  วิธีใช้:
 *    1. paste ไฟล์นี้ใน Apps Script editor (ไฟล์ใหม่ชื่อ Setup.gs)
 *    2. เลือก function: runSetup  →  กด ▶ Run
 *    3. อนุมัติ permission ครั้งแรก
 *    รัน 1 ครั้งเดียว
 * ══════════════════════════════════════════════════════════════════ */

var PURPLE = '#5B21B6';
var WHITE  = '#FFFFFF';
var SOFT   = '#F5F3FF';

/* ══════════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════════ */
function runSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('MCCMU CMS');

  setupActivities(ss);
  setupDocs(ss);
  setupSettings(ss);
  setupMedia(ss);
  setupAlbums(ss);
  setupPlaces(ss);

  /* ลบ Sheet1 default */
  var def = ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);

  SpreadsheetApp.getUi().alert(
    '✅ Setup สำเร็จ!\n\n' +
    '6 sheets พร้อมใช้งาน:\n' +
    '  • activities — กิจกรรม (+ featured)\n' +
    '  • docs       — สรุปบรรยาย\n' +
    '  • settings   — ตั้งค่าเว็บ + โลโก้/รูปแบรนด์\n' +
    '  • media      — คลังรูป (hero/about/board)\n' +
    '  • albums     — อัลบัมภาพ (1 แถว = 1 โฟลเดอร์ Drive)\n' +
    '  • places     — ร้านฮาลาล / มัสยิด\n\n' +
    'อัลบัม: สร้างโฟลเดอร์ต่อกิจกรรม แชร์โฟลเดอร์ (Anyone with link)\n' +
    'แล้ววางลิงก์โฟลเดอร์ในชีต albums — ระบบอ่านรูปทุกใบเอง\n\n' +
    'ถัดไป: Deploy → New deployment → Web app\n' +
    'Copy URL ไปใส่ assets/api.js'
  );
}

/* ══════════════════════════════════════════════════════════════════
   ① ACTIVITIES
   ══════════════════════════════════════════════════════════════════ */
function setupActivities(ss) {
  var sh = getOrCreate(ss, 'activities');
  sh.clearContents(); sh.clearFormats();

  var headers = ['title_th','title_en','date','time','location','description','category','featured','status','image_id','academic_year'];
  var widths  = [240, 200, 100, 80, 160, 300, 120, 90, 100, 240, 110];
  writeHeaders(sh, headers, widths);

  var y = new Date().getFullYear() + 543;
  sh.getRange(2, 1, 3, headers.length).setValues([
    ['ฮาลาเกาะฮ์ประจำสัปดาห์ ครั้งที่ 1','Halaqah Session 1','2026-06-28','13:00','ห้องละหมาด อาคาร A3','บรรยายเรื่องความสำคัญของการละหมาด','ฮาลาเกาะฮ์','no','published','',y],
    ['ค่ายอิสลามฤดูร้อน 2569','Islamic Summer Camp','2026-07-15','08:00','ค่ายสวนสน','ค่ายพักแรม 2 คืน กิจกรรมศาสนาและการสร้างทีม','ค่าย','yes','published','',y],
    ['เตรียมข้อมูล — draft','','2026-08-01','','','','อื่นๆ','no','draft','',y]
  ]);

  addDropdown(sh, 'H', 2, 200, ['yes','no']);
  addDropdown(sh, 'I', 2, 200, ['published','draft','archived']);
  addDropdown(sh, 'G', 2, 200, ['ฮาลาเกาะฮ์','ค่าย','ศาสนกิจ','สังคม','วิชาการ','อื่นๆ']);
  sh.getRange('C2:C200').setNumberFormat('yyyy-mm-dd');
  sh.getRange('H1').setNote('featured=yes → ใช้เป็น "กิจกรรมเด่น" บล็อกใหญ่ (เลือก yes ได้หลายแถว ระบบใช้อันที่ใกล้จะถึงที่สุด)');
  sh.getRange('J1').setNote('Drive File ID ของรูปปกกิจกรรม\nDrive → คลิกขวา → Get link (Anyone with link)\nURL: .../file/d/FILE_ID/view');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   ② DOCS
   ══════════════════════════════════════════════════════════════════ */
function setupDocs(ss) {
  var sh = getOrCreate(ss, 'docs');
  sh.clearContents(); sh.clearFormats();

  var headers = ['title','category','session','date','type','file_id','status','academic_year'];
  var widths  = [300, 120, 100, 100, 80, 280, 100, 110];
  writeHeaders(sh, headers, widths);

  var y = new Date().getFullYear() + 543;
  sh.getRange(2, 1, 3, headers.length).setValues([
    ['สรุปฮาลาเกาะฮ์: ความสำคัญของการละหมาด','อิบาดะฮ์','ครั้งที่ 1','2026-06-14','pdf','REPLACE_FILE_ID','published',y],
    ['อินโฟกราฟิก: เสาหลักอิสลาม 5 ประการ','อาคิดะฮ์','ครั้งที่ 2','2026-06-21','img','REPLACE_FILE_ID','published',y],
    ['ไฟล์ยังไม่พร้อม — draft','อัคลาก','ครั้งที่ 3','2026-06-28','pdf','','draft',y]
  ]);

  addDropdown(sh, 'G', 2, 200, ['published','draft','archived']);
  addDropdown(sh, 'B', 2, 200, ['อิบาดะฮ์','อาคิดะฮ์','อัคลาก','ฟิกฮ์','ประวัติ','อื่นๆ']);
  addDropdown(sh, 'E', 2, 200, ['pdf','img']);
  sh.getRange('D2:D200').setNumberFormat('yyyy-mm-dd');
  sh.getRange('F1').setNote('วิธีหา File ID:\nDrive → คลิกขวา → Get link\nURL: .../file/d/FILE_ID/view');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   ③ SETTINGS
   ══════════════════════════════════════════════════════════════════ */
function setupSettings(ss) {
  var sh = getOrCreate(ss, 'settings');
  sh.clearContents(); sh.clearFormats();

  var headers = ['key','value','note'];
  var widths  = [200, 220, 360];
  writeHeaders(sh, headers, widths);

  var rows = [
    ['prayer_method','2',        'Aladhan calculation method (2=ISNA, 4=UmmAlQura, 11=MUIS)'],
    ['prayer_fajr',  '',         'Auto-filled by Aladhan API — ใส่ค่าสำรองหาก API ล่ม'],
    ['prayer_dhuhr', '',         'Auto-filled'],
    ['prayer_asr',   '',         'Auto-filled'],
    ['prayer_maghrib','',        'Auto-filled'],
    ['prayer_isha',  '',         'Auto-filled'],
    ['logo_id',      '',         'Drive File ID โลโก้หลัก (→ logo_url)'],
    ['hero_about_id','',         'Drive File ID รูปบล็อก About หน้าแรก (→ hero_about_url)'],
    ['club_email',   'mccmu@cmu.ac.th', 'อีเมลชมรม'],
    ['club_line',    '@mccmu',          'LINE OA ID'],
    ['club_facebook','https://facebook.com/mccmu', 'Facebook URL'],
    ['club_instagram','',                'Instagram URL'],
    ['club_tiktok',  '',                 'TikTok URL'],
    ['map_embed_url','',                 'ลิงก์ฝัง Google Maps (ที่ตั้งชมรม · ใช้ในหน้าเกี่ยวกับเรา)'],
    ['halal_map_url','',                 '(ไม่บังคับ) ลิงก์ฝัง Google My Maps/Maps สำหรับแผนที่รวมหน้าฮาลาล — เว้นว่าง=ใช้พื้นที่ มช.'],
    ['site_title_th','ชมรมมุสลิม มหาวิทยาลัยเชียงใหม่', ''],
    ['site_title_en','Muslim Club CMU',  ''],
    ['site_founded', '2554',             'ปีก่อตั้ง (พ.ศ.)'],
    ['site_member_count','120+',         'จำนวนสมาชิก']
  ];
  sh.getRange(2, 1, rows.length, 3).setValues(rows);

  /* highlight prayer_method row */
  sh.getRange(2, 1, 1, 3).setBackground('#EDE9FE').setFontWeight('bold');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   ④ MEDIA — คลังรูป (hero / about / board)  *แกลเลอรีย้ายไปชีต albums*
   ══════════════════════════════════════════════════════════════════ */
function setupMedia(ss) {
  var sh = getOrCreate(ss, 'media');
  sh.clearContents(); sh.clearFormats();

  var headers = ['section','file_id','title','subtitle','order','status'];
  var widths  = [120, 280, 240, 200, 70, 100];
  writeHeaders(sh, headers, widths);

  sh.getRange(2, 1, 5, headers.length).setValues([
    ['hero',  'REPLACE_FILE_ID','รูปกิจกรรมหมุนหน้าแรก 1','', 1,'published'],
    ['hero',  'REPLACE_FILE_ID','รูปกิจกรรมหมุนหน้าแรก 2','', 2,'published'],
    ['about', 'REPLACE_FILE_ID','รูปหมู่สมาชิกชมรม','',        1,'published'],
    ['board', 'REPLACE_FILE_ID','นายสมชาย ใจดี','ประธานชมรม',  1,'published'],
    ['board', 'REPLACE_FILE_ID','นางสาวฟาติมะฮ์','รองประธาน',  2,'published']
  ]);

  addDropdown(sh, 'A', 2, 300, ['hero','about','board']);
  addDropdown(sh, 'F', 2, 300, ['published','draft','archived']);
  sh.getRange('B1').setNote('Drive File ID ของรูป\nDrive → คลิกขวา → Get link (Anyone with link)\nURL: .../file/d/FILE_ID/view');
  sh.getRange('D1').setNote('บรรทัดรอง — กรณี section=board ใส่ตำแหน่ง');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   ④.5 ALBUMS — อัลบัมภาพ (1 แถว = 1 โฟลเดอร์ Drive = 1 กิจกรรม)
        ระบบอ่านรูปทุกใบในโฟลเดอร์เองอัตโนมัติ ไม่ต้องกรอก file_id
   ══════════════════════════════════════════════════════════════════ */
function setupAlbums(ss) {
  var sh = getOrCreate(ss, 'albums');
  sh.clearContents(); sh.clearFormats();

  var headers = ['title','category','date','folder_id','cover_id','order','status'];
  var widths  = [260, 120, 100, 340, 240, 70, 100];
  writeHeaders(sh, headers, widths);

  sh.getRange(2, 1, 3, headers.length).setValues([
    ['ค่ายอาสาพัฒนาชุมชน 2569','อาสา',   '2026-03-20','วางลิงก์โฟลเดอร์ Drive ที่นี่','', 1,'published'],
    ['ละศีลอดเดือนรอมฎอนร่วมกัน','ศาสนา', '2026-03-10','วางลิงก์โฟลเดอร์ Drive ที่นี่','', 2,'published'],
    ['เปิดบ้านต้อนรับน้องใหม่','สังสรรค์','2026-06-28','วางลิงก์โฟลเดอร์ Drive ที่นี่','', 3,'published']
  ]);

  addDropdown(sh, 'B', 2, 200, ['ศาสนา','อาสา','สังสรรค์']);
  addDropdown(sh, 'G', 2, 200, ['published','draft','archived']);
  sh.getRange('C2:C200').setNumberFormat('yyyy-mm-dd');
  sh.getRange('D1').setNote('วางลิงก์โฟลเดอร์ Google Drive (หรือ folder ID)\n1. สร้างโฟลเดอร์ 1 อัน/กิจกรรม ใส่รูปทั้งหมด\n2. คลิกขวาโฟลเดอร์ → Share → Anyone with the link\n3. Get link → วางที่ช่องนี้\nระบบจะอ่านรูปทุกใบในโฟลเดอร์เอง');
  sh.getRange('E1').setNote('(ไม่บังคับ) รูปหน้าปก — วางลิงก์ Drive หรือ File ID ก็ได้\nถ้าเว้นว่างจะใช้รูปแรกในโฟลเดอร์');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ PLACES — ร้านฮาลาล / มัสยิด
   ══════════════════════════════════════════════════════════════════ */
function setupPlaces(ss) {
  var sh = getOrCreate(ss, 'places');
  sh.clearContents(); sh.clearFormats();

  var headers = ['name','type','area','distance','hours','map_url','coords','file_id','status'];
  var widths  = [240, 120, 140, 100, 140, 240, 160, 240, 100];
  writeHeaders(sh, headers, widths);

  sh.getRange(2, 1, 3, headers.length).setValues([
    ['ครัวฮาลาลหน้า มช.','ร้านอาหาร','สวนดอก','350 ม.','10:00–20:00','https://maps.app.goo.gl/example','18.8035,98.9512','','published'],
    ['มัสยิดอัตตักวา','มัสยิด','ช้างคลาน','2.5 กม.','ตลอดเวลา','https://maps.app.goo.gl/example','18.7869,98.9931','','published'],
    ['ห้องละหมาด อาคาร HB7','ห้องละหมาด','ในมหาวิทยาลัย','—','08:00–18:00','','18.8009,98.9525','','published']
  ]);

  addDropdown(sh, 'B', 2, 200, ['ร้านอาหาร','มัสยิด','ห้องละหมาด']);
  addDropdown(sh, 'I', 2, 200, ['published','draft','archived']);
  sh.getRange('G1').setNote('พิกัด "lat,lng" สำหรับฝังแผนที่เล็กในการ์ด (แม่นสุด)\nวิธีหา: เปิด Google Maps → คลิกขวาที่จุด → คลิกตัวเลขพิกัดเพื่อ copy → วางที่นี่\nเว้นว่างได้ ระบบจะเดาตำแหน่งจากชื่อ+ย่านแทน');
  sh.getRange('H1').setNote('(ไม่บังคับ) Drive File ID ของรูป — ใช้เฉพาะกรณีไม่มีพิกัด/ชื่อให้ฝังแผนที่');

  finalize(sh, headers.length);
}

/* ══════════════════════════════════════════════════════════════════
   MENU
   ══════════════════════════════════════════════════════════════════ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🕌 MCCMU CMS')
    .addItem('▶ Setup (รัน 1 ครั้ง)', 'runSetup')
    .addSeparator()
    .addItem('📊 สรุปข้อมูล',   'showSummary')
    .addItem('🗑 ล้าง Prayer Cache', 'clearPrayerCache')
    .addToUi();
}

function showSummary() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var msg = '';
  ['activities','docs','settings','media','albums','places'].forEach(function(name){
    var sh = ss.getSheetByName(name);
    msg += '• ' + name + ': ' + (sh ? Math.max(0, sh.getLastRow()-1) + ' แถว' : '❌ ไม่พบ') + '\n';
  });
  SpreadsheetApp.getUi().alert('📊 MCCMU CMS\n\n' + msg);
}

/* ล้าง prayer cache (กดเมื่อต้องการดึงเวลาใหม่ทันที) */
function clearPrayerCache() {
  var cache = CacheService.getScriptCache();
  /* ล้างทุก key ที่ขึ้นต้นด้วย prayer_ ไม่ได้ แต่ล้าง key วันนี้ก็พอ */
  var today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'dd-MM-yyyy');
  cache.remove('prayer_' + today);
  SpreadsheetApp.getUi().alert('✅ ล้าง Prayer Cache วันนี้แล้ว\nRequest ถัดไปจะดึงข้อมูลใหม่จาก Aladhan');
}

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */
function getOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeHeaders(sh, headers, widths) {
  var r = sh.getRange(1, 1, 1, headers.length);
  r.setValues([headers])
   .setBackground(PURPLE).setFontColor(WHITE)
   .setFontWeight('bold').setFontSize(11)
   .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  widths.forEach(function(w, i){ sh.setColumnWidth(i+1, w); });
}

function addDropdown(sh, col, startRow, numRows, values) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true).setAllowInvalid(false).build();
  sh.getRange(col + startRow + ':' + col + (startRow + numRows - 1))
    .setDataValidation(rule);
}

function finalize(sh, numCols) {
  sh.getRange(2, 1, 200, numCols)
    .setBorder(true,true,true,true,true,true,'#E5E7EB', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);
  try {
    sh.setBanding(
      SpreadsheetApp.newBanding()
        .setRange(sh.getRange(1,1,201,numCols))
        .setHeaderRowColor(PURPLE)
        .setFirstRowColor(WHITE)
        .setSecondRowColor(SOFT)
    );
  } catch(e) {}
}
