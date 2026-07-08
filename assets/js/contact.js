/* ══════════════════════════════════════════════════════════════
   CONTACT.JS — Custom select dropdown, form validation,
                handleSubmit, toast notification
   ══════════════════════════════════════════════════════════════ */

/* ── Custom select ─────────────────────────────────────── */
const cs      = document.getElementById('customSelect');
const trigger = document.getElementById('selectTrigger');
const options = document.querySelectorAll('.custom-option');
const hidden  = document.getElementById('selectValue');

trigger.addEventListener('click', () => cs.classList.toggle('open'));

options.forEach(opt => {
  opt.addEventListener('click', () => {
    options.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    trigger.childNodes[0].textContent = opt.textContent + ' ';
    trigger.classList.add('has-value');
    hidden.value = opt.dataset.value;
    cs.classList.remove('open');
  });
});

document.addEventListener('click', e => {
  if (!cs.contains(e.target)) cs.classList.remove('open');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') cs.classList.remove('open');
});

/* ── Form submit ────────────────────────────────────────── */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

async function handleSubmit(e) {
  e.preventDefault();

  const form   = e.target;
  const btn    = form.querySelector('.form-submit');
  const toast  = document.getElementById('toast');

  const nombre  = form.nombre.value.trim();
  const email   = form.email.value.trim();
  const mensaje = form.mensaje.value.trim();

  // Validación client-side antes de enviar
  if (nombre.length < 2) {
    toast.textContent = 'Por favor indica tu nombre.';
    toast.style.background = '#c0392b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
    return;
  }
  if (!EMAIL_RE.test(email)) {
    toast.textContent = 'Por favor introduce un email válido.';
    toast.style.background = '#c0392b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
    return;
  }
  if (mensaje.length < 5) {
    toast.textContent = 'Por favor escribe un mensaje más detallado.';
    toast.style.background = '#c0392b';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  const payload = {
    nombre,
    clinica:      form.clinica.value.trim(),
    email,
    telefono:     form.telefono.value.trim(),
    tipo_trabajo: hidden.value,
    mensaje,
  };

  try {
    const res = await fetch('https://formspree.io/f/YOUR_FORM_ID', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error((json.errors && json.errors[0]?.message) || 'Error del servidor');

    toast.textContent = 'Mensaje enviado. Nos ponemos en contacto pronto.';
    toast.style.background = '';
  } catch {
    toast.textContent = 'Error al enviar. Por favor escríbenos directamente.';
    toast.style.background = '#c0392b';
  }

  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);

  btn.disabled = false;
  btn.textContent = 'Enviar solicitud';
  form.reset();
  trigger.childNodes[0].textContent = 'Selecciona una categoría ';
  trigger.classList.remove('has-value');
  options.forEach(o => o.classList.remove('selected'));
}
