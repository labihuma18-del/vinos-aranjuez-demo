// ===== Utilidades compartidas: llamadas a la API, avisos e íconos =====

const Sesion = {
  get token() { return sessionStorage.getItem('token'); },
  get usuario() { try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; } },
  guardar(token, usuario, inactividadMin) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
    sessionStorage.setItem('inactividad', inactividadMin);
  },
  actualizarUsuario(usuario) { sessionStorage.setItem('usuario', JSON.stringify(usuario)); },
  limpiar() { sessionStorage.clear(); },
  puede(...permisos) { const u = this.usuario; return !!u && permisos.some((p) => u.permisos.includes(p)); },
};

/** Llama a la API. Lanza un Error con .campos si el backend devuelve errores por campo. */
async function api(metodo, url, cuerpo) {
  const opciones = { method: metodo, headers: {} };
  if (Sesion.token) opciones.headers.Authorization = `Bearer ${Sesion.token}`;
  if (cuerpo !== undefined) { opciones.headers['Content-Type'] = 'application/json'; opciones.body = JSON.stringify(cuerpo); }

  let res;
  try { res = await fetch(`/api${url}`, opciones); }
  catch { throw Object.assign(new Error('No hay conexión con el servidor'), { campos: {} }); }

  const datos = await res.json().catch(() => ({}));
  if (res.status === 401 && Sesion.token && !url.startsWith('/auth/login')) {
    Sesion.limpiar();
    location.href = `index.html?motivo=${encodeURIComponent(datos.codigo || 'SESION_INVALIDA')}`;
    throw new Error(datos.error || 'Sesión finalizada');
  }
  if (!res.ok) throw Object.assign(new Error(datos.error || 'Ocurrió un error'), { campos: datos.campos || {}, status: res.status });
  return datos;
}

/** Escapa texto para insertarlo en HTML de forma segura */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(texto, tipo = '') {
  let cont = document.getElementById('toasts');
  if (!cont) { cont = document.createElement('div'); cont.id = 'toasts'; document.body.appendChild(cont); }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = texto;
  cont.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'error' ? 5000 : 3500);
}

/** Muestra errores por campo dentro de un formulario (inputs con name=...) */
function mostrarErrores(form, campos = {}) {
  form.querySelectorAll('.campo').forEach((c) => { c.classList.remove('error'); const m = c.querySelector('.msg'); if (m) m.textContent = ''; });
  for (const [nombre, msg] of Object.entries(campos)) {
    const input = form.querySelector(`[name="${nombre}"]`);
    const campo = input && input.closest('.campo');
    if (campo) { campo.classList.add('error'); const m = campo.querySelector('.msg'); if (m) m.textContent = msg; }
  }
  const primero = form.querySelector('.campo.error input, .campo.error select');
  if (primero) primero.focus();
}

const datosForm = (form) => Object.fromEntries(new FormData(form).entries());
const bs = (n) => `Bs ${Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaHora = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}` : '—');
const fecha = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—');

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONOS = {
  logo: svg('<path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z"/><path d="M12 12.5V20M8.5 21h7"/><path d="M8.2 7h7.6"/>'),
  inicio: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  usuarios: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>'),
  caja: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 11h18M8 3h8v4H8z"/><circle cx="12" cy="15.5" r="1.5"/>'),
  ventas: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  asistencia: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>'),
  equipo: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 17h6"/>'),
  auditoria: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  perfil: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  candado: svg('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
};
