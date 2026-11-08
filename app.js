(() => {
  'use strict';

  // ---------- Exercices ----------
  // Angles en degrés. abd = écartement du bras (0 = le long du corps),
  // elbow > 0 = flexion vers l'intérieur (curl), elbow < 0 = vers l'extérieur (développé).
  // knee = flexion de la jambe (squat).
  const lerp = (a, b, t) => a + (b - a) * t;
  const EXERCISES = [
    {
      id: 'curl', name: 'Curl biceps', muscles: 'Biceps · Avant-bras',
      main: ['biceps'], secondary: ['forearm'],
      pose: t => ({ abd: lerp(6, 12, t), elbow: lerp(2, 14, t), curl: lerp(5, 155, t), knee: 0 }),
    },
    {
      id: 'press', name: 'Développé épaules', muscles: 'Deltoïdes · Triceps · Trapèzes',
      main: ['delts'], secondary: ['triceps', 'traps'],
      pose: t => ({ abd: lerp(96, 168, t), elbow: lerp(-96, -12, t), knee: 0 }),
    },
    {
      id: 'lateral', name: 'Élévations latérales', muscles: 'Deltoïdes · Trapèzes',
      main: ['delts'], secondary: ['traps'],
      pose: t => ({ abd: lerp(10, 88, t), elbow: -12, knee: 0 }),
    },
    {
      id: 'squat', name: 'Squat', muscles: 'Quadriceps · Adducteurs · Mollets · Abdos',
      main: ['quads'], secondary: ['adductors', 'calves', 'abs'],
      pose: t => ({ abd: 14, elbow: 4, knee: lerp(0, 68, t) }),
    },
    {
      id: 'kickback', name: 'Extension triceps', muscles: 'Triceps · Deltoïdes',
      main: ['triceps'], secondary: ['delts'],
      pose: t => ({ abd: lerp(150, 172, t), elbow: lerp(150, 6, t), knee: 0 }),
    },
  ];

  const DEFAULTS = {
    brand: 'MUSCLE COACH',
    captions: ['même séance', 'zéro excuse', 'chaque rep compte'],
    ticker: ['2 FOIS PLUS', 'TES MUSCLES', 'FORT'],
    bg: '#13614a',
    accent: '#ff6a3d',
  };

  // ---------- Réglages (sauvegarde locale) ----------
  let cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('mc-cfg') || '{}')); } catch (_) {}
  const save = () => { try { localStorage.setItem('mc-cfg', JSON.stringify(cfg)); } catch (_) {} };

  const $ = s => document.querySelector(s);
  const fig = $('#figure');

  // Remplace chaque <use> par une vraie copie du gabarit (styles CSS fiables partout).
  fig.querySelectorAll('#root use').forEach(u => {
    const tpl = document.getElementById(u.getAttribute('href').slice(1));
    const g = tpl.cloneNode(true);
    g.removeAttribute('id');
    u.replaceWith(g);
  });

  // ---------- Squelette ----------
  const SH = 180, SHX = 58;     // épaules
  const HIPY = 400, HIPX = 22;  // hanches
  const THIGH = 178, SHIN = 160;

  const arms = [-1, 1].map(s => {
    const g = $(s < 0 ? '#armL' : '#armR');
    return { s, g, fore: g.querySelector('.forearm'), foreScale: g.querySelector('.foreScale'), db: g.querySelector('.dumbbell') };
  });
  const legs = [-1, 1].map(s => {
    const g = $(s < 0 ? '#legL' : '#legR');
    return {
      s, g,
      wrap: g.querySelector('.thighWrap'), scale: g.querySelector('.thighScale'),
      shin: g.querySelector('.shin'), foot: g.querySelector('.foot'),
    };
  });
  const root = $('#root');
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;

  function applyPose(p, breath) {
    // Jambes : genoux qui s'ouvrent, cuisses raccourcies (vue de face), pieds au sol.
    const k = rad(p.knee);
    const c = Math.cos(k);
    const abdLeg = 4 + p.knee * 0.28;
    const kx = THIGH * c * Math.sin(rad(abdLeg));
    const ky = THIGH * c * Math.cos(rad(abdLeg));
    const shinTot = Math.asin(Math.max(-1, Math.min(1, kx / SHIN)));  // cheville sous la hanche
    const legH = ky + SHIN * Math.cos(shinTot);
    const drop = (THIGH + SHIN) * Math.cos(rad(4)) - legH + 0;
    legs.forEach(l => {
      l.wrap.setAttribute('transform',
        `translate(${200 + l.s * HIPX},${HIPY}) scale(${l.s},1) rotate(${-abdLeg})`);
      l.scale.setAttribute('transform', `scale(1,${c.toFixed(4)})`);
      const rel = deg(shinTot) + abdLeg;
      l.shin.setAttribute('transform', `translate(0,${(THIGH * c).toFixed(2)}) rotate(${rel.toFixed(2)})`);
      l.foot.setAttribute('transform', `translate(0,${SHIN}) rotate(${(-deg(shinTot) - 4).toFixed(2)})`);
    });
    root.setAttribute('transform', `translate(0,${(drop + breath * 0.6).toFixed(2)})`);

    // Bras
    arms.forEach(a => {
      a.g.setAttribute('transform',
        `translate(${200 + a.s * SHX},${SH + breath}) scale(${a.s},1) rotate(${-p.abd})`);
      // curl = flexion vers la caméra : l'avant-bras se raccourcit puis passe au-dessus du coude
      const fc = Math.cos(rad(p.curl || 0));
      a.fore.setAttribute('transform', `translate(0,115) rotate(${p.elbow})`);
      a.foreScale.setAttribute('transform', `scale(1,${fc.toFixed(4)})`);
      // garde l'haltère à l'horizontale
      a.db.setAttribute('transform', `translate(0,${(114 * fc).toFixed(2)}) rotate(${p.abd - p.elbow})`);
    });
  }

  // ---------- Interface ----------
  let ex = EXERCISES[0];
  let playing = true;
  let speed = 1;
  let phase = 0;
  let reps = 0;
  let elapsed = 0;

  const chips = $('#chips');
  EXERCISES.forEach(e => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = e.name; b.dataset.id = e.id;
    b.onclick = () => select(e);
    chips.appendChild(b);
  });

  function select(e) {
    ex = e; phase = 0; reps = 0; elapsed = 0;
    [...fig.classList].filter(c => /^(on|main)-/.test(c)).forEach(c => fig.classList.remove(c));
    e.main.forEach(m => fig.classList.add('main-' + m));
    e.secondary.forEach(m => fig.classList.add('on-' + m));
    $('#exName').textContent = e.name;
    $('#exMuscles').textContent = e.muscles;
    chips.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.id === e.id));
    $('#reps').textContent = '0';
  }

  function setPlaying(v) {
    playing = v;
    $('#icPause').hidden = !v; $('#icPlay').hidden = v;
    $('#playBtn').setAttribute('aria-label', v ? 'Pause' : 'Lecture');
  }
  $('#playBtn').onclick = () => setPlaying(!playing);
  $('#speed').oninput = e => { speed = +e.target.value; $('#speedOut').textContent = speed.toFixed(1) + '×'; };

  // Bulle qui change toutes les 2,5 s
  let capIdx = 0;
  const cap = $('#caption');
  function nextCaption() {
    const list = cfg.captions.filter(Boolean);
    if (!list.length) { cap.hidden = true; return; }
    cap.hidden = false;
    cap.textContent = list[capIdx++ % list.length];
    cap.style.animation = 'none'; void cap.offsetWidth; cap.style.animation = '';
  }
  setInterval(nextCaption, 2500);

  function applyCfg() {
    document.documentElement.style.setProperty('--bg', cfg.bg);
    document.documentElement.style.setProperty('--bg-deep', shade(cfg.bg, -0.38));
    document.documentElement.style.setProperty('--accent', cfg.accent);
    document.querySelector('meta[name=theme-color]').content = cfg.bg;
    $('#brand').textContent = cfg.brand;
    document.title = cfg.brand ? titleCase(cfg.brand) : 'Muscle Coach';
    const words = cfg.ticker.filter(Boolean);
    const track = $('#tickerTrack');
    track.textContent = '';
    const run = words.length ? words : [' '];
    for (let i = 0; i < 2; i++) run.forEach(w => {
      const s = document.createElement('span'); s.textContent = w + ' ·'; track.appendChild(s);
    });
    capIdx = 0; nextCaption();
  }
  const titleCase = s => s.toLowerCase().replace(/\b\p{L}/gu, m => m.toUpperCase());
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.round(Math.max(0, Math.min(255, v + v * amt)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // Dialogue des réglages
  const dlg = $('#settings');
  $('#settingsBtn').onclick = () => {
    $('#setBrand').value = cfg.brand;
    $('#setCaptions').value = cfg.captions.join('\n');
    $('#setTicker').value = cfg.ticker.join('\n');
    $('#setBg').value = cfg.bg;
    $('#setAccent').value = cfg.accent;
    dlg.showModal();
  };
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    cfg = {
      brand: $('#setBrand').value.trim(),
      captions: $('#setCaptions').value.split('\n').map(s => s.trim()).filter(Boolean),
      ticker: $('#setTicker').value.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean),
      bg: $('#setBg').value,
      accent: $('#setAccent').value,
    };
    save(); applyCfg();
  });
  $('#resetBtn').onclick = () => { cfg = { ...DEFAULTS }; save(); applyCfg(); dlg.close(); };

  // ---------- Boucle d'animation ----------
  const REP_SECONDS = 2.4;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      elapsed += dt;
      phase += dt * speed / REP_SECONDS;
      if (phase >= 1) { phase -= 1; reps++; $('#reps').textContent = reps; }
      const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60);
      $('#timer').textContent = `${m}:${String(s).padStart(2, '0')}`;
    }
    // montée un peu plus rapide que la descente, avec une pause en haut
    const raw = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const t = Math.min(1, raw * 1.12);
    applyPose(ex.pose(t), Math.sin(now / 900) * 1.2);
    fig.style.setProperty('--pulse', (0.55 + 0.4 * t).toFixed(3));
    requestAnimationFrame(frame);
  }

  applyCfg();
  select(ex);
  requestAnimationFrame(frame);

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !dlg.open) { e.preventDefault(); setPlaying(!playing); }
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
