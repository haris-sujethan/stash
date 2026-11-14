/* The Stash flower, drawn in characters.
   The center is Stash: one shared memory. Each petal is an agent session.
   A push sends pulses from a petal into the center; a pull sends them back out and lights the petals. */
(function () {
  const RAMP = ' .:-+*#%@';
  function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

  function Flower(fig, opts = {}) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 9, CH = 15, P = opts.petals || 7, r = rng(opts.seed || 3);

    // geometry: [x, y, z, petal (-1 is the center), t along the petal, ring flag]
    const pts = [];
    for (let i = 0; i < 900; i++) { const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), rad = 0.2 * Math.cbrt(r()); pts.push([rad * Math.sin(v) * Math.cos(u), rad * Math.sin(v) * Math.sin(u), rad * Math.cos(v) * 0.6, -1, 0, 0]); }
    for (let p = 0; p < P; p++) {
      const a = (p / P) * Math.PI * 2 - Math.PI / 2;
      for (let i = 0; i < 650; i++) {
        const t = Math.pow(r(), 0.85), w = 0.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02 + 0.02)), 0.75), u = (r() * 2 - 1);
        const s = 0.26 + t * 0.74, x = Math.cos(a) * s - Math.sin(a) * w * u, y = Math.sin(a) * s + Math.cos(a) * w * u;
        pts.push([x, y, -0.3 * t * t + (r() - 0.5) * 0.04, p, t, 0]);
      }
    }
    for (let i = 0; i < 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push([Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0, -1, 0, 1]); }
    const petalAngle = (p) => (p / P) * Math.PI * 2 - Math.PI / 2;

    // state, eased toward targets so scenes change smoothly
    const st = { sep: 0, sepT: 0, core: 1, coreT: 1, ring: 0, ringT: 0, E: 0.2, petal: new Float32Array(P), hidden: new Float32Array(P) };
    let pulses = [], spin = 0, tilt = 0, tiltT = 0, yawP = 0, yawT = 0, w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, paused = false;
    let mode = opts.mode || 'live', hoverPetal = -2, lastEmit = 0, nextAmbient = 0, nextPull = 0, scale = 1;
    const listeners = [];

    function size() { const b = fig.getBoundingClientRect(); w = b.width; h = b.height; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(w / CW); rows = Math.ceil(h / CH); }
    function emit(petal, dir, lime) { if (st.hidden[petal] > 0.5 && dir < 0) return; pulses.push({ petal, dir, t: dir < 0 ? 1 : 0, speed: 0.012 + Math.random() * 0.004, lime: lime || dir > 0 || mode === 'merge' }); }
    const push = (p) => emit(p, -1);
    const pull = (p) => (p == null ? [...Array(P).keys()].forEach((q) => emit(q, 1)) : emit(p, 1));

    function setMode(m) {
      mode = m;
      st.sepT = m === 'apart' ? 1 : 0;
      st.coreT = m === 'apart' ? 0 : 1;
      st.ringT = m === 'guard' ? 1 : 0;
      if (m === 'apart') { pulses = []; st.E = 0; }
      nextAmbient = 0; nextPull = 0; kick();
    }

    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      const k = reduce ? 1 : 0.06;
      st.sep += (st.sepT - st.sep) * k; st.core += (st.coreT - st.core) * k; st.ring += (st.ringT - st.ring) * k;
      tilt += (tiltT - tilt) * 0.1; yawP += (yawT - yawP) * 0.1;
      if (!paused && !reduce) spin += dt * (Math.PI * 2) / 140000;

      // scene scripts
      if (!paused && !reduce && now > nextAmbient) {
        if (mode === 'live' || mode === 'push') push(Math.floor(Math.random() * P));
        if (mode === 'merge') { push(1); push(1 + Math.floor(P / 2)); }
        nextAmbient = now + (mode === 'merge' ? 900 : mode === 'push' ? 700 : 1800);
      }
      if (!paused && !reduce && now > nextPull && (mode === 'live' || mode === 'pull' || mode === 'guard')) { pull(); nextPull = now + (mode === 'live' ? 7000 : 2600); }
      if (hoverPetal >= 0 && now - lastEmit > 320) { push(hoverPetal); lastEmit = now; }

      // pulses
      for (const q of pulses) {
        if (paused) break;
        q.t += q.dir * q.speed * (dt / 33) * (reduce ? 0 : 1);
        if (q.dir < 0 && q.t <= 0) { q.done = true; st.E = Math.min(1, st.E + 0.22); listeners.forEach((f) => f('push', q.petal)); }
        if (q.dir > 0 && q.t >= 1) { q.done = true; st.petal[q.petal] = 1; listeners.forEach((f) => f('pull', q.petal)); }
      }
      pulses = pulses.filter((q) => !q.done);
      st.E *= 0.985; for (let p = 0; p < P; p++) st.petal[p] *= 0.975;

      // project and bin
      scale = Math.min(w, h) * 0.46 * (opts.zoom || 1);
      const ox = w / 2, oy = h * (opts.cy ?? 0.5), cs = Math.cos(spin), sn = Math.sin(spin);
      const pitch = (opts.pitch ?? 0.25) + tilt, cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yawP), sy = Math.sin(yawP);
      const proj = (x, y, z) => { const x1 = x * cs - y * sn, y1 = x * sn + y * cs; const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; const x3 = x1 * cy + z2 * sy, z3 = -x1 * sy + z2 * cy; return [ox + x3 * scale, oy + y2 * scale, z3]; };
      const N = cols * rows, count = new Uint8Array(N), zb = new Float32Array(N).fill(9), tone = new Float32Array(N), lime = new Uint8Array(N), owner = new Int8Array(N).fill(-3);
      const put = (X, Y, Z, tn, isLime, who) => { const c = Math.floor(X / CW), rr = Math.floor(Y / CH); if (c < 0 || rr < 0 || c >= cols || rr >= rows) return; const i = rr * cols + c; if (count[i] < 255) count[i]++; if (isLime) lime[i] = 1; if (Z < zb[i]) { zb[i] = Z; tone[i] = tn; owner[i] = who; } };
      for (const [x0, y0, z0, p, t, ring] of pts) {
        let x = x0, y = y0, z = z0;
        if (p === -1) {
          if (ring) { if (st.ring < 0.05) continue; put(...proj(x * (0.6 + 0.4 * st.ring), y * (0.6 + 0.4 * st.ring), z), 1, true, -1); continue; }
          if (st.core < 0.03) continue; x *= st.core; y *= st.core; z *= st.core;
          put(...proj(x, y, z), 0.45 + st.E * 0.55, false, -1);
        } else {
          if (st.hidden[p] > 0.5) continue;
          const a = petalAngle(p), out = st.sep * (0.55 + (p % 3) * 0.12);
          x += Math.cos(a) * out; y += Math.sin(a) * out; z += st.sep * ((p % 2) - 0.5) * 0.4;
          put(...proj(x, y, z), 0.25 + t * 0.35 + st.petal[p] * 0.5, false, p);
        }
      }
      for (const q of pulses) {
        const a = petalAngle(q.petal);
        for (let j = 0; j < 7; j++) {
          const t = q.t - q.dir * j * 0.025; if (t < 0 || t > 1) continue;
          const s = 0.24 + t * 0.74 + st.sep * 0.6, wob = (j % 2 ? 1 : -1) * 0.018 * j;
          put(...proj(Math.cos(a) * s - Math.sin(a) * wob, Math.sin(a) * s + Math.cos(a) * wob, -0.3 * t * t - 0.02), 1, j < 4 && q.lime, q.petal);
        }
      }

      ctx.clearRect(0, 0, w, h); ctx.font = `400 13px ${C.face}`; ctx.textBaseline = 'top';
      for (let i = 0; i < N; i++) {
        if (!count[i]) continue;
        const tn = tone[i], hot = owner[i] >= 0 && owner[i] === hoverPetal;
        ctx.fillStyle = lime[i] ? C.lime : tn > 0.7 || hot ? C.hi : tn > 0.42 ? C.mid : C.lo;
        ctx.globalAlpha = lime[i] ? 1 : 0.35 + Math.min(1, tn) * 0.65;
        ctx.fillText(RAMP[Math.min(8, Math.ceil(count[i] / 1.6) + (tn > 0.75 ? 1 : 0) + (lime[i] ? 2 : 0))], (i % cols) * CW, Math.floor(i / cols) * CH);
      }
      ctx.globalAlpha = 1;
      fig._owner = owner; fig._cols = cols;
      const busy = !reduce && on && (!paused || pulses.length || Math.abs(st.sepT - st.sep) > 0.002 || Math.abs(st.coreT - st.core) > 0.002 || Math.abs(st.ringT - st.ring) > 0.002);
      if (busy) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    function petalAt(x, y) {
      const o = fig._owner; if (!o) return -2;
      const c = Math.floor(x / CW), rr = Math.floor(y / CH);
      for (let d = 0; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const i = (rr + dy) * fig._cols + (c + dx); if (o[i] !== undefined && o[i] > -3) return o[i]; }
      return -2;
    }
    if (opts.interactive !== false) {
      fig.addEventListener('pointermove', (e) => { const b = fig.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; tiltT = (y / h - 0.5) * 0.3; yawT = (x / w - 0.5) * 0.3; hoverPetal = petalAt(x, y); fig.style.cursor = hoverPetal >= -1 ? 'pointer' : ''; kick(); });
      fig.addEventListener('pointerleave', () => { tiltT = yawT = 0; hoverPetal = -2; kick(); });
      fig.addEventListener('click', (e) => { const b = fig.getBoundingClientRect(), p = petalAt(e.clientX - b.left, e.clientY - b.top); if (p === -1) pull(); else if (p >= 0) { push(p); setTimeout(() => push(p), 140); } kick(); });
    }
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });

    return {
      setMode, push, pull, kick,
      pause(v) { paused = v; kick(); },
      on(fn) { listeners.push(fn); },
    };
  }
  window.StashFlower = Flower;
})();
