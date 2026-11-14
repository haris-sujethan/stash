/* How Stash works, in characters: three laptops and the Stash cloud.
   push: packets rise from a laptop and the cloud fills. pull: packets fall to another laptop and its screen fills.
   merge: two laptops feed the cloud at once. learn: the cloud sends one rule to every laptop. */
(function () {
  const CLOUD = [
    '           .--------.           ',
    '      .---(          )---.      ',
    '    .(                    ).    ',
    '   (                        )   ',
    '   (                        )   ',
    '    \'-.__________________.-\'    ',
  ];
  const LAPTOP = [
    ' .------------. ',
    ' |            | ',
    ' |            | ',
    ' |            | ',
    ' \'------------\' ',
    '/______________\\',
  ];
  const SCREEN = ['> read auth', '> npm test', '> fix race '];

  function Net(fig) {
    const cv = fig.querySelector('canvas'), ctx = cv.getContext('2d');
    const root = getComputedStyle(document.documentElement), tok = (n) => root.getPropertyValue(n).trim();
    const C = { lo: tok('--point-lo'), mid: tok('--point-mid'), hi: tok('--point-hi'), lime: tok('--color-accent'), rule: tok('--color-rule-2'), ink: tok('--color-ink'), face: tok('--font-body') };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const CW = 12, CH = 21;
    let w = 0, h = 0, cols = 0, rows = 0, raf = 0, last = 0, on = true, paused = false, clock = 0;
    let mode = 'push', fill = 0.2, flash = 0, packets = [], next = 0, screens = [1, 1, 0], ruleOn = [0, 0, 0];
    let cloudAt = [0, 0], laps = [], paths = [];

    function layout() {
      const b = fig.getBoundingClientRect(); w = b.width; h = b.height;
      const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0);
      cols = Math.floor(w / CW); rows = Math.floor(h / CH);
      cloudAt = [Math.round(cols / 2 - CLOUD[0].length / 2), Math.max(1, Math.round(rows * 0.1))];
      const ly = Math.round(rows * 0.68), xs = [0.17, 0.5, 0.83];
      laps = xs.map((f) => [Math.round(cols * f - LAPTOP[0].length / 2), ly]);
      const top = [cloudAt[0] + CLOUD[0].length / 2, cloudAt[1] + CLOUD.length];
      paths = laps.map(([x, y], i) => {
        const a = [x + LAPTOP[0].length / 2, y - 1], b = [top[0] + (i - 1) * 6, top[1]], m = [(a[0] + b[0]) / 2 + (i - 1) * 4, (a[1] + b[1]) / 2];
        const pts = [];
        for (let s = 0; s <= 1.0001; s += 0.01) { const x1 = (1 - s) ** 2 * a[0] + 2 * (1 - s) * s * m[0] + s * s * b[0], y1 = (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * m[1] + s * s * b[1]; pts.push([x1, y1]); }
        return pts;
      });
    }
    const at = (path, s) => path[Math.min(path.length - 1, Math.max(0, Math.round(s * (path.length - 1))))];

    function set(m) {
      mode = m; packets = []; next = 0; flash = 0;
      if (m === 'push') { fill = 0.15; screens = [1, 0.4, 0]; ruleOn = [0, 0, 0]; }
      if (m === 'pull') { fill = 1; screens = [1, 0.4, 0]; ruleOn = [0, 0, 0]; }
      if (m === 'merge') { fill = 0.2; screens = [1, 0.4, 1]; ruleOn = [0, 0, 0]; }
      if (m === 'learn') { fill = 1; screens = [1, 1, 1]; ruleOn = [0, 0, 0]; }
      if (reduce) { fill = m === 'push' || m === 'merge' ? 1 : fill; screens = m === 'pull' ? [1, 0.4, 1] : screens; ruleOn = m === 'learn' ? [1, 1, 1] : ruleOn; }
      kick();
    }

    function step(dt) {
      clock += dt; next -= dt;
      if (next <= 0) {
        if (mode === 'push' && fill < 1) { packets.push({ i: 0, s: 0, dir: 1 }); next = 520; }
        else if (mode === 'pull' && screens[2] < 1) { packets.push({ i: 2, s: 1, dir: -1 }); next = 520; }
        else if (mode === 'merge' && fill < 1) { packets.push({ i: 0, s: 0, dir: 1 }); packets.push({ i: 2, s: 0, dir: 1 }); next = 640; }
        else if (mode === 'learn' && ruleOn.some((r) => !r)) { [0, 1, 2].forEach((i) => packets.push({ i, s: 1, dir: -1, rule: true })); next = 99999; }
        else next = 200;
      }
      for (const p of packets) {
        p.s += p.dir * dt / 1400;
        if (p.dir > 0 && p.s >= 1) { p.done = true; fill = Math.min(1, fill + (mode === 'merge' ? 0.06 : 0.09)); flash = 1; }
        if (p.dir < 0 && p.s <= 0) { p.done = true; if (p.rule) ruleOn[p.i] = 1; else screens[p.i] = Math.min(1, screens[p.i] + 0.2); }
      }
      packets = packets.filter((p) => !p.done);
      flash *= Math.pow(0.9, dt / 33);
    }

    function put(ch, x, y, color, alpha) { if (x < 0 || y < 0 || x >= cols || y >= rows || ch === ' ') return; ctx.globalAlpha = alpha ?? 1; ctx.fillStyle = color; ctx.fillText(ch, x * CW, y * CH); }
    function frame(now) {
      raf = 0;
      if (now - last < 33) { raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(100, now - last) : 33; last = now;
      if (!paused && !reduce) step(dt);
      ctx.clearRect(0, 0, w, h); ctx.font = `400 18px ${C.face}`; ctx.textBaseline = 'top';
      // paths
      paths.forEach((path, i) => { for (let k = 4; k < path.length - 2; k += 6) { const [x, y] = path[k]; put('.', Math.round(x), Math.round(y), C.rule, 0.9); } });
      // cloud outline and its fill, rising from the bottom
      const [cx, cy] = cloudAt;
      CLOUD.forEach((line, r) => { for (let c = 0; c < line.length; c++) put(line[c], cx + c, cy + r, flash > 0.3 ? C.hi : C.mid, 1); });
      const word = 'stash', wc = Math.round(CLOUD[0].length / 2 - word.length / 2), wx = cx + wc;
      const inner = [[2, 7, 25], [3, 5, 27], [4, 5, 27]];
      const levels = inner.length, filledRows = fill * levels;
      inner.forEach(([r, a, b], k) => {
        const rowFill = Math.min(1, Math.max(0, filledRows - (levels - 1 - k)));
        for (let c = a; c < b; c++) {
          if (r === 3 && c >= wc - 1 && c <= wc + word.length) continue;
          const v = Math.sin(c * 1.7 + r * 3.1) * 0.5 + 0.5;
          if (rowFill <= 0) { if (v > 0.8) put('.', cx + c, cy + r, C.lo, 0.6); continue; }
          const ch = rowFill > 0.66 ? (v > 0.5 ? '#' : '%') : rowFill > 0.33 ? (v > 0.5 ? '+' : '*') : (v > 0.5 ? ':' : '-');
          put(ch, cx + c, cy + r, flash > 0.4 && k === levels - Math.ceil(filledRows) ? C.lime : rowFill > 0.66 ? C.hi : C.mid, 0.9);
        }
      });
      for (let k = 0; k < word.length; k++) put(word[k], wx + k, cy + 3, C.ink, 1);
      // laptops and their screens
      laps.forEach(([x, y], i) => {
        LAPTOP.forEach((line, r) => { for (let c = 0; c < line.length; c++) put(line[c], x + c, y + r, C.mid, 1); });
        const rowsOn = Math.round(screens[i] * SCREEN.length);
        for (let r = 0; r < SCREEN.length; r++) {
          const text = ruleOn[i] && r === 2 ? '+ rule     ' : SCREEN[r];
          const visible = r < rowsOn || (ruleOn[i] && r === 2);
          for (let c = 0; c < text.length; c++) put(text[c], x + 2 + c, y + 1 + r, ruleOn[i] && r === 2 ? C.lime : visible ? C.hi : C.lo, visible ? 1 : 0.25);
        }
      });
      // packets
      for (const p of packets) for (let k = 0; k < 4; k++) {
        const [x, y] = at(paths[p.i], p.s - p.dir * k * 0.03);
        put(['@', '#', '*', '.'][k], Math.round(x), Math.round(y), k < 2 ? C.lime : C.hi, 1 - k * 0.2);
      }
      ctx.globalAlpha = 1;
      if (on && !paused && !reduce) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(([en]) => { on = en.isIntersecting; if (on) kick(); }).observe(fig);
    new ResizeObserver(() => { layout(); kick(); }).observe(fig);
    document.fonts.ready.then(() => { layout(); kick(); });
    return { set, kick, pause(v) { paused = v; kick(); } };
  }
  window.StashNet = Net;
})();
