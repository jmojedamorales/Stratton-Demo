/* ══════════════════════════════════════════════════════════════
   COUNTERS.JS — Animación de contadores numéricos
                 (.trust-num y .stat-num) con IntersectionObserver
   ══════════════════════════════════════════════════════════════ */

/* ── Number counter animation ───────────────────────────── */
function animateCounters() {
  document.querySelectorAll('.trust-num, .stat-num').forEach(el => {
    const match = el.textContent.match(/[\d,]+/);
    if (!match) return;
    const end   = parseInt(match[0].replace(',', ''), 10);
    const dur   = 1500;
    const step  = dur / 60;
    let current = 0;
    const suffix = el.textContent.replace(match[0], '');
    const prefix = el.textContent.slice(0, el.textContent.indexOf(match[0]));
    const timer = setInterval(() => {
      current += end / (dur / step);
      if (current >= end) { current = end; clearInterval(timer); }
      el.textContent = prefix + Math.floor(current).toLocaleString('es') + suffix;
    }, step);
  });
}

const counterIo = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounters(); counterIo.disconnect(); } });
}, { threshold: 0.3 });

const partnersSection = document.getElementById('partners');
if (partnersSection) counterIo.observe(partnersSection);
