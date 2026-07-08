/* ══════════════════════════════════════════════════════════════
   NAVBAR.JS — Scroll behavior (scrolled class),
               hamburger toggle, mobile nav open/close,
               smooth active nav link highlight
   ══════════════════════════════════════════════════════════════ */

/* ── Navbar scroll ──────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

/* ── Mobile nav ─────────────────────────────────────────── */
const mobileNav    = document.getElementById('mobileNav');
const hamburger    = document.getElementById('navHamburger');
const navBackdrop  = document.getElementById('navBackdrop');

function openMobileNav() {
  mobileNav.classList.add('open');
  hamburger.classList.add('is-open');
  navBackdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeMobileNav() {
  mobileNav.classList.remove('open');
  hamburger.classList.remove('is-open');
  navBackdrop.classList.remove('visible');
  document.body.style.overflow = '';
}
function toggleMobileNav() {
  mobileNav.classList.contains('open') ? closeMobileNav() : openMobileNav();
}

/* Cerrar con tecla Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mobileNav.classList.contains('open')) closeMobileNav();
});

/* ── Smooth active nav link ─────────────────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  navLinks.forEach(a => {
    a.style.color = a.getAttribute('href') === '#' + current ? 'var(--gold)' : '';
  });
});
