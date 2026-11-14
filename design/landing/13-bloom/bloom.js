/* The Stash bloom: a lit 3D flower drawn in characters.
   Petals are agents. The seed head in the middle is Stash.
   Pushing streams light down every petal at once and the seed head fills, seed by seed, in a spiral.
   Pulling streams it back out to the petal tips. One synchronised loop. */
(function () {
  const RAMP = ' .:-=+*#%@';
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function Bloom(fig, opts = {}) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 8, CH = 14;

    // petals: [x, y, z, nx, ny, nz, petal id, t along the petal, kind 0]
    const pts = [];
    const LAYERS = [
      { n: 8, r0: 0.32, r1: 1.0, W: 0.135, z0: 0.02, off: 0, curl: 0.24 },
      { n: 8, r0: 0.29, r1: 0.7, W: 0.1, z0: -0.07, off: 0.5, curl: 0.3 },
    ];
    let pid = 0;
    const petalAngle = [];
    for (const L of LAYERS) for (let p = 0; p < L.n; p++, pid++) {
      const ang = ((p + L.off) / L.n) * Math.PI * 2 - Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang), len = L.r1 - L.r0;
      petalAngle.push(ang);
      for (let ti = 0; ti <= 36; ti++) for (let ui = 0; ui <= 16; ui++) {
        const t = ti / 36, u = (ui / 16) * 2 - 1;
        const half = L.W * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.85);
        const rad = L.r0 + t * len, tan = u * half;
        const z = L.z0 - L.curl * t * t * 0.55 - 0.05 * u * u * (half / L.W);
        const dzdr = (-L.curl * 1.1 * t) / len, dzdu = -0.1 * u / Math.max(0.02, L.W);
        const nl = norm([dzdr, dzdu, -1]);
        const x = rad * ca - tan * sa, y = rad * sa + tan * ca;
        const nx = nl[0] * ca - nl[1] * sa, ny = nl[0] * sa + nl[1] * ca;
        pts.push([x, y, z, nx, ny, nl[2], pid, t, 0, u]);
      }
    }
    const PETALS = pid;
    // seed head: phyllotaxis, filled in index order (center outward)
    const SEEDS = 1000, R = 0.24, seedStart = pts.length;
    for (let i = 0; i < SEEDS; i++) {
      const r = R * Math.sqrt((i + 0.5) / SEEDS), th = i * 2.399963229728653, x = r * Math.cos(th), y = r * Math.sin(th);
      const z = -0.14 * (1 - (r / R) ** 2) - 0.1;
      const n = norm([0.28 * x / (R * R), 0.28 * y / (R * R), -1]);
      pts.push([x, y, z, n[0], n[1], n[2], -1, i / SEEDS, 1]);
    }
    // guardrail ring
    for (let i = 0; i < 640; i++) { const b = (i / 640) * Math.PI * 2, a = i * 0.9; const rr = 0.33 + 0.02 * Math.cos(a); pts.push([Math.cos(b) * rr, Math.sin(b) * rr, -0.1 + 0.02 * Math.sin(a), Math.cos(b) * Math.cos(a), Math.sin(b) * Math.cos(a), -Math.abs(Math.sin(a)) - 0.4, -2, 0, 2]); }

    const S = { sep: 0, cx: opts.cx ?? 0.5, cy: opts.cy ?? 0.5, zoom: opts.zoom ?? 1, pitch: 0.32, ring: 0, glow: 0 };
    let T = { ...S }, scene = opts.scene || 'live', F = 0.15, Ft = 0.15, petalGlow = 0, clock = 0, sceneClock = 0;
    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, paused = false, spin = 0, tilt = 0, tiltT = 0, yaw = 0, yawT = 0;
    const Lgt = norm([-0.45, -0.6, -0.66]);

    function size() { const b = fig.getBoundingClientRect(); w = b.width; h = b.height; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(w / CW); rows = Math.ceil(h / CH); }
    function set(name, layout) { scene = name; sceneClock = 0; T = { ...T, ...layout }; kick(); }

    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      const run = !paused && !reduce;
      if (run) { clock += dt; sceneClock += dt; spin += dt * (Math.PI * 2) / 90000; }
      for (const k of ['sep', 'cx', 'cy', 'zoom', 'pitch', 'ring', 'glow']) S[k] += (T[k] - S[k]) * (reduce ? 1 : 0.07);
      tilt += (tiltT - tilt) * 0.08; yaw += (yawT - yaw) * 0.08;

      // what each scene does: inward stream, outward stream, which petals, how full the seed head is
      let inE = 0, outE = 0, only = null;
      if (scene === 'live') {
        const ph = reduce ? 0.47 : (clock % 9000) / 9000;
        inE = ss(0, 0.04, ph) * (1 - ss(0.4, 0.45, ph));
        outE = ss(0.52, 0.56, ph) * (1 - ss(0.84, 0.9, ph));
        Ft = ph < 0.45 ? 0.12 + 0.88 * ss(0.02, 0.44, ph) : ph < 0.86 ? 1 - 0.55 * ss(0.56, 0.86, ph) : 0.45 - 0.33 * ss(0.86, 1, ph);
        petalGlow = outE * ss(0.56, 0.8, ph);
      } else if (scene === 'empty') { Ft = 0; petalGlow = 0; }
      else if (scene === 'push') { inE = 1; Ft = Math.min(1, sceneClock / 4200); }
      else if (scene === 'full') { Ft = 1; }
      else if (scene === 'pull') { outE = 1; Ft = 1; petalGlow = Math.min(1, sceneClock / 2500); }
      else if (scene === 'merge') { inE = 1; only = [2, 6]; Ft = 0.35 + 0.65 * Math.min(1, sceneClock / 3800); }
      else if (scene === 'guard') { outE = 1; Ft = 1; petalGlow = 1; }
      if (reduce && (scene === 'push' || scene === 'merge')) Ft = 1;
      F += (Ft - F) * (reduce ? 1 : 0.12);
      const tm = clock / 1000;

      const scale = Math.min(w, h) * 0.5 * S.zoom, ox = w * S.cx, oy = h * S.cy;
      const cs = Math.cos(spin), sn = Math.sin(spin), pit = S.pitch + tilt, cp = Math.cos(pit), sp = Math.sin(pit), cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const rot = (x, y, z) => { const x1 = x * cs - y * sn, y1 = x * sn + y * cs, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; return [x1 * cyw + z2 * syw, y2, -x1 * syw + z2 * cyw]; };
      const N = cols * rows, zb = new Float32Array(N).fill(9), lum = new Float32Array(N), lime = new Uint8Array(N);
      const filled = F * SEEDS;
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i], kind = q[8];
        let x = q[0], y = q[1], z = q[2];
        if (kind === 2 && S.ring < 0.04) continue;
        if (kind === 0 && S.sep > 0.002) { const a = petalAngle[q[6]], o = S.sep * (0.22 + (q[6] % 3) * 0.06); x += Math.cos(a) * o; y += Math.sin(a) * o; z += S.sep * ((q[6] % 2) ? -0.12 : 0.1); }
        const [vx, vy, vz] = rot(x, y, z), n = rot(q[3], q[4], q[5]);
        const persp = 3 / (3 + vz), X = ox + vx * scale * persp, Y = oy + vy * scale * persp;
        const c = Math.floor(X / CW), r = Math.floor(Y / CH);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const idx = r * cols + c;
        if (vz >= zb[idx]) continue;
        zb[idx] = vz;
        const dl = Math.abs(n[0] * Lgt[0] + n[1] * Lgt[1] + n[2] * Lgt[2]);
        let l = dl * 0.78 + 0.1, lt = 0;
        if (kind === 0) {
          const t = q[7], active = !only || only.includes(q[6] % 8);
          const sIn = inE && active ? inE * Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (t * 1.15 + tm * 0.55))), 3) : 0;
          const sOut = outE ? outE * Math.pow(Math.max(0, Math.sin(Math.PI * 2 * (t * 1.15 - tm * 0.55))), 3) : 0;
          const s = Math.max(sIn, sOut);
          l = (0.2 + dl * 0.45 + (1 - Math.abs(q[9])) * 0.2 - Math.abs(q[9]) * 0.06) * (only && !active ? 0.55 : 1) + s * 0.4 + petalGlow * 0.18 * t;
          lt = s > 0.62 ? 1 : 0;
        } else if (kind === 1) {
          const k = q[7] * SEEDS, full = k < filled, edge = full && k > filled - 70 && F < 0.995;
          l = full ? 0.55 + dl * 0.45 + S.glow * 0.08 : 0.16 + dl * 0.28;
          lt = edge || (full && scene === 'full' && Math.sin(k * 0.37 + tm * 3) > 0.92) ? 1 : 0;
        } else { lt = 1; l = 0.8; }
        lum[idx] = Math.min(1, l); lime[idx] = lt;
      }
      ctx.clearRect(0, 0, w, h); ctx.font = `400 13px ${C.face}`; ctx.textBaseline = 'top';
      for (let i = 0; i < N; i++) {
        if (zb[i] === 9) continue;
        const l = lum[i];
        ctx.fillStyle = lime[i] ? C.lime : l > 0.64 ? C.hi : l > 0.36 ? C.mid : C.lo;
        ctx.globalAlpha = lime[i] ? 1 : 0.35 + l * 0.65;
        ctx.fillText(RAMP[Math.max(1, Math.min(9, Math.round(l * 9)))], (i % cols) * CW, Math.floor(i / cols) * CH);
      }
      ctx.globalAlpha = 1;
      if (on && !reduce && (!paused || Math.abs(F - Ft) > 0.002 || Math.abs(T.sep - S.sep) > 0.002)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    fig.addEventListener('pointermove', (e) => { const b = fig.getBoundingClientRect(); tiltT = ((e.clientY - b.top) / b.height - 0.5) * 0.22; yawT = ((e.clientX - b.left) / b.width - 0.5) * 0.3; kick(); });
    fig.addEventListener('pointerleave', () => { tiltT = 0; yawT = 0; kick(); });
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });
    return { set, kick, pause(v) { paused = v; kick(); } };
  }
  window.StashBloom = Bloom;
})();
