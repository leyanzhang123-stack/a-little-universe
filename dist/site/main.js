/* ============================================================
   A Little Universe — interactions
   ============================================================ */
(function () {
  'use strict';

  var C = window.CONTENT || {};
  var meta = C.meta || {};
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var body = document.body;
  var loaded = {};                 // which photos actually loaded; key is "memory index - shot index"
  function mark(i, k) { loaded[i + '-' + k] = true; }

  // in the single-file build src becomes a data URI with no extension, so sniff the MIME
  function isVideo(src) {
    return /^data:video\//i.test(src) || /\.(mp4|mov|webm|m4v)$/i.test(src);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /* ==========================================================
     Starfield — layered parallax, slow drift, the occasional shooting star
     ========================================================== */
  var sky = { tiltX: 0, tiltY: 0, scroll: 0 };

  (function starfield() {
    var cv = $('#stars');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], shots = [], w = 0, h = 0, last = 0, nextShot = 4000;

    function build() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(210, (w * h) / 6600));
      stars = [];
      for (var i = 0; i < n; i++) {
        var d = 0.35 + Math.random() * 0.65;      // larger = nearer = moves more
        stars.push({
          x: Math.random() * w, y: Math.random() * h, d: d,
          r: (Math.random() * 1.1 + 0.28) * (0.6 + d * 0.6),
          a: Math.random() * 0.55 + 0.25,
          sp: Math.random() * 0.012 + 0.004,
          ph: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.045 * d,
          vy: (Math.random() - 0.5) * 0.035 * d - 0.012 * d,
          c: Math.random() > 0.8 ? '198,202,246' : '255,255,255'
        });
      }
    }

    function wrap(v, max) { return v < -20 ? v + max + 40 : v > max + 20 ? v - max - 40 : v; }

    function shootingStar() {
      var fromLeft = Math.random() > 0.4;
      shots.push({
        x: fromLeft ? -60 : w * (0.4 + Math.random() * 0.6),
        y: h * (0.05 + Math.random() * 0.4),
        vx: (fromLeft ? 1 : -1) * (0.5 + Math.random() * 0.35),
        vy: 0.20 + Math.random() * 0.16,
        life: 0, span: 900 + Math.random() * 500
      });
    }

    function paint(t) {
      var dt = last ? Math.min(t - last, 50) : 16;
      last = t;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x = wrap(s.x + s.vx * dt, w);
        s.y = wrap(s.y + s.vy * dt, h);
        var px = wrap(s.x + sky.tiltX * s.d, w);
        var py = wrap(s.y + (sky.tiltY - sky.scroll * 0.055) * s.d, h);
        var tw = reduced ? s.a : s.a * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        ctx.beginPath();
        ctx.arc(px, py, s.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + s.c + ',' + tw.toFixed(3) + ')';
        ctx.fill();
      }

      // shooting stars are night-only; once the main site turns day, stop them
      if (!reduced && body.classList.contains('night')) {
        nextShot -= dt;
        if (nextShot <= 0) { shootingStar(); nextShot = 7000 + Math.random() * 11000; }
      }
      for (var k = shots.length - 1; k >= 0; k--) {
        var sh = shots[k];
        sh.life += dt;
        var p = sh.life / sh.span;
        if (p >= 1) { shots.splice(k, 1); continue; }
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        var len = 90 + 120 * Math.sin(Math.PI * p);
        var fade = Math.sin(Math.PI * p);
        var g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * len, sh.y - sh.vy * len);
        g.addColorStop(0, 'rgba(255,246,224,' + (0.9 * fade).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,246,224,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(sh.x - sh.vx * len, sh.y - sh.vy * len);
        ctx.stroke();
      }

      requestAnimationFrame(paint);
    }

    build();
    requestAnimationFrame(paint);
    var tid;
    window.addEventListener('resize', function () {
      clearTimeout(tid); tid = setTimeout(build, 200);
    });
  })();

  // scrolling drives the starfield; nearer layers move faster
  (function skyScroll() {
    var raf = 0;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { sky.scroll = window.scrollY; raf = 0; });
    }, { passive: true });
  })();

  // tilt the phone and the starfield follows
  function listenTilt() {
    if (reduced) return;
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma == null) return;
      sky.tiltX = Math.max(-40, Math.min(40, e.gamma)) * 0.9;
      sky.tiltY = Math.max(-40, Math.min(40, (e.beta || 0) - 45)) * 0.5;
    });
  }
  function askTilt() {
    try {
      var D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        D.requestPermission().then(function (r) { if (r === 'granted') listenTilt(); })
                             .catch(function () {});
      } else if (D) {
        listenTilt();
      }
    } catch (err) { /* not supported, never mind */ }
  }

  /* ==========================================================
     A pool of light that follows the finger or cursor
     ========================================================== */
  (function pointerGlow() {
    var el = $('#glow');
    if (!el || reduced) return;
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2, x = tx, y = ty, raf = 0;

    function loop() {
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) raf = requestAnimationFrame(loop);
      else raf = 0;
    }
    function move(px, py) {
      tx = px; ty = py;
      el.classList.add('on');
      if (!raf) raf = requestAnimationFrame(loop);
    }
    window.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('pointerdown', function (e) { move(e.clientX, e.clientY); }, { passive: true });
  })();

  /* ==========================================================
     Tap empty space, a few small stars appear
     ========================================================== */
  (function tapTwinkle() {
    if (reduced) return;
    var marks = ['✦', '✧', '·', '✦', '˚'];
    var skip = 'button,a,input,textarea,select,label,.mem,.kid,.quiz,#envelope,.wish-cake,#lightbox,#secret';

    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest(skip)) return;
      var n = 4 + ((Math.random() * 3) | 0);
      for (var i = 0; i < n; i++) spark(e.clientX, e.clientY);
    }, { passive: true });

    function spark(x, y) {
      var d = document.createElement('span');
      d.className = 'twinkle';
      d.textContent = marks[(Math.random() * marks.length) | 0];
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      d.style.fontSize = (9 + Math.random() * 11).toFixed(0) + 'px';
      d.style.color = body.classList.contains('night')
        ? 'rgba(255,228,180,.95)' : 'rgba(157,162,226,.85)';
      document.body.appendChild(d);
      var a = d.animate([
        { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 0 },
        { transform: 'translate(' + (-50 + (Math.random() * 2 - 1) * 90) + '%,' +
                     (-50 - 40 - Math.random() * 90) + '%) scale(1) rotate(' +
                     (Math.random() * 180 - 90) + 'deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate(' + (-50 + (Math.random() * 2 - 1) * 150) + '%,' +
                     (-50 - 120 - Math.random() * 120) + '%) scale(.5)', opacity: 0 }
      ], { duration: 900 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.35,1)' });
      a.onfinish = function () { d.remove(); };
    }
  })();

  /* ==========================================================
     Background music — browsers refuse autoplay, so it starts on the ENTER click
     ========================================================== */
  var bgm = (function () {
    var M = C.music || {};
    var btn = $('#mute');
    // No background music configured. Still hand back the full shape:
    // the song section calls subscribe() whenever song.audio is empty,
    // and a missing method there throws and kills the rest of init.
    if (!M.src || !btn) return {
      start: function () {}, duck: function () {}, unduck: function () {},
      subscribe: function () {}
    };

    var audio = new Audio(M.src);
    audio.loop = true;
    audio.preload = 'auto';
    var watchers = [];
    function tell(on) { watchers.forEach(function (fn) { try { fn(on); } catch (e) {} }); }
    if (M.startAt) audio.currentTime = M.startAt;
    var target = typeof M.volume === 'number' ? M.volume : 0.32;
    audio.volume = 0;
    var wanted = false, ducked = false, fade;

    function fadeTo(to, ms) {
      clearInterval(fade);
      var from = audio.volume, t0 = performance.now();
      fade = setInterval(function () {
        var k = Math.min(1, (performance.now() - t0) / ms);
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k >= 1) { clearInterval(fade); if (to === 0) audio.pause(); }
      }, 40);
    }

    function play() {
      return audio.play().then(function () {
        btn.setAttribute('aria-pressed', 'true');
        fadeTo(ducked ? target * 0.12 : target, 1600);
        tell(true);
      });
    }
    function stop() {
      btn.setAttribute('aria-pressed', 'false');
      fadeTo(0, 500);
      tell(false);
    }

    btn.hidden = false;
    btn.addEventListener('click', function () {
      wanted = btn.getAttribute('aria-pressed') !== 'true';
      if (wanted) play().catch(function () { btn.setAttribute('aria-pressed', 'false'); });
      else stop();
    });

    return {
      // only call this inside a user gesture, or the browser refuses
      start: function () {
        wanted = true;
        play().catch(function () { btn.setAttribute('aria-pressed', 'false'); });
      },
      // duck the background music while our song plays, lift it afterwards
      duck: function () { ducked = true; if (wanted) fadeTo(target * 0.12, 600); },
      unduck: function () { ducked = false; if (wanted) fadeTo(target, 900); },
      // the record on the song card spins in time with the background music
      subscribe: function (fn) { watchers.push(fn); fn(!audio.paused); }
    };
  })();

  /* ==========================================================
     Prelude · Loading memories
     ========================================================== */
  var prelude = $('#prelude'), opening = $('#opening');
  opening.style.opacity = '0';
  opening.style.visibility = 'hidden';

  (function preludeScene() {
    var S = C.site || {};
    if (S.en) $('#preEn').textContent = S.en;
    if (S.cn) $('#preCn').textContent = S.cn;
    if (S.loading) $('#preStatus').textContent = S.loading;
    if (S.enter) $('#btnEnterPre').textContent = S.enter;
    if (S.or) $('#btnOr').textContent = S.or;

    var bar = $('#preBar'), pct = $('#prePct');
    var v = 0;

    function step() {
      // bail out once the prelude is gone, otherwise this timer chain keeps running
      // after the elements are removed and $('#preBtns') ends up null
      if (!bar || !bar.isConnected) return;
      // speed up and slow down, as if something were genuinely loading
      v += v < 62 ? 1.6 + Math.random() * 2.6
         : v < 88 ? 0.5 + Math.random() * 1.1
         : 0.7 + Math.random() * 1.6;
      if (v >= 100) v = 100;
      bar.style.width = v + '%';
      pct.textContent = Math.round(v) + '%';
      if (v < 100) { setTimeout(step, 42); return; }
      setTimeout(function () {
        var btns = $('#preBtns');
        if (btns) btns.classList.add('show');
      }, 380);
    }
    setTimeout(step, reduced ? 0 : 700);

    $('#btnOr').addEventListener('click', function () {
      var m = $('#preOrMsg');
      m.textContent = S.orMsg || '';
      m.classList.add('show');
    });
    $('#btnEnterPre').addEventListener('click', toCandles);
  })();

  function toCandles() {
    prelude.classList.add('gone');
    opening.style.visibility = '';
    opening.style.opacity = '';
    setTimeout(function () { prelude.remove(); }, 1300);
  }

  /* ==========================================================
     Prologue · Light eighteen candles
     ========================================================== */
  var TOTAL = 18;
  var candlesBox = $('#candles'), opNum = $('#opNum'), opDone = $('#opDone'),
      btnEnter = $('#btnEnter'), btnSkip = $('#btnSkip'), cake = $('#cake');
  var lit = 0;

  var chapters = C.chapters || {};
  // meta owns the prologue heading and subtitle; chapters.candles only sets the kicker
  if (chapters.candles && chapters.candles.line) $('#opLine').textContent = chapters.candles.line;
  if (meta.openingTitle) $('#opTitle').textContent = meta.openingTitle;
  if (meta.openingSubtitle) $('#opSub').textContent = meta.openingSubtitle;
  if (meta.openingHint) $('#opHint').textContent = meta.openingHint;
  if (meta.enterButton) btnEnter.textContent = meta.enterButton;

  // eighteen candles, each one its own focusable button
  var tints = [['#FDFCFF', '#E4E8F8'], ['#EDF4FE', '#C9DEF6'], ['#F3EFFD', '#D5D0F3']];
  for (var ci = 0; ci < TOTAL; ci++) {
    var c = document.createElement('button');
    c.type = 'button';
    c.className = 'candle';
    c.setAttribute('aria-label', 'Light candle ' + (ci + 1) + '');
    c.innerHTML = '<b></b><u></u><i></i>';
    var stick = c.querySelector('i');
    var tint = tints[ci % 3];
    stick.style.setProperty('--h', (24 + (ci % 4) * 3 + (ci % 2 ? 2 : 0)) + 'px');
    stick.style.setProperty('--c1', tint[0]);
    stick.style.setProperty('--c2', tint[1]);
    candlesBox.appendChild(c);
  }
  var candleEls = candlesBox.querySelectorAll('.candle');

  function lightCandle(el) {
    if (el.classList.contains('lit')) return;
    el.classList.add('lit', 'just');
    setTimeout(function () { el.classList.remove('just'); }, 520);
    lit++;
    opNum.textContent = lit;
    opNum.classList.add('pop');
    setTimeout(function () { opNum.classList.remove('pop'); }, 340);
    checkDone();
  }

  // hold to carry a flame, drag across a candle to light it
  (function torch() {
    var el = $('#torch');
    var wicks = [], active = false;

    function measure() {
      wicks = [];
      Array.prototype.forEach.call(candleEls, function (c) {
        var r = c.getBoundingClientRect();
        wicks.push({ el: c, x: r.left + r.width / 2, y: r.top + 5 });
      });
    }
    function move(x, y) {
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      for (var i = 0; i < wicks.length; i++) {
        var w = wicks[i];
        if (!w.el.classList.contains('lit') && Math.hypot(x - w.x, y - w.y) < 26) lightCandle(w.el);
      }
    }

    opening.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button:not(.candle)')) return;   // do not fight with the two buttons underneath
      active = true;
      measure();
      el.classList.add('on');
      move(e.clientX, e.clientY);
      try { opening.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    opening.addEventListener('pointermove', function (e) {
      if (!active) return;
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      opening.addEventListener(ev, function () { active = false; el.classList.remove('on'); });
    });

    // keyboard and screen reader: lighting one candle on its own also works
    Array.prototype.forEach.call(candleEls, function (c) {
      c.addEventListener('click', function () { lightCandle(c); });
    });
  })();

  function checkDone() {
    if (lit < TOTAL) return;
    cake.classList.add('done');
    $('#opHint').classList.add('hide');
    if (meta.openingSubDone) $('#opSub').textContent = meta.openingSubDone;
    opDone.textContent = meta.openingDone || '';
    setTimeout(function () {
      opDone.classList.add('show');
      btnEnter.classList.add('show');
      btnSkip.style.display = 'none';
    }, 460);
  }

  function enterSite() {
    askTilt();
    bgm.start();
    opening.classList.add('gone');
    body.classList.remove('night', 'locked');
    body.classList.add('day');
    window.scrollTo(0, 0);
    setTimeout(function () { opening.remove(); }, 1400);
  }

  btnEnter.addEventListener('click', enterSite);
  btnSkip.addEventListener('click', function () {
    Array.prototype.forEach.call(candleEls, function (c) { c.classList.add('lit'); });
    lit = TOTAL;
    opNum.textContent = TOTAL;
    cake.classList.add('done');
    enterSite();
  });

  /* ==========================================================
     Chapter headings
     ========================================================== */
  Array.prototype.forEach.call(document.querySelectorAll('.ch-head[data-ch]'), function (h) {
    var ch = chapters[h.dataset.ch];
    if (!ch) return;
    h.innerHTML =
      (ch.line ? '<p class="ch-line">' + esc(ch.line) + '</p>' : '') +
      (ch.cn ? '<h2 class="ch-cn">' + esc(ch.cn) + '</h2>' : '') +
      (ch.sub ? '<p class="ch-sub">' + esc(ch.sub) + '</p>' : '') +
      '<div class="ch-rule"></div>';
  });

  /* ==========================================================
     Hero
     ========================================================== */
  (function hero() {
    if (meta.name) {
      $('#heroTitle').textContent = meta.name;
      $('#foot').textContent = 'MADE WITH ♡ · FOR ' + meta.name;
    }
    if (meta.age) $('#heroBadge').textContent = 'HAPPY ' + meta.age + 'TH';
    if (meta.heroSub) $('#heroSub').textContent = meta.heroSub;

    var el = $('#heroDate');
    var b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meta.birthday || '');
    if (!el || !b) return;
    var y = +b[1], m = +b[2], d = +b[3], bigYear = y + (meta.age || 18);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var range = y + '.' + pad(m) + '.' + pad(d) + '  —  ' + bigYear + '.' + pad(m) + '.' + pad(d);

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(bigYear, m - 1, d) - today) / 86400000);
    var note = days > 0 ? 'Eighteen in ' + days + ' days' : days === 0 ? 'Today is the day' : '';
    el.innerHTML = '<span class="hd-range">' + range + '</span>' +
                   (note ? '<span class="hd-note">' + note + '</span>' : '');
  })();

  /* ==========================================================
     1. Memories + quiz gates
     ========================================================== */
  var gates = { unlocked: 0, nodes: [] };

  (function memories() {
    var box = $('#memline');
    var list = C.memories || [];
    if (!list.length) { box.closest('section').style.display = 'none'; return; }

    var quizzes = (C.quizzes || []).slice().sort(function (a, b) {
      return (a.after || 0) - (b.after || 0);
    });

    var row = 0, gate = 0, qi = 0;

    // a question with after: 0 sits ahead of every memory
    while (qi < quizzes.length && (quizzes[qi].after || 0) === 0) {
      addNode(quizNode(quizzes[qi], qi, gate), gate);
      gate++; qi++;
    }

    list.forEach(function (m, i) {
      addNode(memoryNode(m, i), gate);
      // does a question go after this one
      while (qi < quizzes.length && (quizzes[qi].after || 0) === i + 1) {
        addNode(quizNode(quizzes[qi], qi, gate), gate);
        gate++;
        qi++;
      }
    });
    // questions whose after exceeds the photo count all land at the end
    while (qi < quizzes.length) {
      addNode(quizNode(quizzes[qi], qi, gate), gate);
      gate++; qi++;
    }

    function addNode(el, g) {
      el.dataset.gate = String(g);
      el.style.gridRow = String(++row);
      box.appendChild(el);
      gates.nodes.push(el);
    }

    function memoryNode(m, i) {
      var side = i % 2 ? 'right' : 'left';
      var item = document.createElement('article');
      item.className = 'mem reveal from-' + side;
      item.dataset.side = side;
      item.tabIndex = 0;

      var dot = document.createElement('span');
      dot.className = 'mem-dot';
      item.appendChild(dot);

      var shots = !m.src ? [] : (Array.isArray(m.src) ? m.src : [m.src]);
      if (shots.length) {
        var strip = document.createElement('div');
        strip.className = 'shots' + (shots.length > 1 ? ' multi' : '');
        shots.forEach(function (src, k) {
          var frame = document.createElement('div');
          frame.className = 'frame';
          frame.innerHTML = '<div class="ph-placeholder"><span class="em">🌤</span>' +
                            '<small>PHOTO</small></div>';

          if (isVideo(src)) {
            var v = document.createElement('video');
            v.src = src; v.controls = true; v.playsInline = true; v.preload = 'metadata';
            // the WeChat/QQ in-app browser on Android (X5) hijacks video into a fullscreen
            // system player by default; these attributes keep it playing inline
            v.setAttribute('playsinline', '');
            v.setAttribute('webkit-playsinline', 'true');
            v.setAttribute('x5-playsinline', 'true');
            v.setAttribute('x5-video-player-type', 'h5-page');
            v.setAttribute('x-webkit-airplay', 'allow');
            v.addEventListener('loadeddata', function () { v.classList.add('ok'); mark(i, k); });
            v.addEventListener('click', function (e) { e.stopPropagation(); });
            frame.appendChild(v);
          } else {
            var img = document.createElement('img');
            img.alt = m.title || 'Memory photo';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.addEventListener('load', function () { img.classList.add('ok'); mark(i, k); });
            img.addEventListener('error', function () { img.remove(); });
            img.src = src;
            frame.appendChild(img);
          }

          frame.addEventListener('click', function () { openLightbox(i, k); });
          strip.appendChild(frame);
        });
        item.appendChild(strip);

        if (shots.length > 1) {
          var dots = document.createElement('div');
          dots.className = 'shot-dots';
          shots.forEach(function () { dots.appendChild(document.createElement('i')); });
          item.appendChild(dots);
          strip.addEventListener('scroll', function () {
            var k = Math.round(strip.scrollLeft / strip.clientWidth);
            Array.prototype.forEach.call(dots.children, function (d, n) {
              d.classList.toggle('on', n === k);
            });
          }, { passive: true });
          dots.firstChild.classList.add('on');
        }
      } else {
        item.classList.add('no-photo');   // entries without a photo keep the text only
      }

      var bodyEl = document.createElement('div');
      bodyEl.className = 'mem-body';
      bodyEl.innerHTML = (m.date ? '<p class="mem-date">' + esc(m.date) + '</p>' : '') +
                         '<h3>' + esc(m.title || '') + '</h3>' +
                         (m.text ? '<p class="mem-text">' + esc(m.text) + '</p>' : '');
      item.appendChild(bodyEl);

      item.removeAttribute('tabindex');
      return item;
    }

    function quizNode(q, index, g) {
      var el = document.createElement('div');
      el.className = 'quiz reveal';
      el.innerHTML =
        '<p class="quiz-no">QUESTION ' + String(index + 1).padStart(2, '0') + '</p>' +
        '<p class="quiz-q">' + esc(q.q || '') + '</p>' +
        (q.hint ? '<p class="quiz-hint">' + esc(q.hint) + '</p>' : '') +
        '<form class="quiz-form">' +
          '<input class="quiz-in" type="text" autocomplete="off" ' +
                 'placeholder="Your answer" aria-label="Answer">' +
          '<button type="submit" class="ghost ghost-ink">Submit</button>' +
        '</form>' +
        '<button type="button" class="quiz-tell">Just tell me</button>' +
        '<p class="quiz-ok" hidden></p>';

      var form = el.querySelector('.quiz-form');
      var input = el.querySelector('.quiz-in');
      var okEl = el.querySelector('.quiz-ok');
      var tellBtn = el.querySelector('.quiz-tell');
      // with no right answer, a "just tell me" button makes no sense
      if (q.free) tellBtn.remove();

      function pass(text) {
        el.classList.add('done');
        okEl.textContent = text;
        okEl.hidden = false;
        gates.unlocked = Math.max(gates.unlocked, g + 1);
        applyGates();
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = normalize(input.value);
        if (!val) return;
        // free-answer questions: anything non-empty passes
        if (q.free) { pass(q.ok || ''); return; }
        var hit = (q.answers || []).some(function (a) {
          var n = normalize(a);
          return n && (n === val || val.indexOf(n) > -1 || n.indexOf(val) > -1);
        });
        if (hit) {
          pass(q.ok || 'Correct.');
        } else {
          el.classList.add('wrong');
          setTimeout(function () { el.classList.remove('wrong'); }, 600);
        }
      });

      if (tellBtn) {
        tellBtn.addEventListener('click', function () {
          pass(q.tell || q.ok || '');
        });
      }
      return el;
    }
  })();

  function normalize(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\s　]/g, '')
      .replace(/[，。！？、,.!?；;：:'"“”‘’()（）《》〈〉【】\[\]~～\-—_]/g, '');
  }

  function applyGates() {
    gates.nodes.forEach(function (el) {
      var g = +el.dataset.gate;
      el.classList.toggle('gated', g > gates.unlocked);
    });
  }
  applyGates();

  /* ==========================================================
     Meals we shared · flip cards
     ========================================================== */
  (function meals() {
    var grid = $('#mealGrid');
    var list = C.meals || [];
    if (!grid) return;
    if (!list.length) { grid.closest('section').style.display = 'none'; return; }

    list.forEach(function (m, i) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'meal reveal';
      card.style.setProperty('--d', (i % 3) * 90 + 'ms');
      card.setAttribute('aria-label', 'Flip: ' + (m.teaser || ''));

      var back = '<div class="meal-face meal-back">' +
                   '<div class="meal-cap">' +
                     '<p class="meal-name">' + esc(m.name || '') + '</p>' +
                     (m.date ? '<p class="meal-date">' + esc(m.date) + '</p>' : '') +
                   '</div>' +
                 '</div>';

      card.innerHTML =
        '<div class="meal-in">' +
          '<div class="meal-face meal-front">' +
            '<span class="meal-no">DISH ' + String(i + 1).padStart(2, '0') + '</span>' +
            '<p class="meal-teaser">' + esc(m.teaser || '') + '</p>' +
            '<span class="meal-tap">TAP</span>' +
          '</div>' +
          back +
        '</div>';

      if (m.src) {
        var img = document.createElement('img');
        img.alt = m.name || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('load', function () { img.classList.add('ok'); });
        img.addEventListener('error', function () { img.remove(); });
        img.src = m.src;
        card.querySelector('.meal-back').insertBefore(img, card.querySelector('.meal-cap'));
      }

      card.addEventListener('click', function () { card.classList.toggle('flipped'); });
      grid.appendChild(card);
    });
  })();

  /* ==========================================================
     3. Little you
     ---------------------------------------------------------
     Polaroid wall. The tilt goes on the inner .kid-paper, never on .kid,
     because .reveal.in resets transform to none and the angle would be lost.
     A small heart in the corner; likes are remembered in the viewer's own browser.
     .kid is a div rather than a button: it already contains an enlarge button
     and a heart button, and buttons cannot nest.
     ========================================================== */
  (function childhood() {
    var K = C.childhood || {};
    var wall = $('#kidWall');
    if (!wall) return;
    var items = (K.items || []).filter(function (x) { return x && x.src; });
    if (!items.length) { wall.closest('section').style.display = 'none'; return; }

    // fixed angles rather than random: re-rolling them on every refresh is noisy
    var TILT = [-2.4, 1.9, -1.3, 2.6, -2.0, 1.4, -2.8, 2.2, -1.6];

    // liked photos stay lit the next time the page opens.
    // reads and writes can both throw (private mode, site data disabled), so wrap
    // everything in try and treat failure as "nothing liked"; the page carries on.
    var KEY = 'qz-kid-likes';
    var liked = {};
    try { liked = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { liked = {}; }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(liked)); } catch (e) {} }

    items.forEach(function (it, i) {
      var cell = document.createElement('div');
      cell.className = 'kid reveal';
      cell.style.setProperty('--d', (i % 3) * 120 + 'ms');

      var paper = document.createElement('div');
      paper.className = 'kid-paper';
      paper.style.setProperty('--r', TILT[i % TILT.length] + 'deg');

      var open = document.createElement('button');
      open.type = 'button';
      open.className = 'kid-open';
      open.setAttribute('aria-label', (it.cap || 'Childhood photo') + ', open larger');

      var shot = document.createElement('span');
      shot.className = 'kid-shot';
      shot.innerHTML = '<span class="kid-ph">🧸</span>';

      var img = document.createElement('img');
      img.alt = it.cap || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('load', function () {
        // respect each photo's own aspect ratio; forcing them all to portrait crops the subject
        if (img.naturalWidth && img.naturalHeight) {
          shot.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
        }
        cell.classList.add('has-img');
      });
      img.addEventListener('error', function () { img.remove(); });
      img.src = it.src;
      shot.appendChild(img);
      open.appendChild(shot);
      open.addEventListener('click', function () {
        if (!cell.classList.contains('has-img')) return;   // do not open an empty lightbox before the image has loaded
        showPhoto(it.src, it.cap || '', it.note || '');
      });
      paper.appendChild(open);

      // the handwritten line on the polaroid border. Keep the empty row even when unset:
      // it leaves room for the heart and keeps every polaroid the same height.
      var cap = document.createElement('p');
      cap.className = 'kid-cap';
      cap.textContent = it.cap || '';
      paper.appendChild(cap);

      var key = 'k' + i;
      var heart = document.createElement('button');
      heart.type = 'button';
      heart.className = 'kid-heart';
      heart.setAttribute('aria-label', 'Like this one');
      setHeart(heart, !!liked[key]);
      heart.addEventListener('click', function () {
        var on = !liked[key];
        if (on) liked[key] = 1; else delete liked[key];
        save();
        setHeart(heart, on);
        heart.classList.remove('pop'); void heart.offsetWidth; heart.classList.add('pop');
        if (on) floatHearts(heart);
      });
      paper.appendChild(heart);

      cell.appendChild(paper);
      wall.appendChild(cell);
    });

    function setHeart(btn, on) {
      btn.textContent = on ? '\u2665' : '\u2661';
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    // float a few hearts up at the moment it lights
    function floatHearts(btn) {
      if (reduced) return;
      var r = btn.getBoundingClientRect();
      for (var k = 0; k < 3; k++) spawn(k);

      function spawn(k) {
        var h = document.createElement('div');
        h.className = 'kid-fly';
        h.textContent = '\u2665';
        h.style.left = (r.left + r.width / 2) + 'px';
        h.style.top  = (r.top + r.height / 2) + 'px';
        document.body.appendChild(h);

        var dx = (Math.random() * 2 - 1) * 34;
        var dy = -(54 + Math.random() * 46);
        var a = h.animate([
          { transform: 'translate(-50%,-50%) scale(.45)', opacity: 0 },
          { transform: 'translate(calc(-50% + ' + (dx * 0.5) + 'px), calc(-50% + ' + (dy * 0.45) + 'px)) scale(1)',
            opacity: 1, offset: 0.35 },
          { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.78)',
            opacity: 0 }
        ], { duration: 1000 + k * 150 + Math.random() * 260, delay: k * 90,
             easing: 'cubic-bezier(.2,.7,.35,1)' });
        a.onfinish = function () { h.remove(); };
      }
    }
  })();

  /* ==========================================================
     4. Our song
     ========================================================== */
  (function song() {
    var S = C.song;
    var card = $('#songCard');
    if (!S || !(S.name || S.line)) { card.closest('section').style.display = 'none'; return; }

    card.innerHTML =
      '<div class="disc">' +
        (S.cover ? '<img class="disc-img" src="' + esc(S.cover) + '" alt="">'
                 : '<span class="disc-note">♪</span>') +
        '<span class="disc-hole"></span>' +
      '</div>' +
      '<div class="song-body">' +
        '<p class="song-name">' + esc(S.name || '') + '</p>' +
        '<p class="song-artist">' + esc(S.artist || '') + '</p>' +
        (S.line ? '<p class="song-line">' + esc(S.line) + '</p>' : '') +
        (S.note ? '<p class="song-note">' + esc(S.note) + '</p>' : '') +
        (S.audio ? '<button class="ghost ghost-ink song-play" id="songPlay">▶ PLAY</button>' : '') +
      '</div>';

    var disc0 = card.querySelector('.disc');
    if (!S.audio) {
      // the song is already the site-wide background music; just spin the record
      bgm.subscribe(function (on) { disc0.classList.toggle('spin', !!on); });
      return;
    }
    var audio = new Audio(S.audio);
    audio.loop = true;
    var btn = $('#songPlay'), disc = card.querySelector('.disc');
    btn.addEventListener('click', function () {
      if (audio.paused) {
        audio.play().then(function () {
          btn.textContent = '❚❚ PAUSE';
          disc.classList.add('spin');
          bgm.duck();
        }).catch(function () { btn.textContent = 'Cannot play'; });
      } else {
        audio.pause();
        btn.textContent = '▶ PLAY';
        disc.classList.remove('spin');
        bgm.unduck();
      }
    });
  })();

  /* ==========================================================
     5. The letter
     ========================================================== */
  (function letter() {
    var L = C.letter || {};
    var paper = $('#paper');
    var html = '';
    if (L.salutation) html += '<h3>' + esc(L.salutation) + '</h3>';
    (L.paragraphs || []).forEach(function (p) { html += '<p>' + esc(p) + '</p>'; });
    var sig = L.signature;
    if (sig) {
      (Array.isArray(sig) ? sig : [sig]).forEach(function (line, i) {
        html += '<p class="sign' + (i ? ' sign-n' : '') + '">' + esc(line) + '</p>';
      });
    }
    if (L.ps) html += '<p class="ps">' + esc(L.ps) + '</p>';
    paper.innerHTML = html;

    var env = $('#envelope');
    function open() {
      if (env.classList.contains('opened')) return;
      env.classList.add('opened');
      setTimeout(function () {
        env.classList.add('tucked');
        paper.classList.add('show');
        revealParagraphs();
      }, 520);
    }
    // the letter runs long (thirty-odd paragraphs). Queuing half a second each would
    // leave the last one ten-plus seconds out, staring at blank space. Instead: the
    // paragraphs already on screen stagger in, the rest fade in as they are scrolled to.
    function revealParagraphs() {
      var ps = Array.prototype.slice.call(paper.querySelectorAll('p'));
      if (reduced || !('IntersectionObserver' in window)) {
        ps.forEach(function (p) { p.classList.add('in'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var el = en.target;
          io.unobserve(el);
          setTimeout(function () { el.classList.add('in'); }, +(el.dataset.d || 0));
        });
      }, { rootMargin: '0px 0px -10% 0px' });

      var n = 0;
      ps.forEach(function (el) {
        // stagger the ones already on screen when the letter opens, like paper unfolding
        if (n < 4 && el.getBoundingClientRect().top < window.innerHeight) {
          el.dataset.d = 240 + n * 260;
          n++;
        }
        io.observe(el);
      });
    }

    env.addEventListener('click', open);
    env.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  })();

  /* ==========================================================
     6. The ending
     ========================================================== */
  (function surprise() {
    var S = C.surprise || {};
    var hint = $('#spHint'), wc = $('#wishCake'), btn = $('#btnBlow'), fin = $('#spFinal');
    if (S.hint) hint.textContent = S.hint;
    if (S.button) btn.textContent = S.button;

    var html = '<h2>' + esc(S.title || 'Happy birthday') + '</h2>';
    (S.lines || []).forEach(function (l) { html += '<p class="line">' + esc(l) + '</p>'; });
    fin.innerHTML = html;

    var blown = false;
    function blow() {
      if (blown) return;
      blown = true;
      wc.classList.add('blown');
      hint.classList.add('hide');
      btn.style.display = 'none';
      confetti();
      setTimeout(function () {
        fin.classList.add('show');
        var lines = fin.querySelectorAll('.line');
        Array.prototype.forEach.call(lines, function (l, i) {
          setTimeout(function () { l.classList.add('in'); }, 320 + i * 640);
        });
        showFinale(320 + lines.length * 640 + 900);
      }, 720);
    }
    btn.addEventListener('click', blow);
    wc.addEventListener('click', blow);
    wc.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blow(); }
    });

    // the one last thing that appears at the very end
    function showFinale(delay) {
      var F = S.finale || {};
      var box = $('#finale');
      if (!box || !F.enabled || !(F.video || F.link)) return;

      var media = F.video
        ? '<video class="fin-video" controls playsinline preload="metadata"' +
            // as above, do not let WeChat hijack this into fullscreen
            ' webkit-playsinline="true" x5-playsinline="true"' +
            ' x5-video-player-type="h5-page" x-webkit-airplay="allow"' +
            (F.poster ? ' poster="' + esc(F.poster) + '"' : '') +
            ' src="' + esc(F.video) + '"></video>'
        : '<a class="fin-link ghost ghost-ink" href="' + esc(F.link) +
            '" target="_blank" rel="noopener">' + esc(F.linkLabel || 'Take a look') + '</a>';

      box.innerHTML =
        (F.kicker ? '<p class="fin-kicker">' + esc(F.kicker) + '</p>' : '') +
        (F.title ? '<p class="fin-title">' + esc(F.title) + '</p>' : '') +
        media +
        (F.note ? '<p class="fin-note">' + esc(F.note) + '</p>' : '');

      var v = box.querySelector('video');
      if (v) {
        v.addEventListener('play', function () { bgm.duck(); });
        v.addEventListener('pause', function () { bgm.unduck(); });
        v.addEventListener('ended', function () { bgm.unduck(); });
      }
      setTimeout(function () {
        box.classList.add('show');
        requestAnimationFrame(function () { box.classList.add('in'); });
      }, delay);
    }

    // the moon · three taps in a row
    var taps = 0, timer;
    $('#secretText').textContent = S.secret || '';
    $('#moon').addEventListener('click', function () {
      taps++;
      clearTimeout(timer);
      timer = setTimeout(function () { taps = 0; }, 1400);
      if (taps >= 3) { taps = 0; showModal($('#secret')); confetti(28); }
    });
    $('#secretClose').addEventListener('click', function () { hideModal($('#secret')); });
    $('#secret').addEventListener('click', function (e) { if (e.target === this) hideModal(this); });
  })();

  /* ==========================================================
     Chapter nav — the dots down the right edge
     ========================================================== */
  (function chapterNav() {
    var nav = $('#chapnav');
    if (!nav) return;
    var stops = [
      { id: 'hero',         label: 'Start' },
      { id: 'memories',     label: 'Memories' },
      { id: 'meals-sec',    label: 'Meals' },
      { id: 'childhood-sec', label: 'Childhood' },
      { id: 'song-sec',     label: 'Song' },
      { id: 'letter',       label: 'Letter' },
      { id: 'surprise',     label: 'Last' }
    ].filter(function (x) {
      var el = document.getElementById(x.id);
      return el && el.style.display !== 'none';
    });
    if (stops.length < 2) return;

    var items = stops.map(function (st) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cn-item';
      b.setAttribute('aria-label', st.label);
      b.innerHTML = '<span class="cn-label">' + esc(st.label) + '</span><span class="cn-dot"></span>';
      b.addEventListener('click', function () {
        document.getElementById(st.id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      });
      nav.appendChild(b);
      return b;
    });

    function mark(i) {
      items.forEach(function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    mark(0);

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var i = stops.findIndex(function (x) { return x.id === en.target.id; });
        if (i > -1) mark(i);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    stops.forEach(function (st) { io.observe(document.getElementById(st.id)); });
  })();

  /* ==========================================================
     Photos tilt slightly toward the cursor
     ========================================================== */
  (function photoTilt() {
    if (reduced || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest && e.target.closest('.mem');
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('tilting');
      card.style.transform =
        'perspective(900px) rotateY(' + (px * 7).toFixed(2) + 'deg) rotateX(' +
        (-py * 7).toFixed(2) + 'deg)';
    }, { passive: true });

    document.addEventListener('pointerout', function (e) {
      var card = e.target.closest && e.target.closest('.mem');
      if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
      card.classList.remove('tilting');
      card.style.transform = '';
    }, { passive: true });
  })();

  /* ==========================================================
     Fade in on scroll
     ========================================================== */
  (function reveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || reduced) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  })();

  /* ==========================================================
     Lightbox
     ========================================================== */
  var lb = $('#lightbox');
  function openLightbox(i, k) {
    var p = (C.memories || [])[i];
    if (!p) return;
    k = k || 0;
    var shots = !p.src ? [] : (Array.isArray(p.src) ? p.src : [p.src]);
    var src = shots[k];
    var img = $('#lbImg');
    if (src && loaded[i + '-' + k] && !isVideo(src)) {
      img.style.display = ''; img.src = src; img.alt = p.title || '';
    } else {
      img.style.display = 'none';
      if (src && isVideo(src)) return;   // video plays in place, no lightbox needed
    }
    $('#lbTitle').textContent = (p.date ? p.date + '  ·  ' : '') + (p.title || '') +
                               (shots.length > 1 ? '  ·  ' + (k + 1) + '/' + shots.length : '');
    $('#lbText').textContent = p.text || '';
    showModal(lb);
  }

  // for images outside the memories data set (the childhood wall)
  function showPhoto(src, title, text) {
    var img = $('#lbImg');
    if (src) { img.style.display = ''; img.src = src; img.alt = title || ''; }
    else { img.style.display = 'none'; }
    $('#lbTitle').textContent = title || '';
    $('#lbText').textContent = text || '';
    showModal(lb);
  }
  $('#lbClose').addEventListener('click', function () { hideModal(lb); });
  lb.addEventListener('click', function (e) { if (e.target === lb) hideModal(lb); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (lb.classList.contains('open')) hideModal(lb);
    if ($('#secret').classList.contains('open')) hideModal($('#secret'));
  });

  function showModal(el) {
    el.classList.add('open');
    body.classList.add('locked');
    requestAnimationFrame(function () { el.classList.add('show'); });
  }
  function hideModal(el) {
    el.classList.remove('show');
    body.classList.remove('locked');
    setTimeout(function () { el.classList.remove('open'); }, 450);
  }

  /* ==========================================================
     Stardust
     ========================================================== */
  function confetti(count) {
    if (reduced) return;
    var n = count || 60;
    var colors = ['#C9CCF2', '#B3CFEE', '#FFD9A0', '#DED8F5', '#FFFFFF', '#9DA2E2'];
    for (var i = 0; i < n; i++) {
      (function (i) {
        setTimeout(function () {
          var d = document.createElement('div');
          d.className = 'confetti';
          var size = 5 + Math.random() * 7;
          d.style.left = (Math.random() * 100) + 'vw';
          d.style.width = size + 'px';
          d.style.height = (size * (Math.random() > .5 ? 1 : 1.9)) + 'px';
          d.style.background = colors[(Math.random() * colors.length) | 0];
          d.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
          document.body.appendChild(d);
          var a = d.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: 'translateY(' + (window.innerHeight + 60) + 'px) translateX(' +
                         (Math.random() * 160 - 80) + 'px) rotate(' +
                         (Math.random() * 720 - 360) + 'deg)', opacity: 0 }
          ], { duration: 2600 + Math.random() * 2400, easing: 'cubic-bezier(.25,.6,.4,1)' });
          a.onfinish = function () { d.remove(); };
        }, i * 34);
      })(i);
    }
  }
})();
