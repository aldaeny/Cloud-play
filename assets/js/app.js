/* ============================================================
   Cloud-play — مساحة تجريب سحابية
   محرّر HTML/CSS/JS مع معاينة لحظية وطرفية مدمجة.
   ============================================================ */
(() => {
  'use strict';

  /* ==========================================================
     1. القوالب
     ========================================================== */
  const TEMPLATES = {
    starter: {
      html: `<div class="card">
  <div class="emoji">☁️</div>
  <h1>مرحبًا بك في <span class="grad">Cloud-play</span></h1>
  <p class="lead">حرّر الملفات في المحرّر، وشاهد النتيجة هنا لحظيًا.</p>
  <button id="hello">اضغطني 👋</button>
  <p class="hint" id="hint">لم تضغط بعد</p>
</div>`,
      css: `* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, "Segoe UI", Tahoma, sans-serif;
  color: #e7edf9;
  background:
    radial-gradient(900px 600px at 15% 0%, rgba(37, 99, 235, 0.35), transparent 65%),
    radial-gradient(700px 560px at 85% 100%, rgba(124, 58, 237, 0.35), transparent 60%),
    #070b16;
}

.card {
  width: min(430px, 88vw);
  padding: 34px 28px 30px;
  text-align: center;
  border-radius: 22px;
  background: rgba(23, 32, 51, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(18px) scale(0.98); }
  to   { opacity: 1; transform: none; }
}

.emoji { font-size: 46px; line-height: 1; margin-bottom: 14px; }

h1 { font-size: 1.5rem; margin: 0 0 10px; letter-spacing: -0.3px; }

.grad {
  background: linear-gradient(100deg, #6ee7ff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lead { margin: 0 auto 22px; max-width: 300px; color: #9fb0cc; font-size: 0.94rem; line-height: 1.7; }

button {
  font: inherit;
  font-weight: 700;
  color: #06101f;
  padding: 11px 26px;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(100deg, #6ee7ff, #a78bfa);
  cursor: pointer;
  transition: transform 0.18s, box-shadow 0.18s, filter 0.18s;
  box-shadow: 0 12px 30px rgba(110, 231, 255, 0.28);
}

button:hover { transform: translateY(-2px); filter: brightness(1.08); box-shadow: 0 16px 36px rgba(110, 231, 255, 0.38); }
button:active { transform: translateY(0) scale(0.98); }

.hint { margin: 18px 0 0; font-size: 0.85rem; color: #7f8fae; min-height: 1.2em; }`,
      js: `const button = document.getElementById('hello');
const hint = document.getElementById('hint');
let count = 0;

button.addEventListener('click', () => {
  count++;
  hint.textContent = 'عدد الضغطات: ' + count + ' 🎉';
  console.log('تم الضغط ' + count + ' مرة');
});

console.log('مرحبًا من Cloud-play ☁️');`
    },

    clock: {
      html: `<div class="clock">
  <p class="label">الوقت الآن</p>
  <p class="time" id="time">--:--:--</p>
  <p class="date" id="date"></p>
  <p class="tz">توقيتك المحلي</p>
</div>`,
      css: `* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, "Segoe UI", Tahoma, sans-serif;
  color: #e7edf9;
  background: radial-gradient(circle at 50% 0%, #1b2b46, #050810 72%);
}

.clock { text-align: center; padding: 28px; }

.label {
  margin: 0 0 12px;
  letter-spacing: 5px;
  font-size: 0.7rem;
  color: #6ee7ff;
}

.time {
  margin: 0;
  font-family: ui-monospace, "Courier New", monospace;
  font-size: clamp(2.6rem, 12vw, 5.2rem);
  font-weight: 700;
  letter-spacing: 3px;
  direction: ltr;
  background: linear-gradient(180deg, #ffffff, #7dd3fc);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 32px rgba(110, 231, 255, 0.35));
}

.date { margin: 16px 0 0; color: #a9b9d4; font-size: 1.02rem; }
.tz { margin: 8px 0 0; color: #5b6a85; font-size: 0.76rem; letter-spacing: 1px; }`,
      js: `const timeEl = document.getElementById('time');
const dateEl = document.getElementById('date');

const pad = (n) => String(n).padStart(2, '0');

function tick() {
  const now = new Date();
  timeEl.textContent =
    pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

  dateEl.textContent = now.toLocaleDateString('ar-IQ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

tick();
setInterval(tick, 1000);
console.log('بدأت الساعة ⏰');`
    },

    particles: {
      html: `<canvas id="sky"></canvas>
<div class="overlay">
  <h1>سحابة الجسيمات</h1>
  <p>حرّك المؤشر داخل المعاينة وشاهد الشبكة تتنفّس</p>
</div>`,
      css: `* { box-sizing: border-box; }

body {
  margin: 0;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at 50% 40%, #0d1a30, #04070f 75%);
  font-family: system-ui, "Segoe UI", Tahoma, sans-serif;
  color: #e7edf9;
}

#sky { position: fixed; inset: 0; display: block; }

.overlay {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
}

.overlay h1 {
  margin: 0;
  font-size: clamp(1.6rem, 5vw, 2.6rem);
  letter-spacing: -0.5px;
  background: linear-gradient(100deg, #6ee7ff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.overlay p { margin: 12px 0 0; color: #8ea0bf; font-size: 0.92rem; }`,
      js: `const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const pointer = { x: -999, y: -999 };
let w = 0;
let h = 0;
let dots = [];

function resize() {
  w = canvas.width = innerWidth;
  h = canvas.height = innerHeight;
}

function makeDots(n) {
  dots = [];
  for (let i = 0; i < n; i++) {
    dots.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 2.2 + 0.7,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      glow: Math.random() * 0.5 + 0.45
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, w, h);

  for (const d of dots) {
    d.x += d.vx;
    d.y += d.vy;

    if (d.x < 0 || d.x > w) d.vx *= -1;
    if (d.y < 0 || d.y > h) d.vy *= -1;

    const dx = d.x - pointer.x;
    const dy = d.y - pointer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 95 && dist > 0.01) {
      d.x += (dx / dist) * 1.8;
      d.y += (dy / dist) * 1.8;
    }

    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(110, 231, 255, ' + d.glow + ')';
    ctx.fill();
  }

  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const a = dots[i];
      const b = dots[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 115) {
        ctx.strokeStyle = 'rgba(167, 139, 250, ' + 0.18 * (1 - dist / 115) + ')';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(draw);
}

addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

addEventListener('resize', () => {
  resize();
  makeDots(80);
});

resize();
makeDots(80);
draw();
console.log('عدد الجسيمات: ' + dots.length);`
    },

    calc: {
      html: `<div class="calc">
  <div class="screen" id="screen">0</div>
  <div class="keys">
    <button data-key="C" class="fn">C</button>
    <button data-key="(" class="fn">(</button>
    <button data-key=")" class="fn">)</button>
    <button data-key="/" class="op">÷</button>

    <button data-key="7">7</button>
    <button data-key="8">8</button>
    <button data-key="9">9</button>
    <button data-key="*" class="op">×</button>

    <button data-key="4">4</button>
    <button data-key="5">5</button>
    <button data-key="6">6</button>
    <button data-key="-" class="op">−</button>

    <button data-key="1">1</button>
    <button data-key="2">2</button>
    <button data-key="3">3</button>
    <button data-key="+" class="op">+</button>

    <button data-key="0">0</button>
    <button data-key=".">.</button>
    <button data-key="=" class="eq">=</button>
  </div>
</div>`,
      css: `* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, "Segoe UI", Tahoma, sans-serif;
  background:
    radial-gradient(700px 500px at 20% 10%, rgba(56, 189, 248, 0.25), transparent 60%),
    radial-gradient(700px 500px at 85% 90%, rgba(167, 139, 250, 0.25), transparent 60%),
    #070b16;
}

.calc {
  width: min(330px, 90vw);
  padding: 18px;
  border-radius: 24px;
  background: rgba(20, 28, 46, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(18px);
}

.screen {
  direction: ltr;
  text-align: right;
  padding: 18px 14px;
  margin-bottom: 14px;
  font-family: ui-monospace, "Courier New", monospace;
  font-size: 2rem;
  border-radius: 14px;
  color: #6ee7ff;
  background: rgba(6, 10, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  min-height: 68px;
}

.keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
}

.keys button {
  font: inherit;
  font-size: 1.05rem;
  font-weight: 600;
  padding: 14px 0;
  border-radius: 13px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.05);
  color: #e7edf9;
  cursor: pointer;
  transition: transform 0.12s, background 0.16s;
}

.keys button:hover { background: rgba(255, 255, 255, 0.11); }
.keys button:active { transform: scale(0.95); }

.keys .fn { color: #fca5a5; }
.keys .op { color: #6ee7ff; }
.keys .eq {
  grid-column: span 3;
  background: linear-gradient(100deg, #6ee7ff, #a78bfa);
  color: #06101f;
  font-weight: 800;
}`,
      js: `const screen = document.getElementById('screen');
let expr = '';

function show() {
  screen.textContent = expr || '0';
}

document.querySelectorAll('.keys button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.key;

    if (key === 'C') {
      expr = '';
    } else if (key === '=') {
      try {
        const allowed = '0123456789+-*/.() ';
        if (![...expr].every((ch) => allowed.includes(ch))) throw new Error('تعبير غير صالح');
        expr = String(Function('return (' + expr + ')')());
        console.log('النتيجة: ' + expr);
      } catch (err) {
        console.error(err.message);
        expr = '';
      }
    } else {
      expr += key;
    }

    show();
    console.log('الشاشة: ' + (expr || '0'));
  });
});

show();`
    }
  };

  /* ==========================================================
     2. الترجمة
     ========================================================== */
  const I18N = {
    ar: {
      tagline: 'مساحة تجريب سحابية',
      run: 'تشغيل',
      runTitle: 'تشغيل الكود (Ctrl + Enter)',
      autoRun: 'تشغيل تلقائي',
      autoRunTitle: 'إعادة تشغيل المعاينة تلقائيًا بعد كل تعديل',
      templates: 'التحميل من قالب جاهز',
      tpl_starter: 'البداية',
      tpl_clock: 'ساعة رقمية',
      tpl_particles: 'سحابة جسيمات',
      tpl_calc: 'آلة حاسبة',
      download: 'تنزيل ملف HTML',
      share: 'نسخ رابط المشاركة',
      theme: 'تبديل المظهر',
      language: 'تغيير اللغة',
      preview: 'المعاينة',
      live: 'مباشر',
      reload: 'إعادة التشغيل',
      console: 'الطرفية',
      clear: 'مسح',
      consoleEmpty: 'لا توجد مخرجات بعد — جرّب console.log().',
      desktop: 'سطح المكتب',
      tablet: 'جهاز لوحي',
      phone: 'هاتف',
      line: 'سطر',
      col: 'عمود',
      chars: 'حرف',
      copied: 'تم نسخ رابط المشاركة ✓',
      copyFailed: 'تعذّر النسخ — انسخ الرابط من شريط العنوان',
      downloaded: 'تم تنزيل cloud-play.html',
      templateLoaded: 'تم تحميل القالب: ',
      confirmTemplate: 'سيؤدي تحميل القالب إلى استبدال الكود الحالي. هل تريد المتابعة؟',
      title: 'Cloud-play — مساحة تجريب سحابية',
      autoOff: 'التشغيل التلقائي متوقف — اضغط تشغيل'
    },
    en: {
      tagline: 'A cloud playground',
      run: 'Run',
      runTitle: 'Run the code (Ctrl + Enter)',
      autoRun: 'Auto-run',
      autoRunTitle: 'Re-run the preview automatically after each edit',
      templates: 'Load a starter template',
      tpl_starter: 'Starter',
      tpl_clock: 'Digital clock',
      tpl_particles: 'Particle cloud',
      tpl_calc: 'Calculator',
      download: 'Download HTML file',
      share: 'Copy share link',
      theme: 'Toggle theme',
      language: 'Switch language',
      preview: 'Preview',
      live: 'Live',
      reload: 'Reload preview',
      console: 'Console',
      clear: 'Clear',
      consoleEmpty: 'No output yet — try console.log().',
      desktop: 'Desktop',
      tablet: 'Tablet',
      phone: 'Phone',
      line: 'Line',
      col: 'Col',
      chars: 'chars',
      copied: 'Share link copied ✓',
      copyFailed: 'Copy failed — grab the URL from the address bar',
      downloaded: 'cloud-play.html downloaded',
      templateLoaded: 'Template loaded: ',
      confirmTemplate: 'Loading a template will replace your current code. Continue?',
      title: 'Cloud-play — a cloud playground',
      autoOff: 'Auto-run is off — press Run'
    }
  };

  const t = (key) => (I18N[state.lang] && I18N[state.lang][key]) || key;

  /* ==========================================================
     3. الحالة والتخزين
     ========================================================== */
  const STORE_KEY = 'cloudplay.state.v1';
  const cloneTemplate = (id) => ({
    html: TEMPLATES[id].html,
    css: TEMPLATES[id].css,
    js: TEMPLATES[id].js
  });

  const defaultFiles = () => cloneTemplate('starter');

  const state = {
    files: defaultFiles(),
    active: 'html',
    theme: 'dark',
    lang: 'ar',
    autoRun: true,
    split: 47,
    template: 'starter'
  };

  function readStored() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        if (saved.files && typeof saved.files.html === 'string') {
          state.files = {
            html: String(saved.files.html ?? ''),
            css: String(saved.files.css ?? ''),
            js: String(saved.files.js ?? '')
          };
        }
        if (saved.active === 'html' || saved.active === 'css' || saved.active === 'js') state.active = saved.active;
        if (saved.theme === 'light' || saved.theme === 'dark') state.theme = saved.theme;
        if (saved.lang === 'ar' || saved.lang === 'en') state.lang = saved.lang;
        if (typeof saved.autoRun === 'boolean') state.autoRun = saved.autoRun;
        if (typeof saved.split === 'number' && isFinite(saved.split)) state.split = saved.split;
        if (typeof saved.template === 'string' && TEMPLATES[saved.template]) state.template = saved.template;
      }
    } catch (err) {
      /* تخزين غير متاح أو تالف — تجاهل */
    }
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          files: state.files,
          active: state.active,
          theme: state.theme,
          lang: state.lang,
          autoRun: state.autoRun,
          split: state.split,
          template: state.template
        }));
      } catch (err) { /* تجاهل */ }
    }, 250);
  }

  /* ---- تشفير الحالة في الرابط ---- */
  function encodeShare(files) {
    const json = JSON.stringify({ v: 1, files });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeShare(str) {
    try {
      const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!data || !data.files) return null;
      return {
        html: String(data.files.html ?? ''),
        css: String(data.files.css ?? ''),
        js: String(data.files.js ?? '')
      };
    } catch (err) {
      return null;
    }
  }

  readStored();
  if (location.hash.startsWith('#p=')) {
    const shared = decodeShare(location.hash.slice(3));
    if (shared) {
      state.files = shared;
      state.template = null;
    }
  }

  /* ==========================================================
     4. عناصر الواجهة
     ========================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  // eslint-disable-next-line no-unused-vars
  const matchMQ = (query) => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);

  const dom = {
    root: document.documentElement,
    workspace: $('#workspace'),
    splitter: $('#splitter'),
    tabs: $$('.file-tab'),
    editors: $$('.editor'),
    templateSelect: $('#templateSelect'),
    autoRun: $('#autoRunToggle'),
    runBtn: $('#runBtn'),
    downloadBtn: $('#downloadBtn'),
    shareBtn: $('#shareBtn'),
    themeBtn: $('#themeBtn'),
    langBtn: $('#langBtn'),
    reloadBtn: $('#reloadBtn'),
    preview: $('#preview'),
    device: $('#device'),
    stage: $('#previewStage'),
    consolePane: $('#console'),
    consoleToggle: $('#consoleToggle'),
    consoleBody: $('#consoleBody'),
    consoleCount: $('#consoleCount'),
    clearConsole: $('#clearConsole'),
    statusPos: $('#statusPos'),
    statusChars: $('#statusChars'),
    statusLang: $('#statusLang'),
    paneHint: $('#paneHint'),
    toast: $('#toast'),
    segments: $$('.seg'),
    icoSun: null
  };

  /* ==========================================================
     5. محرّك التلوين النصي
     ========================================================== */
  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  const esc = (s) => s.replace(/[&<>]/g, (ch) => ESC_MAP[ch]);

  const JS_KEYWORDS = /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|this|try|catch|finally|throw|async|await|import|export|from|default|typeof|instanceof|delete|in|of|yield|null|undefined|true|false|void|static|get|set)\b/y;

  const RULES = {
    html: [
      { cls: 'comment', re: /<!--[\s\S]*?-->/y },
      { cls: 'doctype', re: /<!doctype[^>]*>/iy },
      { cls: 'tag', re: /<\/?[a-zA-Z][\w:-]*/y },
      { cls: 'punct', re: /\/?>/y },
      { cls: 'attr', re: /[a-zA-Z_:][\w:.-]*(?=\s*=)/y },
      { cls: 'string', re: /"[^"]*"|'[^']*'/y },
      { cls: 'op', re: /=/y }
    ],
    css: [
      { cls: 'comment', re: /\/\*[\s\S]*?\*\//y },
      { cls: 'string', re: /"[^"]*"|'[^']*'/y },
      { cls: 'atrule', re: /@[\w-]+/y },
      { cls: 'prop', re: /-{0,2}[a-zA-Z][\w-]*(?=\s*:)/y },
      { cls: 'color', re: /#[0-9a-fA-F]{3,8}\b/y },
      { cls: 'number', re: /-?\d*\.?\d+(?:%|[a-zA-Z]+)?/y },
      { cls: 'punct', re: /[{}();:,]/y },
      { cls: 'op', re: /[>+~*=[\]^$|]/y }
    ],
    js: [
      { cls: 'comment', re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
      { cls: 'string', re: /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y },
      { cls: 'keyword', re: JS_KEYWORDS },
      { cls: 'number', re: /\b(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y },
      { cls: 'fn', re: /\b[A-Za-z_$][\w$]*(?=\s*\()/y },
      { cls: 'punct', re: /[{}()[\];,.]/y },
      { cls: 'op', re: /[+\-*/%<>=!&|^~?:]+/y }
    ]
  };

  function highlight(code, lang) {
    const rules = RULES[lang] || [];
    const n = code.length;
    let out = '';
    let plain = '';
    let i = 0;

    const flush = () => {
      if (plain) { out += esc(plain); plain = ''; }
    };

    while (i < n) {
      let matched = false;
      for (let r = 0; r < rules.length; r++) {
        const rule = rules[r];
        rule.re.lastIndex = i;
        const m = rule.re.exec(code);
        if (m && m.index === i && m[0].length > 0) {
          flush();
          out += '<span class="tok-' + rule.cls + '">' + esc(m[0]) + '</span>';
          i += m[0].length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        plain += code[i];
        i += 1;
      }
    }
    flush();
    return out + '\n';
  }

  /* ==========================================================
     6. المحرّرات
     ========================================================== */
  const editors = {};

  dom.editors.forEach((wrap) => {
    const lang = wrap.dataset.lang;
    const ta = wrap.querySelector('textarea');
    const codeEl = wrap.querySelector('.highlight code');
    const pre = wrap.querySelector('.highlight');
    editors[lang] = { wrap, ta, codeEl, pre };

    ta.value = state.files[lang];

    const repaint = () => {
      codeEl.innerHTML = highlight(ta.value, lang);
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    };

    ta.addEventListener('input', () => {
      state.files[lang] = ta.value;
      repaint();
      updateStatus(lang);
      persist();
      scheduleRun();
    });

    ta.addEventListener('scroll', () => {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.setRangeText('  ', start, end, 'end');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    ['keyup', 'click', 'select', 'focus'].forEach((evt) => {
      ta.addEventListener(evt, () => {
        updateStatus(lang);
        setActiveLang(lang, { silent: true });
      });
    });

    repaint();
  });

  function setActiveLang(lang, opts = {}) {
    if (!editors[lang]) return;
    state.active = lang;
    dom.editors.forEach((w) => w.classList.toggle('is-active', w.dataset.lang === lang));
    dom.tabs.forEach((tab) => {
      const on = tab.dataset.lang === lang;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    });
    dom.paneHint.textContent = lang.toUpperCase();
    dom.statusLang.textContent = lang.toUpperCase();
    updateStatus(lang);
    if (!opts.silent) {
      persist();
      editors[lang].ta.focus();
    }
  }

  function updateStatus(lang) {
    const ta = editors[lang].ta;
    const pos = ta.selectionStart;
    const before = ta.value.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    dom.statusPos.textContent = t('line') + ' ' + line + ' · ' + t('col') + ' ' + col;
    dom.statusChars.textContent = ta.value.length.toLocaleString('en-US') + ' ' + t('chars');
  }

  /* ==========================================================
     7. المعاينة
     ========================================================== */
  const CONSOLE_HOOK = `
(function () {
  var send = function (payload) {
    try {
      payload.__cloudplay = true;
      parent.postMessage(payload, '*');
    } catch (e) {}
  };

  var seen = new WeakSet();

  function safe(v, depth) {
    depth = depth || 0;
    if (v === null) return 'null';
    var type = typeof v;
    if (type === 'undefined') return 'undefined';
    if (type === 'string') return v;
    if (type === 'number' || type === 'boolean' || type === 'bigint') return String(v);
    if (type === 'symbol') return v.toString();
    if (type === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (v === window) return 'Window';
    if (v && v.nodeType) return '<' + String(v.tagName || 'node').toLowerCase() + '>';
    if (depth > 4) return '…';
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    try {
      if (Array.isArray(v)) {
        return '[' + v.slice(0, 50).map(function (x) { return safe(x, depth + 1); }).join(', ') + ']';
      }
      var keys = Object.keys(v).slice(0, 30);
      return '{ ' + keys.map(function (k) { return k + ': ' + safe(v[k], depth + 1); }).join(', ') + ' }';
    } catch (e) {
      return String(v);
    }
  }

  ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        return typeof a === 'string' ? a : safe(a);
      });
      send({ type: 'console', level: level, args: args });
      try { original.apply(console, arguments); } catch (e) {}
    };
  });

  console.clear = function () { send({ type: 'clear' }); };

  window.addEventListener('error', function (e) {
    var where = e.lineno ? ' (' + e.lineno + ':' + e.colno + ')' : '';
    send({ type: 'console', level: 'error', args: [(e.message || 'Script error') + where] });
  });

  window.addEventListener('unhandledrejection', function (e) {
    send({ type: 'console', level: 'error', args: ['Unhandled rejection: ' + safe(e.reason)] });
  });
})();
`;

  const guardScript = (s) => s.replace(/<\/script/gi, '<\\/script');
  const guardStyle = (s) => s.replace(/<\/style/gi, '<\\/style');

  function buildDoc(withHook) {
    const dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    return '<!DOCTYPE html>\n' +
      '<html lang="' + state.lang + '" dir="' + dir + '">\n' +
      '<head>\n' +
      '<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<base target="_blank">\n' +
      '<style>' + guardStyle(state.files.css) + '</style>\n' +
      (withHook ? '<script>' + CONSOLE_HOOK + '<\/script>\n' : '') +
      '</head>\n' +
      '<body>\n' +
      state.files.html + '\n' +
      '<script>' + guardScript(state.files.js) + '<\/script>\n' +
      '</body>\n' +
      '</html>';
  }

  let runTimer = null;

  function run() {
    clearTimeout(runTimer);
    clearConsole();
    dom.preview.srcdoc = buildDoc(true);
  }

  function scheduleRun() {
    if (!state.autoRun) return;
    clearTimeout(runTimer);
    runTimer = setTimeout(run, 550);
  }

  dom.preview.addEventListener('load', () => {
    /* إعادة تشغيل أي رسائل عالقة بعد التحميل */
    setTimeout(updateConsoleCount, 120);
  });

  /* ==========================================================
     8. الطرفية
     ========================================================== */
  let logCount = 0;

  function updateConsoleCount() {
    dom.consoleCount.textContent = String(logCount);
  }

  function ensureEmptyState() {
    if (dom.consoleBody.querySelector('.log')) return;
    dom.consoleBody.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'console-empty';
    p.dataset.i18n = 'consoleEmpty';
    p.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    p.textContent = t('consoleEmpty');
    dom.consoleBody.appendChild(p);
  }

  function appendLog(level, args) {
    const empty = dom.consoleBody.querySelector('.console-empty');
    if (empty) empty.remove();

    const row = document.createElement('div');
    row.className = 'log log-' + (level || 'log');

    const text = document.createElement('span');
    text.className = 'log-text';
    text.textContent = Array.isArray(args) ? args.join(' ') : String(args);

    row.appendChild(text);
    dom.consoleBody.appendChild(row);
    dom.consoleBody.scrollTop = dom.consoleBody.scrollHeight;

    logCount += 1;
    updateConsoleCount();
  }

  function clearConsole() {
    logCount = 0;
    dom.consoleBody.innerHTML = '';
    ensureEmptyState();
    updateConsoleCount();
  }

  window.addEventListener('message', (event) => {
    if (!event.source || event.source !== dom.preview.contentWindow) return;
    const data = event.data;
    if (!data || data.__cloudplay !== true) return;

    if (data.type === 'clear') {
      logCount = 0;
      dom.consoleBody.innerHTML = '';
      ensureEmptyState();
      updateConsoleCount();
    } else if (data.type === 'console') {
      appendLog(data.level, data.args);
    }
  });

  /* ==========================================================
     9. واجهة المستخدم
     ========================================================== */
  /* ---- رسائل ---- */
  let toastTimer = null;
  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2400);
  }

  /* ---- اللغة ---- */
  function applyLang() {
    state.lang = state.lang === 'ar' ? 'ar' : 'en';
    dom.root.lang = state.lang;
    dom.root.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    dom.langBtn.textContent = state.lang === 'ar' ? 'EN' : 'ع';
    document.title = t('title');

    $$('[data-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    $$('[data-i18n-title]').forEach((node) => {
      const label = t(node.dataset.i18nTitle);
      node.title = label;
      node.setAttribute('aria-label', label);
    });

    renderTemplateOptions();
    ensureEmptyState();
    const emptyHint = dom.consoleBody.querySelector('.console-empty');
    if (emptyHint) emptyHint.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    updateStatus(state.active);
  }

  function renderTemplateOptions() {
    const current = dom.templateSelect.value || state.template || 'starter';
    dom.templateSelect.innerHTML = '';
    Object.keys(TEMPLATES).forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = t('tpl_' + id);
      dom.templateSelect.appendChild(opt);
    });
    dom.templateSelect.value = current;
    if (!dom.templateSelect.value) dom.templateSelect.value = 'starter';
  }

  /* ---- القوالب ---- */
  function isDirty() {
    if (!state.template || !TEMPLATES[state.template]) return true;
    const tpl = TEMPLATES[state.template];
    return state.files.html !== tpl.html || state.files.css !== tpl.css || state.files.js !== tpl.js;
  }

  function loadTemplate(id) {
    if (!TEMPLATES[id]) return;

    if (isDirty() && !window.confirm(t('confirmTemplate'))) {
      renderTemplateOptions();
      return;
    }

    state.template = id;
    state.files = cloneTemplate(id);
    Object.keys(editors).forEach((lang) => {
      editors[lang].ta.value = state.files[lang];
      editors[lang].codeEl.innerHTML = highlight(state.files[lang], lang);
      editors[lang].ta.scrollTop = 0;
      editors[lang].pre.scrollTop = 0;
    });

    updateStatus(state.active);
    persist();
    run();
    toast(t('templateLoaded') + t('tpl_' + id));
  }

  /* ---- المظهر ---- */
  function applyTheme() {
    dom.root.dataset.theme = state.theme;
    persist();
  }

  /* ---- التنزيل ---- */
  function download() {
    const doc = buildDoc(false);
    const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cloud-play.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(t('downloaded'));
  }

  /* ---- المشاركة ---- */
  async function share() {
    const code = encodeShare(state.files);
    const url = location.origin + location.pathname + '#p=' + code;
    try {
      history.replaceState(null, '', '#p=' + code);
    } catch (err) { /* تجاهل */ }

    try {
      await navigator.clipboard.writeText(url);
      toast(t('copied'));
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? t('copied') : t('copyFailed'));
    }
  }

  /* ---- الأحداث ---- */
  dom.tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      setActiveLang(tab.dataset.lang);
      persist();
    });
  });

  dom.templateSelect.addEventListener('change', (e) => {
    loadTemplate(e.target.value);
  });

  dom.autoRun.addEventListener('change', () => {
    state.autoRun = dom.autoRun.checked;
    persist();
    if (state.autoRun) run();
    else toast(t('autoOff'));
  });

  dom.runBtn.addEventListener('click', run);
  dom.reloadBtn.addEventListener('click', run);
  dom.downloadBtn.addEventListener('click', download);
  dom.shareBtn.addEventListener('click', share);

  dom.themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });

  dom.langBtn.addEventListener('click', () => {
    state.lang = state.lang === 'ar' ? 'en' : 'ar';
    applyLang();
    persist();
    run();
  });

  dom.clearConsole.addEventListener('click', clearConsole);

  dom.consoleToggle.addEventListener('click', () => {
    const collapsed = dom.consolePane.classList.toggle('collapsed');
    dom.consoleToggle.setAttribute('aria-expanded', String(!collapsed));
  });

  dom.segments.forEach((btn) => {
    btn.addEventListener('click', () => {
      dom.segments.forEach((b) => b.classList.toggle('is-active', b === btn));
      dom.device.style.maxWidth = btn.dataset.w;
    });
  });

  /* ---- السحب لتغيير الحجم ---- */
  function isRTL() {
    return getComputedStyle(document.body).direction === 'rtl';
  }

  function setSplit(pct) {
    state.split = Math.max(22, Math.min(78, pct));
    dom.workspace.style.setProperty('--split', String(state.split));
  }

  let dragging = false;

  dom.splitter.addEventListener('pointerdown', (e) => {
    if (matchMQ('(max-width: 920px)')) return;
    dragging = true;
    dom.splitter.classList.add('is-dragging');
    document.body.classList.add('is-resizing');
    dom.splitter.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  dom.splitter.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = dom.workspace.getBoundingClientRect();
    if (!rect.width) return;
    const raw = ((e.clientX - rect.left) / rect.width) * 100;
    setSplit(isRTL() ? 100 - raw : raw);
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    dom.splitter.classList.remove('is-dragging');
    document.body.classList.remove('is-resizing');
    persist();
  };

  dom.splitter.addEventListener('pointerup', endDrag);
  dom.splitter.addEventListener('pointercancel', endDrag);
  dom.splitter.addEventListener('lostpointercapture', endDrag);

  /* ---- اختصارات لوحة المفاتيح ---- */
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      run();
      return;
    }
    if (mod && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      download();
      return;
    }
    if (e.altKey && ['1', '2', '3'].includes(e.key)) {
      e.preventDefault();
      const lang = ['html', 'css', 'js'][Number(e.key) - 1];
      setActiveLang(lang);
      persist();
    }
  });

  /* ==========================================================
     10. الإقلاع
     ========================================================== */
  dom.root.dataset.theme = state.theme;
  dom.autoRun.checked = state.autoRun;
  dom.workspace.style.setProperty('--split', String(state.split));

  /* على الشاشات الصغيرة تُطوى الطرفية افتراضيًا لإفساح المجال للمعاينة */
  if (matchMQ('(max-width: 620px)')) {
    dom.consolePane.classList.add('collapsed');
    dom.consoleToggle.setAttribute('aria-expanded', 'false');
  }

  if (state.template) dom.templateSelect.value = state.template;
  applyLang();
  setActiveLang(state.active, { silent: true });
  run();
  persist();

  /* إعادة المزامنة عند تغيير حجم النافذة */
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      Object.keys(editors).forEach((lang) => {
        const { ta, pre } = editors[lang];
        pre.scrollTop = ta.scrollTop;
        pre.scrollLeft = ta.scrollLeft;
      });
    }, 120);
  });
})();
