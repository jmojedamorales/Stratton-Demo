/* ══════════════════════════════════════════════════════════════
   LIGHTBOX.JS — openLightbox, closeLightbox, lbNav,
                 renderLightbox, keyboard navigation,
                 click-outside to close
   ══════════════════════════════════════════════════════════════ */

/* ── Portfolio Lightbox ──────────────────────────────────── */
const portfolioItems = Array.from(document.querySelectorAll('.portfolio-item'));
const lightbox       = document.getElementById('lightbox');
const lbImg          = document.getElementById('lb-img');
const lbCaption      = document.getElementById('lb-caption');
let currentLbIdx = 0;

function openLightbox(el) {
  currentLbIdx = portfolioItems.indexOf(el);
  renderLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function lbNav(dir) {
  currentLbIdx = (currentLbIdx + dir + portfolioItems.length) % portfolioItems.length;
  renderLightbox();
}

function renderLightbox() {
  const item = portfolioItems[currentLbIdx];
  const img  = item.querySelector('.portfolio-img');
  if (img) {
    lbImg.src = img.src;
    lbImg.style.display = 'block';
  } else {
    lbImg.src = '';
    lbImg.style.display = 'none';
  }
  const cat  = item.querySelector('.portfolio-cat')?.textContent  || '';
  const name = item.querySelector('.portfolio-name')?.textContent || '';
  lbCaption.textContent = cat && name ? cat + ' · ' + name : name || cat;
}

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  lbNav(-1);
  if (e.key === 'ArrowRight') lbNav(1);
});
