/**
 * BoolSynth — Kinetic Background Canvas Engine
 * High-performance physics-based particle system with cursor repulsion,
 * proximity circuit lines, and click energy bursts using vanilla HTML5 Canvas.
 */
(function () {
  'use strict';

  const TOGGLE_ID = 'kinetic-bg-toggle';
  const CANVAS_ID = 'kinetic-canvas';

  let canvas = null;
  let ctx = null;
  let animId = null;
  let isRunning = false;

  // Viewport dimensions
  let width = 0;
  let height = 0;
  let dpr = 1;

  // Particle systems
  let particles = [];
  let burstParticles = [];

  // Mouse tracking
  const mouse = {
    x: -9999,
    y: -9999,
    radius: 145,
    isActive: false,
    timer: null
  };

  // Color tokens from :root
  const PALETTE = [
    { r: 107, g: 255, b: 176 }, // Neon Signal Green #6bffb0 (Primary)
    { r: 107, g: 255, b: 176 },
    { r: 107, g: 255, b: 176 },
    { r: 255, g: 190, b: 92  }, // Amber Gold #ffbe5c
    { r: 92,  g: 225, b: 230 }  // Cyan Blue #5ce1e6
  ];

  /* ===================== Particle Model ===================== */

  class LogicParticle {
    constructor(x, y, isBurst = false, burstAngle = 0, burstSpeed = 0) {
      this.x = x !== undefined ? x : Math.random() * width;
      this.y = y !== undefined ? y : Math.random() * height;
      this.isBurst = isBurst;

      const col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      this.rgb = `${col.r}, ${col.g}, ${col.b}`;

      if (isBurst) {
        this.vx = Math.cos(burstAngle) * burstSpeed;
        this.vy = Math.sin(burstAngle) * burstSpeed;
        this.baseVx = 0;
        this.baseVy = 0;
        this.radius = 2 + Math.random() * 2.5;
        this.alpha = 1.0;
        this.decay = 0.015 + Math.random() * 0.02;
        this.isBit = Math.random() < 0.45;
        this.bitChar = Math.random() < 0.5 ? '1' : '0';
      } else {
        const speed = 0.25 + Math.random() * 0.45;
        const angle = Math.random() * Math.PI * 2;
        this.baseVx = Math.cos(angle) * speed;
        this.baseVy = Math.sin(angle) * speed;
        this.vx = this.baseVx;
        this.vy = this.baseVy;
        this.radius = 1.8 + Math.random() * 2.2;
        this.alpha = 0.25 + Math.random() * 0.45;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.isBit = Math.random() < 0.35;
        this.bitChar = Math.random() < 0.5 ? '1' : '0';
      }
    }

    update() {
      if (this.isBurst) {
        // Friction and fade
        this.vx *= 0.94;
        this.vy *= 0.94;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
        return this.alpha > 0.01;
      }

      // Cursor Repulsion Physics
      if (mouse.isActive) {
        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        const radiusSq = mouse.radius * mouse.radius;

        if (distSq < radiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / mouse.radius) * 3.8;
          const nx = dx / dist;
          const ny = dy / dist;

          this.vx += nx * force * 0.9;
          this.vy += ny * force * 0.9;
        }
      }

      // Smooth damping back to drift speed
      this.vx = this.vx * 0.94 + this.baseVx * 0.06;
      this.vy = this.vy * 0.94 + this.baseVy * 0.06;

      this.x += this.vx;
      this.y += this.vy;

      // Toroidal boundary wrap
      if (this.x < -10) this.x = width + 10;
      else if (this.x > width + 10) this.x = -10;

      if (this.y < -10) this.y = height + 10;
      else if (this.y > height + 10) this.y = -10;

      this.pulsePhase += 0.03;
      return true;
    }

    draw(ctx) {
      const currentAlpha = this.isBurst
        ? this.alpha
        : this.alpha * (0.8 + 0.2 * Math.sin(this.pulsePhase));

      if (this.isBit) {
        // Render glowing binary logic glyph (0 or 1)
        ctx.font = '10px "Space Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(${this.rgb}, ${currentAlpha * 0.95})`;
        ctx.fillText(this.bitChar, this.x, this.y);
      } else {
        // Render logic node point
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.rgb}, ${currentAlpha})`;
        ctx.fill();

        // Subtle glow aura
        if (currentAlpha > 0.4) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${this.rgb}, ${currentAlpha * 0.15})`;
          ctx.fill();
        }
      }
    }
  }

  /* ===================== Engine Core ===================== */

  function resize() {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }

  function spawnParticles() {
    particles = [];
    burstParticles = [];
    // Adaptive count based on screen area (capped between 40 and 90)
    const count = Math.min(90, Math.max(40, Math.floor((width * height) / 16000)));
    for (let i = 0; i < count; i++) {
      particles.push(new LogicParticle());
    }
  }

  function triggerBurst(x, y) {
    if (!isRunning) return;
    const burstCount = 18 + Math.floor(Math.random() * 8);
    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 6.5;
      burstParticles.push(new LogicParticle(x, y, true, angle, speed));
    }
  }

  function drawConnections() {
    const maxDist = 115;
    const maxDistSq = maxDist * maxDist;
    const pLen = particles.length;

    ctx.lineWidth = 0.75;

    for (let i = 0; i < pLen; i++) {
      const p1 = particles[i];
      for (let j = i + 1; j < pLen; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDist) * 0.18;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(107, 255, 176, ${alpha})`;
          ctx.stroke();
        }
      }
    }
  }

  function loop() {
    if (!isRunning) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw circuit constellation traces
    drawConnections();

    // 2. Update and draw regular particles
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(ctx);
    }

    // 3. Update and draw burst particles
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const alive = burstParticles[i].update();
      if (alive) {
        burstParticles[i].draw(ctx);
      } else {
        burstParticles.splice(i, 1);
      }
    }

    animId = requestAnimationFrame(loop);
  }

  function start() {
    if (isRunning) return;
    if (!canvas) {
      canvas = document.getElementById(CANVAS_ID);
      if (!canvas) return;
      ctx = canvas.getContext('2d', { alpha: true });
    }

    isRunning = true;
    canvas.style.display = 'block';
    resize();
    spawnParticles();

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    animId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;

    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    window.removeEventListener('resize', handleResize);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('click', handleClick);

    // Free memory and hide canvas completely for zero performance footprint
    particles = [];
    burstParticles = [];
    if (ctx) ctx.clearRect(0, 0, width, height);
    if (canvas) canvas.style.display = 'none';
  }

  /* ===================== Event Listeners ===================== */

  function handleResize() {
    resize();
  }

  function handleMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.isActive = true;

    clearTimeout(mouse.timer);
    mouse.timer = setTimeout(() => {
      mouse.isActive = false;
    }, 1500);
  }

  function handleClick(e) {
    // Avoid triggering burst when clicking interactive form inputs/buttons
    const targetTag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (['input', 'button', 'select', 'textarea', 'a'].includes(targetTag)) {
      return;
    }
    triggerBurst(e.clientX, e.clientY);
  }

  function init() {
    const toggle = document.getElementById(TOGGLE_ID);
    if (!toggle) return;

    // Toggle switch handler
    toggle.addEventListener('change', () => {
      if (toggle.checked) {
        start();
      } else {
        stop();
      }
    });

    // Ensure default state is OFF
    toggle.checked = false;
    stop();
  }

  // Export control API
  window.BoolKineticCanvas = {
    start,
    stop,
    triggerBurst
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
