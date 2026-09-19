/* ============================================================
   بصمتي لوطني — منطق التطبيق
   ============================================================ */

(function () {
  'use strict';

  var CFG = window.SITE_CONFIG || {};
  var $  = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function ar(n)   { return String(n).replace(/[0-9]/g, function (d) { return AR[+d]; }); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /* ============================================================
     الصوت
     ============================================================ */
  var Sound = (function () {
    var ctx = null, on = true, buf = null;
    try { on = localStorage.getItem('nd96.sound') !== 'off'; } catch (e) {}

    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function noise() {
      var c = ac(); if (!c) return null;
      if (!buf) {
        buf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return buf;
    }
    function tone(f, t0, dur, type, vol) {
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, c.currentTime + t0);
      g.gain.setValueAtTime(0, c.currentTime + t0);
      g.gain.linearRampToValueAtTime(vol == null ? .14 : vol, c.currentTime + t0 + .012);
      g.gain.exponentialRampToValueAtTime(.0008, c.currentTime + t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + .02);
    }
    function hiss(t0, dur, f, vol) {
      var c = ac(); if (!c) return;
      var b = noise(); if (!b) return;
      var s = c.createBufferSource(); s.buffer = b;
      var bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(f, c.currentTime + t0);
      var g = c.createGain();
      g.gain.setValueAtTime(vol == null ? .09 : vol, c.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(.0008, c.currentTime + t0 + dur);
      s.connect(bp); bp.connect(g); g.connect(c.destination);
      s.start(c.currentTime + t0); s.stop(c.currentTime + t0 + dur);
    }

    var lib = {
      tap:     function () { tone(680, 0, .06, 'triangle', .07); },
      move:    function () { hiss(0, .24, 1500, .045); tone(430, 0, .13, 'sine', .045); },
      press:   function () { tone(240, 0, .09, 'sine', .055); },
      stamp:   function () {
        tone(115, 0, .2, 'sine', .2); hiss(0, .14, 720, .12);
        tone(523.25, .07, .15, 'triangle', .09);
        tone(783.99, .16, .28, 'triangle', .09);
      },
      success: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * .08, .32, 'triangle', .09); });
      },
      error:   function () { tone(200, 0, .15, 'square', .06); tone(150, .11, .18, 'square', .05); }
    };

    return {
      play:   function (n) { if (on && lib[n]) { try { lib[n](); } catch (e) {} } },
      toggle: function () {
        on = !on;
        try { localStorage.setItem('nd96.sound', on ? 'on' : 'off'); } catch (e) {}
        if (on) { ac(); lib.tap(); }
        return on;
      },
      isOn: function () { return on; },
      warm: function () { ac(); }
    };
  })();

  var sndBtn = $('sound-toggle');
  sndBtn.setAttribute('aria-pressed', Sound.isOn() ? 'true' : 'false');
  sndBtn.addEventListener('click', function () {
    sndBtn.setAttribute('aria-pressed', Sound.toggle() ? 'true' : 'false');
  });
  document.addEventListener('pointerdown', function warm() {
    Sound.warm();
    document.removeEventListener('pointerdown', warm);
  }, { once: true });

  /* ============================================================
     الموسيقى الخلفية
     يشغّل assets/audio/background.mp3 إن وُجد،
     وإلا يولّد لحنًا هادئًا داخليًا حتى يعمل الزر دائمًا.
     ============================================================ */
  var Music = (function () {
    var on = false, el = null, ctx = null, master = null, timer = 0, step = 0;
    var mode = 'off', track = null, probing = null;
    var VOL = 0.60;

    try { on = localStorage.getItem('nd96.music') === 'on'; } catch (e) {}

    function ac() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    /* ---- اللحن المولّد: سلّم خماسي هادئ ---- */
    var MELODY = [587.33, 493.88, 440, 493.88, 587.33, 659.25, 587.33, 493.88,
                  440, 369.99, 440, 493.88, 587.33, 493.88, 440, 369.99];
    var BASS   = [146.83, 146.83, 164.81, 164.81, 185.00, 185.00, 146.83, 146.83];

    function voice(freq, at, dur, vol, type) {
      var c = ac(); if (!c) return;
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
      o.connect(g); g.connect(master);
      o.start(at); o.stop(at + dur + 0.05);
    }

    function beat() {
      var c = ac(); if (!c) return;
      var at = c.currentTime + 0.05;
      var n = MELODY[step % MELODY.length];
      voice(n, at, 1.05, 0.10, 'triangle');
      voice(n * 2, at, 0.70, 0.025, 'sine');
      if (step % 2 === 0) voice(BASS[(step / 2) % BASS.length], at, 1.5, 0.07, 'sine');
      step++;
    }

    function toneStart() {
      if (timer) return;
      ac(); beat();
      timer = setInterval(beat, 620);
      fadeCtx(1, 900);
      mode = 'tone';
    }
    function toneStop() { clearInterval(timer); timer = 0; }

    function fadeCtx(to, ms) {
      var c = ac(); if (!c || !master) return;
      master.gain.cancelScheduledValues(c.currentTime);
      master.gain.setValueAtTime(master.gain.value, c.currentTime);
      master.gain.linearRampToValueAtTime(to, c.currentTime + (ms || 600) / 1000);
    }
    function fadeEl(to, ms) {
      if (!el) return;
      var from = el.volume, t0 = Date.now();
      var iv = setInterval(function () {
        var k = Math.min(1, (Date.now() - t0) / (ms || 600));
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k >= 1) clearInterval(iv);
      }, 40);
    }

    /* ---- ابحث عن ملف الموسيقى فعليًا بدل الاعتماد على فشل التشغيل ---- */
    function findTrack() {
      if (probing) return probing;
      var exts = ['mp3', 'm4a', 'ogg'];
      probing = exts.reduce(function (chain, ext) {
        return chain.then(function (found) {
          if (found) return found;
          var url = 'assets/audio/background.' + ext;
          return fetch(url, { method: 'HEAD' })
            .then(function (r) {
              var ct = r.headers.get('content-type') || '';
              return (r.ok && ct.indexOf('text/html') === -1) ? url : null;
            })
            .catch(function () { return null; });
        });
      }, Promise.resolve(null));
      return probing;
    }

    function playFile(url) {
      if (!el) {
        el = document.createElement('audio');
        el.loop = true; el.preload = 'auto'; el.volume = 0;
        el.addEventListener('error', function () { if (on) toneStart(); });
        document.body.appendChild(el);
      }
      if (track !== url) { track = url; el.src = url; }
      var p = el.play();
      if (p && p.catch) {
        p.then(function () { mode = 'file'; fadeEl(VOL, 800); })
         .catch(function () { toneStart(); });
      } else {
        mode = 'file'; fadeEl(VOL, 800);
      }
    }

    function start() {
      ac();                                   // داخل إيماءة المستخدم
      findTrack().then(function (url) {
        if (!on) return;
        url ? playFile(url) : toneStart();
      });
    }

    function stop() {
      mode = 'off';
      if (el) { fadeEl(0, 400); setTimeout(function () { if (!on && el) el.pause(); }, 450); }
      fadeCtx(0, 400);
      setTimeout(function () { if (!on) toneStop(); }, 450);
    }

    return {
      isOn: function () { return on; },
      mode: function () { return mode; },
      toggle: function () {
        on = !on;
        try { localStorage.setItem('nd96.music', on ? 'on' : 'off'); } catch (e) {}
        on ? start() : stop();
        return on;
      },
      resumeIfEnabled: function () { if (on && mode === 'off') start(); }
    };
  })();
  window.__music = Music;   // للاختبار فقط

  var musicBtn = $('music-toggle');
  musicBtn.setAttribute('aria-pressed', Music.isOn() ? 'true' : 'false');
  musicBtn.addEventListener('click', function () {
    musicBtn.setAttribute('aria-pressed', Music.toggle() ? 'true' : 'false');
  });
  // المتصفحات تمنع التشغيل التلقائي — استأنف عند أول لمسة لو كانت مفعّلة
  document.addEventListener('pointerdown', function resume() {
    Music.resumeIfEnabled();
    document.removeEventListener('pointerdown', resume);
  }, { once: true });

  /* ============================================================
     القصاصات
     ============================================================ */
  var Confetti = (function () {
    var cv = $('fx'), c2 = cv.getContext('2d'), bits = [], raf = 0;
    var COLORS = ['#2E7D52', '#8FCBAA', '#D3A84E', '#F2E3B8', '#FFFFFF'];

    function size() {
      var r = window.devicePixelRatio || 1;
      var b = cv.getBoundingClientRect();
      cv.width = b.width * r; cv.height = b.height * r;
      c2.setTransform(r, 0, 0, r, 0, 0);
    }
    size();
    addEventListener('resize', size);

    function frame() {
      var b = cv.getBoundingClientRect();
      c2.clearRect(0, 0, b.width, b.height);
      bits = bits.filter(function (p) { return p.life > 0; });
      bits.forEach(function (p) {
        p.vy += .16; p.x += p.vx; p.y += p.vy; p.vx *= .995; p.rot += p.vr; p.life--;
        c2.save();
        c2.translate(p.x, p.y); c2.rotate(p.rot);
        c2.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
        c2.fillStyle = p.col;
        c2.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c2.restore();
      });
      raf = bits.length ? requestAnimationFrame(frame) : 0;
    }

    return function burst(x, y, n) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      var box = cv.getBoundingClientRect();
      x -= box.left; y -= box.top;
      for (var i = 0; i < (n || 70); i++) {
        var a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 9;
        bits.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4,
          w: 5 + Math.random() * 6, h: 7 + Math.random() * 8,
          rot: Math.random() * 6, vr: (Math.random() - .5) * .35,
          col: COLORS[(Math.random() * COLORS.length) | 0],
          life: 70 + Math.random() * 45
        });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
  })();

  /* ============================================================
     إدارة الشاشات
     ============================================================ */
  var VIEWS = { home:'v-home', press:'v-press', map:'v-map', share:'v-share', wall:'v-wall', about:'v-about' };
  var current = 'home';
  var visitorName = '';

  function go(name, silent) {
    if (name === current || !VIEWS[name]) return;
    var from = $(VIEWS[current]), to = $(VIEWS[name]);
    if (!silent) Sound.play('move');

    from.classList.add('is-leaving');
    setTimeout(function () {
      from.hidden = true;
      from.classList.remove('is-leaving', 'is-on');
      to.hidden = false;
      to.classList.add('is-on');
      to.scrollTop = 0;
      current = name;
      if (name === 'wall') refreshWall();
      if (name === 'map')  refreshPrints();
    }, 235);
  }

  /* ============================================================
     العدّ التنازلي (يظهر في العنوان الفرعي عند اقتراب اليوم)
     ============================================================ */
  (function () {
    var d = CFG.nationalDayDate || { year: 2026, month: 9, day: 23 };
    var target = Date.UTC(d.year, d.month - 1, d.day, 0, 0, 0) - 3 * 3600 * 1000;
    var el = $('map-note-txt');
    if (!el) return;
    var base = el.innerHTML;
    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { el.innerHTML = base; return; }
      var s = Math.floor(diff / 1000);
      var days = Math.floor(s / 86400);
      el.innerHTML = base + '<br><span style="font-size:.8em;opacity:.7">باقٍ على اليوم الوطني ' +
        ar(days) + ' ' + (days === 1 ? 'يوم' : 'أيام') + '</span>';
      setTimeout(tick, 60000);
    }
    tick();
  })();

  /* ============================================================
     بوابة الاسم
     ============================================================ */
  var nameInput = $('visitor-name');

  function nudge() {
    nameInput.classList.add('is-bad', 'shake');
    $('name-hint').textContent = 'رجاءً اكتب اسمك أولًا';
    Sound.play('error');
    nameInput.focus();
    setTimeout(function () { nameInput.classList.remove('is-bad', 'shake'); }, 700);
  }

  function begin() {
    var v = (nameInput.value || '').trim().replace(/\s+/g, ' ');
    if (v.length < 2) { nudge(); return; }
    visitorName = v;
    $('greet-name').textContent = v;
    $('share-name').value = v;
    $('name-hint').textContent = 'الاسم الأول فقط — سيظهر بجانب بصمتك على الخريطة';
    resetPad();
    Sound.play('tap');
    go('press');
  }

  $('btn-begin').addEventListener('click', begin);
  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); begin(); }
  });
  $('to-wall').addEventListener('click',  function () { Sound.play('tap'); go('wall'); });
  $('to-about').addEventListener('click', function () { Sound.play('tap'); go('about'); });

  /* ============================================================
     الخريطة
     ============================================================ */
  var POLY = [[40.9,162.2],[90.9,133.3],[136.4,88.9],[180.9,48.9],[218.2,42.2],[234.1,37.8],[290.9,48.9],[327.3,66.7],[368.2,84.4],[431.8,124.4],[486.4,168.9],[540.9,171.1],[568.2,173.3],[611.4,177.8],[622.7,198.7],[654.5,197.8],[665.9,220],[672.7,235.6],[709.1,257.8],[736.4,280],[729.5,295.6],[743.2,313.3],[754.5,324.4],[763.6,365.3],[785.5,372.4],[800,374.2],[800.9,395.6],[845.5,394.7],[909.1,426.7],[963.6,457.8],[986.4,488.9],[968.2,551.1],[963.6,577.8],[886.4,604.4],[818.2,622.2],[750,631.1],[681.8,640],[618.2,684.4],[590.9,693.3],[500,693.3],[427.3,693.3],[418.2,724.4],[400,737.8],[388.6,693.3],[368.2,657.8],[354.5,631.1],[331.8,600],[315.9,580],[272.7,537.8],[250,528.9],[231.8,513.3],[229.5,488.9],[222.7,464.4],[200,426.7],[181.8,404.4],[161.4,391.1],[145.5,375.6],[129.5,351.1],[118.2,328.9],[102.3,302.2],[90.9,283.6],[70.5,266.7],[52.3,246.7],[43.2,228.9],[36.4,220],[28.2,197.8],[34.1,175.6]];

  // ألوان البصمات كما في التصميم المرجعي
  var HUES = ['#2E7D52','#7E63B8','#D98436','#3F72B8','#2F9E96','#C24D6C','#4E9A3E'];

  function inside(x, y) {
    var hit = false;
    for (var i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      var xi = POLY[i][0], yi = POLY[i][1], xj = POLY[j][0], yj = POLY[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) hit = !hit;
    }
    return hit;
  }
  function safeInside(x, y, m) {
    return inside(x, y) && inside(x + m, y) && inside(x - m, y) && inside(x, y + m) && inside(x, y - m);
  }
  function seeded(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NS = 'http://www.w3.org/2000/svg';
  var layer = $('print-layer');
  var placed = [], seen = Object.create(null);

  function findSpot(seed) {
    var rnd = seeded(seed);
    var gap = placed.length > 120 ? 26 : placed.length > 60 ? 38 : 58;
    var best = null, bestGap = -1;
    for (var a = 0; a < 500; a++) {
      var x = 30 + rnd() * 950, y = 40 + rnd() * 700;
      if (!safeInside(x, y, 30)) continue;
      var near = Infinity;
      for (var i = 0; i < placed.length; i++) {
        var dx = placed[i].x - x, dy = placed[i].y - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < near) near = d;
      }
      if (near >= gap) return { x: x, y: y };
      if (near > bestGap) { bestGap = near; best = { x: x, y: y }; }
    }
    return best || { x: 480, y: 420 };
  }

  /* الموضع على مجموعة خارجية (سمة SVG)، والحركة على مجموعة داخلية (CSS)
     حتى لا تلغي الحركة موضع البصمة. */
  function drawPrint(p, isNew) {
    var color = p.color || HUES[0];

    var outer = document.createElementNS(NS, 'g');
    outer.setAttribute('class', 'print');
    outer.setAttribute('transform', 'translate(' + (+p.x).toFixed(1) + ',' + (+p.y).toFixed(1) + ')');

    var inner = document.createElementNS(NS, 'g');
    if (isNew) inner.setAttribute('class', 'print-pop');

    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#fp-glyph');
    use.setAttribute('x', '-18'); use.setAttribute('y', '-36');
    use.setAttribute('width', '36'); use.setAttribute('height', '44');
    use.setAttribute('style', 'color:' + color);
    inner.appendChild(use);

    // شريحة الاسم كما في التصميم: مستطيل ملوّن ونص أبيض
    var chip = document.createElementNS(NS, 'rect');
    chip.setAttribute('class', 'print-chip');
    chip.setAttribute('fill', color);
    inner.appendChild(chip);

    var t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'print-label');
    t.setAttribute('y', '22');
    t.textContent = p.name;
    inner.appendChild(t);

    outer.appendChild(inner);
    layer.appendChild(outer);

    // قِس النص ثم اضبط الشريحة حوله
    var w = 40;
    try { w = t.getComputedTextLength() + 22; } catch (e) {}
    if (!w || w < 34) w = 34 + (p.name || '').length * 9;
    chip.setAttribute('x', (-w / 2).toFixed(1));
    chip.setAttribute('y', '10');
    chip.setAttribute('width', w.toFixed(1));
    chip.setAttribute('height', '24');

    placed.push({ x: +p.x, y: +p.y });
  }

  function setCount(n, bump) {
    var el = $('print-count');
    el.textContent = ar(n);
    if (bump) { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); }
  }

  function refreshPrints() {
    return window.Store.listPrints().then(function (rows) {
      rows = rows || [];
      var fresh = rows.filter(function (r) { return !seen[r.id]; });
      if (!placed.length) {
        layer.textContent = ''; placed = [];
        rows.forEach(function (r) { seen[r.id] = 1; drawPrint(r, false); });
      } else {
        fresh.forEach(function (r) { seen[r.id] = 1; drawPrint(r, true); });
      }
      setCount(placed.length, fresh.length > 0 && placed.length > fresh.length);
    }).catch(function (e) { console.error('تعذّر تحميل البصمات:', e); });
  }

  /* ============================================================
     لوحة الضغط
     ============================================================ */
  var pad = $('print-pad'), padHint = $('pad-hint'), btnDone = $('btn-done');
  var HOLD = 1100;
  var t0 = 0, timer = 0, saving = false, savedRow = null;

  function ring(p) { pad.style.setProperty('--p', p); }

  function resetPad() {
    saving = false; savedRow = null;
    ring(0);
    pad.disabled = false;
    pad.classList.remove('is-press');
    btnDone.disabled = true;
    padHint.textContent = 'ضع إصبعك هنا واضغط مع الاستمرار';
  }

  function tick() {
    var pct = Math.min(100, ((Date.now() - t0) / HOLD) * 100);
    ring(pct);
    if (pct >= 100) complete();
  }

  function down(e) {
    if (saving || timer) return;
    if (e && e.preventDefault) e.preventDefault();
    if (!visitorName) { go('home'); nudge(); return; }
    pad.classList.add('is-press');
    padHint.textContent = 'استمر بالضغط…';
    Sound.play('press');
    t0 = Date.now();
    timer = setInterval(tick, 30);
  }

  function up() {
    if (saving || !timer) return;
    clearInterval(timer); timer = 0;
    pad.classList.remove('is-press');
    ring(0);
    padHint.textContent = 'ضع إصبعك هنا واضغط مع الاستمرار';
  }

  function complete() {
    saving = true;
    clearInterval(timer); timer = 0;
    pad.classList.remove('is-press');
    pad.disabled = true;
    ring(100);
    padHint.textContent = 'جارٍ تسجيل بصمتك…';

    var seed = visitorName + '|' + Date.now() + '|' + Math.random();
    var spot = findSpot(seed);
    var color = HUES[Math.floor(seeded(seed)() * HUES.length)];
    savedRow = { x: spot.x, y: spot.y, name: visitorName, color: color };

    window.Store.addPrint(savedRow).then(function (saved) {
      if (saved && saved.id) seen[saved.id] = 1;
      Sound.play('stamp');
      var r = pad.getBoundingClientRect();
      Confetti(r.left + r.width / 2, r.top + r.height / 2, 80);

      padHint.textContent = 'تمّت بصمتك يا ' + visitorName + '!';
      btnDone.disabled = false;
      btnDone.focus();

      drawPrint(savedRow, true);
      setCount(placed.length, true);
      $('map-note-txt').innerHTML = 'بصمتك الآن في خريطة وطنك يا <strong>' + escapeHTML(visitorName) + '</strong>';

      setTimeout(function () { if (current === 'press') go('map'); }, 1100);
    }).catch(function (err) {
      console.error(err);
      saving = false; pad.disabled = false; ring(0);
      Sound.play('error');
      padHint.textContent = 'تعذّر حفظ البصمة. تحقّق من الاتصال وحاول مجددًا';
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointerleave', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); down(e); }
  });
  pad.addEventListener('keyup', up);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  btnDone.addEventListener('click', function () { Sound.play('tap'); go('map'); });
  $('btn-to-share').addEventListener('click', function () { Sound.play('tap'); go('share'); });

  /* ============================================================
     المشاركة
     ============================================================ */
  var kind = 'vision', form = $('share-form');

  $$('.seg', form).forEach(function (seg) {
    seg.addEventListener('click', function () {
      kind = seg.dataset.kind;
      Sound.play('tap');
      $$('.seg', form).forEach(function (s) {
        var on = s === seg;
        s.classList.toggle('is-on', on);
        s.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      $$('.pane', form).forEach(function (p) { p.hidden = p.dataset.pane !== kind; });
    });
  });

  $$('[data-count-for]').forEach(function (c) {
    var f = $(c.dataset.countFor), max = CFG.maxTextChars || 280;
    c.textContent = ar(0) + ' / ' + ar(max);
    f.addEventListener('input', function () { c.textContent = ar(f.value.length) + ' / ' + ar(max); });
  });

  /* ---- تسجيل صوتي ---- */
  var recBtn = $('rec-btn'), recState = $('rec-state'), recTime = $('rec-time'), recPlay = $('rec-play');
  var recBox = recBtn.closest('.rec');
  var mr = null, chunks = [], audioBlob = null, rt = 0, secs = 0;
  var MAXSEC = CFG.maxAudioSeconds || 60;
  function fmt(s) { return ar(Math.floor(s / 60)) + ':' + ar(pad2(s % 60)); }

  recBtn.addEventListener('click', function () {
    if (mr && mr.state === 'recording') { mr.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      recState.textContent = 'المتصفح لا يدعم التسجيل'; Sound.play('error'); return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      chunks = []; audioBlob = null; secs = 0;
      recPlay.hidden = true; recTime.textContent = fmt(0);

      var mime = '';
      ['audio/webm','audio/mp4','audio/ogg'].some(function (m) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) { mime = m; return true; }
        return false;
      });
      mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mr.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
      mr.onstop = function () {
        clearInterval(rt);
        stream.getTracks().forEach(function (t) { t.stop(); });
        audioBlob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        recPlay.src = URL.createObjectURL(audioBlob);
        recPlay.hidden = false;
        recBtn.classList.remove('is-rec');
        recBox.classList.remove('is-live');
        recState.textContent = 'تم التسجيل — اضغط للإعادة';
        Sound.play('tap');
      };
      mr.start();
      recBtn.classList.add('is-rec');
      recBox.classList.add('is-live');
      recState.textContent = 'جارٍ التسجيل… اضغط للإيقاف';
      rt = setInterval(function () {
        secs++; recTime.textContent = fmt(secs);
        if (secs >= MAXSEC) mr.stop();
      }, 1000);
    }).catch(function () {
      recState.textContent = 'لم يُسمح باستخدام الميكروفون';
      Sound.play('error');
    });
  });

  /* ---- صورة ---- */
  var photoInput = $('photo-input'), photoPrev = $('photo-preview'), photoBlob = null;

  function shrink(file, max, q) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var sc = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) { b ? res(b) : rej(new Error('تعذّرت معالجة الصورة')); }, 'image/jpeg', q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('ملف الصورة غير صالح')); };
      img.src = url;
    });
  }

  photoInput.addEventListener('change', function () {
    var f = photoInput.files && photoInput.files[0];
    if (!f) return;
    var msg = $('share-msg');
    if (f.size > (CFG.maxPhotoMB || 5) * 1024 * 1024) {
      msg.className = 'msg err';
      msg.textContent = 'حجم الصورة أكبر من ' + ar(CFG.maxPhotoMB || 5) + ' ميجابايت';
      photoInput.value = ''; Sound.play('error'); return;
    }
    msg.textContent = '';
    shrink(f, 1400, .82).then(function (b) {
      photoBlob = b;
      photoPrev.src = URL.createObjectURL(b);
      photoPrev.hidden = false;
      Sound.play('tap');
    }).catch(function (e) { msg.className = 'msg err'; msg.textContent = e.message; });
  });

  /* ---- إرسال ---- */
  $('skip-share').addEventListener('click', function () { Sound.play('tap'); go('wall'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('share-msg'), btn = $('share-submit');
    var name = $('share-name').value.trim(), rel = $('share-rel').value;

    function bad(t) { msg.className = 'msg err'; msg.textContent = t; Sound.play('error'); }

    if (name.length < 2) return bad('رجاءً اكتب الاسم');

    var text = '';
    if (kind === 'vision') text = $('vision-text').value.trim();
    if (kind === 'text')   text = $('share-text').value.trim();

    if ((kind === 'vision' || kind === 'text') && text.length < 3) return bad('رجاءً اكتب مشاركتك');
    if (kind === 'audio' && !audioBlob) return bad('رجاءً سجّل رسالتك الصوتية أولًا');
    if (kind === 'photo' && !photoBlob) return bad('رجاءً اختر صورة أولًا');

    btn.disabled = true;
    msg.className = 'msg'; msg.textContent = 'جارٍ الإرسال…';

    var up;
    if (kind === 'audio') {
      var ext = audioBlob.type.indexOf('mp4') > -1 ? 'm4a' : (audioBlob.type.indexOf('ogg') > -1 ? 'ogg' : 'webm');
      up = window.Store.uploadMedia(audioBlob, ext);
    } else if (kind === 'photo') {
      up = window.Store.uploadMedia(photoBlob, 'jpg');
    } else {
      up = Promise.resolve(null);
    }

    up.then(function (url) {
      return window.Store.addEntry({ kind: kind, name: name, rel: rel, text: text || null, media_url: url });
    }).then(function (saved) {
      if (saved && saved.id) wallSeen[saved.id] = 1;
      msg.className = 'msg ok'; msg.textContent = 'شكرًا لمشاركتك!';
      Sound.play('success');
      var b = $('fx').getBoundingClientRect();
      Confetti(b.left + b.width / 2, b.top + b.height / 2, 90);

      $('vision-text').value = ''; $('share-text').value = '';
      $$('[data-count-for]').forEach(function (c) { c.textContent = ar(0) + ' / ' + ar(CFG.maxTextChars || 280); });
      audioBlob = null; photoBlob = null;
      photoPrev.hidden = true; recPlay.hidden = true; photoInput.value = '';
      recTime.textContent = fmt(0); recState.textContent = 'اضغط للتسجيل';

      setTimeout(function () { msg.textContent = ''; go('wall'); }, 850);
    }).catch(function (err) {
      bad('تعذّر الإرسال: ' + err.message);
    }).then(function () { btn.disabled = false; });
  });

  /* ============================================================
     الجدار
     ============================================================ */
  var KIND = { vision:'رؤية لوطن مزدهر', text:'عبارة وطنية', audio:'رسالة صوتية', photo:'صورة' };
  var wallData = [], wallFilter = 'all', wallSeen = Object.create(null);

  function card(e, isNew) {
    var c = document.createElement('article');
    c.className = 'wcard' + (e.kind === 'vision' ? ' is-vision' : '');
    if (!isNew) c.style.animation = 'none';

    var k = document.createElement('p');
    k.className = 'wcard-kind';
    k.textContent = KIND[e.kind] || 'مشاركة';
    c.appendChild(k);

    if (e.kind === 'photo' && e.media_url) {
      var img = document.createElement('img');
      img.className = 'wcard-media'; img.loading = 'lazy';
      img.src = e.media_url; img.alt = 'صورة مشاركة من ' + e.name;
      c.appendChild(img);
    } else if (e.kind === 'audio' && e.media_url) {
      var au = document.createElement('audio');
      au.className = 'wcard-media'; au.controls = true; au.preload = 'none';
      au.src = e.media_url;
      c.appendChild(au);
    }

    if (e.text) {
      var p = document.createElement('p');
      p.className = 'wcard-body' + (e.kind === 'vision' || e.kind === 'text' ? ' is-quote' : '');
      p.textContent = e.text;
      c.appendChild(p);
    }

    var by = document.createElement('p');
    by.className = 'wcard-by';
    var s = document.createElement('strong');
    s.textContent = e.name;
    by.appendChild(s);
    by.appendChild(document.createTextNode(e.rel ? ' — ' + e.rel : ''));
    c.appendChild(by);
    return c;
  }

  function renderWall(fresh) {
    var wall = $('wall');
    var items = wallFilter === 'all' ? wallData : wallData.filter(function (e) { return e.kind === wallFilter; });
    wall.textContent = '';
    items.forEach(function (e) { wall.appendChild(card(e, fresh && fresh[e.id])); });
    $('wall-empty').hidden = items.length > 0;
  }

  function refreshWall() {
    return window.Store.listEntries().then(function (rows) {
      rows = rows || [];
      var fresh = Object.create(null);
      rows.forEach(function (r) { if (!wallSeen[r.id]) { fresh[r.id] = 1; wallSeen[r.id] = 1; } });
      wallData = rows;
      renderWall(fresh);
    }).catch(function (e) { console.error('تعذّر تحميل الجدار:', e); });
  }

  $$('.filters .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      wallFilter = c.dataset.filter;
      Sound.play('tap');
      $$('.filters .chip').forEach(function (x) { x.classList.toggle('is-on', x === c); });
      renderWall(null);
    });
  });

  /* ============================================================
     الأزرار العائمة
     ============================================================ */
  $('fab-home').addEventListener('click', function () {
    Sound.play('tap');
    resetPad();
    go('home');
  });

  $('fab-new').addEventListener('click', function () {
    Sound.play('tap');
    visitorName = '';
    nameInput.value = '';
    $('map-note-txt').innerHTML = 'كل بصمة حكاية طفل ..<br>وكل طفل أملٌ لوطننا';
    resetPad();
    go('home');
    setTimeout(function () { nameInput.focus(); }, 420);
  });

  /* ============================================================
     التحديث المباشر
     ============================================================ */
  setInterval(function () {
    if (document.hidden) return;
    if (current === 'wall') refreshWall();
    else if (current === 'map' && !saving) refreshPrints();
  }, 6000);

  window.addEventListener('storage', function (e) {
    if (e.key === 'nd96.prints')  refreshPrints();
    if (e.key === 'nd96.entries') refreshWall();
  });

  /* ---- بديل الصور الرسمية ---- */
  $$('img[data-fallback]').forEach(function (img) {
    function swap() {
      if (!img.dataset.fallback || img.src.indexOf(img.dataset.fallback) > -1) return;
      img.src = img.dataset.fallback;
    }
    img.addEventListener('error', swap);
    if (img.complete && img.naturalWidth === 0) swap();
  });

  /* ---- وضع التجربة ---- */
  if (!window.Store.isSharedMode()) {
    var note = document.createElement('div');
    note.className = 'storage-note';
    note.appendChild(document.createTextNode('وضع التجربة: البيانات محفوظة في هذا الجهاز فقط.'));
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = 'إخفاء';
    x.addEventListener('click', function () { note.remove(); });
    note.appendChild(x);
    document.querySelector('.app').appendChild(note);
  }

  /* ---- التشغيل ---- */
  refreshPrints();
  refreshWall();
})();
