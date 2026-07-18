/* ============ WEB RADIO HRVATSKA — logika retro auto radija ============ */
(function () {
  'use strict';

  // ---------- stanje ----------
  const audio = new Audio();
  audio.preload = 'none';

  let current = -1;          // indeks u STATIONS
  let streamIdx = 0;         // koji stream URL trenutno probamo
  let playing = false;
  let powerOn = true;
  let playToken = 0;         // poništava zakašnjele callbackove starih pokušaja
  let presets = loadJSON('wrh_presets', [null, null, null, null, null, null]);

  const FREQ_MIN = 87.5, FREQ_MAX = 108.0;

  // ---------- elementi ----------
  const $ = (id) => document.getElementById(id);
  const lcdText = $('lcdText'), needle = $('needle'), statusLed = $('statusLed');
  const list = $('stationList'), search = $('search');
  const cityFilter = $('cityFilter'), genreFilter = $('genreFilter');
  const panel = $('panel'), toast = $('toast'), countEl = $('count');

  // stabilna "frekvencija" po imenu postaje
  function freqOf(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return Math.round((FREQ_MIN + (h % ((FREQ_MAX - FREQ_MIN) * 10 + 1)) / 10) * 10) / 10;
  }
  STATIONS.forEach(s => { s.freq = freqOf(s.name); });

  // ---------- skala ----------
  (function buildDial() {
    const scale = $('dialScale');
    for (let f = 88; f <= 108; f += 0.5) {
      const x = ((f - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100;
      const t = document.createElement('div');
      const major = f % 2 === 0;
      t.className = 'tick' + (major ? ' major' : '');
      t.style.left = x + '%';
      scale.appendChild(t);
      if (f % 4 === 0) {
        const n = document.createElement('span');
        n.className = 'num';
        n.textContent = f;
        n.style.left = x + '%';
        scale.appendChild(n);
      }
    }
  })();

  // ---------- LCD ----------
  function setLCD(text) {
    lcdText.classList.remove('scroll');
    lcdText.textContent = text;
    requestAnimationFrame(() => {
      if (lcdText.scrollWidth > lcdText.parentElement.clientWidth) lcdText.classList.add('scroll');
    });
  }

  function setLed(state) { // '', 'on', 'err', 'busy'
    statusLed.className = 'led' + (state ? ' ' + state : '');
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function moveNeedle(freq) {
    const pct = ((freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN)) * 100;
    needle.style.left = Math.min(98, Math.max(1, pct)) + '%';
  }

  // ---------- reprodukcija s fallbackom ----------
  function playStation(idx) {
    if (idx < 0 || idx >= STATIONS.length) return;
    const st = STATIONS[idx];
    current = idx;
    streamIdx = 0;
    powerOn = true;
    document.body.classList.add('on');
    moveNeedle(st.freq);
    setLCD('⟳ TRAŽIM ' + st.freq.toFixed(1) + ' MHz · ' + st.name.toUpperCase());
    setLed('busy');
    localStorage.setItem('wrh_last', String(idx));
    renderActive();
    tryStream();
  }

  function tryStream() {
    const st = STATIONS[current];
    if (!st || streamIdx >= st.streams.length) {
      setPlaying(false);
      setLed('err');
      setLCD('✕ NEMA SIGNALA · ' + (st ? st.name.toUpperCase() : ''));
      return;
    }
    const token = ++playToken;
    const url = st.streams[streamIdx];
    audio.src = url;
    audio.load();

    // ako se u 10 s ništa ne dogodi — sljedeći stream
    clearTimeout(tryStream.t);
    tryStream.t = setTimeout(() => {
      if (token === playToken && !playing) nextStream(token);
    }, 10000);

    audio.play().then(() => {
      if (token !== playToken) return;
      setPlaying(true);
      setLed('on');
      setLCD('♪ ' + st.freq.toFixed(1) + ' MHz · ' + st.name.toUpperCase() + (st.city ? ' · ' + st.city.toUpperCase() : ''));
      updateMediaSession(st);
    }).catch(() => {
      if (token !== playToken) return;
      nextStream(token);
    });
  }

  function nextStream(token) {
    if (token !== playToken) return;
    streamIdx++;
    tryStream();
  }

  audio.addEventListener('error', () => { if (!playing) nextStream(playToken); });
  audio.addEventListener('stalled', () => { /* pusti timeout da odradi */ });

  function setPlaying(on) {
    playing = on;
    document.body.classList.toggle('playing', on);
    renderActive();
  }

  // ---------- power ----------
  $('pwrBtn').addEventListener('click', () => {
    if (powerOn && playing) {
      audio.pause();
      setPlaying(false);
      powerOn = false;
      document.body.classList.remove('on');
      setLed('');
      setLCD('· RADIO ISKLJUČEN ·');
    } else {
      powerOn = true;
      document.body.classList.add('on');
      if (current >= 0) playStation(current);
      else setLCD('DOBRODOŠLI · ODABERI POSTAJU ▸');
    }
  });

  // ---------- TUNE gumb ----------
  const tuneKnob = $('tuneKnob');
  let tuneAngle = 0;
  tuneKnob.addEventListener('click', (e) => {
    const rect = tuneKnob.getBoundingClientRect();
    const dir = (e.clientX - rect.left) < rect.width / 2 ? -1 : 1;
    tuneAngle += dir * 45;
    tuneKnob.style.transform = 'rotate(' + tuneAngle + 'deg)';
    const order = visibleOrder();
    if (!order.length) return;
    let pos = order.indexOf(current);
    pos = pos === -1 ? 0 : (pos + dir + order.length) % order.length;
    playStation(order[pos]);
  });

  // ---------- VOL gumb ----------
  const volKnob = $('volKnob');
  let vol = parseFloat(localStorage.getItem('wrh_vol') || '0.9');
  audio.volume = vol;
  updateVolKnob();

  function updateVolKnob() {
    volKnob.style.transform = 'rotate(' + (-135 + vol * 270) + 'deg)';
  }
  function setVol(v) {
    vol = Math.min(1, Math.max(0, v));
    audio.volume = vol;
    localStorage.setItem('wrh_vol', vol.toFixed(2));
    updateVolKnob();
  }
  volKnob.addEventListener('wheel', (e) => {
    e.preventDefault();
    setVol(vol + (e.deltaY < 0 ? .05 : -.05));
    showToast('VOL ' + Math.round(vol * 100) + '%');
  }, { passive: false });

  let dragging = false, dragY = 0, dragVol = 0;
  volKnob.addEventListener('pointerdown', (e) => {
    dragging = true; dragY = e.clientY; dragVol = vol;
    volKnob.setPointerCapture(e.pointerId);
  });
  volKnob.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setVol(dragVol + (dragY - e.clientY) / 150);
  });
  volKnob.addEventListener('pointerup', () => {
    if (dragging) showToast('VOL ' + Math.round(vol * 100) + '%');
    dragging = false;
  });

  // ---------- preseti (klik = pozovi, drži = spremi) ----------
  const presetsEl = $('presets');
  for (let i = 0; i < 6; i++) {
    const b = document.createElement('button');
    b.textContent = i + 1;
    let holdT = null, held = false;
    b.addEventListener('pointerdown', () => {
      held = false;
      holdT = setTimeout(() => {
        held = true;
        if (current >= 0) {
          presets[i] = STATIONS[current].name;
          localStorage.setItem('wrh_presets', JSON.stringify(presets));
          renderPresets();
          showToast('SPREMLJENO NA P' + (i + 1));
        }
      }, 700);
    });
    b.addEventListener('pointerup', () => {
      clearTimeout(holdT);
      if (held) return;
      const name = presets[i];
      if (!name) { showToast('P' + (i + 1) + ' PRAZAN — DRŽI ZA SPREMANJE'); return; }
      const idx = STATIONS.findIndex(s => s.name === name);
      if (idx >= 0) playStation(idx);
    });
    b.addEventListener('pointerleave', () => clearTimeout(holdT));
    presetsEl.appendChild(b);
  }
  function renderPresets() {
    [...presetsEl.children].forEach((b, i) => {
      const name = presets[i];
      b.classList.toggle('set', !!name);
      b.classList.toggle('active', !!name && current >= 0 && STATIONS[current] && STATIONS[current].name === name);
      b.title = name ? name : 'Drži za spremanje trenutne postaje';
    });
  }

  // ---------- popis postaja ----------
  (function buildFilters() {
    const cities = [...new Set(STATIONS.map(s => s.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'hr'));
    const genres = [...new Set(STATIONS.flatMap(s => s.genres))].sort((a, b) => a.localeCompare(b, 'hr'));
    for (const c of cities) cityFilter.append(new Option(c, c));
    for (const g of genres) genreFilter.append(new Option(g, g));
  })();

  function norm(s) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function visibleOrder() {
    const q = norm(search.value.trim());
    const city = cityFilter.value, genre = genreFilter.value;
    const order = [];
    STATIONS.forEach((s, i) => {
      if (q && !norm(s.name).includes(q) && !norm(s.city).includes(q)) return;
      if (city && s.city !== city) return;
      if (genre && !s.genres.includes(genre)) return;
      order.push(i);
    });
    return order;
  }

  function renderList() {
    const order = visibleOrder();
    countEl.textContent = order.length + ' / ' + STATIONS.length + ' POSTAJA';
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const i of order) {
      const s = STATIONS[i];
      const li = document.createElement('li');
      li.dataset.idx = i;

      if (s.logo) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = s.logo;
        img.alt = '';
        img.onerror = () => { img.replaceWith(logoPh()); };
        li.appendChild(img);
      } else {
        li.appendChild(logoPh());
      }

      const meta = document.createElement('div');
      meta.className = 'meta';
      const nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = s.name;
      const sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = [s.freq.toFixed(1) + ' MHz', s.city, s.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
      meta.append(nm, sub);
      li.appendChild(meta);

      const eq = document.createElement('div');
      eq.className = 'eq';
      eq.innerHTML = '<i></i><i></i><i></i>';
      li.appendChild(eq);

      li.addEventListener('click', () => {
        playStation(i);
        if (window.innerWidth < 760) panel.classList.remove('open');
      });
      frag.appendChild(li);
    }
    list.appendChild(frag);
    renderActive();
  }

  function logoPh() {
    const d = document.createElement('div');
    d.className = 'logo-ph';
    d.textContent = '📻';
    return d;
  }

  function renderActive() {
    [...list.children].forEach(li => {
      const on = Number(li.dataset.idx) === current;
      li.classList.toggle('active', on);
      li.classList.toggle('playing-item', on && playing);
    });
    renderPresets();
  }

  search.addEventListener('input', renderList);
  cityFilter.addEventListener('change', renderList);
  genreFilter.addEventListener('change', renderList);

  // ---------- panel ----------
  $('panelToggle').addEventListener('click', () => panel.classList.toggle('open'));
  $('panelClose').addEventListener('click', () => panel.classList.remove('open'));

  // ---------- video vožnja (YouTube · kanal City Drive 4K) ----------
  // Samo videi s dopuštenim embedanjem; video je mutiran — zvuk daje radio.
  const DRIVE_CHANNEL = { name: 'City Drive 4K', url: 'https://www.youtube.com/@citydrive4K' };
  const DRIVES = [
    { id: 'u9rh4hmtaU8', title: 'DRIVE 4K MALI LOŠINJ – MERAG 107' },
    { id: 'oZR40-j7c-U', title: 'DRIVE 4K ZAGREB CROATIA 105' },
    { id: 'qnRGhxvlGpI', title: 'DRIVE 4K ŽUMBERAK CROATIA 104' },
    { id: 'kmDnVX5iEm8', title: 'DRIVE 4K ZAGREB ŽUMBERAK CROATIA 98' },
    { id: 'wTZD79yT6E0', title: 'DRIVE 4K ZAGREB CROATIA 97' },
    { id: 'aaGE9ttdIxg', title: 'DRIVE 4K IKEA ZAGREB CROATIA 96' },
    { id: 'UbvRYT7-zbc', title: 'DRIVE 4K ZAGREB SLJEME CROATIA 98' }
  ];

  const windshield = $('windshield');
  const ytHolder = $('ytHolder');
  const videoCredit = $('videoCredit');
  const videoTitle = $('videoTitle');
  const lever = $('lever');

  let scene = localStorage.getItem('wrh_scene') || 'video';
  let driveIdx = parseInt(localStorage.getItem('wrh_drive') || '0', 10) % DRIVES.length;
  if (driveIdx < 0 || isNaN(driveIdx)) driveIdx = 0;

  function loadDrive() {
    const v = DRIVES[driveIdx];
    ytHolder.innerHTML = '';
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + v.id
      + '?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&iv_load_policy=3'
      + '&loop=1&playlist=' + v.id;
    f.allow = 'autoplay; encrypted-media';
    f.title = v.title + ' — YouTube kanal ' + DRIVE_CHANNEL.name;
    ytHolder.appendChild(f);
    videoTitle.textContent = v.title;
    videoCredit.href = 'https://www.youtube.com/watch?v=' + v.id;
    localStorage.setItem('wrh_drive', String(driveIdx));
  }

  function applyScene() {
    windshield.classList.toggle('video-on', scene === 'video');
    if (scene === 'video') {
      if (!ytHolder.firstChild) loadDrive();
    } else {
      ytHolder.innerHTML = ''; // zaustavi video kad se vratimo na animaciju
    }
    localStorage.setItem('wrh_scene', scene);
  }

  lever.addEventListener('click', () => {
    lever.classList.add('pulled');
    setTimeout(() => lever.classList.remove('pulled'), 260);
    if (scene !== 'video') { scene = 'video'; applyScene(); }
    else { driveIdx = (driveIdx + 1) % DRIVES.length; loadDrive(); }
    showToast('VOŽNJA: ' + DRIVES[driveIdx].title);
  });

  $('sceneMode').addEventListener('click', () => {
    scene = scene === 'video' ? 'anim' : 'video';
    applyScene();
    showToast(scene === 'video' ? 'VIDEO VOŽNJA · CITY DRIVE 4K' : 'CRTANA VOŽNJA');
  });

  applyScene();

  // ---------- Media Session (lock screen / tipke na tastaturi) ----------
  function updateMediaSession(st) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: st.name,
      artist: 'WEB RADIO HRVATSKA' + (st.city ? ' · ' + st.city : ''),
      artwork: st.logo ? [{ src: st.logo, sizes: '256x256' }] : []
    });
    navigator.mediaSession.setActionHandler('play', () => { if (current >= 0) playStation(current); });
    navigator.mediaSession.setActionHandler('pause', () => $('pwrBtn').click());
    navigator.mediaSession.setActionHandler('previoustrack', () => stepStation(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => stepStation(1));
  }
  function stepStation(dir) {
    const order = visibleOrder();
    if (!order.length) return;
    let pos = order.indexOf(current);
    pos = pos === -1 ? 0 : (pos + dir + order.length) % order.length;
    playStation(order[pos]);
  }

  // ---------- pomoćne ----------
  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  // ---------- init ----------
  document.body.classList.add('on');
  renderList();
  renderPresets();

  const last = parseInt(localStorage.getItem('wrh_last') || '-1', 10);
  if (last >= 0 && last < STATIONS.length) {
    current = last;
    moveNeedle(STATIONS[last].freq);
    setLCD('▸ ZADNJE: ' + STATIONS[last].name.toUpperCase() + ' · KLIKNI ⏻ ILI POSTAJU');
    renderActive();
  }

  // otvori panel na startu na velikim ekranima
  if (window.innerWidth >= 760) panel.classList.add('open');
})();
