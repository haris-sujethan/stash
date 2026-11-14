/* Stash, as bubbles of characters arranged like a flower.
   The outer bubbles are agents; the middle one is Stash. The loop is the product's cycle:
   1. Grey agents learn and push: a pulse crosses the gap, and the middle brightens a step as each one lands.
   2. When the middle is full it briefs every agent: a lime pulse goes out and each agent turns green.
   3. Agents use what they received: the green drains away as they work, until they are grey again.
   4. A grey agent starts pushing what it has learned since. The loop never ends. */
(function () {
  const RAMP = ' .:-+*#%@';

  function Bubbles(fig, opts = {}) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 7, CH = 11.5;
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    // six agents, evenly spaced on one ring, all the same size and depth, one straight above the middle
    const RING = 6, D = 0.92, RA = 0.29, B = [{ c: [0, 0, 0], r: 0.36 }];
    for (let k = 0; k < RING; k++) {
      const a = Math.PI / 2 + (k / RING) * Math.PI * 2;
      B.push({ c: [Math.cos(a) * D, Math.sin(a) * D, 0], r: RA });
    }
    // a small, smooth drift for each bubble: sums of slow sines, so it always returns home
    const drift = B.map((b, bi) => ({ a: bi === 0 ? 0.012 : 0.03, w1: 0.11 + bi * 0.013, w2: 0.087 + bi * 0.011, p1: bi * 1.7, p2: bi * 2.9 }));
    const off = B.map(() => [0, 0, 0]);
    const pts = [];
    B.forEach((b, bi) => {
      const n = bi === 0 ? 6800 : 4400;
      for (let i = 0; i < n; i++) {
        const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1), rr = b.r * Math.pow(rnd(), 0.55);
        pts.push([b.c[0] + rr * Math.sin(v) * Math.cos(u), b.c[1] + rr * Math.sin(v) * Math.sin(u), b.c[2] + rr * Math.cos(v), bi, rnd()]);
      }
    });

    // the cycle
    let E = 0.08, briefing = false, pulses = [], clock = 0, centerFlare = 0;
    const agent = B.map(() => ({ state: 'grey', G: 0, hold: 0, next: 1500 + rnd() * 6000, flare: 0 }));

    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, sway = 0, tilt = 0, tiltT = 0, yawT = 0, yawP = 0;
    function size() { const b = fig.getBoundingClientRect(); w = b.width; h = b.height; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); cols = Math.ceil(w / CW); rows = Math.ceil(h / CH); }

    function step(dt) {
      clock += dt;
      for (let k = 1; k < B.length; k++) {
        const a = agent[k];
        if (a.state === 'grey' && !briefing && clock > a.next) { pulses.push({ from: k, to: 0, t: 0, dur: 2300 }); a.flare = 1; a.next = clock + 3200 + rnd() * 5200; }
        if (a.state === 'filling') { a.G = Math.min(0.78, a.G + dt / 3000 * 0.78); if (a.G >= 0.78) { a.state = 'using'; a.hold = 1600; } }
        if (a.state === 'using') { a.hold -= dt; if (a.hold <= 0) { a.G = Math.max(0, a.G - dt / 7500); if (a.G === 0) { a.state = 'grey'; a.next = clock + 600 + rnd() * 2600; } } }
        a.flare *= Math.pow(0.93, dt / 33);
      }
      for (const p of pulses) {
        p.t += dt / p.dur;
        if (p.t >= 1) {
          p.done = true;
          if (p.to === 0) { E = Math.min(1, E + 0.05); centerFlare = 1; }
          else { const a = agent[p.to]; a.state = 'filling'; a.flare = 1; }
        }
      }
      pulses = pulses.filter((p) => !p.done);
      if (!briefing && E >= 0.999) { briefing = true; for (let k = 1; k < B.length; k++) pulses.push({ from: 0, to: k, t: 0, dur: 2500, out: true }); centerFlare = 1; }
      if (briefing) { E = Math.max(0.1, E - dt / 3200); if (!pulses.some((p) => p.out)) briefing = false; }
      centerFlare *= Math.pow(0.92, dt / 33);
    }

    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      if (!reduce) { step(dt); sway += dt / 1000; }
      else { E = 0.55; agent.forEach((a) => { a.G = 0; }); }
      tilt += (tiltT - tilt) * 0.06; yawP += (yawT - yawP) * 0.06;
      const tt = sway;
      drift.forEach((d, bi) => { off[bi][0] = d.a * Math.sin(tt * d.w1 + d.p1); off[bi][1] = d.a * Math.sin(tt * d.w2 + d.p2); off[bi][2] = d.a * 0.6 * Math.sin(tt * (d.w1 + d.w2) * 0.5 + d.p1); });

      const scale = Math.min(h * (opts.fit ?? 0.47), w * (opts.fitW ?? 0.42)), ox = w * (opts.cx ?? 0.5), oy = h * (opts.cy ?? 0.5);
      const yaw = Math.sin(sway * 0.09) * 0.08 + yawP, pitch = 0.06 + Math.sin(sway * 0.07) * 0.03 + tilt, roll = 0;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const view = (x, y, z) => { const x0 = x * cr - y * sr, y0 = x * sr + y * cr; const x1 = x0 * cy + z * sy, z1 = -x0 * sy + z * cy; return [x1, y0 * cp - z1 * sp, y0 * sp + z1 * cp]; };
      const N = cols * rows, count = new Uint8Array(N), zb = new Float32Array(N).fill(9), who = new Int8Array(N).fill(-1), lime = new Uint8Array(N), knot = new Uint8Array(N);
      const plot = (x, y, z, bi, mark) => {
        const [vx, vy, vz] = view(x, y, z), k = 3 / (3 + vz), X = ox + vx * scale * k, Y = oy - vy * scale * k;
        const c = Math.floor(X / CW), r = Math.floor(Y / CH);
        if (c < 0 || r < 0 || c >= cols || r >= rows) return;
        const i = r * cols + c;
        if (count[i] < 255) count[i]++;
        if (mark === 1) lime[i] = 1; else if (mark === 2) knot[i] = 1;
        if (vz < zb[i]) { zb[i] = vz; who[i] = bi; }
      };
      for (const q of pts) {
        const bi = q[3];
        const o = off[bi];
        plot(q[0] + o[0], q[1] + o[1], q[2] + o[2], bi, (bi === 0 ? q[4] < E * 0.55 : q[4] < agent[bi].G) ? 1 : 0);
      }
      for (const p of pulses) {
        const oa = off[p.from], ob = off[p.to];
        const a = { c: [B[p.from].c[0] + oa[0], B[p.from].c[1] + oa[1], B[p.from].c[2] + oa[2]] }, b = { c: [B[p.to].c[0] + ob[0], B[p.to].c[1] + ob[1], B[p.to].c[2] + ob[2]] }, e = p.t < 0.5 ? 2 * p.t * p.t : 1 - Math.pow(-2 * p.t + 2, 2) / 2;
        for (let tail = 0; tail < 5; tail++) {
          const s = Math.max(0, e - tail * 0.03), rad = (p.out ? 0.075 : 0.06) * (1 - tail * 0.14);
          const x = a.c[0] + (b.c[0] - a.c[0]) * s, y = a.c[1] + (b.c[1] - a.c[1]) * s, z = a.c[2] + (b.c[2] - a.c[2]) * s;
          for (let j = 0; j < 26; j++) { const u = j * 2.4, v = (j % 9) / 9 * Math.PI; plot(x + Math.cos(u) * Math.sin(v) * rad, y + Math.sin(u) * Math.sin(v) * rad, z + Math.cos(v) * rad, -2, p.out ? 1 : 2); }
        }
      }

      // every glyph is centred in its cell, so columns stay straight whatever the character's width
      ctx.clearRect(0, 0, w, h); ctx.font = `400 10.5px ${C.face}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center';
      const fadeOf = (X) => (opts.fadeLeft ? Math.min(1, Math.max(0, (X - w * opts.fadeLeft[0]) / (w * (opts.fadeLeft[1] - opts.fadeLeft[0])))) : 1);
      for (let i = 0; i < N; i++) {
        const n = count[i]; if (!n) continue;
        const X = (i % cols) * CW, fade = fadeOf(X); if (fade <= 0.02) continue;
        const bi = who[i], depth = Math.min(1, Math.max(0, (0.9 - zb[i]) / 1.8));
        const bright = bi === 0 ? 0.3 + E * 0.55 + centerFlare * 0.25 : bi > 0 ? 0.26 + agent[bi].flare * 0.3 + agent[bi].G * 0.25 : 1;
        const ch = RAMP[Math.min(8, Math.ceil(n / 3.4) + (bright > 0.7 ? 1 : 0))];
        if (knot[i] && bi === -2) { ctx.fillStyle = C.hi; ctx.globalAlpha = fade; }
        else if (lime[i]) { ctx.fillStyle = C.lime; ctx.globalAlpha = (bi === -2 ? 1 : 0.5 + bright * 0.4) * fade; }
        else { ctx.fillStyle = bright > 0.72 ? C.hi : bright > 0.4 || n > 9 ? C.mid : C.lo; ctx.globalAlpha = Math.min(1, 0.34 + depth * 0.28 + bright * 0.38) * fade; }
        ctx.fillText(ch, X + CW / 2, Math.floor(i / cols) * CH);
      }
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      if (on && !reduce) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    const area = opts.area || fig;
    area.addEventListener('pointermove', (e) => {
      const b = fig.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
      tiltT = (y / b.height - 0.5) * 0.2; yawT = (x / b.width - 0.5) * 0.25;
      kick();
    });
    area.addEventListener('pointerleave', () => { tiltT = 0; yawT = 0; kick(); });
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { size(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { size(); kick(); });
    return { kick };
  }
  window.StashBubbles = Bubbles;
})();
