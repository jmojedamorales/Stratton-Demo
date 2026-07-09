/* ══════════════════════════════════════════════════════════════
   LIGHTBOX.JS — openLightbox, closeLightbox, lbNav,
                 renderLightbox, keyboard navigation,
                 click-outside to close
   ══════════════════════════════════════════════════════════════ */

/* ── Portfolio Lightbox ──────────────────────────────────── */
const portfolioItems = Array.from(document.querySelectorAll('.trabajo-item'));
const lightbox       = document.getElementById('lightbox');
const lbImg          = document.getElementById('lb-img');
const lbCaption      = document.getElementById('lb-caption');

let currentItemIdx = 0;
let currentImgIdx  = 0;

function getImagesFor(item) {
  return Array.from(item.querySelectorAll('.portfolio-img'));
}

function openLightbox(el) {
  currentItemIdx = portfolioItems.indexOf(el);
  currentImgIdx  = 0;
  renderLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function lbNav(dir) {
  const imgs = getImagesFor(portfolioItems[currentItemIdx]);

  const nextImg = currentImgIdx + dir;
  if (nextImg >= 0 && nextImg < imgs.length) {
    currentImgIdx = nextImg;
  } else {
    currentItemIdx = (currentItemIdx + dir + portfolioItems.length) % portfolioItems.length;
    currentImgIdx  = dir > 0 ? 0 : getImagesFor(portfolioItems[currentItemIdx]).length - 1;
  }
  renderLightbox();
}

function renderLightbox() {
  const item = portfolioItems[currentItemIdx];
  const imgs = getImagesFor(item);
  const img  = imgs[currentImgIdx];

  if (img) {
    lbImg.src = img.src;
    lbImg.style.display = 'block';
  }

  const cat    = item.querySelector('.portfolio-cat')?.textContent  || '';
  const name   = item.querySelector('.portfolio-name')?.textContent || '';
  const label  = cat && name ? cat + ' · ' + name : name || cat;
  const counter = imgs.length > 1 ? `  (${currentImgIdx + 1}/${imgs.length})` : '';
  lbCaption.textContent = label + counter;
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
