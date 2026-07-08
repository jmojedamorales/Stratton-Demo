/* ══════════════════════════════════════════════════════════════
   ANIMATIONS.JS — IntersectionObserver para .reveal elements,
                   cursor glow effect (desktop only)
   ══════════════════════════════════════════════════════════════ */

/* ── Cursor glow ────────────────────────────────────────── */
const glow = document.getElementById('cursorGlow');
if (window.matchMedia('(pointer: fine)').matches) {
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top  = e.clientY + 'px';
  });
} else {
  glow.style.display = 'none';
}

/* ── Reveal on scroll ───────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => io.observe(el));
