/* ============================================================
   คลิปจากช่อง YouTube ชมรม (หน้าคลังความรู้)

   รายการคลิปมาจาก /data?sheet=youtube (Edge Function อ่าน RSS ของช่องให้)
   ตัวเล่นไม่โหลดจนกว่าจะกดเล่น — iframe ของ YouTube หนัก ~1 MB ต่อตัว
   และใช้ youtube-nocookie.com: ไม่ฝากคุกกี้ติดตามจนกว่าคนดูจะกดเล่นเอง
   ทุกข้อความใส่ด้วย textContent ไม่มี innerHTML
   ============================================================ */
(function () {
  'use strict';

  var CHANNEL = 'https://www.youtube.com/@muslimcmu';
  var MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(d, cls) {
    var NS = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }
  var IC = {
    play: 'M8 5.5v13l11-6.5z',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
    date: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    place: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    out: 'M14 4h6v6M20 4l-9 9M10 5H4v15h15v-6',
  };

  function thaiDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }

  /* คำอธิบายคลิปเขียนกันคนละแบบ บางคลิปขึ้นต้นบรรทัดด้วยอีโมจิ (🗓 📍 ⏰)
     ดึงเฉพาะที่ใช้ได้: ประเภท (บรรทัดแรกสั้น ๆ) · วิทยากร · วันที่จัด · สถานที่ */
  function parse(v) {
    var out = { kind: '', speaker: '', when: '', venue: '' };
    String(v.description || '').split('\n')
      .map(function (l) { return l.replace(/^[^\p{L}\p{N}]+/u, '').trim(); })
      .filter(Boolean)
      .forEach(function (l, i) {
        var m;
        if (!out.speaker && (m = l.match(/^(?:บรรยายโดย|โดย|วิทยากร)\s*[:：]?\s*(.+)$/))) out.speaker = m[1];
        else if (!out.venue && (m = l.match(/^ณ\s*(.+)$/))) out.venue = m[1];
        else if (!out.when && (m = l.match(/^(?:เมื่อ)?วันที่\s*(.+)$/))) out.when = m[1];
        else if (i === 0 && l.length <= 30 && !/^(หัวข้อ|เรื่อง)/.test(l)) out.kind = l.replace(/^กิจกรรม/, '');
      });
    /* ชื่อคลิปบางอันต่อท้ายด้วย "| ชื่อวิทยากร" — ตัดออก วิทยากรไปอยู่ในบรรทัดข้อมูลแทน */
    var parts = String(v.title || '').split(/\s+\|\s+/);
    out.title = parts[0];
    if (!out.speaker && parts[1]) out.speaker = parts.slice(1).join(' · ');
    if (!out.when) out.when = thaiDate(v.published);
    return out;
  }

  function thumb(id, size, cls) {
    var img = el('img', cls);
    img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
    img.src = 'https://i.ytimg.com/vi/' + id + '/' + size + '.jpg';
    /* maxres มีเฉพาะคลิปที่อัปความละเอียดสูง ไม่มีก็ถอยไปใช้ hq ที่มีเสมอ
       YouTube ไม่ได้ตอบ error ตรง ๆ แต่ส่งรูปเทาขนาด 120px มาแทน จึงต้องเช็กขนาดด้วย */
    function fallback() {
      if (img.dataset.fb) return;
      img.dataset.fb = '1';
      img.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    }
    if (size !== 'hqdefault') {
      img.addEventListener('error', fallback);
      img.addEventListener('load', function () { if (img.naturalWidth <= 120) fallback(); });
    }
    return img;
  }

  function metaRow(info) {
    var row = el('ul', 'vmeta');
    [[IC.person, info.speaker], [IC.date, info.when], [IC.place, info.venue]].forEach(function (x) {
      if (!x[1]) return;
      var li = el('li');
      li.append(svg(x[0]), el('span', null, x[1]));
      row.appendChild(li);
    });
    return row;
  }

  function render(box, list) {
    box.replaceChildren();
    var items = list.map(function (v) { return { v: v, info: parse(v) }; });
    var current = 0;

    var main = el('div', 'vmain');
    var player = el('div', 'vplayer');
    var info = el('div', 'vinfo');
    main.append(player, info);
    box.appendChild(main);

    function poster(n) {
      var it = items[n];
      var b = el('button', 'vplayer__poster');
      b.type = 'button';
      b.setAttribute('aria-label', 'เล่นคลิป ' + it.info.title);
      b.appendChild(thumb(it.v.id, 'maxresdefault', 'vplayer__img'));
      var play = el('span', 'vplayer__play');
      play.appendChild(svg(IC.play));
      b.appendChild(play);
      b.addEventListener('click', function () { start(n); });
      player.replaceChildren(b);
    }
    function start(n) {
      var f = el('iframe', 'vplayer__frame');
      f.src = 'https://www.youtube-nocookie.com/embed/' + items[n].v.id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = items[n].info.title;
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      /* YouTube ปฏิเสธการฝังถ้าไม่ส่ง referrer มาด้วย (error 153) */
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      player.replaceChildren(f);
    }
    function describe(n) {
      var it = items[n];
      info.replaceChildren();
      if (it.info.kind) info.appendChild(el('span', 'vkind', it.info.kind));
      info.appendChild(el('h3', 'vtitle', it.info.title));
      info.appendChild(metaRow(it.info));
      var yt = el('a', 'vlink');
      yt.href = 'https://www.youtube.com/watch?v=' + it.v.id;
      yt.target = '_blank'; yt.rel = 'noopener';
      yt.append(el('span', null, 'ดูบน YouTube'), svg(IC.out));
      info.appendChild(yt);
    }
    function pick(n, play) {
      current = n;
      describe(n);
      if (play) start(n); else poster(n);
      if (side) side.querySelectorAll('.vitem').forEach(function (b, i) {
        b.setAttribute('aria-current', String(i === n));
      });
    }

    /* คลิปเดียวก็ไม่ต้องมีรายการข้าง ๆ ให้ตัวเล่นกว้างเต็มแถว */
    var side = null;
    if (items.length > 1) {
      side = el('div', 'vside');
      side.appendChild(el('p', 'vside__label', 'คลิปทั้งหมด ' + items.length + ' คลิป'));
      var ul = el('div', 'vlist');
      items.forEach(function (it, n) {
        var b = el('button', 'vitem');
        b.type = 'button';
        var t = el('span', 'vitem__thumb');
        t.appendChild(thumb(it.v.id, 'mqdefault'));
        var now = el('span', 'vitem__now', 'กำลังเปิด');
        now.setAttribute('aria-hidden', 'true');          // สถานะจริงบอกผ่าน aria-current แล้ว
        t.appendChild(now);
        var tx = el('span', 'vitem__tx');
        tx.appendChild(el('span', 'vitem__title', it.info.title));
        tx.appendChild(el('span', 'vitem__sub', [it.info.speaker, it.info.when].filter(Boolean).join(' · ')));
        b.append(t, tx);
        /* กดจากรายการ = ตั้งใจจะดูแล้ว เล่นเลย แล้วเลื่อนให้เห็นตัวเล่น (สำคัญบนมือถือที่รายการอยู่ข้างล่าง) */
        b.addEventListener('click', function () {
          pick(n, true);
          var r = player.getBoundingClientRect();
          if (r.top < 70 || r.bottom > innerHeight) player.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        ul.appendChild(b);
      });
      side.appendChild(ul);
      box.appendChild(side);
    } else {
      box.classList.add('vwrap--single');
    }
    pick(current, false);
  }

  function fail(box) {
    box.replaceChildren();
    var m = el('div', 'vempty');
    m.appendChild(el('p', null, 'ตอนนี้โหลดรายการคลิปไม่ได้ ดูคลิปทั้งหมดได้ที่ช่อง YouTube ของชมรมโดยตรง'));
    var a = el('a', 'btn btn--light btn--sm', 'ไปที่ช่อง YouTube');
    a.href = CHANNEL; a.target = '_blank'; a.rel = 'noopener';
    m.appendChild(a);
    box.appendChild(m);
  }

  function skeleton(box) {
    var main = el('div', 'vmain');
    main.append(el('div', 'vplayer vskel'), el('div', 'vskel vskel--line'));
    var side = el('div', 'vside');
    for (var i = 0; i < 3; i++) side.appendChild(el('div', 'vskel vskel--item'));
    box.append(main, side);
  }

  function init() {
    var box = document.getElementById('videoBox');
    if (!box) return;
    skeleton(box);
    fetch('/data?sheet=youtube')
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j.ok || !Array.isArray(j.data) || !j.data.length) throw new Error(j.error || 'no videos');
        render(box, j.data);
      })
      .catch(function () { fail(box); })
      .finally(function () { box.setAttribute('aria-busy', 'false'); });
  }

  /* เปิดไว้ให้ทดสอบหน้าตาในเครื่องได้ (ในเครื่องไม่มี /data) */
  window.MCCMUVideos = { render: function (list) { render(document.getElementById('videoBox'), list); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
