/* The Stash bloom: a lit 3D flower drawn in characters.
   Petals are agents; the seed head is Stash.
   Each petal fires on its own clock. Its pulse runs down the petal as one band of light and, the moment
   it lands, the seed head brightens and fills a little more. When the seed head is full it sends light
   back out along every petal at once. */
(function () {
  const RAMP = ' .:-=+*#%@';
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  function Bloom(fig, opts = {}) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 6.5, CH = 11.5, P = 8;

    // petals: rounded, widest past the middle, narrow at the base, cupped across and lifted at the tip
    // point: [x, y, z, nx, ny, nz, petal, t (0 base to 1 tip), kind 0, u (-1..1 across)]
    const pts = [], angle = [];
    const R0 = 0.31, R1 = 1.0, W = 0.175, PEAK = 0.64;
    for (let p = 0; p < P; p++) {
      const a = (p / P) * Math.PI * 2 - Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
      angle.push(a);
      for (let ti = 0; ti <= 56; ti++) for (let ui = 0; ui <= 22; ui++) {
        const t = ti / 56, u = (ui / 22) * 2 - 1;
        const tp = t < PEAK ? (t / PEAK) * 0.5 : 0.5 + ((t - PEAK) / (1 - PEAK)) * 0.5;
        const half = W * Math.sqrt(Math.max(0, 1 - (2 * tp - 1) ** 2)) * (0.55 + 0.45 * Math.min(1, t / 0.25));
        const rad = R0 + t * (R1 - R0), tan = u * half;
        const z = -0.22 * t * t - 0.13 * (1 - u * u) * (half / W) + 0.02;
        const dzdr = -0.44 * t / (R1 - R0), dzdu = 0.26 * u * (half / W) / Math.max(0.03, half);
        const nl = norm([dzdr * 1.3, dzdu * 1.1, -1]);
        pts.push([rad * ca - tan * sa, rad * sa + tan * ca, z, nl[0] * ca - nl[1] * sa, nl[0] * sa + nl[1] * ca, nl[2], p, t, 0, u]);
      }
    }
    // seed head: phyllotaxis dome, lit in index order (center outward)
    const SEEDS = 1500, RS = 0.24;
    for (let i = 0; i < SEEDS; i++) {
      const r = RS * Math.sqrt((i + 0.5) / SEEDS), th = i * 2.399963229728653, x = r * Math.cos(th), y = r * Math.sin(th);
      const n = norm([0.3 * x / (RS * RS), 0.3 * y / (RS * RS), -1]);
      pts.push([x, y, -0.15 * (1 - (r / RS) ** 2) - 0.09, n[0], n[1], n[2], -1, i / SEEDS, 1, 0]);
    }

    // living state
    let E = 0.25, flash = 0, outward = null;
    const pulses = [], nextFire = [], petalGlow = new Float32Array(P);
    for (let p = 0; p < P; p++) nextFire.push(400 + Math.random() * 3200);
    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, paused = false, spin = 0, clock = 0, tilt = 0, tiltT = 0, yaw = 0, yawT = 0;
    const Lgt = norm([-0.35, -0.5, -0.8]);

    function size() { const b = fig.getBoundingClientRect(); w = b.width; h = b.height; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(w / CW); rows = Math.ceil(h / CH); }

    function step(dt) {
      clock += dt;
      // petals fire inward on their own clocks
      for (let p = 0; p < P; p++) if (!outward && clock > nextFire[p]) { pulses.push({ p, c: 1.05 }); nextFire[p] = clock + 1500 + Math.random() * 3200; }
      for (const q of pulses) {
        q.c -= dt / 1100;
        if (q.c <= -0.02) { q.done = true; E = Math.min(1, E + 0.085); flash = 1; }
      }
      for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].done) pulses.splice(i, 1);
      // when the seed head is full, it sends light back out along every petal
      if (!outward && E >= 0.98) { outward = { c: -0.05 }; pulses.length = 0; }
      if (outward) {
        outward.c += dt / 1300; E = Math.max(0.35, E - dt / 2600);
        if (outward.c > 1.1) { outward = null; for (let p = 0; p < P; p++) { petalGlow[p] = 1; nextFire[p] = clock + 600 + Math.random() * 2400; } }
      }
      E = Math.max(0.15, E - dt / 60000);
      flash *= Math.pow(0.9, dt / 33);
      for (let p = 0; p < P; p++) petalGlow[p] *= Math.pow(0.985, dt / 33);
    }

    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      if (!paused && !reduce) { step(dt); spin += dt * (Math.PI * 2) / 120000; }
      if (reduce) E = 0.75;
      tilt += (tiltT - tilt) * 0.08; yaw += (yawT - yaw) * 0.08;

      const scale = Math.min(w, h) * 0.5 * (opts.zoom || 1), ox = w * (opts.cx ?? 0.5), oy = h * (opts.cy ?? 0.5);
      const cs = Math.cos(spin), sn = Math.sin(spin), pit = (opts.pitch ?? 0.38) + tilt, cp = Math.cos(pit), sp = Math.sin(pit), cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const rot = (x, y, z) => { const x1 = x * cs - y * sn, y1 = x * sn + y * cs, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; return [x1 * cyw + z2 * syw, y2, -x1 * syw + z2 * cyw]; };
      const N = cols * rows, zb = new Float32Array(N).fill(9), lum = new Float32Array(N), lime = new Uint8Array(N);
      const band = new Float32Array(P); // strongest pulse position per petal, looked up per point
      const lit = E * SEEDS;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i];
        const [vx, vy, vz] = rot(q[0], q[1], q[2]), n = rot(q[3], q[4], q[5]);
        const persp = 3 / (3 + vz), X = ox + vx * scale * persp, Y = oy + vy * scale * persp;
        const c = Math.floor(X / CW), r = Math.floor(Y / CH);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const idx = r * cols + c;
        if (vz >= zb[idx]) continue;
        zb[idx] = vz;
        const dl = Math.abs(n[0] * Lgt[0] + n[1] * Lgt[1] + n[2] * Lgt[2]);
        let l, lt = 0;
        if (q[8] === 0) {
          const t = q[7], u = Math.abs(q[9]);
          let s = 0;
          for (const p of pulses) if (p.p === q[6]) s = Math.max(s, Math.exp(-((t - p.c) ** 2) / 0.012));
          if (outward) s = Math.max(s, Math.exp(-((t - outward.c) ** 2) / 0.012));
          l = 0.06 + dl * 0.78 + s * 0.45 + petalGlow[q[6]] * 0.12;
          lt = s > 0.55 ? 1 : 0;
        } else {
          const k = q[7] * SEEDS, isLit = k < lit;
          l = isLit ? 0.5 + dl * 0.38 + flash * 0.25 + (outward ? 0.12 : 0) : 0.12 + dl * 0.22;
          lt = isLit && (k > lit - 45 || flash > 0.55) ? 1 : 0;
        }
        lum[idx] = Math.min(1, l); lime[idx] = lt;
      }
      ctx.clearRect(0, 0, w, h); ctx.font = `400 11px ${C.face}`; ctx.textBaseline = 'top';
      for (let i = 0; i < N; i++) {
        if (zb[i] === 9) continue;
        const l = lum[i];
        ctx.fillStyle = lime[i] ? C.lime : l > 0.66 ? C.hi : l > 0.38 ? C.mid : C.lo;
        ctx.globalAlpha = lime[i] ? 1 : 0.35 + l * 0.65;
        ctx.fillText(RAMP[Math.max(1, Math.min(9, Math.round(l * 9)))], (i % cols) * CW, Math.floor(i / cols) * CH);
      }
      ctx.globalAlpha = 1;
      if (on && !reduce && !paused) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    fig.addEventListener('pointermove', (e) => { const b = fig.getBoundingClientRect(); tiltT = ((e.clientY - b.top) / b.height - 0.5) * 0.22; yawT = ((e.clientX - b.left) / b.width - 0.5) * 0.3; kick(); });
    fig.addEventListener('pointerleave', () => { tiltT = 0; yawT = 0; kick(); });
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });
    return { kick, pause(v) { paused = v; kick(); } };
  }
  window.StashBloom = Bloom;
})();
