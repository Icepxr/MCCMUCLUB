/* Album browser: lazy thumbnails, progressive photos, bounded neighbour cache. */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function safeURL(raw) {
    if (!raw) return '';
    try {
      var url = new URL(raw, location.href);
      return url.protocol === 'https:' || (url.origin === location.origin && url.protocol === 'http:') ? url.href : '';
    } catch (e) { return ''; }
  }
  function sized(raw, width) {
    var safe = safeURL(raw);
    if (!safe) return '';
    var url = new URL(safe);
    if (url.hostname === 'drive.google.com' && url.pathname === '/thumbnail') {
      url.searchParams.set('sz', 'w' + width);
    } else if (url.hostname === 'lh3.googleusercontent.com') {
      url.pathname = url.pathname.replace(/=w\d+(-h\d+)?$/, '=w' + width);
    }
    return url.href;
  }
  function alternate(raw, width) {
    var safe = safeURL(raw);
    if (!safe) return '';
    var url = new URL(safe);
    var id = url.hostname === 'drive.google.com' && url.searchParams.get('id');
    return id && /^[-\w]+$/.test(id) ? 'https://lh3.googleusercontent.com/d/' + id + '=w' + width : '';
  }
  function icon(name) {
    var paths = {
      close: 'M6 6l12 12M18 6L6 18',
      prev: 'M15 6l-6 6 6 6', next: 'M9 6l6 6-6 6',
      grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
      zoom: 'M10 7v6M7 10h6M15 15l6 6',
      photos: 'M3 6h14v12H3zM7 3h14v12M3 15l4-4 3 3 2-2 5 5',
      external: 'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7'
    };
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', paths[name]);
    svg.appendChild(path);
    if (name === 'zoom') {
      var circle = document.createElementNS(svg.namespaceURI, 'circle');
      circle.setAttribute('cx', '10'); circle.setAttribute('cy', '10'); circle.setAttribute('r', '7');
      svg.appendChild(circle);
    }
    return svg;
  }
  function control(name, label, handler) {
    var button = el('button', 'album-control');
    button.type = 'button'; button.title = label;
    button.setAttribute('aria-label', label);
    button.appendChild(icon(name));
    button.addEventListener('click', handler);
    return button;
  }
  function thumb(raw, alt, width) {
    var img = el('img');
    img.alt = alt || ''; img.loading = 'lazy'; img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    var url = sized(raw, width);
    if (url) img.src = url;
    else img.classList.add('is-unavailable');
    img.addEventListener('load', function () { img.classList.add('is-loaded'); });
    var triedAlternate = false;
    img.addEventListener('error', function () {
      var fallback = alternate(raw, width);
      if (!triedAlternate && fallback) { triedAlternate = true; img.src = fallback; return; }
      img.classList.add('is-unavailable');
      img.parentElement.classList.add('has-image-error');
    });
    return img;
  }
  function dateLabel(raw) {
    var date = raw && new Date(raw);
    return date && !isNaN(date.getTime()) ? date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  }

  function viewer() {
    var dialog = el('dialog', 'album-dialog');
    dialog.setAttribute('aria-labelledby', 'albumTitle');
    var header = el('div', 'album-dialog__header');
    var heading = el('div', 'album-dialog__heading');
    var title = el('h2'); title.id = 'albumTitle';
    var count = el('p', 'album-dialog__count');
    count.setAttribute('aria-live', 'polite');
    heading.append(title, count);
    var actions = el('div', 'album-dialog__actions');
    var overviewButton = control('grid', 'ภาพทั้งหมด', overview);
    var zoomButton = control('zoom', 'ขยายภาพ', function () {
      var zoomed = stage.classList.toggle('is-zoomed');
      zoomButton.setAttribute('aria-pressed', String(zoomed));
      stage.scrollLeft = zoomed ? (stage.scrollWidth - stage.clientWidth) / 2 : 0;
      stage.scrollTop = zoomed ? (stage.scrollHeight - stage.clientHeight) / 2 : 0;
    });
    zoomButton.setAttribute('aria-pressed', 'false');
    var original = el('a', 'album-control');
    original.title = 'เปิดภาพในแท็บใหม่'; original.setAttribute('aria-label', 'เปิดภาพในแท็บใหม่');
    original.target = '_blank'; original.rel = 'noopener noreferrer'; original.appendChild(icon('external'));
    var closeButton = control('close', 'ปิดอัลบั้ม', function () { dialog.close(); });
    actions.append(overviewButton, zoomButton, original, closeButton);
    header.append(heading, actions);
    var overviewPane = el('div', 'album-overview');
    var photoGrid = el('div', 'album-photo-grid');
    var more = el('button', 'album-more', 'ดูภาพเพิ่มเติม'); more.type = 'button';
    overviewPane.append(photoGrid, more);
    var photoPane = el('div', 'album-photo-pane'); photoPane.hidden = true;
    var stage = el('div', 'album-stage');
    var preview = el('img', 'album-stage__preview'); preview.alt = '';
    var full = el('img', 'album-stage__full');
    preview.referrerPolicy = full.referrerPolicy = 'no-referrer';
    var message = el('div', 'album-stage__message');
    var status = el('span', 'album-stage__status'); status.setAttribute('role', 'status');
    var retry = el('button', 'album-retry', 'ลองอีกครั้ง'); retry.type = 'button'; retry.hidden = true;
    message.append(status, retry);
    stage.append(preview, full, message);
    var previous = control('prev', 'รูปก่อนหน้า', function () { step(-1); });
    var next = control('next', 'รูปถัดไป', function () { step(1); });
    previous.classList.add('album-stage__prev'); next.classList.add('album-stage__next');
    var frame = el('div', 'album-frame'); frame.append(stage, previous, next);
    var strip = el('div', 'album-filmstrip'); strip.setAttribute('aria-label', 'เลือกภาพ');
    photoPane.append(frame, strip);
    dialog.append(header, overviewPane, photoPane);
    document.body.appendChild(dialog);

    var photos = [], index = 0, generation = 0, rendered = 0, observer;
    var returnFocus, gridFocus, scrollY = 0, bodyStyle = '', overviewScroll = 0;
    var cache = new Map(), MAX_CACHE = 12, touch;
    var connection = navigator.connection;
    var saveData = connection && (connection.saveData || /2g/.test(connection.effectiveType || ''));
    function photoURL(p, width) { return sized(p.image_url || p.thumb_url, width); }
    function preload(url) {
      if (!url) return Promise.reject(new Error('Missing image'));
      if (cache.has(url)) {
        var cached = cache.get(url); cache.delete(url); cache.set(url, cached); return cached;
      }
      var promise = new Promise(function (resolve, reject) {
        var img = new Image(); img.referrerPolicy = 'no-referrer'; img.decoding = 'async';
        img.onload = function () {
          var decoded = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
          decoded.then(function () { resolve(img); });
        };
        var triedAlternate = false;
        img.onerror = function () {
          var size = new URL(url).searchParams.get('sz') || 'w1600';
          var fallback = alternate(url, Number(size.replace('w', '')));
          if (!triedAlternate && fallback) { triedAlternate = true; img.src = fallback; return; }
          cache.delete(url); reject(new Error('Image unavailable'));
        };
        img.src = url;
      });
      cache.set(url, promise);
      while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
      return promise;
    }
    function widthForPhoto() {
      return saveData ? 800 : (window.innerWidth < 700 ? 1200 : 1600);
    }
    function step(delta) {
      var target = index + delta;
      if (target >= 0 && target < photos.length) show(target);
    }
    function updateStrip() {
      var restoreStripFocus = strip.contains(document.activeElement);
      strip.replaceChildren();
      for (var i = Math.max(0, index - 3); i < Math.min(photos.length, index + 4); i++) {
        (function (n) {
          var b = el('button', 'album-filmstrip__item'); b.type = 'button';
          b.setAttribute('aria-label', 'รูปที่ ' + (n + 1));
          b.setAttribute('aria-pressed', String(n === index));
          b.appendChild(thumb(photos[n].thumb_url || photos[n].image_url, '', 160));
          b.addEventListener('click', function () { show(n); });
          strip.appendChild(b);
          if (restoreStripFocus && n === index) b.focus({ preventScroll: true });
        })(i);
      }
    }
    function show(n) {
      if (!photos[n]) return;
      if (!overviewPane.hidden) overviewScroll = overviewPane.scrollTop;
      index = n; var token = ++generation;
      overviewPane.hidden = true; photoPane.hidden = false;
      overviewButton.hidden = zoomButton.hidden = original.hidden = false;
      stage.classList.remove('is-ready', 'is-zoomed');
      zoomButton.setAttribute('aria-pressed', 'false');
      stage.scrollTop = stage.scrollLeft = 0;
      full.removeAttribute('src'); preview.removeAttribute('src');
      full.alt = title.textContent + ' รูปที่ ' + (n + 1);
      count.textContent = 'รูปที่ ' + (n + 1) + ' / ' + photos.length;
      status.textContent = 'กำลังโหลดภาพ…'; retry.hidden = true;
      previous.disabled = n === 0; next.disabled = n === photos.length - 1;
      var p = photos[n];
      var small = sized(p.thumb_url || p.image_url, 400);
      if (small) preview.src = small;
      var url = photoURL(p, widthForPhoto());
      original.href = safeURL(p.image_url || p.thumb_url) || '#';
      original.hidden = !safeURL(p.image_url || p.thumb_url);
      preload(url).then(function (img) {
        if (token !== generation || !dialog.open || photoPane.hidden) return;
        full.src = img.src;
        stage.classList.add('is-ready'); status.textContent = '';
        if (!saveData) [n - 1, n + 1].forEach(function (neighbor) {
          if (photos[neighbor]) preload(photoURL(photos[neighbor], widthForPhoto())).catch(function () {});
        });
      }).catch(function () {
        if (token !== generation || !dialog.open || photoPane.hidden) return;
        status.textContent = 'โหลดภาพคมชัดไม่สำเร็จ'; retry.hidden = false;
      });
      updateStrip();
    }
    retry.addEventListener('click', function () { show(index); });
    function overview() {
      ++generation;
      overviewPane.hidden = false; photoPane.hidden = true;
      overviewButton.hidden = zoomButton.hidden = original.hidden = true;
      count.textContent = photos.length + ' รูป';
      overviewPane.scrollTop = overviewScroll;
      if (gridFocus && gridFocus.isConnected) gridFocus.focus({ preventScroll: true });
    }
    function appendBatch() {
      var fragment = document.createDocumentFragment();
      var end = Math.min(rendered + 48, photos.length);
      for (var i = rendered; i < end; i++) {
        (function (n) {
          var b = el('button', 'album-photo'); b.type = 'button';
          b.setAttribute('aria-label', 'ดูรูปที่ ' + (n + 1));
          b.append(thumb(photos[n].thumb_url || photos[n].image_url, '', 400), el('span', 'album-photo__number', n + 1));
          b.addEventListener('click', function () {
            gridFocus = b; show(n); overviewButton.focus({ preventScroll: true });
          });
          fragment.appendChild(b);
        })(i);
      }
      photoGrid.appendChild(fragment); rendered = end; more.hidden = rendered >= photos.length;
    }
    more.addEventListener('click', appendBatch);
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && dialog.open && !overviewPane.hidden && !more.hidden) appendBatch();
      }, { root: overviewPane, rootMargin: '400px' });
      observer.observe(more);
    }
    dialog.addEventListener('cancel', function (event) {
      if (!photoPane.hidden) { event.preventDefault(); overview(); }
    });
    dialog.addEventListener('close', function () {
      ++generation; full.removeAttribute('src'); preview.removeAttribute('src');
      document.body.style.cssText = bodyStyle;
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    });
    dialog.addEventListener('keydown', function (event) {
      if (photoPane.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); step(event.key === 'ArrowRight' ? 1 : -1);
      }
    });
    stage.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'touch' && !stage.classList.contains('is-zoomed')) {
        touch = { x: event.clientX, y: event.clientY, id: event.pointerId };
      }
    }, { passive: true });
    stage.addEventListener('pointerup', function (event) {
      if (!touch || touch.id !== event.pointerId) return;
      var dx = event.clientX - touch.x, dy = event.clientY - touch.y; touch = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    stage.addEventListener('pointercancel', function () { touch = null; });

    return function open(album, opener) {
      photos = (album.photos || []).filter(function (p) { return safeURL(p.image_url || p.thumb_url); });
      if (!photos.length) return;
      title.textContent = album.title || 'อัลบั้มภาพ';
      returnFocus = opener; gridFocus = null; overviewScroll = 0; rendered = 0;
      photoGrid.replaceChildren(); appendBatch(); overview();
      scrollY = window.scrollY; bodyStyle = document.body.style.cssText;
      document.body.style.position = 'fixed'; document.body.style.top = -scrollY + 'px';
      document.body.style.width = '100%';
      dialog.showModal(); closeButton.focus();
    };
  }

  window.MCCMUGallery = {
    mount: function (selector) {
      var grid = document.querySelector(selector); if (!grid || grid.dataset.mounted) return;
      grid.dataset.mounted = 'true'; grid.classList.add('album-grid');
      var root = grid.closest('[data-gallery]') || grid.parentElement;
      var categories = root.querySelector('[data-album-categories]');
      var limit = Number(grid.dataset.limit) || Infinity;
      var albums = [], active = '', open = viewer();
      grid.setAttribute('aria-busy', 'true');
      for (var i = 0; i < 6; i++) {
        var skeleton = el('div', 'album-skeleton skel'); skeleton.setAttribute('aria-hidden', 'true');
        grid.appendChild(skeleton);
      }
      function message(text, retryable) {
        grid.replaceChildren();
        var state = el('div', 'album-empty'); state.setAttribute('role', 'status');
        state.appendChild(el('p', '', text));
        if (retryable) {
          var retry = el('button', 'btn btn--primary btn--sm', 'ลองอีกครั้ง'); retry.type = 'button';
          retry.addEventListener('click', function () { load(true); }); state.appendChild(retry);
        }
        grid.appendChild(state);
      }
      function paint() {
        var filtered = albums.filter(function (a) { return !active || a.category === active; });
        grid.replaceChildren();
        if (!filtered.length) return message('ยังไม่มีอัลบั้มภาพ', false);
        filtered.slice(0, limit).forEach(function (a) {
          var card = el('button', 'album-card'); card.type = 'button';
          var usable = Array.isArray(a.photos) ? a.photos.filter(function (p) { return safeURL(p.image_url || p.thumb_url); }) : [];
          var photoCount = usable.length;
          card.setAttribute('aria-label', (a.title || 'อัลบั้มภาพ') + ' · ' + photoCount + ' รูป');

          /* ปกวางบนรูปถัดไปของอัลบั้มสองใบ ให้การ์ดดูเป็น "อัลบั้ม" จริง ๆ
             ถ้ารูปไม่พอก็เหลือเป็นแผ่นสีอ่อนแทน · โหลดแบบ lazy ขนาดเล็ก */
          var media = el('span', 'album-card__media');
          var coverRaw = a.cover_url || (usable[0] && usable[0].thumb_url);
          var behind = usable.filter(function (p) { return (p.thumb_url || p.image_url) !== coverRaw; }).slice(0, 2);
          ['b', 'a'].forEach(function (k, i) {
            var sheet = el('span', 'album-card__sheet album-card__sheet--' + k);
            var p = behind[1 - i];
            if (p) sheet.appendChild(thumb(p.thumb_url || p.image_url, '', 320));
            media.appendChild(sheet);
          });
          var cover = el('span', 'album-card__cover');
          cover.appendChild(thumb(coverRaw, '', 640));
          media.appendChild(cover);
          if (photoCount) {
            var badge = el('span', 'album-card__count');
            badge.append(icon('photos'), el('span', '', photoCount + ' รูป'));
            media.appendChild(badge);
          }

          var body = el('span', 'album-card__body');
          var meta = el('span', 'album-card__meta');
          if (a.category) meta.appendChild(el('span', 'album-card__cat', a.category));
          if (dateLabel(a.date)) meta.appendChild(el('time', '', dateLabel(a.date)));
          if (meta.childNodes.length) body.appendChild(meta);
          body.appendChild(el('span', 'album-card__title', a.title || 'อัลบั้มภาพ'));
          if (a.description) body.appendChild(el('span', 'album-card__description', a.description));
          if (!photoCount) body.appendChild(el('span', 'album-card__empty', 'ยังไม่มีภาพ'));
          card.disabled = !photoCount;
          card.append(media, body);
          card.addEventListener('click', function () { open(a, card); }); grid.appendChild(card);
        });
      }
      function makeCategories() {
        if (!categories) return;
        categories.replaceChildren();
        var names = Array.from(new Set(albums.map(function (a) { return a.category; }).filter(Boolean)));
        /* ไม่มีหมวดเลย = มีแค่ปุ่ม "ทั้งหมด" ปุ่มเดียวซึ่งกดแล้วไม่ได้อะไร ซ่อนทั้งแถวไปเลย */
        categories.hidden = !names.length;
        [''].concat(names).forEach(function (name) {
          var button = el('button', 'album-filter', name || 'ทั้งหมด'); button.type = 'button';
          button.setAttribute('aria-pressed', String(active === name));
          button.addEventListener('click', function () {
            active = name;
            categories.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
            paint();
          }); categories.appendChild(button);
        });
      }
      function load(fresh) {
        grid.setAttribute('aria-busy', 'true');
        return window.MCCMU.getAlbums({ fresh: fresh }).then(function (items) {
          albums = items; active = ''; makeCategories(); paint();
        }).catch(function () {
          message('ไม่สามารถโหลดอัลบั้มได้ในขณะนี้', true);
        }).finally(function () { grid.setAttribute('aria-busy', 'false'); });
      }
      return load(false);
    }
  };
})();
