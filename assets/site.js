// Shared by every page. Each block only runs when the page has the elements it needs.

// ---------- Black-Scholes (normal CDF: Hart 1968 via West 2005, same as optlib/normal.py) ----------
const SQRT_2PI = 2.5066282746310002;
const HART_NUM = [220.206867912376, 221.213596169931, 112.079291497871, 33.912866078383,
  6.37396220353165, 0.700383064443688, 3.52624965998911e-2];
const HART_DEN = [440.413735824752, 793.826512519948, 637.333633378831, 296.564248779674,
  86.7807322029461, 16.064177579207, 1.75566716318264, 8.83883476483184e-2];
const horner = (coeffs, x) => coeffs.reduceRight((acc, c) => acc * x + c, 0);

function normCdf(z) {
  const za = Math.abs(z);
  let upper = 0;
  if (za <= 37) {
    const e = Math.exp(-0.5 * za * za);
    if (za < 7.071067811865475) {
      upper = e * horner(HART_NUM, za) / horner(HART_DEN, za);
    } else {
      let cf = za + 0.65;
      for (const k of [4, 3, 2, 1]) cf = za + k / cf;
      upper = e / (cf * SQRT_2PI);
    }
  }
  return z > 0 ? 1 - upper : upper;
}
const normPdf = (z) => Math.exp(-0.5 * z * z) / SQRT_2PI;

// European, no dividends. Vega per vol point, theta per day, rho per 1%.
function blackScholes(S, K, T, sigma, r) {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const df = Math.exp(-r * T);
  const nd1 = normPdf(d1);
  const call = S * normCdf(d1) - K * df * normCdf(d2);
  const put = K * df * normCdf(-d2) - S * normCdf(-d1);
  const decay = -S * nd1 * sigma / (2 * sqrtT);
  return {
    call: { price: call, delta: normCdf(d1), theta: (decay - r * K * df * normCdf(d2)) / 365, rho: K * T * df * normCdf(d2) / 100 },
    put: { price: put, delta: normCdf(d1) - 1, theta: (decay + r * K * df * normCdf(-d2)) / 365, rho: -K * T * df * normCdf(-d2) / 100 },
    gamma: nd1 / (S * sigma * sqrtT),
    vega: S * nd1 * sqrtT / 100,
    parityError: Math.abs(call - put - (S - K * df)),
  };
}

(() => {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const minus = (s) => s.replace('-', '−');
  const fmt = (x) => minus((Math.abs(x) < 5e-5 ? 0 : x).toFixed(4));

  // ---------- Theme: white by default, dark on request, remembered per visitor ----------
  // The inline script in <head> applies a saved choice before first paint; this keeps the toggle,
  // its label and the browser's theme colour in step.
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    themeMeta?.setAttribute('content', dark ? '#232323' : '#ffffff');
    document.querySelectorAll('.theme-toggle').forEach((b) => b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'));
  };
  const toggleTheme = () => {
    if (root.dataset.theme === 'dark') delete root.dataset.theme;
    else root.dataset.theme = 'dark';
    try { localStorage.setItem('theme', root.dataset.theme || 'light'); } catch {}
    syncTheme();
  };
  document.querySelectorAll('.theme-toggle').forEach((b) => b.addEventListener('click', toggleTheme));
  syncTheme();

  // ---------- Photo: opens "Side quests", with a pointer tag on hover ----------
  // A native <dialog>, so Esc, focus trapping and focus return come for free. Clicking the backdrop
  // or the close button shuts it. The tag follows the mouse over the photo instead of a plain cursor.
  const photoBtn = document.querySelector('.avatar-btn');
  const quests = $('quests');
  if (photoBtn && quests && typeof quests.showModal === 'function') {
    quests.querySelectorAll('.quest').forEach((q, i) => q.style.setProperty('--i', i));
    photoBtn.addEventListener('click', () => { peek?.classList.remove('is-on'); quests.showModal(); });
    quests.addEventListener('click', (e) => {
      if (e.target === quests || e.target.closest('.quests-close')) quests.close();
    });
  }
  const peek = document.querySelector('.peek');
  if (photoBtn && peek && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const place = (e) => { peek.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; };
    photoBtn.addEventListener('pointerenter', (e) => { place(e); peek.classList.add('is-on'); });
    photoBtn.addEventListener('pointermove', place);
    photoBtn.addEventListener('pointerleave', () => peek.classList.remove('is-on'));
  }

  // ---------- Appear animations ----------
  // site.css hides these until .is-in is added. Things visible at load use the CSS stagger;
  // anything revealed later by scrolling plays straight away, staggered within its batch.
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion');
    const appearing = document.querySelectorAll([
      '.hero .clocks', '.hero .avatar-wrap', '.hero-title > *', '.hero .avail', '.hero .status', '.hero .socials', '.hero .actions > *', '.hero .coords', '.side > .demo',
      '.flow > .row:not(#projects)', '#projects .row-label', '.cards > .card', '#projects .btn-block', '.flow > .contact', '.flow > .site-foot',
      '.article .back', '.article .cover', '.article h1', '.article .facts', '.article .prose', '.article .article-links', '.article .more',
      '.work-list .wl-title', '.work-list .wl-group', '.work-list .wl-items > li',
    ].join(','));
    document.querySelectorAll('.work-list > *, .work-list .wl-items > li').forEach((node, i) => {
      node.style.setProperty('--delay', `${(i * 0.05).toFixed(2)}s`);
    });
    const loadedAt = performance.now();
    const onScreen = (node) => {
      const r = node.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0;
    };
    const reveal = new IntersectionObserver((entries) => {
      const late = performance.now() - loadedAt > 900;
      let batch = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const node = entry.target;
        if (late) node.style.setProperty('--delay', `${(batch++ * 0.08).toFixed(2)}s`);
        node.classList.add('is-in');
        reveal.unobserve(node);
      }
    }, { rootMargin: '0px 0px -6% 0px' });
    // Anything already on screen plays its CSS stagger right away; the rest waits to be scrolled to
    appearing.forEach((node) => (onScreen(node) ? node.classList.add('is-in') : reveal.observe(node)));
  }

  // ---------- Toast ----------
  let toast = $('toast');
  if (!toast) {
    toast = document.createElement('p');
    toast.className = 'toast';
    toast.id = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  let toastTimer;
  const showToast = (text) => {
    toast.textContent = text;
    toast.classList.add('is-shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-shown'), 1800);
  };

  // ---------- Copy email ----------
  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(email);
        showToast('Email copied');
      } catch {
        location.href = `mailto:${email}`;
      }
    });
  }

  // ---------- Market clocks: US, EMEA, APAC ----------
  // Holidays come from rules (Easter, "third Monday", weekend substitutes), so nothing needs updating yearly.
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const dow = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  const shiftDays = (y, m, d, n) => {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
  };
  const nthWeekday = (y, m, wd, n) => { // n = -1 for the last one in the month
    if (n > 0) return 1 + ((wd - dow(y, m, 1) + 7) % 7) + (n - 1) * 7;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return last - ((dow(y, m, last) - wd + 7) % 7);
  };
  const easter = (y) => { // Anonymous Gregorian algorithm
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
    return [Math.floor((h + l - 7 * mm + 114) / 31), ((h + l - 7 * mm + 114) % 31) + 1];
  };
  const isWeekday = (y, m, d) => { const w = dow(y, m, d); return w > 0 && w < 6; };

  const CALENDARS = {
    // NYSE: Sat holidays move to Fri (except New Year's), Sun to Mon. Early 1 p.m. closes.
    nyse(y) {
      const closed = new Set(), early = new Set();
      const add = (date) => date && closed.add(ymd(...date));
      const observed = (m, d, saturdayToFriday = true) => {
        const w = dow(y, m, d);
        if (w === 6) return saturdayToFriday ? shiftDays(y, m, d, -1) : null;
        if (w === 0) return shiftDays(y, m, d, 1);
        return [y, m, d];
      };
      const [em, ed] = easter(y);
      const thanksgiving = nthWeekday(y, 11, 4, 4);
      add(observed(1, 1, false));
      add([y, 1, nthWeekday(y, 1, 1, 3)]);
      add([y, 2, nthWeekday(y, 2, 1, 3)]);
      add(shiftDays(y, em, ed, -2));
      add([y, 5, nthWeekday(y, 5, 1, -1)]);
      add(observed(6, 19));
      add(observed(7, 4));
      add([y, 9, nthWeekday(y, 9, 1, 1)]);
      add([y, 11, thanksgiving]);
      add(observed(12, 25));
      if ([1, 2, 3, 4].includes(dow(y, 7, 3))) early.add(ymd(y, 7, 3));
      early.add(ymd(y, 11, thanksgiving + 1));
      if ([1, 2, 3, 4].includes(dow(y, 12, 24))) early.add(ymd(y, 12, 24));
      return { closed, early };
    },
    // Euronext: six fixed closing days, no substitutes. Early 14:05 closes on Dec 24 and 31.
    euronext(y) {
      const [em, ed] = easter(y);
      const closed = new Set([ymd(y, 1, 1), ymd(...shiftDays(y, em, ed, -2)), ymd(...shiftDays(y, em, ed, 1)), ymd(y, 5, 1), ymd(y, 12, 25), ymd(y, 12, 26)]);
      const early = new Set([24, 31].filter((d) => isWeekday(y, 12, d)).map((d) => ymd(y, 12, d)));
      return { closed, early };
    },
    // ASX: weekend New Year, Australia Day, Christmas and Boxing Day roll to the next weekday. Early 14:10 closes.
    asx(y) {
      const closed = new Set();
      const rollForward = (m, d) => {
        let date = [y, m, d];
        while (!isWeekday(...date) || closed.has(ymd(...date))) date = shiftDays(...date, 1);
        closed.add(ymd(...date));
      };
      const [em, ed] = easter(y);
      rollForward(1, 1);
      rollForward(1, 26);
      closed.add(ymd(...shiftDays(y, em, ed, -2)));
      closed.add(ymd(...shiftDays(y, em, ed, 1)));
      if (isWeekday(y, 4, 25)) closed.add(ymd(y, 4, 25));
      closed.add(ymd(y, 6, nthWeekday(y, 6, 1, 2)));
      rollForward(12, 25);
      rollForward(12, 26);
      const early = new Set([24, 31].filter((d) => isWeekday(y, 12, d) && !closed.has(ymd(y, 12, d))).map((d) => ymd(y, 12, d)));
      return { closed, early };
    },
  };

  const MARKETS = {
    us: { exchange: 'NYSE', city: 'New York', tz: 'America/New_York', zoneLocale: 'en-US', calendar: 'nyse', open: 570, close: 960, earlyClose: 780 },
    emea: { exchange: 'Euronext', city: 'Amsterdam', tz: 'Europe/Amsterdam', zoneLocale: 'en-GB', calendar: 'euronext', open: 540, close: 1050, earlyClose: 845 },
    apac: { exchange: 'ASX', city: 'Sydney', tz: 'Australia/Sydney', zoneLocale: 'en-AU', calendar: 'asx', open: 600, close: 960, earlyClose: 850 },
  };
  const calendarCache = new Map();
  const calendarFor = (id, y) => {
    const cacheKey = `${id}-${y}`;
    if (!calendarCache.has(cacheKey)) calendarCache.set(cacheKey, CALENDARS[id](y));
    return calendarCache.get(cacheKey);
  };
  const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Local wall-clock time in a zone -> the real instant (handles DST on both ends)
  const zoneOffsetMinutes = (date, tz) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((x) => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()) / 60000;
  };
  const zonedToInstant = (y, m, d, minutes, tz) => {
    const wall = Date.UTC(y, m - 1, d, 0, minutes);
    let t = wall;
    for (let i = 0; i < 2; i++) t = wall - zoneOffsetMinutes(new Date(t), tz) * 60000;
    return new Date(t);
  };

  function marketState(market, now) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: market.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((x) => [x.type, x.value]));
    const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    const session = (date) => {
      const { closed, early } = calendarFor(market.calendar, date[0]);
      const keyed = ymd(...date);
      if (!isWeekday(...date) || closed.has(keyed)) return null;
      return { open: market.open, close: early.has(keyed) ? market.earlyClose : market.close };
    };
    const today = session([y, m, d]);
    const isOpen = !!today && minutes >= today.open && minutes < today.close;
    let detail;
    if (isOpen) {
      detail = `open, closes ${hhmm(today.close)}`;
    } else if (today && minutes < today.open) {
      detail = `closed, opens ${hhmm(today.open)}`;
    } else {
      for (let n = 1; n <= 10; n++) {
        const date = shiftDays(y, m, d, n);
        const next = session(date);
        if (next) { detail = `closed, opens ${WEEKDAYS[dow(...date)]} ${hhmm(next.open)}`; break; }
      }
    }
    const zone = new Intl.DateTimeFormat(market.zoneLocale, { timeZone: market.tz, timeZoneName: 'short' })
      .formatToParts(now).find((x) => x.type === 'timeZoneName')?.value || '';
    // The session to draw on the ring: today's if it hasn't finished, otherwise the next one
    let span = null;
    for (let n = 0; n <= 10 && !span; n++) {
      const date = shiftDays(y, m, d, n);
      const s = session(date);
      if (!s || (n === 0 && minutes >= s.close)) continue;
      span = { start: zonedToInstant(...date, s.open, market.tz), end: zonedToInstant(...date, s.close, market.tz) };
    }
    return { isOpen, time: `${parts.hour}:${parts.minute}`, detail: detail || 'closed', zone, span };
  }

  // Minutes past midnight in Manhattan for an instant, as an angle on a 24-hour dial
  const nyDial = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dialAngle = (date) => {
    const p = Object.fromEntries(nyDial.formatToParts(date).map((x) => [x.type, x.value]));
    return ((Number(p.hour) * 60 + Number(p.minute)) / 1440) * 360;
  };
  const RING_C = 72;
  const polar = (r, deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [RING_C + r * Math.cos(a), RING_C + r * Math.sin(a)];
  };
  const arcPath = (r, from, to) => {
    let sweep = to - from;
    if (sweep <= 0) sweep += 360;
    const [x0, y0] = polar(r, from);
    const [x1, y1] = polar(r, from + sweep);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const marketEls = [...document.querySelectorAll('[data-market]')];
  const readout = $('mkt-readout');
  const rings = document.querySelector('.rings');
  if (marketEls.length && readout) {
    const states = {};
    let pinned = marketEls.find((b) => b.getAttribute('aria-pressed') === 'true') || marketEls[0];
    let shownText = '';
    const RING_NOTE = 'Rings: NYSE, Euronext, ASX sessions on a 24h Manhattan clock';
    const describe = (id) => `${MARKETS[id].exchange} · ${states[id].detail} ${states[id].zone}`;
    const setReadout = (text) => {
      if (text === shownText) return;
      shownText = text;
      readout.classList.add('is-swapping');
      setTimeout(() => { readout.textContent = shownText; readout.classList.remove('is-swapping'); }, 120);
    };
    const focusRing = (id) => {
      if (!rings) return;
      rings.classList.toggle('has-focus', !!id);
      rings.querySelectorAll('[data-ring]').forEach((g) => g.classList.toggle('is-focus', g.dataset.ring === id));
    };
    const show = (btn) => {
      marketEls.forEach((b) => b.classList.toggle('is-shown', b === btn && b !== pinned));
      setReadout(describe(btn.dataset.market));
      focusRing(btn === pinned && !btn.matches(':hover, :focus-visible') ? null : btn.dataset.market);
    };
    const reset = () => {
      marketEls.forEach((b) => b.classList.remove('is-shown'));
      setReadout(describe(pinned.dataset.market));
      focusRing(null);
    };

    const tick = () => {
      const now = new Date();
      for (const btn of marketEls) {
        const id = btn.dataset.market;
        const st = marketState(MARKETS[id], now);
        states[id] = st;
        btn.classList.toggle('is-open', st.isOpen);
        btn.querySelector('.mkt-time').textContent = st.time;
        btn.setAttribute('aria-label', `${MARKETS[id].city} ${st.time}, ${MARKETS[id].exchange} ${st.detail} ${st.zone}`);
        const ring = rings?.querySelector(`[data-ring="${id}"]`);
        if (ring && st.span) {
          const r = Number(ring.dataset.r);
          ring.querySelector('.ring-arc').setAttribute('d', arcPath(r, dialAngle(st.span.start), dialAngle(st.span.end)));
          ring.classList.toggle('is-open', st.isOpen);
        }
      }
      if (rings) {
        const a = dialAngle(now);
        const [x0, y0] = polar(51, a);
        const [x1, y1] = polar(70, a);
        const hand = rings.querySelector('.ring-now');
        hand.setAttribute('x1', x0.toFixed(2)); hand.setAttribute('y1', y0.toFixed(2));
        hand.setAttribute('x2', x1.toFixed(2)); hand.setAttribute('y2', y1.toFixed(2));
      }
      if (!shownText) { shownText = describe(pinned.dataset.market); readout.textContent = shownText; }
    };
    tick();
    setInterval(tick, 20000);
    if (rings) requestAnimationFrame(() => requestAnimationFrame(() => rings.classList.add('is-drawn')));

    for (const btn of marketEls) {
      btn.addEventListener('mouseenter', () => show(btn));
      btn.addEventListener('focus', () => show(btn));
      btn.addEventListener('click', () => {
        pinned = btn;
        marketEls.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        show(btn);
      });
    }
    // Leaving the row puts the pinned city (New York by default) back in the readout
    const row = marketEls[0].closest('.markets');
    row.addEventListener('mouseleave', reset);
    row.addEventListener('focusout', (e) => { if (!row.contains(e.relatedTarget)) reset(); });
    // Hovering the photo explains the rings
    const wrap = rings?.closest('.avatar-wrap');
    if (wrap) {
      wrap.addEventListener('mouseenter', () => setReadout(RING_NOTE));
      wrap.addEventListener('mouseleave', reset);
    }
  }

  // ---------- Coordinates: decode effect ----------
  // A fixed number of steps (not a time budget), so a busy or throttled tab plays the whole
  // effect instead of skipping to the end. The line is pre-scrambled while still invisible and
  // starts decoding the instant its fade-in begins, so it's moving from the first visible frame.
  const coords = $('coords');
  if (coords && !reduceMotion) {
    const finalText = coords.textContent;
    const chars = [...finalText];
    const DIGITS = '0123456789';
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const STEPS = 28;
    let timer = null;
    const scrambleFrom = (step) => chars.map((ch, i) => {
      if (i < Math.floor((step / STEPS) * chars.length)) return ch;
      if (/[0-9]/.test(ch)) return DIGITS[Math.floor(Math.random() * 10)];
      if (/[A-Za-z]/.test(ch)) return LETTERS[Math.floor(Math.random() * 26)];
      return ch;
    }).join('');
    const decode = () => {
      if (timer) return;
      let step = 0;
      const tickDecode = () => {
        step += 1;
        // Characters lock in left to right; the rest keep cycling
        coords.textContent = scrambleFrom(step);
        if (step < STEPS) timer = setTimeout(tickDecode, 42);
        else { coords.textContent = finalText; timer = null; }
      };
      tickDecode();
    };
    let started = false;
    const startOnce = () => { if (!started) { started = true; decode(); } };
    if (document.documentElement.classList.contains('motion')) {
      coords.textContent = scrambleFrom(0);
      coords.addEventListener('animationstart', startOnce, { once: true });
      setTimeout(startOnce, 900); // in case the fade-in never runs
    } else {
      startOnce();
    }
    coords.addEventListener('mouseenter', decode);
  }

  // ---------- Pricer ----------
  if ($('pricer')) {
    const sliders = {
      S: { el: $('s-spot'), out: $('v-spot'), show: (v) => v.toFixed(2), say: (v) => v.toFixed(2) },
      K: { el: $('s-strike'), out: $('v-strike'), show: (v) => v.toFixed(2), say: (v) => v.toFixed(2) },
      days: { el: $('s-days'), out: $('v-days'), show: (v) => `${v}d`, say: (v) => `${v} days` },
      vol: { el: $('s-vol'), out: $('v-vol'), show: (v) => `${v.toFixed(1)}%`, say: (v) => `${v.toFixed(1)} percent` },
      r: { el: $('s-rate'), out: $('v-rate'), show: (v) => minus(`${v.toFixed(2)}%`), say: (v) => `${v.toFixed(2)} percent` },
    };
    const readSliders = () => {
      const values = {};
      for (const [key, s] of Object.entries(sliders)) {
        const v = Number(s.el.value);
        values[key] = v;
        s.out.textContent = s.show(v);
        s.el.setAttribute('aria-valuetext', s.say(v));
        s.el.style.setProperty('--pct', `${((v - Number(s.el.min)) / (Number(s.el.max) - Number(s.el.min))) * 100}%`);
      }
      return values;
    };

    const W = 320, BASE = 100, TOP = 6, X0 = 50, X1 = 150, N = 100;
    const px = (x) => ((x - X0) / (X1 - X0)) * W;
    const drawCurve = (kind, S, K, T, sigma, r, spotValue) => {
      const xs = Array.from({ length: N + 1 }, (_, i) => X0 + ((X1 - X0) * i) / N);
      const value = xs.map((x) => blackScholes(x, K, T, sigma, r)[kind].price);
      const payoff = xs.map((x) => (kind === 'call' ? Math.max(x - K, 0) : Math.max(K - x, 0)));
      const yMax = Math.max(...value, ...payoff) * 1.08 || 1;
      const py = (y) => BASE - (y / yMax) * (BASE - TOP);
      const line = (ys) => ys.map((y, i) => `${i ? 'L' : 'M'}${px(xs[i]).toFixed(1)} ${py(y).toFixed(1)}`).join('');
      const valuePath = line(value);
      $('c-value').setAttribute('d', valuePath);
      $('c-area').setAttribute('d', `${valuePath}L${W} ${BASE}L0 ${BASE}Z`);
      $('c-payoff').setAttribute('d', line(payoff));
      const kx = px(K);
      $('c-strike').setAttribute('x1', kx);
      $('c-strike').setAttribute('x2', kx);
      $('c-strike-label').setAttribute('x', Math.min(Math.max(kx, 24), W - 30));
      $('c-strike-label').textContent = `K ${K}`;
      const sx = px(S), sy = py(spotValue);
      $('c-dot').setAttribute('cx', sx);
      $('c-dot').setAttribute('cy', sy);
      $('c-spot').setAttribute('x1', sx);
      $('c-spot').setAttribute('x2', sx);
      $('c-spot').setAttribute('y1', sy);
    };

    let last = null;
    let flashTimer, announceTimer;
    const update = () => {
      const kind = document.querySelector('input[name="kind"]:checked').value;
      const { S, K, days, vol, r } = readSliders();
      const T = days / 365, sigma = vol / 100, rate = r / 100;
      const res = blackScholes(S, K, T, sigma, rate);
      const leg = res[kind];
      const label = kind === 'call' ? 'Call value' : 'Put value';
      const price = $('q-price');
      const change = $('q-change');

      $('quote-label').textContent = label;
      price.textContent = fmt(leg.price);
      price.classList.remove('is-up', 'is-down');
      change.className = 'change';
      if (last && last.kind === kind) {
        const d = leg.price - last.price;
        if (Math.abs(d) < 5e-5) {
          change.textContent = 'unch';
        } else {
          const dir = d > 0 ? 'is-up' : 'is-down';
          change.textContent = `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}`;
          change.classList.add(dir);
          price.classList.add(dir);
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => price.classList.remove('is-up', 'is-down'), 500);
        }
      } else {
        change.textContent = 'per share';
      }
      last = { kind, price: leg.price };

      $('g-delta').textContent = fmt(leg.delta);
      $('g-gamma').textContent = fmt(res.gamma);
      $('g-vega').textContent = fmt(res.vega);
      $('g-theta').textContent = fmt(leg.theta);
      $('g-rho').textContent = fmt(leg.rho);
      const err = res.parityError === 0 ? '0' : res.parityError.toExponential(1).replace('e-', 'e−');
      $('parity').innerHTML = `Put–call parity holds to <span class="is-up">${err}</span>.`;

      drawCurve(kind, S, K, T, sigma, rate, leg.price);
      clearTimeout(announceTimer);
      announceTimer = setTimeout(() => { $('pricer-status').textContent = `${label} ${fmt(leg.price)}`; }, 600);
    };
    $('pricer').addEventListener('input', update);
    update();
  }

  // ---------- Sidebar (home, wide screens) ----------
  // The hero and pricer stick beside the flow. They're usually taller than the window, so the sidebar
  // sticks with its bottom edge in view (a negative top) rather than its top, keeping the pricer reachable.
  const side = document.querySelector('.side');
  const sideIsSticky = () => !!side && getComputedStyle(side).position === 'sticky';
  if (side) {
    const place = () => side.style.setProperty('--side-top', `${Math.min(0, innerHeight - side.offsetHeight)}px`);
    if ('ResizeObserver' in window) new ResizeObserver(place).observe(side);
    addEventListener('resize', place);
    place();
  }
  const inStickySide = (node) => sideIsSticky() && side.contains(node);

  // Scroll to a section. Something in the sticky sidebar has no fixed place on the page, so going to
  // it means scrolling just far enough for the sidebar's bottom to come into view.
  const goTo = (target, behavior) => {
    if (target && inStickySide(target)) {
      const need = side.offsetHeight - innerHeight;
      if (need > 0 && scrollY < need) scrollTo({ top: need, behavior });
      return;
    }
    if (target) target.scrollIntoView({ behavior });
    else scrollTo({ top: 0, behavior });
  };

  // ---------- Nav: current section on the home page + number-key shortcuts everywhere ----------
  const links = [...document.querySelectorAll('a.nav-link')];   // the theme toggle is a button, not a section link
  if (document.body.dataset.page === 'home') {
    const sections = links.map((a) => (a.hash && a.hash !== '#top' ? document.querySelector(a.hash) : null));
    const markCurrent = () => {
      const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      let current = 0;
      sections.forEach((sec, i) => {
        if (sec && !inStickySide(sec) && sec.getBoundingClientRect().top <= innerHeight * 0.4) current = i;
      });
      if (atBottom) current = links.length - 1;
      links.forEach((a, i) => {
        if (i === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    };
    addEventListener('scroll', markCurrent, { passive: true });
    markCurrent();
    links.forEach((a, i) => a.addEventListener('click', (e) => {
      if (!inStickySide(sections[i])) return;
      e.preventDefault();
      goTo(sections[i], reduceMotion ? 'auto' : 'smooth');
    }));
  }

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); toggleTheme(); return; }
    const link = links.find((a) => a.dataset.key === e.key);
    if (!link) return;
    e.preventDefault();
    const url = new URL(link.href);
    if (url.pathname !== location.pathname) { location.href = link.href; return; }
    const target = url.hash && url.hash !== '#top' ? document.querySelector(url.hash) : null;
    goTo(target, reduceMotion ? 'auto' : 'smooth');
  });
})();
