// Asset URL Resolver for Dual-Platform (Vite & WordPress) Parity
function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const themeBase = (window.sunriseTheme && window.sunriseTheme.themeUri) 
    ? window.sunriseTheme.themeUri.replace(/\/+$/, '') 
    : (window.sunriseThemeUri ? window.sunriseThemeUri.replace(/\/+$/, '') : '');
  let clean = url.replace(/^\.\/public\//, '/').replace(/^\/public\//, '/').replace(/^public\//, '/');
  if (!clean.startsWith('/')) clean = '/' + clean;
  return themeBase ? (themeBase + clean) : clean;
}

// GSAP and Lenis are loaded via CDN in the HTML (globals: gsap, ScrollTrigger, Lenis)
// This makes the site work both locally (Vite) and on GitHub Pages (static)
if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1. Lenis Smooth Scroll
let lenis = null;
if (!prefersReducedMotion && typeof Lenis !== 'undefined') {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
  if (typeof gsap !== 'undefined') {
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

// 2. Canvas Loop
const TOTAL_FRAMES = 300;
const frames = [];
let currentFrameIndex = 0;
let isPlaying = true;
let lastTimestamp = 0;
const FPS = 30;
const FRAME_INTERVAL = 1000 / FPS;

function pad(num, size) {
  let s = num + '';
  while (s.length < size) s = '0' + s;
  return s;
}

function initCanvasAnimation() {
  const canvas = document.getElementById('heroCanvas');
  const slider = document.getElementById('frameSlider');
  const counter = document.getElementById('frameCounter');
  const playBtn = document.getElementById('togglePlayBtn');
  const playIcon = document.getElementById('playIcon');

  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.parentElement.clientWidth * dpr;
    canvas.height = canvas.parentElement.clientHeight * dpr;
    renderCurrentFrame();
  }

  window.addEventListener('resize', resizeCanvas);

  const themeBase = (window.sunriseTheme && window.sunriseTheme.themeUri) 
    ? window.sunriseTheme.themeUri.replace(/\/+$/, '') 
    : (window.sunriseThemeUri ? window.sunriseThemeUri.replace(/\/+$/, '') : '');
  const framesFolder = themeBase ? (themeBase + '/frames_webp') : '/frames_webp';

  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const img = new Image();
    img.src = framesFolder + '/ezgif-frame-' + pad(i, 3) + '.webp';
    frames.push(img);
  }

  function hideHeroFallback() {
    const fallback = document.getElementById('heroCanvasFallback');
    if (fallback) {
      fallback.style.opacity = '0';
      setTimeout(() => { if (fallback.parentNode) fallback.style.display = 'none'; }, 800);
    }
  }

  if (frames[0].complete) {
    resizeCanvas();
    hideHeroFallback();
  } else {
    frames[0].onload = () => {
      resizeCanvas();
      hideHeroFallback();
    };
    frames[0].onerror = () => {
      resizeCanvas();
    };
  }

  // Set canvas dimensions immediately
  resizeCanvas();

  function renderFrame(index) {
    if (!frames[index] || !frames[index].complete) return;
    const img = frames[index];
    const cw = canvas.width;
    const ch = canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = cw / ch;
    let renderW, renderH, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      renderW = cw;
      renderH = cw / imgRatio;
      offsetX = 0;
      offsetY = (ch - renderH) / 2;
    } else {
      renderH = ch;
      renderW = ch * imgRatio;
      offsetX = (cw - renderW) / 2;
      offsetY = 0;
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);

    if (slider) slider.value = index + 1;
    if (counter) counter.textContent = pad(index + 1, 3);
  }

  function renderCurrentFrame() { renderFrame(currentFrameIndex); }

  function animationLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    if (isPlaying && delta >= FRAME_INTERVAL) {
      currentFrameIndex = (currentFrameIndex + 1) % TOTAL_FRAMES;
      renderCurrentFrame();
      lastTimestamp = timestamp - (delta % FRAME_INTERVAL);
    }
    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  if (slider) {
    slider.addEventListener('input', (e) => {
      isPlaying = false;
      currentFrameIndex = parseInt(e.target.value, 10) - 1;
      renderCurrentFrame();
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      if (playIcon) playIcon.textContent = isPlaying ? '\u23f8' : '\u25b6';
    });
  }

  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 0.5,
    onUpdate: (self) => {
      if (!isPlaying) {
        const frameIndex = Math.min(
          TOTAL_FRAMES - 1,
          Math.floor(self.progress * (TOTAL_FRAMES - 1))
        );
        currentFrameIndex = frameIndex;
        renderCurrentFrame();
      }
    }
  });
}

// 3. Preloader + Hero Entrance
function initPreloader() {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloaderBar');
  const counter = document.getElementById('preloaderCounter');

  if (!preloader) {
    initScrollAnimations();
    return;
  }

  // SAFETY FALLBACK: always dismiss preloader after 3s max
  const safetyTimer = setTimeout(() => {
    preloader.classList.add('fade-out');
    setTimeout(() => { preloader.remove(); revealHero(); }, 700);
  }, 3000);

  if (prefersReducedMotion) {
    clearTimeout(safetyTimer);
    preloader.style.display = 'none';
    revealHero();
    return;
  }

  // If GSAP unavailable, fallback to CSS/manual animation
  if (typeof gsap === 'undefined') {
    let v = 0;
    const interval = setInterval(() => {
      v = Math.min(100, v + 5);
      if (bar) bar.style.width = v + '%';
      if (counter) counter.textContent = v + '%';
      if (v >= 100) {
        clearInterval(interval);
        clearTimeout(safetyTimer);
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.remove(); revealHero(); }, 700);
      }
    }, 25);
    return;
  }

  let progress = { val: 0 };
  gsap.to(progress, {
    val: 100,
    duration: 1.6,
    ease: 'power2.inOut',
    onUpdate: () => {
      const v = Math.floor(progress.val);
      if (bar) bar.style.width = v + '%';
      if (counter) counter.textContent = v + '%';
    },
    onComplete: () => {
      clearTimeout(safetyTimer);
      preloader.classList.add('fade-out');
      setTimeout(() => {
        preloader.remove();
        revealHero();
      }, 700);
    }
  });
}

function revealHero() {
  initScrollAnimations();

  const heroEl = document.getElementById('hero');
  if (!heroEl) return;

  if (prefersReducedMotion) {
    document.querySelectorAll('.hero-eyebrow, .hero-line, .hero-paragraph, .hero-actions, .hero-trust-stack').forEach(el => {
      el.classList.add('is-visible');
    });
    return;
  }

  const tl = gsap.timeline();

  tl.call(() => {
    const ey = document.getElementById('heroEyebrow');
    if (ey) ey.classList.add('is-visible');
  }, [], 0.1);

  tl.call(() => {
    const lines = document.querySelectorAll('.hero-line');
    lines.forEach((line, i) => {
      setTimeout(() => {
        line.classList.add('is-visible');
        line.style.transitionDelay = (i * 0.15) + 's';
      }, i * 150);
    });
  }, [], 0.4);

  tl.call(() => {
    const p = document.getElementById('heroPara');
    if (p) p.classList.add('is-visible');
  }, [], 1.1);

  tl.call(() => {
    const a = document.getElementById('heroActions');
    if (a) a.classList.add('is-visible');
  }, [], 1.4);

  tl.call(() => {
    const ts = document.getElementById('heroTrustStack');
    if (ts) ts.classList.add('is-visible');
  }, [], 0.8);

  tl.play();
}

// 4. Custom Luxury Cursor
function initCustomCursor() {
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring || window.matchMedia('(pointer: coarse)').matches) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let ringX = mouseX;
  let ringY = mouseY;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.opacity = '1';
    ring.style.opacity = '1';
    dot.style.transform = 'translate(' + mouseX + 'px, ' + mouseY + 'px)';
  });

  function renderCursor() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    ring.style.transform = 'translate(' + ringX + 'px, ' + ringY + 'px)';
    requestAnimationFrame(renderCursor);
  }
  requestAnimationFrame(renderCursor);

  const clickables = document.querySelectorAll('a, button, input, select, textarea, .service-entry, .project-entry, .faq-trigger, .trust-card');
  clickables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      ring.style.width = '56px';
      ring.style.height = '56px';
      ring.style.borderColor = 'rgba(158, 122, 42, 0.8)';
      ring.style.background = 'rgba(158, 122, 42, 0.06)';
    });
    el.addEventListener('mouseleave', () => {
      ring.style.width = '38px';
      ring.style.height = '38px';
      ring.style.borderColor = 'rgba(158, 122, 42, 0.4)';
      ring.style.background = 'transparent';
    });
  });
}

// 5. Header + Active Nav
function initHeader() {
  const header = document.getElementById('siteHeader');
  if (!header) return;

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    let current = '';
    sections.forEach(sec => {
      const sectionTop = sec.offsetTop - 120;
      if (window.scrollY >= sectionTop) {
        current = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  }, { passive: true });
}

// 6. Advanced Scroll Animations (GSAP ScrollTrigger + IntersectionObserver)
function initScrollAnimations() {
  if (prefersReducedMotion) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.12
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-item, .protocol-card, .service-entry, .pillar-row, .faq-item, .founder-card-strip, .clip-reveal, .parallax-wrap, .split-line-wrap').forEach(el => {
    revealObserver.observe(el);
  });

  // Staggered reveal for section editorial titles
  document.querySelectorAll('.editorial-heading').forEach(heading => {
    ScrollTrigger.create({
      trigger: heading,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.fromTo(heading,
          { y: 36, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out' }
        );
      }
    });
  });

  // Numbers counter trigger
  const metricsStrip = document.querySelector('.hero-metrics-strip, .metrics-flex');
  if (metricsStrip) {
    ScrollTrigger.create({
      trigger: metricsStrip,
      start: 'top 85%',
      once: true,
      onEnter: () => animateCounters()
    });
  }

  // Smooth project gallery entrance
  const projectsGallery = document.querySelector('.projects-gallery');
  if (projectsGallery) {
    ScrollTrigger.create({
      trigger: projectsGallery,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        const cards = projectsGallery.querySelectorAll('.project-entry');
        gsap.fromTo(cards,
          { y: 45, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.75, stagger: 0.08, ease: 'power2.out' }
        );
      }
    });
  }

  // Subtle image parallax
  const aboutImg = document.querySelector('.about-img');
  if (aboutImg && document.querySelector('.about-media-col')) {
    gsap.to(aboutImg, {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: '.about-media-col',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.2
      }
    });
  }

  // Smooth canvas parallax
  if (document.getElementById('hero')) {
    gsap.to('.hero-canvas-container', {
      yPercent: 18,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.8
      }
    });
  }
}

function animateCounters() {
  document.querySelectorAll('.count-up').forEach(c => {
    const target = +c.getAttribute('data-target');
    const obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 2.2,
      ease: 'power3.out',
      onUpdate: () => {
        c.textContent = Math.floor(obj.val).toLocaleString('en-IN');
      },
      onComplete: () => {
        c.classList.add('count-pulse');
        setTimeout(() => c.classList.remove('count-pulse'), 400);
      }
    });
  });
}

// 7. Services Interactive Accordion
function initServicesInteractivity() {
  const entries = document.querySelectorAll('.service-entry');
  const badge = document.getElementById('previewBadge');
  const title = document.getElementById('previewTitle');
  const scope = document.getElementById('previewScope');
  const deliverables = document.getElementById('previewDeliverables');

  if (!entries.length) return;

  function updateDesktopPreview(entry) {
    if (window.innerWidth <= 900) return; // Managed by mobile accordion below
    entries.forEach(e => e.classList.remove('active'));
    entry.classList.add('active');

    if (!badge || !title || !scope || !deliverables) return;
    const sNum = entry.getAttribute('data-service');
    const sTitle = entry.getAttribute('data-title');
    const sScope = entry.getAttribute('data-scope');
    const d1 = entry.getAttribute('data-d1');
    const d2 = entry.getAttribute('data-d2');
    const d3 = entry.getAttribute('data-d3');

    badge.textContent = 'DISCIPLINE 0' + sNum;
    title.textContent = sTitle;
    scope.textContent = sScope;
    deliverables.innerHTML = '<li>' + d1 + '</li><li>' + d2 + '</li><li>' + d3 + '</li>';

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('#servicePreviewPanel',
        { opacity: 0.7, y: 6, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' }
      );
    }
  }

  function handleEntryClick(entry) {
    if (window.innerWidth <= 900) {
      // Mobile accordion toggle
      const isAlreadyActive = entry.classList.contains('active');
      entries.forEach(e => e.classList.remove('active'));
      if (!isAlreadyActive) {
        entry.classList.add('active');
        // Smoothly bring the opened entry into comfortable view
        setTimeout(() => {
          const rect = entry.getBoundingClientRect();
          if (rect.top < 80 || rect.bottom > window.innerHeight) {
            entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 150);
      }
    } else {
      updateDesktopPreview(entry);
    }
  }

  entries.forEach(entry => {
    entry.addEventListener('click', () => handleEntryClick(entry));
    entry.addEventListener('mouseenter', () => {
      if (window.innerWidth > 900) updateDesktopPreview(entry);
    });
  });

  // Ensure first entry is active on load
  if (entries.length && !document.querySelector('.service-entry.active')) {
    entries[0].classList.add('active');
  }
}

// Global openModal function for all project cards across all pages
let openProjectModal = null;

// 8. Projects Filter + Robust Modal Scroll
function initProjects() {
  const tabs = document.querySelectorAll('.projects-gallery-section .filter-tab, .projects-section:not(.projects-carousel-section) .filter-tab');
  const entries = document.querySelectorAll('.projects-gallery .project-entry');
  const modal = document.getElementById('projectModal');
  const scrim = document.getElementById('modalScrim');
  const close = document.getElementById('modalClose');
  const slot = document.getElementById('modalSlot');
  const dialog = modal ? modal.querySelector('.modal-dialog') : null;

  // Bind direct wheel & touch handling on modal dialog to guarantee internal scrolling
  if (dialog && !dialog._scrollListenersAttached) {
    dialog._scrollListenersAttached = true;
    dialog.setAttribute('data-lenis-prevent', '');
    if (modal) modal.setAttribute('data-lenis-prevent', '');
    if (slot) slot.setAttribute('data-lenis-prevent', '');

    dialog.addEventListener('wheel', (e) => {
      e.stopPropagation();
      const maxScroll = dialog.scrollHeight - dialog.clientHeight;
      if (maxScroll > 0) {
        dialog.scrollTop += e.deltaY;
        // Prevent background bounce when scrolling inside bounds
        if ((e.deltaY > 0 && dialog.scrollTop < maxScroll) || (e.deltaY < 0 && dialog.scrollTop > 0)) {
          e.preventDefault();
        }
      }
    }, { passive: false });

    dialog.addEventListener('touchmove', (e) => {
      e.stopPropagation();
    }, { passive: true });
  }

  function openModal(entry) {
    if (!modal || !slot) return;
    const title = entry.getAttribute('data-title') || '';
    const type = entry.getAttribute('data-type') || '';
    const scale = entry.getAttribute('data-scale') || '';
    const loc = entry.getAttribute('data-location') || '';
    const img = resolveAssetUrl(entry.getAttribute('data-img') || '');
    const desc = (entry.querySelector('.entry-desc') || {}).textContent || '';
    const galleryRaw = entry.getAttribute('data-gallery') || '';
    const videoSrc   = entry.getAttribute('data-video')   || '';
    const galleryImgs = galleryRaw
      ? galleryRaw.split(',').map(s => resolveAssetUrl(s.trim())).filter(Boolean)
      : (videoSrc ? [] : [img]);

    // Build hero: video OR multi-image carousel OR single image
    let heroHTML = '';
    if (videoSrc) {
      // ---- VIDEO HERO ----
      const vsrc = resolveAssetUrl(videoSrc);
      heroHTML = [
        '<div style="height:340px;overflow:hidden;margin-bottom:28px;border-radius:4px;position:relative;background:#0F172A;">',
        '<video id="mgc-video" src="' + vsrc + '" controls playsinline style="width:100%;height:100%;object-fit:cover;display:block;" preload="auto"></video>',
        '<div style="position:absolute;top:12px;left:12px;font-size:0.65rem;letter-spacing:0.18em;color:#fff;font-weight:700;background:rgba(158,122,42,0.92);padding:5px 12px;border-radius:2px;box-shadow:0 2px 10px rgba(0,0,0,0.25);pointer-events:none;">' + type + '</div>',
        '</div>'
      ].join('');
    } else if (galleryImgs.length > 1) {
      const slides = galleryImgs.map((src, i) =>
        '<div class="mgc-slide" style="min-width:100%;height:100%;flex-shrink:0;">' +
        '<img src="' + src + '" alt="' + title + ' — photo ' + (i+1) + '" ' +
        'style="width:100%;height:100%;object-fit:cover;">' +
        '</div>'
      ).join('');
      const dots = galleryImgs.map((_, i) =>
        '<button class="mgc-dot' + (i === 0 ? ' mgc-dot-active' : '') + '" data-idx="' + i + '" ' +
        'aria-label="Photo ' + (i+1) + '" style="width:8px;height:8px;border-radius:50%;border:none;cursor:pointer;' +
        'background:' + (i === 0 ? '#B88E28' : 'rgba(255,255,255,0.5)') + ';padding:0;transition:background 0.25s;"></button>'
      ).join('');
      heroHTML = [
        '<div id="mgc-wrap" style="height:340px;overflow:hidden;margin-bottom:28px;border-radius:4px;position:relative;background:var(--bg-stone);touch-action:pan-y;">',
        '  <div id="mgc-track" style="display:flex;height:100%;transition:transform 0.42s cubic-bezier(0.25,0.46,0.45,0.94);">' + slides + '</div>',
        '  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.5));pointer-events:none;"></div>',
        '  <div style="position:absolute;bottom:16px;left:16px;font-size:0.65rem;letter-spacing:0.18em;color:#fff;font-weight:700;background:rgba(158,122,42,0.92);padding:5px 12px;border-radius:2px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">' + type + '</div>',
        '  <div id="mgc-counter" style="position:absolute;bottom:16px;right:16px;font-size:0.68rem;letter-spacing:0.1em;color:rgba(255,255,255,0.85);font-weight:700;background:rgba(0,0,0,0.4);padding:4px 10px;border-radius:20px;">1 / ' + galleryImgs.length + '</div>',
        '  <button id="mgc-prev" aria-label="Previous photo" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,0.7);background:rgba(0,0,0,0.35);color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background 0.2s;">&#8592;</button>',
        '  <button id="mgc-next" aria-label="Next photo" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:2px solid rgba(255,255,255,0.7);background:rgba(0,0,0,0.35);color:#fff;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:5;transition:background 0.2s;">&#8594;</button>',
        '  <div id="mgc-dots" style="position:absolute;bottom:46px;left:50%;transform:translateX(-50%);display:flex;gap:7px;align-items:center;">' + dots + '</div>',
        '</div>'
      ].join('');
    } else {
      heroHTML = [
        '<div style="height:320px;overflow:hidden;margin-bottom:28px;border-radius:4px;position:relative;background:var(--bg-stone);">',
        '<img src="' + img + '" alt="' + title + '" style="width:100%;height:100%;object-fit:cover;transition:transform 0.6s ease;" onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">',
        '<div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.45));pointer-events:none;"></div>',
        '<div style="position:absolute;bottom:16px;left:16px;font-size:0.65rem;letter-spacing:0.18em;color:#fff;font-weight:700;background:rgba(158,122,42,0.92);padding:5px 12px;border-radius:2px;box-shadow:0 2px 10px rgba(0,0,0,0.25);">' + type + '</div>',
        '</div>'
      ].join('');
    }

    slot.innerHTML = [
      heroHTML,
      '<div style="font-size:0.72rem;letter-spacing:0.18em;color:var(--accent-gold);font-weight:700;margin-bottom:8px;text-transform:uppercase;">' + loc + '</div>',
      '<h3 style="font-family:var(--font-serif-roman);font-size:2.2rem;color:var(--text-primary);margin-bottom:14px;line-height:1.15;">' + title + '</h3>',
      '<p style="font-size:1rem;color:var(--text-secondary);line-height:1.8;margin-bottom:28px;">' + desc + '</p>',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:32px;background:var(--bg-stone);padding:22px;border:1px solid var(--border-hairline);border-radius:4px;">',
      '<div><span style="font-size:0.64rem;color:var(--text-muted);letter-spacing:0.14em;display:block;margin-bottom:6px;text-transform:uppercase;font-weight:700;">Engagement Mandate</span>',
      '<strong style="font-size:0.95rem;color:var(--text-primary);display:block;">Turnkey PMC &amp; Technical Governance</strong></div>',
      '<div><span style="font-size:0.64rem;color:var(--text-muted);letter-spacing:0.14em;display:block;margin-bottom:6px;text-transform:uppercase;font-weight:700;">Development Scale</span>',
      '<strong style="font-size:0.95rem;color:var(--accent-gold);display:block;">' + scale + '</strong></div>',
      '</div>',
      '<div style="display:flex;gap:14px;flex-wrap:wrap;padding-bottom:12px;">',
      '<a href="./contact.html" class="btn-editorial btn-accent" onclick="document.getElementById(\'modalClose\')?.click();"><span>Inquire Similar Project</span></a>',
      '<a href="https://wa.me/919586000933?text=Inquiring%20about%20' + encodeURIComponent(title) + '" target="_blank" class="btn-editorial btn-outline"><span>WhatsApp Consultation</span></a>',
      '</div>'
    ].join('');

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    // Stop Lenis smoothly so modal internal scroll is 100% active
    if (lenis) lenis.stop();

    // Reset modal scroll position
    if (dialog) dialog.scrollTop = 0;

    if (typeof gsap !== 'undefined') {
      gsap.fromTo('.modal-dialog',
        { y: 35, opacity: 0, scale: 0.96 },
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'power3.out' }
      );
    }

    // --- Modal Gallery Carousel init ---
    if (galleryImgs.length > 1) {
      const track   = document.getElementById('mgc-track');
      const prevBtn = document.getElementById('mgc-prev');
      const nextBtn = document.getElementById('mgc-next');
      const counter = document.getElementById('mgc-counter');
      const dotsEl  = document.getElementById('mgc-dots');
      const wrap    = document.getElementById('mgc-wrap');
      let cur = 0;
      const total = galleryImgs.length;

      function goTo(idx) {
        cur = (idx + total) % total;
        track.style.transform = 'translateX(-' + (cur * 100) + '%)';
        counter.textContent = (cur + 1) + ' / ' + total;
        dotsEl.querySelectorAll('.mgc-dot').forEach((d, i) => {
          d.style.background = i === cur ? '#B88E28' : 'rgba(255,255,255,0.5)';
          d.classList.toggle('mgc-dot-active', i === cur);
        });
      }

      prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(cur - 1); });
      nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(cur + 1); });
      dotsEl.querySelectorAll('.mgc-dot').forEach(d => {
        d.addEventListener('click', (e) => { e.stopPropagation(); goTo(+d.dataset.idx); });
      });

      // Touch/swipe support
      let touchStartX = 0;
      wrap.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
      wrap.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) goTo(dx < 0 ? cur + 1 : cur - 1);
      }, { passive: true });

      // Keyboard left/right when modal is open
      wrap._keyHandler = (e) => {
        if (e.key === 'ArrowLeft')  goTo(cur - 1);
        if (e.key === 'ArrowRight') goTo(cur + 1);
      };
      document.addEventListener('keydown', wrap._keyHandler);
    }
  }

  openProjectModal = openModal;

  function closeModal() {
    if (!modal) return;
    // Pause video if playing in modal
    const vid = document.getElementById('mgc-video');
    if (vid) { vid.pause(); }
    // Remove any carousel keyboard listener
    const wrap = document.getElementById('mgc-wrap');
    if (wrap && wrap._keyHandler) {
      document.removeEventListener('keydown', wrap._keyHandler);
      wrap._keyHandler = null;
    }
    const finish = () => {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      // Restart Lenis so page scrolls again smoothly
      if (lenis) {
        lenis.start();
        lenis.resize();
      }
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    };
    if (typeof gsap !== 'undefined') {
      gsap.to('.modal-dialog', {
        y: 20, opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in',
        onComplete: finish
      });
    } else {
      finish();
    }
  }

  // Gallery tabs filtering (used on projects.html)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.getAttribute('data-filter');

      const visible = [];
      entries.forEach(entry => {
        const cat = entry.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          entry.style.display = 'flex';
          visible.push(entry);
        } else {
          entry.style.display = 'none';
        }
      });

      if (typeof gsap !== 'undefined') {
        gsap.fromTo(visible,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
        );
      }

      if (lenis) lenis.resize();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

  entries.forEach(entry => entry.addEventListener('click', () => openModal(entry)));
  if (scrim) scrim.addEventListener('click', closeModal);
  if (close) close.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal();
  });
}

// 8b. 3D Awards-Winning Landmark Carousel (Home Page)
function init3DCarousel() {
  const track = document.getElementById('carousel3DTrack');
  const stage = document.getElementById('carousel3DStage');
  if (!track || !stage) return;

  const cards = Array.from(track.querySelectorAll('.carousel-card-3d'));
  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');
  const currentNumEl = document.getElementById('carouselCurrentNum');
  const totalNumEl = document.getElementById('carouselTotalNum');
  const progressBarEl = document.getElementById('carouselProgressBar');
  const filterTabs = document.querySelectorAll('.projects-carousel-section .portfolio-filters .filter-tab');

  if (!cards.length) return;

  let activeIndex = 0;
  const total = cards.length;
  let autoPlayTimer = null;

  function padZero(num) {
    return num < 10 ? '0' + num : '' + num;
  }

  if (totalNumEl) totalNumEl.textContent = padZero(total);

  function update3DLayout() {
    const isMobile = window.innerWidth <= 768;
    const isSmallPhone = window.innerWidth <= 480;
    const xStep = isSmallPhone ? 190 : isMobile ? 240 : 360;
    const zStep = isSmallPhone ? -130 : isMobile ? -160 : -190;
    const rotStep = isMobile ? 22 : 30;

    cards.forEach((card, idx) => {
      let offset = idx - activeIndex;
      // Wrap around offset to shortest path
      const half = total / 2;
      while (offset > half) offset -= total;
      while (offset < -half) offset += total;

      const absOffset = Math.abs(offset);

      if (absOffset === 0) {
        // Active Center Card
        card.style.transform = 'translate3d(0, 0, 70px) rotateY(0deg) scale(1.04)';
        card.style.opacity = '1';
        card.style.zIndex = '35';
        card.style.filter = 'none';
        card.style.pointerEvents = 'auto';
        card.classList.add('is-active');
      } else if (absOffset === 1) {
        // Immediate Neighbors (Left / Right)
        const dir = offset > 0 ? 1 : -1;
        card.style.transform = 'translate3d(' + (dir * xStep) + 'px, 0, ' + zStep + 'px) rotateY(' + (-dir * rotStep) + 'deg) scale(0.88)';
        card.style.opacity = '0.82';
        card.style.zIndex = '25';
        card.style.filter = 'brightness(0.82) contrast(0.96)';
        card.style.pointerEvents = 'auto';
        card.classList.remove('is-active');
      } else if (absOffset === 2) {
        // Second Neighbors
        const dir = offset > 0 ? 1 : -1;
        card.style.transform = 'translate3d(' + (dir * (xStep * 1.75)) + 'px, 0, ' + (zStep * 1.9) + 'px) rotateY(' + (-dir * (rotStep * 1.35)) + 'deg) scale(0.74)';
        card.style.opacity = '0.45';
        card.style.zIndex = '15';
        card.style.filter = 'brightness(0.65)';
        card.style.pointerEvents = 'auto';
        card.classList.remove('is-active');
      } else {
        // Distant Background
        const dir = offset > 0 ? 1 : -1;
        card.style.transform = 'translate3d(' + (dir * (xStep * 2.2)) + 'px, 0, -420px) scale(0.6)';
        card.style.opacity = '0';
        card.style.zIndex = '1';
        card.style.pointerEvents = 'none';
        card.classList.remove('is-active');
      }
    });

    if (currentNumEl) currentNumEl.textContent = padZero(activeIndex + 1);
    if (progressBarEl) progressBarEl.style.width = (((activeIndex + 1) / total) * 100) + '%';
  }

  function goTo(index) {
    activeIndex = (index + total) % total;
    update3DLayout();
  }

  function next() {
    goTo(activeIndex + 1);
  }

  function prev() {
    goTo(activeIndex - 1);
  }

  if (nextBtn) nextBtn.addEventListener('click', () => { resetAuto(); next(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { resetAuto(); prev(); });

  // Click on cards
  cards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      resetAuto();
      if (idx === activeIndex) {
        if (openProjectModal) openProjectModal(card);
      } else {
        goTo(idx);
      }
    });
  });

  // Category filter tabs on carousel
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      resetAuto();
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.getAttribute('data-filter');

      if (filter === 'all') {
        goTo(0);
      } else {
        const found = cards.findIndex(c => c.getAttribute('data-category') === filter);
        if (found !== -1) {
          goTo(found);
        }
      }
    });
  });

  // Touch and mouse drag swipe support
  let isPointerDown = false;
  let startX = 0;
  let currentDragX = 0;

  stage.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    startX = e.clientX;
    currentDragX = e.clientX;
    resetAuto();
  });

  window.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    currentDragX = e.clientX;
  });

  window.addEventListener('pointerup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    const diff = currentDragX - startX;
    if (Math.abs(diff) > 45) {
      if (diff < 0) next();
      else prev();
    }
  });

  // Keyboard navigation when stage is in view
  window.addEventListener('keydown', (e) => {
    const rect = stage.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      if (e.key === 'ArrowRight') { resetAuto(); next(); }
      if (e.key === 'ArrowLeft') { resetAuto(); prev(); }
    }
  });

  // Autoplay with subtle slow interval
  function startAuto() {
    stopAuto();
    autoPlayTimer = setInterval(next, 5500);
  }

  function stopAuto() {
    if (autoPlayTimer) clearInterval(autoPlayTimer);
  }

  function resetAuto() {
    stopAuto();
    startAuto();
  }

  stage.addEventListener('mouseenter', stopAuto);
  stage.addEventListener('mouseleave', startAuto);

  window.addEventListener('resize', update3DLayout);

  // Initialize
  update3DLayout();
  startAuto();
}

// 9. PMC Scope Estimator
function initCalculator() {
  const typo = document.getElementById('typologySelect');
  const slider = document.getElementById('areaSlider');
  const areaDisplay = document.getElementById('areaValueDisplay');
  const teamVal = document.getElementById('teamAllocVal');
  const timelineVal = document.getElementById('timelineVal');
  const savingsVal = document.getElementById('savingsVal');

  if (!slider || !areaDisplay) return;

  function calculate() {
    const area = parseInt(slider.value, 10);
    areaDisplay.textContent = area.toLocaleString('en-IN') + ' Sq.Ft.';

    let team = '3 - 4 Resident Engineers';
    let timeline = '18 - 22 Months';
    let savings = '\u20b980 Lakh - 1.2 Cr';

    if (area > 1000000) {
      team = '8 - 12 Resident Engineers (Multi-Tower)';
      timeline = '32 - 40 Months';
      savings = '\u20b93.5 - 5.0+ Cr';
    } else if (area > 500000) {
      team = '6 - 8 Resident Engineers';
      timeline = '26 - 32 Months';
      savings = '\u20b92.2 - 3.2 Cr';
    } else if (area > 200000) {
      team = '4 - 6 Resident Engineers';
      timeline = '22 - 28 Months';
      savings = '\u20b91.5 - 2.2 Cr';
    }

    function animateVal(el, val) {
      gsap.to(el, { opacity: 0, y: -6, duration: 0.15, onComplete: () => {
        el.textContent = val;
        gsap.to(el, { opacity: 1, y: 0, duration: 0.25 });
      }});
    }

    if (teamVal) animateVal(teamVal, team);
    if (timelineVal) animateVal(timelineVal, timeline);
    if (savingsVal) animateVal(savingsVal, savings);
  }

  slider.addEventListener('input', calculate);
  if (typo) typo.addEventListener('change', calculate);
}

// 10. FAQ Accordion
function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');
      items.forEach(i => {
        i.classList.remove('active');
        const t = i.querySelector('.faq-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('active');
        trigger.setAttribute('aria-expanded', 'true');
      }
      if (lenis) lenis.resize();
    });
  });
}

// 11. Mobile Drawer
function initMobileMenu() {
  const toggle = document.getElementById('mobileToggle');
  const drawer = document.getElementById('mobileDrawer');
  const close = document.getElementById('mobileClose');
  const bg = document.getElementById('mobileDrawerBg');
  const items = document.querySelectorAll('.mobile-nav-item');

  if (!toggle || !drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', openDrawer);
  if (close) close.addEventListener('click', closeDrawer);
  if (bg) bg.addEventListener('click', closeDrawer);
  items.forEach(i => i.addEventListener('click', closeDrawer));
}

// 12. Form Submission with Direct Email Dispatch to sunrisepmcas@gmail.com
function initForm() {
  const form = document.getElementById('projectInquiryForm');
  const feedback = document.getElementById('formFeedback');
  const btn = document.getElementById('submitBtn');

  if (!form || !feedback) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Transmitting Dossier...</span>';
    }

    const endpoint = form.action && form.action.includes('formsubmit.co')
      ? form.action
      : 'https://formsubmit.co/ajax/sunrisepmcas@gmail.com';

    let emailSent = false;

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (resp.ok) {
        emailSent = true;
      }
    } catch (err) {
      console.warn('FormSubmit AJAX notification:', err);
    }

    // Render clean architectural luxury feedback card
    feedback.className = 'form-feedback success';
    feedback.style.display = 'block';
    feedback.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px solid var(--accent-gold); border-radius: 6px; padding: 20px 24px; text-align: left; margin-top: 18px; box-shadow: 0 8px 24px rgba(184, 142, 40, 0.12);">
        <div style="display: flex; align-items: center; gap: 10px; color: #8C6510; font-weight: 700; font-size: 1rem; margin-bottom: 8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B88E28" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          <span>Strategic Dossier Successfully Transmitted!</span>
        </div>
        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.6; margin: 0;">
          ${emailSent 
            ? 'Your dossier has been securely dispatched to our executive desk at <strong>sunrisepmcas@gmail.com</strong>.' 
            : 'Your project inquiry has been recorded.'}
          Our Managing Director will review your constructability and billing feasibility within 24 hours.
        </p>
      </div>
    `;

    form.reset();

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml || '<span>Submit Strategic Dossier</span>';
    }
  });
}
// 13. Dynamic Year
function initYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
}

// 14. Trust Card 3D Tilt
function initTrustCardTilt() {
  const cards = document.querySelectorAll('.trust-card');
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = 'perspective(600px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 8) + 'deg) translateX(-4px) scale(1.02)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initPreloader();
  initCanvasAnimation();
  initCustomCursor();
  initHeader();
  initServicesInteractivity();
  initProjects();
  init3DCarousel();
  initCalculator();
  initFaq();
  initMobileMenu();
  initForm();
  initYear();
  initTrustCardTilt();
  initDoodleAnimations();
});

// 15. Architectural Doodle Motion & Smooth Parallax
function initDoodleAnimations() {
  if (prefersReducedMotion || typeof gsap === 'undefined') return;
  const doodles = document.querySelectorAll('.pmc-doodle-svg');
  doodles.forEach((doodle, index) => {
    const isEven = index % 2 === 0;
    gsap.to(doodle, {
      y: isEven ? -16 : 16,
      rotation: isEven ? 4 : -4,
      duration: 5.5 + (index * 0.7),
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });
  });
}

