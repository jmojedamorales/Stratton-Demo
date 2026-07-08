/* ══════════════════════════════════════════════════════════════
   PORTFOLIO.JS — Slider de portfolio: psTrack, psGoTo,
                  psNav, dots navigation, touch swipe
   ══════════════════════════════════════════════════════════════ */

const psTrack    = document.getElementById('psTrack');
const psPrevBtn  = document.getElementById('psPrev');
const psNextBtn  = document.getElementById('psNext');
const psDotsWrap = document.querySelector('.ps-dots');

const PS_TOTAL = 4;   // páginas en escritorio
const PS_ITEMS = 12;  // ítems individuales en móvil

let psPage = 0;
let psDots = [];

function isMobile() { return window.innerWidth < 768; }

function buildDots() {
  const count = isMobile() ? PS_ITEMS : PS_TOTAL;
  psDotsWrap.innerHTML = '';
  psDots = [];
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.className = 'ps-dot' + (i === 0 ? ' active' : '');
    btn.addEventListener('click', () => { psGoTo(i); psAutoRestart(); });
    psDotsWrap.appendChild(btn);
    psDots.push(btn);
  }
}

function psGoTo(n) {
  const mobile = isMobile();
  const total  = mobile ? PS_ITEMS : PS_TOTAL;
  psPage = Math.max(0, Math.min(total - 1, n));

  if (mobile) {
    psTrack.style.transform = `translateX(-${psPage * (100 / total)}%)`;
  } else {
    psTrack.style.transform = '';
    psTrack.querySelectorAll('.ps-page').forEach((p, i) =>
      p.classList.toggle('active', i === psPage)
    );
  }

  psDots.forEach((d, i) => d.classList.toggle('active', i === psPage));
  psPrevBtn.classList.toggle('disabled', psPage === 0);
  psNextBtn.classList.toggle('disabled', psPage === total - 1);
}

function psNav(dir) {
  const total = isMobile() ? PS_ITEMS : PS_TOTAL;
  psGoTo(psPage + dir);
  psAutoRestart();
}

/* ── Autoplay ────────────────────────────────────────────── */
let psAutoTimer = null;

function psAutoNext() {
  const total = isMobile() ? PS_ITEMS : PS_TOTAL;
  psGoTo(psPage >= total - 1 ? 0 : psPage + 1);
}

function psAutoStart() {
  psAutoTimer = setInterval(psAutoNext, 4000);
}

function psAutoStop() {
  clearInterval(psAutoTimer);
  psAutoTimer = null;
}

function psAutoRestart() {
  psAutoStop();
  psAutoStart();
}

const psViewport = document.querySelector('.portfolio-viewport');
psViewport.addEventListener('mouseenter', psAutoStop);
psViewport.addEventListener('mouseleave', psAutoStart);

/* ── Touch swipe ─────────────────────────────────────────── */
let touchStartX = 0;
psTrack.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
}, { passive: true });
psTrack.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 40) psNav(dx < 0 ? 1 : -1);
});

/* ── Resize: reconstruir dots y reiniciar ────────────────── */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    psTrack.querySelectorAll('.ps-page').forEach(p => p.classList.remove('active'));
    psTrack.style.transform = '';
    buildDots();
    psGoTo(0);
  }, 200);
});

buildDots();
psGoTo(0);
psAutoStart();
