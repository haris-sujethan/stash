/* Stash memory cloud: one ASCII engine shared by the Vantage variations.
   Every point is a memory with a 3D position. Memories about the same topic sit close together,
   the way Atlas Vector Search places them by meaning. Pages decide what is lit, hidden or moving. */
(function () {
  const TOPICS = [
    { id: 'auth', label: 'auth refresh' },
    { id: 'cache', label: 'session cache' },
    { id: 'db', label: 'database' },
    { id: 'client', label: 'generated client' },
    { id: 'rate', label: 'rate limits' },
    { id: 'build', label: 'build and CI' },
  ];
  const TYPES = ['decision', 'discovery', 'failed approach', 'constraint', 'open question'];
  const TEXT = {
    auth: ['Lock token refresh behind a mutex', 'Refresh fires twice under load', 'Retrying refresh on a 401 made it worse', 'Access tokens expire after 15 minutes', 'Can two tabs refresh at the same time?'],
    cache: ['Invalidate the session cache on logout', 'The cache serves a session after it expires', 'A shorter TTL did not stop stale reads', 'The cache must survive a restart', 'Does the stale cache explain path two?'],
    db: ['Add an index on users.email', 'The login query does a full table scan', 'Raising the db timeout changed nothing', 'Production runs Postgres 15', 'Is the pool too small at peak?'],
    client: ['Change schema/api.yaml, then regenerate', 'The build regenerates the client from the schema', 'Hand edits to generated.ts were overwritten', 'Generated files are rebuilt on every build', 'Should the generator run in CI?'],
    rate: ['Back off and retry after HTTP 429', 'The API allows 60 requests a minute', 'The batch import hit HTTP 429', 'Imports must stay under 60 requests a minute', 'Does the API accept batch requests?'],
    build: ['Run the auth tests on every push', 'CI caches node_modules by lockfile', 'Skipping the auth tests hid the race', 'The project must support Node 22', 'Why is CI slower on Mondays?'],
  };
  const STATUS = ['hypothesis', 'evidenced', 'verified'];
  const RAMP = ' .:-+*#%@';

  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const gauss = (r) => (r() + r() + r() + r() - 2) * 0.87;
  const sessionId = (i) => 'ses_' + ((i * 7919 + 40933) * 2654435761 % 60466176).toString(36).padStart(5, '0').slice(-5);

  function ring(radius = 0.62, lift = 0.14) {
    const out = {};
    TOPICS.forEach((t, i) => { const a = (i / TOPICS.length) * Math.PI * 2; out[t.id] = [Math.cos(a) * radius, i % 2 ? lift : -lift, Math.sin(a) * radius]; });
    return out;
  }

  function memory(r, topic, type, center, spread, sessionIndex) {
    return {
      topic, type, text: TEXT[topic][type], kind: TYPES[type],
      status: STATUS[r() < 0.5 ? 1 : r() < 0.85 ? 0 : 2],
      session: sessionId(sessionIndex), event: 'e_' + (100 + Math.floor(r() * 900)),
      pos: [center[0] + gauss(r) * spread, center[1] + gauss(r) * spread * 0.75, center[2] + gauss(r) * spread],
    };
  }

  function memories({ n = 1200, seed = 11, spread = 0.16, centers = ring(), sessions = 40, topics = null } = {}) {
    const r = rng(seed), ids = topics || TOPICS.map((t) => t.id), out = [];
    for (let i = 0; i < n; i++) {
      const topic = ids[Math.floor(r() * ids.length)], type = Math.floor(r() * 5);
      out.push(Object.assign(memory(r, topic, type, centers[topic], spread, Math.floor(r() * sessions)), { i }));
    }
    return out;
  }

  function scene(fig, o) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d'), call = fig.querySelector('.callout');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), ink: tok('--color-ink'), ink2: tok('--color-ink-2'), muted: tok('--color-muted'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = o.cw || 9, CH = o.ch || 15, splat = o.splat || 1, splatR = o.splatR || 0.03;
    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true;
    let yaw = o.yaw ?? 0.3, tilt = 0, tiltT = 0, px = -1e4, py = -1e4, hover = -1, scale = 1;
    let sx = new Float32Array(0), sy = new Float32Array(0), live = new Uint8Array(0);
    const jit = []; { const r = rng(97); for (let k = 0; k < 64; k++) jit.push([gauss(r) * splatR, gauss(r) * splatR * 0.8, gauss(r) * splatR]); }

    function size() {
      const b = fig.getBoundingClientRect(); w = b.width; h = b.height;
      const d = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0);
      cols = Math.ceil(w / CW); rows = Math.ceil(h / CH);
    }
    function project(x, y, z) {
      const cy = Math.cos(yaw), sy0 = Math.sin(yaw), p = (o.pitch ?? 0.35) + tilt, cp = Math.cos(p), sp = Math.sin(p);
      const x1 = x * cy - z * sy0, z1 = x * sy0 + z * cy, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      return [w * (o.cx ?? 0.5) + x1 * scale, h * (o.cy ?? 0.5) + y1 * scale, z2];
    }
    function describe(m) { return o.describe ? o.describe(m) : { title: m.text, meta: [m.kind, m.status, m.session, m.event] }; }
    function placeCallout(i, X, Y) {
      if (!call) return;
      if (i < 0) { call.classList.remove('is-on'); return; }
      const d = describe(o.points()[i]);
      call.querySelector('strong').textContent = d.title;
      call.querySelector('.callout__meta').innerHTML = d.meta.map((t) => `<span>${t}</span>`).join('');
      const left = X > w * 0.55, bw = call.querySelector('.callout__box').offsetWidth + 48;
      call.classList.toggle('is-left', left);
      const x = left ? X - bw + 3 : X - 3, y = Math.min(Math.max(Y - 4, 8), h - call.offsetHeight - 8);
      call.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      call.classList.add('is-on');
    }

    function frame(now) {
      raf = 0;
      const moving = !reduce && ((o.period && hover < 0) || (o.animating && o.animating(now)) || Math.abs(tiltT - tilt) > 0.002);
      if (moving && now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 16; last = now;
      if (!reduce && o.period && hover < 0) yaw += (dt * Math.PI * 2) / o.period;
      tilt += (tiltT - tilt) * (reduce ? 1 : 0.12);
      scale = Math.min(w / (o.fitW || 1.9), h / (o.fitH || 1.3)) * (o.zoom || 1);
      const pts = o.points(), n = pts.length;
      if (sx.length < n) { sx = new Float32Array(n); sy = new Float32Array(n); live = new Uint8Array(n); }
      const N = cols * rows, count = new Uint8Array(N), zb = new Float32Array(N).fill(-9), top = new Int32Array(N).fill(-1);
      const lit = new Uint8Array(N), flash = new Uint8Array(N), bright = new Uint8Array(N), tone = new Float32Array(N);
      for (let i = 0; i < n; i++) {
        const m = pts[i];
        if (o.hidden && o.hidden(m, now)) { live[i] = 0; continue; }
        let [x, y, z] = m.pos;
        if (o.offset) { const d = o.offset(m, now); if (d) { x += d[0]; y += d[1]; z += d[2]; } }
        const dimmed = o.dim ? o.dim(m, now) : false;
        for (let k = 0; k < splat; k++) {
          const j = splat > 1 ? jit[(i * 7 + k) % jit.length] : [0, 0, 0];
          const [X, Y, Z] = project(x + j[0], y + j[1], z + j[2]);
          if (k === 0) { sx[i] = X; sy[i] = Y; live[i] = dimmed ? 2 : o.noHover && o.noHover(m) ? 3 : 1; }
          const c = Math.floor(X / CW), r = Math.floor(Y / CH);
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const idx = r * cols + c;
          if (count[idx] < 255) count[idx]++;
          if (o.lit && o.lit(m, now, X)) lit[idx] = 1;
          if (o.flash && o.flash(m, now, X)) flash[idx] = 1;
          if (!dimmed) bright[idx] = 1;
          if (Z > zb[idx]) { zb[idx] = Z; top[idx] = i; tone[idx] = o.tone ? o.tone(m) : (Z + 1.1) / 2.2; }
        }
      }
      ctx.clearRect(0, 0, w, h); ctx.font = `400 13px ${C.face}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      for (let idx = 0; idx < N; idx++) {
        if (!count[idx]) continue;
        const t = Math.min(1, Math.max(0, tone[idx]));
        const isHover = hover >= 0 && top[idx] === hover;
        const dens = Math.ceil(count[idx] / (o.densDiv || Math.max(1, splat * 0.6)));
        const ch = isHover ? '@' : RAMP[Math.min(7, dens + (lit[idx] || flash[idx] ? 2 : 0) + (t > 0.7 ? 1 : 0))];
        ctx.globalAlpha = lit[idx] || flash[idx] || isHover ? 1 : bright[idx] ? 0.3 + t * 0.7 : 0.14;
        ctx.fillStyle = lit[idx] || isHover ? C.lime : flash[idx] ? C.hi : t > 0.66 ? C.hi : t > 0.33 ? C.mid : C.lo;
        ctx.fillText(ch, (idx % cols) * CW, Math.floor(idx / cols) * CH);
      }
      ctx.globalAlpha = 1;
      if (o.labels) {
        ctx.font = `400 13px ${C.face}`; ctx.textAlign = 'center';
        for (const l of o.labels(now)) {
          const [X, Y] = project(l.pos[0], l.pos[1], l.pos[2]);
          ctx.fillStyle = l.lime ? C.lime : C.ink2; ctx.globalAlpha = l.quiet ? 0.55 : 1;
          ctx.fillText(l.text, X, Y - (l.lift ?? 0.26) * scale);
        }
        ctx.globalAlpha = 1; ctx.textAlign = 'left';
      }
      if (o.after) o.after(ctx, project, now, { w, h, scale, C });
      // hover, or a pinned memory the page wants explained
      let best = -1, bd = 18;
      if (px > -1e3) for (let i = 0; i < n; i++) { if (live[i] !== 1) continue; const d = Math.hypot(sx[i] - px, sy[i] - py); if (d < bd) { bd = d; best = i; } }
      if (best !== hover) { hover = best; }
      const pin = hover >= 0 ? hover : o.pin ? o.pin(now) : -1;
      if (pin >= 0 && live[pin]) placeCallout(pin, sx[pin], sy[pin]); else placeCallout(-1);
      if (!reduce && on && ((o.period && hover < 0) || (o.animating && o.animating(now)) || Math.abs(tiltT - tilt) > 0.002)) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    fig.addEventListener('pointermove', (e) => { const b = fig.getBoundingClientRect(); px = e.clientX - b.left; py = e.clientY - b.top; tiltT = (py / h - 0.5) * (o.tiltRange ?? 0.3); kick(); });
    fig.addEventListener('pointerleave', () => { px = py = -1e4; hover = -1; tiltT = 0; kick(); });
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });
    return { kick, project: (p) => project(p[0], p[1], p[2]), get hover() { return hover; } };
  }

  window.StashCloud = { TOPICS, TYPES, TEXT, STATUS, rng, ring, memories, sessionId, scene };
})();
