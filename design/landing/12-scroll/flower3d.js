/* The Stash flower as a lit 3D ASCII render.
   Surfaces are sampled as points, lit by one light, and drawn as characters by brightness with a depth buffer,
   so the petals and the center read as solid shapes. One shared wave moves through every petal:
   inward to the center (push), then outward to the petals (pull). */
(function () {
  const RAMP = ' .:-=+*#%@';

  function fib(n, i) { const y = 1 - (i + 0.5) * (2 / n), r = Math.sqrt(1 - y * y), a = i * 2.399963229728653; return [Math.cos(a) * r, y, Math.sin(a) * r]; }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  function Flower3D(fig, opts = {}) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 8, CH = 14, P = 7;

    // geometry in flower space: x, y in the flower's plane, z out of it (toward the viewer is negative)
    // each point: [x, y, z, nx, ny, nz, petal (-1 center, -2 ring), s (0 center to 1 petal tip)]
    const pts = [];
    const CR = 0.21;
    for (let i = 0; i < 1500; i++) { const n = fib(1500, i); pts.push([n[0] * CR, n[1] * CR, n[2] * CR * 0.9, n[0], n[1], n[2], -1, 0]); }
    const A = 0.26, B = 0.17, Cz = 0.11, D = 0.62, CUP = 0.38;
    for (let p = 0; p < P; p++) {
      const ang = (p / P) * Math.PI * 2 - Math.PI / 2, ca = Math.cos(ang), sa = Math.sin(ang), cc = Math.cos(CUP), sc = Math.sin(CUP);
      for (let i = 0; i < 1100; i++) {
        const u = fib(1100, i);
        // ellipsoid along its own radial axis (x'), tangent (y'), thickness (z')
        let x = u[0] * A, y = u[1] * B, z = u[2] * Cz;
        let nx = u[0] / A, ny = u[1] / B, nz = u[2] / Cz;
        // cup: tip rises toward the viewer
        const x1 = x * cc - z * sc, z1 = x * sc + z * cc, nx1 = nx * cc - nz * sc, nz1 = nx * sc + nz * cc;
        x = x1 + D; z = -z1 * 1 - 0.05; nx = nx1; nz = -nz1;
        const s = Math.min(1, Math.max(0, (x - (D - A)) / (2 * A)));
        // rotate into place around the center
        const X = x * ca - y * sa, Y = x * sa + y * ca, NX = nx * ca - ny * sa, NY = nx * sa + ny * ca;
        const n = norm([NX, NY, nz]);
        pts.push([X, Y, z, n[0], n[1], n[2], p, s]);
      }
    }
    for (let i = 0; i < 700; i++) { const a = (i / 700) * Math.PI * 2 * 7, b = (i / 700) * Math.PI * 2; const R = 0.36, rt = 0.022; const cx = Math.cos(b), sy = Math.sin(b); pts.push([cx * (R + rt * Math.cos(a)), sy * (R + rt * Math.cos(a)), rt * Math.sin(a), cx * Math.cos(a), sy * Math.cos(a), Math.sin(a), -2, 0]); }

    // scene state, eased toward targets
    const S = { sep: 0, core: 1, ring: 0, cx: opts.cx ?? 0.5, cy: opts.cy ?? 0.5, zoom: opts.zoom ?? 1, pitch: 0.95, glow: 0 };
    let T = { ...S }, waves = 'both', period = 7000;
    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, paused = false, spin = 0, clock = 0, tilt = 0, tiltT = 0, yaw = 0, yawT = 0;
    const L = norm([-0.45, -0.65, -0.62]);

    function size() { const b = fig.getBoundingClientRect(); w = b.width; h = b.height; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(w / CW); rows = Math.ceil(h / CH); }

    function set(state) { T = { ...T, ...state }; if (state.waves) waves = state.waves; if (state.period) period = state.period; kick(); }

    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      const k = reduce ? 1 : 0.07;
      for (const key of ['sep', 'core', 'ring', 'cx', 'cy', 'zoom', 'pitch', 'glow']) S[key] += (T[key] - S[key]) * k;
      tilt += (tiltT - tilt) * 0.08; yaw += (yawT - yaw) * 0.08;
      if (!paused && !reduce) { spin += dt * (Math.PI * 2) / 60000; clock += dt; }

      // one shared wave: in (push) on the first half of the cycle, out (pull) on the second
      const ph = reduce ? 0.5 : (clock % period) / period;
      const inC = waves === 'in' ? 1.15 - ph * 1.3 : waves === 'both' ? 1.15 - ph / 0.45 * 1.3 : -9;
      const outC = waves === 'out' ? ph * 1.3 - 0.15 : waves === 'both' ? (ph - 0.5) / 0.45 * 1.3 - 0.15 : -9;
      const flash = waves === 'both' ? Math.max(0, 1 - Math.abs(ph - 0.47) / 0.08) : waves === 'in' ? Math.max(0, 1 - Math.abs(ph - 0.92) / 0.08) : 0;

      const scale = Math.min(w, h) * 0.62 * S.zoom, ox = w * S.cx, oy = h * S.cy;
      const cs = Math.cos(spin), sn = Math.sin(spin), pit = S.pitch + tilt, cp = Math.cos(pit), sp = Math.sin(pit), cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const view = (x, y, z) => { const x1 = x * cs - y * sn, y1 = x * sn + y * cs; const y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp; return [x1 * cyw + z2 * syw, y2, -x1 * syw + z2 * cyw]; };
      const N = cols * rows, zb = new Float32Array(N).fill(9), lum = new Float32Array(N), lime = new Uint8Array(N);
      for (let i = 0; i < pts.length; i++) {
        const q = pts[i]; let [x, y, z] = q; const p = q[6], s = q[7];
        if (p === -1) { if (S.core < 0.04) continue; x *= S.core; y *= S.core; z *= S.core; }
        else if (p === -2) { if (S.ring < 0.04) continue; const g = 0.7 + 0.3 * S.ring; x *= g; y *= g; }
        else if (S.sep > 0.001) { const a = (p / P) * Math.PI * 2 - Math.PI / 2, o = S.sep * (0.3 + (p % 3) * 0.07); x += Math.cos(a) * o; y += Math.sin(a) * o; z += S.sep * ((p % 2) ? -0.18 : 0.14); }
        const [vx, vy, vz] = view(x, y, z), [nx, ny, nz] = view(q[3], q[4], q[5]);
        if (nz > 0.25) continue; // faces away
        const persp = 2.6 / (2.6 + vz), X = ox + vx * scale * persp, Y = oy + vy * scale * persp;
        const c = Math.floor(X / CW), r = Math.floor(Y / CH);
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const idx = r * cols + c;
        if (vz >= zb[idx]) continue;
        zb[idx] = vz;
        let l = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) * 0.82 + 0.12;
        let lit = 0;
        if (p >= 0) {
          const wIn = Math.exp(-((s - inC) ** 2) / 0.012), wOut = Math.exp(-((s - outC) ** 2) / 0.012), wv = Math.max(wIn, wOut);
          l += wv * 0.35; lit = wv > 0.55 ? 1 : 0;
        } else if (p === -1) { l += (flash * 0.18 + S.glow * 0.2) * (l > 0.4 ? 1 : 0.4); lit = flash > 0.6 && l > 0.8 ? 1 : 0; }
        else { lit = 1; l = Math.max(l, 0.7); }
        lum[idx] = Math.min(1, l); lime[idx] = lit;
      }
      ctx.clearRect(0, 0, w, h); ctx.font = `400 13px ${C.face}`; ctx.textBaseline = 'top';
      for (let i = 0; i < N; i++) {
        if (zb[i] === 9) continue;
        const l = lum[i], ch = RAMP[Math.max(1, Math.min(9, Math.round(l * 9)))];
        ctx.fillStyle = lime[i] ? C.lime : l > 0.62 ? C.hi : l > 0.34 ? C.mid : C.lo;
        ctx.globalAlpha = lime[i] ? 1 : 0.4 + l * 0.6;
        ctx.fillText(ch, (i % cols) * CW, Math.floor(i / cols) * CH);
      }
      ctx.globalAlpha = 1;
      const settling = ['sep', 'core', 'ring', 'cx', 'cy', 'zoom', 'pitch', 'glow'].some((key) => Math.abs(T[key] - S[key]) > 0.001);
      if (!reduce && on && (!paused || settling || Math.abs(tiltT - tilt) > 0.001)) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    fig.addEventListener('pointermove', (e) => { const b = fig.getBoundingClientRect(); tiltT = ((e.clientY - b.top) / b.height - 0.5) * 0.25; yawT = ((e.clientX - b.left) / b.width - 0.5) * 0.35; kick(); });
    fig.addEventListener('pointerleave', () => { tiltT = 0; yawT = 0; kick(); });
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });
    return { set, kick, pause(v) { paused = v; kick(); } };
  }
  window.StashFlower3D = Flower3D;
})();
