/* ══════════════════════════════════════════════════════════════
   LIGHTBOX.JS — openLightbox, closeLightbox, lbNav,
                 renderLightbox, keyboard navigation,
                 click-outside to close
   ══════════════════════════════════════════════════════════════ */

const lbImages   = Array.from(document.querySelectorAll('.trabajo-item .portfolio-img'));
const lightbox   = document.getElementById('lightbox');
const lbImg      = document.getElementById('lb-img');
const lbCaption  = document.getElementById('lb-caption');
let currentLbIdx = 0;

function openLightbox(el) {
  const firstImg = el.querySelector('.portfolio-img');
  currentLbIdx   = lbImages.indexOf(firstImg);
  if (currentLbIdx < 0) currentLbIdx = 0;
  renderLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function lbNav(dir) {
  currentLbIdx = (currentLbIdx + dir + lbImages.length) % lbImages.length;
  renderLightbox();
}

function renderLightbox() {
  const img = lbImages[currentLbIdx];
  if (!img) return;
  lbImg.src = img.src;
  lbImg.alt = img.alt;
  const item = img.closest('.trabajo-item');
  const cat  = item?.querySelector('.portfolio-cat')?.textContent  || '';
  const name = item?.querySelector('.portfolio-name')?.textContent || '';
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
