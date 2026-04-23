/* ============================================
   Utilis Neural Network Hero
   Draws a live neural graph behind the hero title.
   Calm, cursor-reactive, respects reduced-motion.
   ============================================ */

(function () {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==== Config ====
  const CFG = {
    nodeCount: 45,            // total nodes
    maxConnectDist: 190,      // max pixel distance for a connection
    nodeRadius: 3,
    nodeRadiusHover: 6,
    pulseSpeed: 0.0024,       // how fast the "data" travels edges
    pulseCount: 10,           // concurrent pulses
    mouseInfluence: 140,      // radius of cursor attraction
    mouseForce: 0.12,         // strength of attraction
    drift: 0.15,              // ambient node drift velocity
    accent: '66, 222, 195',   // #42dec3 in rgb
    faint: '255, 255, 255',
    drawInDuration: 2600,     // ms for the "drawing itself" entrance
  };

  let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [];
  let edges = [];
  let pulses = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let startTime = performance.now();
  let rafId = null;

  // ==== Size ====
  function resize() {
    const rect = host.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // ==== Build graph ====
  function buildGraph() {
    nodes = [];
    // Poisson-ish distribution: grid-with-jitter for even spread but organic feel
    const cols = Math.round(Math.sqrt((CFG.nodeCount * W) / H));
    const rows = Math.ceil(CFG.nodeCount / cols);
    const cellW = W / cols;
    const cellH = H / rows;

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= CFG.nodeCount) break;
        const jx = (Math.random() - 0.5) * cellW * 0.7;
        const jy = (Math.random() - 0.5) * cellH * 0.7;
        nodes.push({
          id: idx,
          x: cellW * (c + 0.5) + jx,
          y: cellH * (r + 0.5) + jy,
          ox: 0, oy: 0, // origin offset (for drift anchor)
          vx: (Math.random() - 0.5) * CFG.drift,
          vy: (Math.random() - 0.5) * CFG.drift,
          // slight size variation — some "hub" nodes
          size: Math.random() < 0.15 ? CFG.nodeRadius * 1.8 : CFG.nodeRadius,
          // staggered appearance (0..1 of drawIn duration)
          appearAt: Math.random() * 0.6,
        });
        idx++;
      }
    }
    // anchor origins
    nodes.forEach(n => { n.ox = n.x; n.oy = n.y; });

    // Build edges: connect every node to its 2-4 nearest within radius
    edges = [];
    nodes.forEach((a, i) => {
      const candidates = [];
      nodes.forEach((b, j) => {
        if (i === j) return;
        const dx = a.ox - b.ox, dy = a.oy - b.oy;
        const d = Math.hypot(dx, dy);
        if (d < CFG.maxConnectDist) candidates.push({ j, d });
      });
      candidates.sort((p, q) => p.d - q.d);
      const take = Math.min(3, candidates.length);
      for (let k = 0; k < take; k++) {
        const { j } = candidates[k];
        // Avoid duplicate edges (i<j only)
        const lo = Math.min(i, j), hi = Math.max(i, j);
        if (!edges.some(e => e.a === lo && e.b === hi)) {
          edges.push({
            a: lo, b: hi,
            appearAt: Math.max(nodes[lo].appearAt, nodes[hi].appearAt) + 0.1,
          });
        }
      }
    });

    // Seed pulses along random edges
    pulses = [];
    for (let i = 0; i < CFG.pulseCount; i++) spawnPulse(Math.random());
  }

  function spawnPulse(initialT = 0) {
    if (edges.length === 0) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    pulses.push({
      edge: e,
      t: initialT,
      // random direction along edge
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: CFG.pulseSpeed * (0.7 + Math.random() * 0.7),
    });
  }

  // ==== Mouse ====
  function onMove(e) {
    const rect = host.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }
  function onLeave() { mouse.active = false; mouse.x = -9999; mouse.y = -9999; }

  host.addEventListener('mousemove', onMove);
  host.addEventListener('mouseleave', onLeave);
  window.addEventListener('resize', () => {
    resize();
    buildGraph();
  });

  // ==== Draw ====
  function draw(now) {
    const elapsed = now - startTime;
    const drawIn = Math.min(1, elapsed / CFG.drawInDuration);

    ctx.clearRect(0, 0, W, H);

    // --- Update nodes: drift + mouse attraction + spring to origin ---
    for (const n of nodes) {
      // Spring toward origin (keeps the graph coherent)
      const sx = (n.ox - n.x) * 0.008;
      const sy = (n.oy - n.y) * 0.008;

      // Mouse attraction
      let mx = 0, my = 0;
      if (mouse.active) {
        const dx = mouse.x - n.x, dy = mouse.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < CFG.mouseInfluence && d > 0.1) {
          const falloff = (1 - d / CFG.mouseInfluence);
          const f = CFG.mouseForce * falloff * falloff;
          mx = (dx / d) * f;
          my = (dy / d) * f;
        }
      }

      n.vx = n.vx * 0.95 + sx + mx;
      n.vy = n.vy * 0.95 + sy + my;
      n.x += n.vx;
      n.y += n.vy;
    }

    // --- Draw edges ---
    for (const e of edges) {
      const appearProgress = Math.max(0, Math.min(1, (drawIn - e.appearAt) / 0.25));
      if (appearProgress <= 0) continue;
      const a = nodes[e.a], b = nodes[e.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      // fade by distance too, so stretched edges soften
      const distFade = 1 - Math.min(1, dist / CFG.maxConnectDist);
      const alpha = 0.40 * appearProgress * (0.4 + 0.6 * distFade);

      // Progressive line draw during entrance — tinted with brand accent
      ctx.strokeStyle = `rgba(${CFG.accent}, ${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const endX = a.x + dx * appearProgress;
      const endY = a.y + dy * appearProgress;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    // --- Draw pulses (only after lines are drawn) ---
    if (drawIn > 0.8) {
      const pulseFade = Math.min(1, (drawIn - 0.8) / 0.2);
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i];
        p.t += p.speed * p.dir;
        if (p.t > 1 || p.t < 0) {
          pulses.splice(i, 1);
          spawnPulse(p.dir > 0 ? 0 : 1);
          continue;
        }
        const a = nodes[p.edge.a], b = nodes[p.edge.b];
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;

        // Glow — softer than cranked version
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 16);
        grd.addColorStop(0, `rgba(${CFG.accent}, ${0.80 * pulseFade})`);
        grd.addColorStop(0.4, `rgba(${CFG.accent}, ${0.28 * pulseFade})`);
        grd.addColorStop(1, `rgba(${CFG.accent}, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Core dot — white-hot centre, smaller
        ctx.fillStyle = `rgba(255, 255, 255, ${pulseFade})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Draw nodes (on top of edges) ---
    for (const n of nodes) {
      const appearProgress = Math.max(0, Math.min(1, (drawIn - n.appearAt) / 0.2));
      if (appearProgress <= 0) continue;

      // Proximity-to-mouse glow
      let hover = 0;
      if (mouse.active) {
        const d = Math.hypot(mouse.x - n.x, mouse.y - n.y);
        if (d < CFG.mouseInfluence) hover = 1 - d / CFG.mouseInfluence;
      }

      const r = n.size + hover * (CFG.nodeRadiusHover - n.size);
      const baseA = 1.0 * appearProgress;
      const hoverA = 0.55 * hover;
      const a = Math.min(1.0, baseA + hoverA);

      // Constant subtle glow on every node so it reads
      const glowR = r + 4;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      glow.addColorStop(0, `rgba(${CFG.accent}, ${0.22 * appearProgress})`);
      glow.addColorStop(1, `rgba(${CFG.accent}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Stronger halo on hover
      if (hover > 0.1) {
        const haloR = r + 14 * hover;
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        grd.addColorStop(0, `rgba(${CFG.accent}, ${0.55 * hover})`);
        grd.addColorStop(1, `rgba(${CFG.accent}, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node body: accent teal for all nodes so they pop against the dark bg
      ctx.fillStyle = `rgba(${CFG.accent}, ${a})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    rafId = requestAnimationFrame(draw);
  }

  // ==== Init ====
  function init() {
    resize();
    buildGraph();
    startTime = performance.now();
    if (reducedMotion) {
      // Single static frame at t=1
      startTime = performance.now() - CFG.drawInDuration - 1000;
      draw(performance.now());
      return;
    }
    rafId = requestAnimationFrame(draw);
  }

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!rafId && !reducedMotion) {
      rafId = requestAnimationFrame(draw);
    }
  });

  // Kick off once fonts/layout settle
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
