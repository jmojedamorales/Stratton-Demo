/* ══════════════════════════════════════════════════════════════
   CONTACT.JS — Validación del formulario de contacto
   ══════════════════════════════════════════════════════════════ */

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function showToast(msg, error = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.background = error ? '#c0392b' : '';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;

  const clinica = form.clinica.value.trim();
  const email   = form.email.value.trim();
  const mensaje = form.mensaje.value.trim();

  if (clinica.length < 2) return showToast('Por favor indica el nombre de tu clínica.', true);
  if (!EMAIL_RE.test(email)) return showToast('Por favor introduce un email válido.', true);
  if (mensaje.length < 5)   return showToast('Por favor escribe un mensaje más detallado.', true);
}
