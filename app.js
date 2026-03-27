/* ===================================
   UTILIS TECHNOLOGIES v3 — Animations & Interactivity
   Adapted from Ember GEO with teal palette
   =================================== */

(function() {
  'use strict';

  // ===== EMBER PARTICLE CANVAS (Teal variant) =====
  const canvas = document.getElementById('ember-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: -1000, y: -1000 };
  let animFrame;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class TealParticle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + Math.random() * 100;
      this.size = Math.random() * 3 + 1;
      this.speedY = -(Math.random() * 0.8 + 0.2);
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.opacity = Math.random() * 0.6 + 0.1;
      this.fadeRate = Math.random() * 0.002 + 0.001;
      this.life = 1;
      this.hue = 160 + Math.random() * 30; // 160-190 range for teal/cyan
      this.wobbleSpeed = Math.random() * 0.02 + 0.01;
      this.wobblePhase = Math.random() * Math.PI * 2;
      this.time = 0;
    }

    update() {
      this.time++;
      this.wobblePhase += this.wobbleSpeed;
      this.x += this.speedX + Math.sin(this.wobblePhase) * 0.3;
      this.y += this.speedY;
      this.life -= this.fadeRate;

      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150;
        this.x += (dx / dist) * force * 2;
        this.y += (dy / dist) * force * 2;
      }

      if (this.life <= 0 || this.y < -50) {
        this.reset();
      }
    }

    draw() {
      const alpha = this.life * this.opacity;
      // Glow
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size * 4
      );
      gradient.addColorStop(0, `hsla(${this.hue}, 80%, 55%, ${alpha})`);
      gradient.addColorStop(0.4, `hsla(${this.hue}, 80%, 45%, ${alpha * 0.4})`);
      gradient.addColorStop(1, `hsla(${this.hue}, 80%, 35%, 0)`);
      
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue + 15}, 80%, 70%, ${alpha})`;
      ctx.fill();
    }
  }

  function initParticles() {
    const count = Math.min(80, Math.floor(window.innerWidth / 18));
    particles = [];
    for (let i = 0; i < count; i++) {
      const p = new TealParticle();
      p.y = Math.random() * canvas.height; // Spread initially
      particles.push(p);
    }
  }

  // Subtle moving gradient background (teal tints)
  let gradientAngle = 0;

  function drawBackground() {
    gradientAngle += 0.002;
    const cx = canvas.width * (0.5 + 0.3 * Math.sin(gradientAngle));
    const cy = canvas.height * (0.5 + 0.3 * Math.cos(gradientAngle * 0.7));
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.8);
    gradient.addColorStop(0, 'rgba(0, 40, 35, 0.6)');
    gradient.addColorStop(0.5, 'rgba(0, 20, 18, 0.3)');
    gradient.addColorStop(1, 'rgba(10, 15, 15, 0)');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function animateParticles() {
    drawBackground();
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    animFrame = requestAnimationFrame(animateParticles);
  }

  // Mouse tracking for particle interaction
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    initParticles();
  });

  resizeCanvas();
  initParticles();
  animateParticles();


  // ===== HERO CHARACTER REVEAL (Jeton per-char animation) =====
  function splitWordsToChars() {
    const words = document.querySelectorAll('.hero__title [data-chars]');
    words.forEach(word => {
      const text = word.textContent;
      word.innerHTML = '';
      word.classList.add('word');
      for (let i = 0; i < text.length; i++) {
        const wrap = document.createElement('span');
        wrap.className = 'char-wrap';
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.textContent = text[i];
        wrap.appendChild(charSpan);
        word.appendChild(wrap);
      }
    });
  }

  splitWordsToChars();

  function revealHeroChars() {
    const charWraps = document.querySelectorAll('.hero__title .char-wrap');
    charWraps.forEach((wrap, i) => {
      setTimeout(() => {
        wrap.classList.add('revealed');
      }, 80 + i * 35);
    });
  }

  // ===== HERO BODY + ACTIONS REVEAL =====
  function revealHeroContent() {
    const elements = document.querySelectorAll('.hero .reveal-text');
    elements.forEach((el, i) => {
      setTimeout(() => {
        el.classList.add('revealed');
      }, 1400 + i * 200);
    });
  }

  // Fire hero animations on load
  window.addEventListener('load', () => {
    setTimeout(revealHeroChars, 300);
    revealHeroContent();
  });


  // ===== SCROLL-TRIGGERED REVEALS =====
  function setupScrollReveals() {
    const reveals = document.querySelectorAll('.reveal-up, .reveal-card');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px'
    });

    reveals.forEach(el => observer.observe(el));
  }

  setupScrollReveals();


  // ===== COUNTER ANIMATIONS =====
  function animateCounter(el, target, isDecimal = false) {
    const duration = 1800;
    const startTime = performance.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    const suffix = el.querySelector('.stat__suffix');
    const textNode = el.childNodes[0];
    const hasChildElements = el.children.length > 0;

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOut(progress);
      const current = easedProgress * target;

      const displayVal = isDecimal ? current.toFixed(1) : Math.floor(current).toString();
      
      if (hasChildElements && textNode) {
        textNode.textContent = displayVal;
      } else {
        el.textContent = displayVal;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        const finalVal = isDecimal ? target.toFixed(1) : target.toString();
        if (hasChildElements && textNode) {
          textNode.textContent = finalVal;
        } else {
          el.textContent = finalVal;
        }
      }
    }

    requestAnimationFrame(tick);
  }

  function setupCounters() {
    const counters = document.querySelectorAll('[data-counter], [data-counter-decimal]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const isDecimal = el.hasAttribute('data-counter-decimal');
          const target = isDecimal 
            ? parseFloat(el.getAttribute('data-counter-decimal'))
            : parseInt(el.getAttribute('data-counter'));
          
          animateCounter(el, target, isDecimal);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
  }

  setupCounters();


  // ===== NAVBAR SCROLL BEHAVIOR =====
  let lastScroll = 0;
  const nav = document.getElementById('nav');

  if (nav) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      
      if (currentScroll > lastScroll && currentScroll > 100) {
        nav.classList.add('nav--hidden');
      } else {
        nav.classList.remove('nav--hidden');
      }
      
      lastScroll = currentScroll;
    }, { passive: true });
  }


  // ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Close mobile menu if open
      const toggle = document.getElementById('nav-toggle');
      if (toggle) toggle.checked = false;
    });
  });


  // ===== MOBILE MENU LINK CLOSE =====
  document.querySelectorAll('.nav__mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      const toggle = document.getElementById('nav-toggle');
      if (toggle) toggle.checked = false;
    });
  });

})();
