// ===== Bodegas Aranjuez — aplicación principal (menú por rol + módulos) =====
const $ = (s, r = document) => r.querySelector(s);
const vista = $('#vista');

// Menú: cada opción declara qué permisos la habilitan.
// La interfaz solo OCULTA; el backend es quien realmente BLOQUEA (403).
const MENU = [
  { id: 'inicio', label: 'Inicio', icono: 'inicio' },
  { grupo: 'Operación' },
  { id: 'pedidos', label: 'Pedidos web', icono: 'pedidos', permisos: ['pedidos.gestionar'], desc: 'Reservas de la tienda en línea: cobrar o cancelar', prueba: '/pedidos' },
  { id: 'ventas', label: 'Ventas', icono: 'ventas', permisos: ['ventas.registrar', 'ventas.ver_propias', 'ventas.ver_todas'], desc: 'Emitir y consultar notas de venta', prueba: '/ventas' },
  { id: 'clientes', label: 'Clientes', icono: 'clientes', permisos: ['clientes.gestionar'], desc: 'Registro y consulta de clientes', prueba: '/clientes' },
  { id: 'caja', label: 'Caja', icono: 'caja', permisos: ['caja.operar', 'caja.ver_todas'], desc: 'Apertura, movimientos y arqueo', prueba: '/caja/historial' },
  { id: 'almacen', label: 'Almacén', icono: 'almacen', permisos: ['productos.ver', 'inventario.mover', 'inventario.alertas'], desc: 'Productos, stock, entradas y salidas', prueba: '/inventario/productos' },
  { id: 'asistencia', label: 'Mi asistencia', icono: 'asistencia', permisos: ['asistencia.marcar', 'asistencia.ver_propia'], desc: 'Marcar entrada/salida y ver mi historial', prueba: '/asistencia/mia' },
  { grupo: 'Administración' },
  { id: 'usuarios', label: 'Usuarios', icono: 'usuarios', permisos: ['usuarios.ver'], desc: 'Altas, edición, roles y bajas', prueba: '/usuarios' },
  { id: 'roles', label: 'Roles y permisos', icono: 'roles', permisos: ['roles.gestionar'], desc: 'Crear roles y elegir qué puede hacer cada uno', prueba: '/roles' },
  { id: 'personal', label: 'Asistencia del personal', icono: 'equipo', permisos: ['asistencia.ver_todas'], desc: 'Control de entradas y salidas', prueba: '/asistencia/todas' },
  { id: 'sede', label: 'Sede y ubicación', icono: 'sede', permisos: ['sede.gestionar'], desc: 'Dirección de la bodega para validar la asistencia (radio 50 m)', prueba: '/sede' },
  { id: 'auditoria', label: 'Auditoría', icono: 'auditoria', permisos: ['auditoria.ver'], desc: 'Log de actividad del sistema', prueba: '/auditoria' },
  { grupo: 'Cuenta' },
  { id: 'perfil', label: 'Mi cuenta', icono: 'perfil', desc: 'Cambiar contraseña y PIN' },
];
const permitido = (item) => !item.permisos || Sesion.puede(...item.permisos);

// Reglas de validación (las mismas que usa el backend)
const R = {
  nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{2,60}$/,
  ci: /^[0-9]{5,10}(-[0-9A-Za-z]{1,2})?$/,
  correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  telefono: /^[67][0-9]{7}$/,
  username: /^[a-z0-9._]{4,30}$/,
  pin: /^[0-9]{4,6}$/,
};
const claveOk = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);

function rolBadge(rol) {
  const c = { Administrador: 'b-admin', Cajero: 'b-cajero', Empleado: 'b-empleado', 'Encargado de almacén': 'b-almacen' }[rol] || 'b-otro';
  return `<span class="badge ${c}">${esc(rol)}</span>`;
}
const estadoBadge = (e) => `<span class="badge ${e === 'ACTIVO' ? 'b-ok' : 'b-off'}">${e === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span>`;

// ---------- Modal ----------
function abrirModal(html, { cerrable = true } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-fondo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  if (cerrable) {
    m.querySelector('.modal-fondo').addEventListener('mousedown', (e) => { if (e.target.classList.contains('modal-fondo')) cerrarModal(); });
    m.querySelectorAll('[data-cerrar]').forEach((b) => { b.onclick = cerrarModal; });
  }
  const primero = m.querySelector('input:not([type=hidden]), select');
  if (primero) setTimeout(() => primero.focus(), 30);
  return m.querySelector('.modal');
}
function cerrarModal() { $('#modal').innerHTML = ''; }
function confirmar(titulo, texto, etiqueta = 'Confirmar', clase = '') {
  return new Promise((ok) => {
    const m = abrirModal(`<h2>${esc(titulo)}</h2><p>${texto}</p>
      <div class="pie"><button class="btn sec" data-no>Cancelar</button><button class="btn ${clase}" data-si>${esc(etiqueta)}</button></div>`);
    m.querySelector('[data-no]').onclick = () => { cerrarModal(); ok(false); };
    m.querySelector('[data-si]').onclick = () => { cerrarModal(); ok(true); };
  });
}

// ---------- Sesión: cierre e inactividad ----------
async function cerrarSesion(motivo = 'SALIDA') {
  try { await api('POST', '/auth/logout', { motivo: motivo === 'SESION_EXPIRADA' ? 'INACTIVIDAD' : 'MANUAL' }); } catch { /* ya expirada */ }
  Sesion.limpiar();
  location.href = `login.html?motivo=${motivo}`;
}

(function vigilarInactividad() {
  const limite = Number(sessionStorage.getItem('inactividad') || 15) * 60000 - 20000; // un poco antes que el servidor
  let ultima = Date.now(); let ultimoPing = Date.now(); let avisado = false;
  const actividad = () => {
    ultima = Date.now(); avisado = false;
    // Mantiene viva la sesión en el servidor mientras el usuario trabaja (máx. 1 llamada por minuto)
    if (Date.now() - ultimoPing > 60000) {
      ultimoPing = Date.now();
      api('GET', '/auth/me').then((r) => Sesion.actualizarUsuario(r.usuario)).catch(() => {});
    }
  };
  ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach((ev) => addEventListener(ev, actividad, { passive: true }));
  setInterval(() => {
    const quieto = Date.now() - ultima;
    if (quieto >= limite) cerrarSesion('SESION_EXPIRADA');
    else if (quieto >= limite - 60000 && !avisado) { avisado = true; toast('Su sesión se cerrará en 1 minuto por inactividad', 'aviso'); }
  }, 5000);
})();

// ---------- Estructura: menú y usuario ----------
function pintarMenu() {
  const u = Sesion.usuario;
  $('#logo').innerHTML = ICONOS.logo + 'Bodegas Aranjuez';
  let html = ''; let grupo = null;
  for (const item of MENU) {
    if (item.grupo) { grupo = item.grupo; continue; }
    if (!permitido(item)) continue;
    if (grupo) { html += `<div class="grupo">${grupo}</div>`; grupo = null; }
    html += `<a href="#${item.id}" data-id="${item.id}">${ICONOS[item.icono]}<span>${item.label}</span>${item.id === 'pedidos' ? '<span class="badge b-aviso hidden" id="nPend" style="margin-left:auto"></span>' : ''}</a>`;
  }
  html += `<div class="grupo">Tienda</div><a href="index.html" target="_blank" rel="noopener">${ICONOS.tienda}<span>Ver tienda en línea ↗</span></a>`;
  $('#menu').innerHTML = html;
  actualizarPendientes();
  $('#usuarioBox').innerHTML = `<strong>${esc(u.nombres)} ${esc(u.apellidos)}</strong><span class="rol">${esc(u.rol)} · @${esc(u.username)}</span>
    <button class="btn mini" id="btnSalir">Cerrar sesión</button>`;
  $('#btnSalir').onclick = () => cerrarSesion('SALIDA');
  $('#abrirMenu').onclick = () => $('#lateral').classList.toggle('abierto');
}

/** Número de pedidos web pendientes junto al menú (se refresca cada minuto) */
async function actualizarPendientes() {
  if (!Sesion.puede('pedidos.gestionar')) return;
  try {
    const n = (await api('GET', '/pedidos?estado=PENDIENTE')).length;
    const b = $('#nPend'); if (!b) return;
    b.textContent = n; b.classList.toggle('hidden', n === 0);
  } catch { /* sin conexión */ }
}
setInterval(actualizarPendientes, 60000);

async function navegar() {
  const id = location.hash.slice(1) || 'inicio';
  const item = MENU.find((m) => m.id === id) || MENU[0];
  document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('activo', a.dataset.id === item.id));
  $('#lateral').classList.remove('abierto');
  cerrarModal();
  if (!permitido(item)) return vistaDenegada(item);
  vista.innerHTML = '<p class="muted">Cargando…</p>';
  try { await VISTAS[item.id](); } catch (e) { vista.innerHTML = `<div class="alerta error">${esc(e.message)}</div>`; }
  if (Sesion.usuario.debe_cambiar_clave) forzarCambioClave();
}

/** Si el usuario escribe la URL de un módulo sin permiso, igual se consulta al servidor para demostrar el 403 */
async function vistaDenegada(item) {
  let respuesta = '';
  try { await api('GET', item.prueba); } catch (e) { respuesta = `${e.status || ''} — ${e.message}`; }
  vista.innerHTML = `<div class="panel denegado">
      <div class="codigo">403</div>
      <h2>Acceso denegado a “${esc(item.label)}”</h2>
      <p class="muted">Su rol <strong>${esc(Sesion.usuario.rol)}</strong> no tiene los permisos requeridos (${item.permisos.map(esc).join(', ')}).</p>
      <p class="small muted">Respuesta del servidor: <code>${esc(respuesta)}</code><br>El intento quedó registrado en la auditoría.</p>
      <a class="btn" href="#inicio">Volver al inicio</a></div>`;
}

// ======================= VISTAS =======================
const VISTAS = {};

// ---------- Inicio ----------
VISTAS.inicio = async () => {
  const u = Sesion.usuario;
  const hoy = new Date().toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const accesos = MENU.filter((m) => m.id && m.id !== 'inicio' && permitido(m));
  vista.innerHTML = `
    <div class="cabecera"><div><h1>Hola, ${esc(u.nombres)}</h1><p class="muted">${hoy}</p></div>${rolBadge(u.rol)}</div>
    <div class="kpis" id="kpis"></div>
    <div class="accesos">${accesos.map((m) => `<a class="acceso" href="#${m.id}">${ICONOS[m.icono]}<h3>${m.label}</h3><p>${m.desc}</p></a>`).join('')}</div>
    <div class="panel" style="margin-top:1.2rem"><h3>Permisos de su rol</h3>
      <div class="chips">${u.permisos.map((p) => `<span class="badge b-admin">${esc(p)}</span>`).join('')}</div></div>`;

  const kpis = [];
  if (Sesion.puede('usuarios.ver')) {
    const lista = await api('GET', '/usuarios');
    kpis.push(['Usuarios activos', lista.filter((x) => x.estado === 'ACTIVO').length], ['Usuarios inactivos', lista.filter((x) => x.estado !== 'ACTIVO').length]);
  }
  if (Sesion.puede('pedidos.gestionar')) {
    const p = await api('GET', '/pedidos?estado=PENDIENTE');
    kpis.push(['Pedidos web pendientes', p.length, p.length > 0]);
  }
  if (Sesion.puede('caja.operar')) {
    const c = await api('GET', '/caja/actual');
    kpis.push(c.caja ? ['Efectivo en mi caja', bs(c.resumen.esperado), true] : ['Mi caja', 'Cerrada']);
  }
  if (Sesion.puede('inventario.alertas')) {
    const al = await api('GET', '/inventario/alertas');
    kpis.push(['Productos con stock bajo', al.length, al.length > 0]);
  }
  if (Sesion.puede('auditoria.ver')) {
    const av = await api('GET', '/auditoria?nivel=AVISO');
    kpis.push(['Avisos de asistencia', av.length, av.length > 0]);
  }
  if (Sesion.puede('asistencia.ver_propia')) {
    const a = await api('GET', '/asistencia/mia');
    kpis.push(['Próxima marca', a.siguiente === 'ENTRADA' ? 'Entrada' : 'Salida', true]);
  }
  $('#kpis').innerHTML = kpis.map(([l, v, d]) => `<div class="kpi ${d ? 'destacado' : ''}"><div class="l">${l}</div><div class="v">${esc(v)}</div></div>`).join('');
};

// ---------- Usuarios (CRUD) ----------
let ROLES = []; let AREAS = [];
VISTAS.usuarios = async () => {
  [ROLES, AREAS] = await Promise.all([api('GET', '/usuarios/roles'), api('GET', '/usuarios/areas')]);
  vista.innerHTML = `
    <div class="cabecera"><div><h1>Usuarios</h1><p class="muted">Gestión de cuentas, roles y accesos del personal.</p></div>
      ${Sesion.puede('usuarios.crear') ? '<button class="btn" id="btnNuevo">+ Nuevo usuario</button>' : ''}</div>
    <div class="toolbar">
      <input class="buscar" id="fBuscar" placeholder="Buscar por nombre, CI o usuario…">
      <select id="fRol"><option value="">Todos los roles</option>${ROLES.map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`).join('')}</select>
      <select id="fEstado"><option value="">Todos los estados</option><option value="ACTIVO">Activos</option><option value="INACTIVO">Inactivos</option></select>
    </div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Nombre</th><th>CI</th><th>Usuario</th><th>Contacto</th><th>Rol</th><th>Área</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tUsuarios"></tbody></table></div>`;

  let t;
  const recargar = async () => {
    const q = new URLSearchParams({ q: $('#fBuscar').value, rol_id: $('#fRol').value, estado: $('#fEstado').value });
    const lista = await api('GET', `/usuarios?${q}`);
    $('#tUsuarios').innerHTML = lista.length ? lista.map((u) => `
      <tr class="${u.estado === 'ACTIVO' ? '' : 'inactivo'}">
        <td><strong>${esc(u.nombres)} ${esc(u.apellidos)}</strong>${u.debe_cambiar_clave ? '<br><span class="badge b-aviso">Clave temporal</span>' : ''}</td>
        <td>${esc(u.ci)}</td><td>@${esc(u.username)}</td><td>${esc(u.correo)}<br><span class="muted small">${esc(u.telefono || 'sin celular')}</span></td>
        <td>${rolBadge(u.rol)}</td><td>${esc(u.area || '—')}</td><td>${estadoBadge(u.estado)}</td>
        <td class="acciones">
          ${Sesion.puede('usuarios.editar') ? `<button class="btn sec mini" data-editar="${u.id}">Editar</button><button class="btn sec mini" data-reset="${u.id}" data-nombre="${esc(u.username)}">Clave</button>` : ''}
          ${Sesion.puede('usuarios.desactivar') && u.id !== Sesion.usuario.id
            ? (u.estado === 'ACTIVO'
              ? `<button class="btn peligro mini" data-estado="INACTIVO" data-id="${u.id}" data-nombre="${esc(u.username)}">Desactivar</button>`
              : `<button class="btn ok mini" data-estado="ACTIVO" data-id="${u.id}" data-nombre="${esc(u.username)}">Reactivar</button>`) : ''}
        </td></tr>`).join('') : '<tr><td colspan="8" class="vacio">No se encontraron usuarios</td></tr>';
  };
  $('#fBuscar').oninput = () => { clearTimeout(t); t = setTimeout(recargar, 250); };
  $('#fRol').onchange = recargar; $('#fEstado').onchange = recargar;
  if ($('#btnNuevo')) $('#btnNuevo').onclick = () => formUsuario(null, recargar);

  $('#tUsuarios').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.editar) formUsuario(await api('GET', `/usuarios/${b.dataset.editar}`), recargar);
    if (b.dataset.reset) formResetClave(b.dataset.reset, b.dataset.nombre);
    if (b.dataset.estado) {
      const baja = b.dataset.estado === 'INACTIVO';
      const ok = await confirmar(baja ? 'Desactivar usuario' : 'Reactivar usuario',
        baja ? `<strong>@${esc(b.dataset.nombre)}</strong> ya no podrá ingresar al sistema ni marcar asistencia. Su historial de ventas, caja y asistencia <strong>se conserva</strong>.`
          : `<strong>@${esc(b.dataset.nombre)}</strong> podrá volver a ingresar al sistema.`,
        baja ? 'Desactivar' : 'Reactivar', baja ? 'peligro' : 'ok');
      if (!ok) return;
      try { const r = await api('PATCH', `/usuarios/${b.dataset.id}/estado`, { estado: b.dataset.estado }); toast(r.mensaje, 'ok'); recargar(); }
      catch (err) { toast(err.message, 'error'); }
    }
  };
  recargar();
};

function formUsuario(u, alGuardar) {
  const nuevo = !u; u = u || {};
  const campo = (name, label, attrs = '', req = true) => `<div class="campo"><label class="${req ? 'req' : ''}">${label}</label>
      <input name="${name}" value="${esc(u[name] || '')}" ${attrs}><div class="msg"></div></div>`;
  const m = abrirModal(`
    <h2>${nuevo ? 'Nuevo usuario' : `Editar @${esc(u.username)}`}</h2>
    <form id="fUsuario" novalidate>
      <div class="fila">${campo('nombres', 'Nombres')}${campo('apellidos', 'Apellidos')}</div>
      <div class="fila">${campo('ci', 'CI', 'placeholder="7845123"')}${campo('telefono', 'Celular', 'placeholder="71234567" inputmode="numeric"', false)}</div>
      ${campo('correo', 'Correo electrónico', 'type="email" placeholder="nombre@bodegasaranjuez.bo"')}
      <div class="campo"><label class="req">Rol</label><select name="rol_id"><option value="">Seleccione…</option>
        ${ROLES.filter((r) => r.estado === 'ACTIVO').map((r) => `<option value="${r.id}" ${u.rol_id === r.id ? 'selected' : ''}>${esc(r.nombre)} — ${esc(r.descripcion)}</option>`).join('')}</select><div class="msg"></div></div>
      <div class="campo"><label>Área de trabajo</label><select name="area_id"><option value="">Sin área</option>
        ${AREAS.map((a) => `<option value="${a.id}" ${u.area_id === a.id ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select><div class="msg"></div></div>
      ${nuevo ? `
        <div class="fila">${campo('username', 'Nombre de usuario', 'placeholder="jperez" autocomplete="off"')}
          <div class="campo"><label class="req">PIN de asistencia</label><input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><div class="msg"></div></div></div>
        <div class="campo"><label class="req">Contraseña inicial</label><input name="password" type="password" autocomplete="new-password">
          <div class="msg"></div><div class="small muted">Temporal: el usuario deberá cambiarla al ingresar. Mín. 8 caracteres con letras y números.</div></div>` : ''}
      <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">${nuevo ? 'Crear usuario' : 'Guardar cambios'}</button></div>
    </form>`);
  const f = $('#fUsuario', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    const er = {};
    if (!R.nombre.test(d.nombres.trim())) er.nombres = d.nombres.trim() ? 'Solo letras y espacios' : 'Obligatorio';
    if (!R.nombre.test(d.apellidos.trim())) er.apellidos = d.apellidos.trim() ? 'Solo letras y espacios' : 'Obligatorio';
    if (!R.ci.test(d.ci.trim())) er.ci = d.ci.trim() ? 'CI inválido (ej. 7845123 o 7845123-1A)' : 'Obligatorio';
    if (d.telefono.trim() && !R.telefono.test(d.telefono.trim())) er.telefono = '8 dígitos, inicia con 6 o 7';
    if (!R.correo.test(d.correo.trim())) er.correo = d.correo.trim() ? 'Formato de correo inválido' : 'Obligatorio';
    if (!d.rol_id) er.rol_id = 'Seleccione un rol';
    if (nuevo) {
      if (!R.username.test(d.username.trim())) er.username = 'Minúsculas, números, . o _ (4 a 30)';
      if (!R.pin.test(d.pin)) er.pin = 'De 4 a 6 dígitos';
      if (!claveOk(d.password)) er.password = 'Mín. 8 caracteres con letras y números';
    }
    mostrarErrores(f, er);
    if (Object.keys(er).length) return;
    try {
      const r = nuevo ? await api('POST', '/usuarios', d) : await api('PUT', `/usuarios/${u.id}`, d);
      cerrarModal(); toast(r.mensaje, 'ok'); alGuardar();
    } catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

function formResetClave(id, username) {
  const m = abrirModal(`<h2>Restablecer contraseña</h2>
    <p class="muted">Asigne una contraseña temporal a <strong>@${esc(username)}</strong>. Se cerrarán sus sesiones abiertas y deberá cambiarla al ingresar.</p>
    <form id="fReset" novalidate>
      <div class="campo"><label class="req">Contraseña temporal</label><input name="password" type="text" autocomplete="off"><div class="msg"></div></div>
      <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">Restablecer</button></div>
    </form>`);
  const f = $('#fReset', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    if (!claveOk(d.password)) return mostrarErrores(f, { password: 'Mín. 8 caracteres con letras y números' });
    try { const r = await api('POST', `/usuarios/${id}/reset-clave`, d); cerrarModal(); toast(r.mensaje, 'ok'); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

// ---------- Caja ----------
VISTAS.caja = async () => {
  const opera = Sesion.puede('caja.operar');
  const actual = opera ? await api('GET', '/caja/actual') : { caja: null };
  const verTodas = Sesion.puede('caja.ver_todas');
  const historial = await api('GET', `/caja/historial${verTodas ? '?todas=1' : ''}`);
  const c = actual.caja;

  let html = `<div class="cabecera"><div><h1>Caja</h1><p class="muted">Cajero responsable: <strong>${esc(Sesion.usuario.nombres)} ${esc(Sesion.usuario.apellidos)}</strong></p></div>
    ${c ? `<span class="badge b-ok">Caja #${c.id} abierta desde ${fechaHora(c.fecha_apertura)}</span>` : '<span class="badge b-off">Sin caja abierta</span>'}</div>`;

  if (opera && !c) {
    html += `<div class="panel" style="max-width:420px"><h3>Abrir caja</h3>
      <form id="fAbrir" novalidate><div class="campo"><label class="req">Monto inicial (Bs)</label>
      <input name="monto_inicial" type="number" min="0" step="0.01" placeholder="200.00"><div class="msg"></div></div>
      <button class="btn">Abrir caja</button></form></div>`;
  }
  if (c) {
    const r = actual.resumen;
    html += `<div class="kpis">
        <div class="kpi"><div class="l">Monto inicial</div><div class="v">${bs(c.monto_inicial)}</div></div>
        <div class="kpi"><div class="l">Ingresos (${r.nro_ventas} ventas)</div><div class="v">${bs(r.ingresos)}</div></div>
        <div class="kpi"><div class="l">Egresos</div><div class="v">${bs(r.egresos)}</div></div>
        <div class="kpi destacado"><div class="l">Efectivo esperado</div><div class="v">${bs(r.esperado)}</div></div></div>
      <div class="grid-2">
        <div class="panel"><h3>Registrar movimiento</h3><form id="fMov" novalidate>
          <div class="fila"><div class="campo"><label class="req">Tipo</label><select name="tipo"><option value="INGRESO">Ingreso</option><option value="EGRESO">Egreso</option></select><div class="msg"></div></div>
          <div class="campo"><label class="req">Monto (Bs)</label><input name="monto" type="number" min="0.01" step="0.01"><div class="msg"></div></div></div>
          <div class="campo"><label class="req">Concepto</label><input name="concepto" placeholder="Ej. pago de transporte"><div class="msg"></div></div>
          <button class="btn sec">Registrar</button></form></div>
        <div class="panel"><h3>Cerrar caja (arqueo)</h3><form id="fCerrar" novalidate>
          <div class="campo"><label class="req">Efectivo contado (Bs)</label><input name="monto_contado" type="number" min="0" step="0.01"><div class="msg"></div></div>
          <p class="small" id="difPrev">Esperado: <strong>${bs(r.esperado)}</strong></p>
          <div class="campo"><label>Observaciones</label><input name="observaciones" maxlength="255"></div>
          <button class="btn">Cerrar caja</button></form></div>
      </div>
      <div class="panel"><h3>Movimientos de la caja actual</h3><div class="tabla-wrap"><table>
        <thead><tr><th>Hora</th><th>Tipo</th><th>Concepto</th><th class="num">Monto</th></tr></thead>
        <tbody>${actual.movimientos.length ? actual.movimientos.map((m) => `<tr><td>${fechaHora(m.fecha)}</td>
          <td><span class="badge ${m.tipo === 'INGRESO' ? 'b-ok' : 'b-error'}">${m.tipo}</span></td><td>${esc(m.concepto)}</td>
          <td class="num">${m.tipo === 'EGRESO' ? '−' : ''}${bs(m.monto)}</td></tr>`).join('') : '<tr><td colspan="4" class="vacio">Sin movimientos todavía</td></tr>'}</tbody></table></div></div>`;
  }

  html += `<div class="panel"><h3>${verTodas ? 'Historial de cajas (todos los cajeros)' : 'Mis cajas anteriores'}</h3><div class="tabla-wrap"><table>
    <thead><tr><th>#</th>${verTodas ? '<th>Cajero</th>' : ''}<th>Apertura</th><th>Cierre</th><th class="num">Inicial</th><th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferencia</th><th>Estado</th></tr></thead>
    <tbody>${historial.length ? historial.map((h) => `<tr><td>${h.id}</td>${verTodas ? `<td>${esc(h.cajero)}</td>` : ''}
      <td>${fechaHora(h.fecha_apertura)}</td><td>${fechaHora(h.fecha_cierre)}</td><td class="num">${bs(h.monto_inicial)}</td>
      <td class="num">${h.monto_esperado == null ? '—' : bs(h.monto_esperado)}</td><td class="num">${h.monto_contado == null ? '—' : bs(h.monto_contado)}</td>
      <td class="num">${h.diferencia == null ? '—' : `<span class="badge ${h.diferencia === 0 ? 'b-ok' : h.diferencia < 0 ? 'b-error' : 'b-aviso'}">${bs(h.diferencia)}</span>`}</td>
      <td><span class="badge ${h.estado === 'ABIERTA' ? 'b-ok' : 'b-off'}">${h.estado}</span></td></tr>`).join('') : `<tr><td colspan="9" class="vacio">Sin registros</td></tr>`}</tbody></table></div></div>`;
  vista.innerHTML = html;

  const enviar = (sel, url, validar, exito) => {
    const f = $(sel); if (!f) return;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = datosForm(f); const er = validar(d);
      mostrarErrores(f, er); if (Object.keys(er).length) return;
      try { const r = await api('POST', url, d); toast(exito(r), 'ok'); VISTAS.caja(); }
      catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
    };
  };
  enviar('#fAbrir', '/caja/abrir', (d) => (d.monto_inicial === '' || Number(d.monto_inicial) < 0 ? { monto_inicial: 'Ingrese un monto ≥ 0' } : {}), (r) => r.mensaje);
  enviar('#fMov', '/caja/movimientos', (d) => {
    const e = {}; if (!(Number(d.monto) > 0)) e.monto = 'Mayor a 0'; if (d.concepto.trim().length < 3) e.concepto = 'Mínimo 3 caracteres'; return e;
  }, (r) => r.mensaje);
  enviar('#fCerrar', '/caja/cerrar', (d) => (d.monto_contado === '' || Number(d.monto_contado) < 0 ? { monto_contado: 'Ingrese el efectivo contado' } : {}),
    (r) => `Caja cerrada. Diferencia: ${bs(r.arqueo.diferencia)}`);
  if (c) {
    $('#fCerrar').monto_contado.oninput = (e) => {
      const dif = Number(e.target.value || 0) - actual.resumen.esperado;
      $('#difPrev').innerHTML = `Esperado: <strong>${bs(actual.resumen.esperado)}</strong> · Diferencia: <strong style="color:${Math.abs(dif) < 0.005 ? 'var(--ok)' : 'var(--error)'}">${bs(dif)}</strong>`;
    };
  }
};

// ---------- Ventas ----------
VISTAS.ventas = async () => {
  const registra = Sesion.puede('ventas.registrar');
  const todas = Sesion.puede('ventas.ver_todas');
  let html = `<div class="cabecera"><div><h1>Ventas</h1><p class="muted">Vendedor: <strong>${esc(Sesion.usuario.nombres)} ${esc(Sesion.usuario.apellidos)}</strong> (@${esc(Sesion.usuario.username)})</p></div></div>`;

  let productos = [];
  let caja = null;
  if (registra) {
    [productos, { caja }] = await Promise.all([api('GET', '/ventas/productos'), Sesion.puede('caja.operar') ? api('GET', '/caja/actual') : { caja: null }]);
    html += caja ? `<div class="panel"><h3>Nueva nota de venta</h3>
        <div class="fila"><div class="campo" style="grid-column:span 2"><label>Producto</label><select id="selProd">${productos.map((p) =>
          `<option value="${p.id}" ${p.stock ? '' : 'disabled'}>${esc(p.nombre)} · ${bs(p.precio)} · stock ${p.stock}</option>`).join('')}</select></div>
          <div class="campo"><label>Cantidad</label><input id="cant" type="number" min="1" value="1"></div>
          <div class="campo"><label>&nbsp;</label><button class="btn sec bloque" id="btnAgregar">Agregar</button></div></div>
        <div class="tabla-wrap"><table><thead><tr><th>Producto</th><th class="num">Precio</th><th class="num">Cant.</th><th class="num">Subtotal</th><th></th></tr></thead><tbody id="carrito"></tbody></table></div>
        <form id="fVenta" novalidate style="margin-top:1rem">
          <div class="fila"><div class="campo"><label>Cliente</label><input name="cliente_nombre" placeholder="Sin nombre"></div>
          <div class="campo"><label>CI / NIT</label><input name="cliente_ci_nit" inputmode="numeric"><div class="msg"></div></div></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap">
            <div class="kpi destacado" style="min-width:200px"><div class="l">Total</div><div class="v" id="total">Bs 0,00</div></div>
            <button class="btn grande">Emitir nota de venta</button></div>
        </form></div>`
      : `<div class="alerta aviso">Para vender debe tener una caja abierta a su nombre. <a href="#caja">Abrir caja →</a></div>`;
  }
  const ventas = await api('GET', '/ventas');
  html += `<div class="panel"><h3>${todas ? 'Todas las ventas' : 'Mis ventas'}</h3><div class="tabla-wrap"><table>
    <thead><tr><th>Nota</th><th>Fecha</th><th>Cliente</th><th>Vendedor</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${ventas.length ? ventas.map((v) => `<tr><td><strong>${esc(v.nro_nota)}</strong></td><td>${fechaHora(v.fecha)}</td><td>${esc(v.cliente_nombre)}</td>
      <td>${esc(v.vendedor)}</td><td class="num">${bs(v.total)}</td><td class="acciones"><button class="btn sec mini" data-ver="${v.id}">Ver nota</button></td></tr>`).join('')
      : '<tr><td colspan="6" class="vacio">Aún no hay ventas</td></tr>'}</tbody></table></div></div>`;
  vista.innerHTML = html;

  vista.querySelectorAll('[data-ver]').forEach((b) => { b.onclick = async () => verNota(await api('GET', `/ventas/${b.dataset.ver}`)); });
  if (!registra || !caja) return;

  const carrito = [];
  const pintar = () => {
    $('#carrito').innerHTML = carrito.length ? carrito.map((i, k) => `<tr><td>${esc(i.nombre)}</td><td class="num">${bs(i.precio)}</td><td class="num">${i.cantidad}</td>
      <td class="num">${bs(i.precio * i.cantidad)}</td><td class="acciones"><button class="btn peligro mini" data-quitar="${k}">Quitar</button></td></tr>`).join('')
      : '<tr><td colspan="5" class="vacio">Agregue productos a la nota</td></tr>';
    $('#total').textContent = bs(carrito.reduce((s, i) => s + i.precio * i.cantidad, 0));
  };
  $('#btnAgregar').onclick = () => {
    const p = productos.find((x) => x.id === Number($('#selProd').value));
    const cant = Number($('#cant').value);
    if (!p || !Number.isInteger(cant) || cant < 1) return toast('Cantidad inválida', 'error');
    const ya = carrito.find((i) => i.producto_id === p.id);
    if ((ya ? ya.cantidad : 0) + cant > p.stock) return toast(`Stock insuficiente (disponible: ${p.stock})`, 'error');
    if (ya) ya.cantidad += cant; else carrito.push({ producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: cant });
    $('#cant').value = 1; pintar();
  };
  $('#carrito').onclick = (e) => { const b = e.target.closest('[data-quitar]'); if (b) { carrito.splice(Number(b.dataset.quitar), 1); pintar(); } };
  $('#fVenta').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target; const d = datosForm(f);
    if (!carrito.length) return toast('Agregue al menos un producto', 'error');
    if (d.cliente_ci_nit.trim() && !/^[0-9]{5,13}(-[0-9A-Za-z]{1,2})?$/.test(d.cliente_ci_nit.trim())) return mostrarErrores(f, { cliente_ci_nit: 'Solo números (5 a 13)' });
    try {
      const r = await api('POST', '/ventas', { ...d, items: carrito.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })) });
      toast(r.mensaje, 'ok');
      await VISTAS.ventas();
      verNota(await api('GET', `/ventas/${r.id}`));
    } catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
  pintar();
};

function verNota(v) {
  abrirModal(`<div class="nota">
    <div class="enc"><div><h2 style="margin:0">Bodegas Aranjuez</h2><span class="muted small">Tarija, Bolivia</span></div>
      <div style="text-align:right"><strong>NOTA DE VENTA</strong><br>${esc(v.nro_nota)}<br><span class="small">${fechaHora(v.fecha)}</span></div></div>
    <p><strong>Vendedor:</strong> ${esc(v.vendedor)} (@${esc(v.vendedor_usuario)}) · ID usuario ${v.usuario_id}<br>
       <strong>Cliente:</strong> ${esc(v.cliente_nombre)}${v.cliente_ci_nit ? ` · CI/NIT ${esc(v.cliente_ci_nit)}` : ''}<br>
       <strong>Caja:</strong> #${v.caja_id}${v.pedido_codigo ? ` · <strong>Origen:</strong> pedido web ${esc(v.pedido_codigo)}` : ''}</p>
    <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
      <tbody>${v.detalle.map((d) => `<tr><td>${esc(d.codigo)}</td><td>${esc(d.nombre)}</td><td class="num">${d.cantidad}</td><td class="num">${bs(d.precio_unitario)}</td><td class="num">${bs(d.subtotal)}</td></tr>`).join('')}</tbody></table></div>
    <div class="total">Total: <strong>${bs(v.total)}</strong></div></div>
    <div class="pie"><button class="btn sec" data-cerrar>Cerrar</button></div>`);
}

// ---------- Pedidos web (tienda en línea) ----------
const ESTADO_PEDIDO = { PENDIENTE: 'b-aviso', ENTREGADO: 'b-ok', CANCELADO: 'b-error' };
let filtroPedidos = 'PENDIENTE';
VISTAS.pedidos = async () => {
  const [lista, actual] = await Promise.all([
    api('GET', `/pedidos${filtroPedidos ? `?estado=${filtroPedidos}` : ''}`),
    Sesion.puede('caja.operar') ? api('GET', '/caja/actual') : { caja: null },
  ]);
  const caja = actual.caja;
  vista.innerHTML = `
    <div class="cabecera"><div><h1>Pedidos web</h1><p class="muted">Reservas hechas por clientes en la tienda en línea. Al cobrar, se emite la nota de venta a su nombre y el ingreso entra a su caja.</p></div>
      ${caja ? `<span class="badge b-ok">Caja #${caja.id} abierta</span>` : '<span class="badge b-off">Sin caja abierta</span>'}</div>
    ${caja ? '' : '<div class="alerta aviso">Puede revisar los pedidos, pero para <strong>cobrarlos</strong> necesita una caja abierta a su nombre. <a href="#caja">Abrir caja →</a></div>'}
    <div class="toolbar">
      <div class="chips" id="fEstadoPed">${[['PENDIENTE', 'Pendientes'], ['ENTREGADO', 'Entregados'], ['CANCELADO', 'Cancelados'], ['', 'Todos']]
        .map(([v, t]) => `<button class="btn ${filtroPedidos === v ? '' : 'sec'} mini" data-f="${v}">${t}</button>`).join('')}</div>
      <input class="buscar" id="fBuscarPed" placeholder="Buscar por código, cliente o celular…">
    </div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th class="num">Unid.</th><th class="num">Total</th><th>Estado</th><th>Atendido por</th><th></th></tr></thead>
      <tbody id="tPedidos"></tbody></table></div>`;

  const pintar = () => {
    const q = $('#fBuscarPed').value.trim().toLowerCase();
    const filas = lista.filter((p) => !q || `${p.codigo} ${p.cliente_nombre} ${p.cliente_telefono}`.toLowerCase().includes(q));
    $('#tPedidos').innerHTML = filas.length ? filas.map((p) => `<tr>
        <td style="white-space:nowrap"><strong>${esc(p.codigo)}</strong></td><td style="white-space:nowrap">${fechaHora(p.fecha)}</td>
        <td>${esc(p.cliente_nombre)}<br><span class="small muted">${esc(p.cliente_telefono)}${p.cliente_ci_nit ? ` · CI/NIT ${esc(p.cliente_ci_nit)}` : ''}</span></td>
        <td class="num">${p.unidades}</td><td class="num">${bs(p.total)}</td>
        <td><span class="badge ${ESTADO_PEDIDO[p.estado]}">${p.estado}</span>${p.nro_nota ? `<br><span class="small muted">${esc(p.nro_nota)}</span>` : ''}</td>
        <td>${p.atendido_por_nombre ? `${esc(p.atendido_por_nombre)}<br><span class="small muted">${fechaHora(p.fecha_atencion)}</span>` : '<span class="muted">—</span>'}</td>
        <td class="acciones"><button class="btn sec mini" data-ver="${p.id}">Ver</button>
          ${p.estado === 'PENDIENTE' ? `<button class="btn ok mini" data-cobrar="${p.id}" ${caja ? '' : 'disabled title="Abra su caja para cobrar"'}>Cobrar</button>
          <button class="btn peligro mini" data-cancelar="${p.id}" data-codigo="${esc(p.codigo)}">Cancelar</button>` : ''}
          ${p.venta_id ? `<button class="btn sec mini" data-nota="${p.venta_id}">Nota</button>` : ''}</td></tr>`).join('')
      : `<tr><td colspan="8" class="vacio">${filtroPedidos === 'PENDIENTE' ? 'No hay pedidos pendientes. Los nuevos pedidos de la tienda aparecerán aquí.' : 'Sin pedidos para este filtro'}</td></tr>`;
  };
  $('#fBuscarPed').oninput = pintar;
  $('#fEstadoPed').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { filtroPedidos = b.dataset.f; VISTAS.pedidos(); } };
  $('#tPedidos').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.ver) verPedido(await api('GET', `/pedidos/${b.dataset.ver}`), caja);
    if (b.dataset.cobrar) cobrarPedido(await api('GET', `/pedidos/${b.dataset.cobrar}`), caja);
    if (b.dataset.cancelar) cancelarPedido(b.dataset.cancelar, b.dataset.codigo);
    if (b.dataset.nota) verNota(await api('GET', `/ventas/${b.dataset.nota}`));
  };
  pintar();
  actualizarPendientes();
};

function detallePedidoHtml(p) {
  return `<p><strong>Cliente:</strong> ${esc(p.cliente_nombre)} · Cel. ${esc(p.cliente_telefono)}${p.cliente_ci_nit ? ` · CI/NIT ${esc(p.cliente_ci_nit)}` : ''}${p.cliente_correo ? `<br><strong>Correo:</strong> ${esc(p.cliente_correo)}` : ''}
    <br><strong>Recibido:</strong> ${fechaHora(p.fecha)}${p.nota ? `<br><strong>Nota del cliente:</strong> “${esc(p.nota)}”` : ''}</p>
    <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
    <tbody>${p.detalle.map((d) => `<tr><td>${esc(d.codigo)}</td><td>${esc(d.nombre)}</td><td class="num">${d.cantidad}</td><td class="num">${bs(d.precio_unitario)}</td><td class="num">${bs(d.subtotal)}</td></tr>`).join('')}</tbody></table></div>
    <div style="text-align:right;margin-top:.8rem;font-size:1.1rem">Total: <strong>${bs(p.total)}</strong></div>`;
}

function verPedido(p, caja) {
  const m = abrirModal(`<h2>Pedido ${esc(p.codigo)} <span class="badge ${ESTADO_PEDIDO[p.estado]}" style="vertical-align:middle">${p.estado}</span></h2>
    ${detallePedidoHtml(p)}
    ${p.estado === 'CANCELADO' ? `<div class="alerta error" style="margin-top:1rem">Cancelado por ${esc(p.atendido_por_nombre)} el ${fechaHora(p.fecha_atencion)}: ${esc(p.motivo_cancelacion)}</div>` : ''}
    ${p.estado === 'ENTREGADO' ? `<div class="alerta ok" style="margin-top:1rem">Cobrado por ${esc(p.atendido_por_nombre)} el ${fechaHora(p.fecha_atencion)} · Nota ${esc(p.nro_nota)}</div>` : ''}
    <div class="pie"><button class="btn sec" data-cerrar>Cerrar</button>
      ${p.estado === 'PENDIENTE' && caja ? '<button class="btn ok" id="mCobrar">Cobrar pedido</button>' : ''}</div>`);
  const b = $('#mCobrar', m); if (b) b.onclick = () => cobrarPedido(p, caja);
}

function cobrarPedido(p, caja) {
  const m = abrirModal(`<h2>Cobrar pedido ${esc(p.codigo)}</h2>
    ${detallePedidoHtml(p)}
    <div class="alerta aviso" style="margin-top:1rem">Verifique el código y el celular del cliente. Se emitirá la nota de venta con usted como <strong>vendedor</strong> (@${esc(Sesion.usuario.username)}) y el ingreso de <strong>${bs(p.total)}</strong> se registrará en su <strong>caja #${caja.id}</strong>.</div>
    <div class="pie"><button class="btn sec" data-cerrar>Volver</button><button class="btn ok" id="mConfirmarCobro">Cobrar ${bs(p.total)}</button></div>`);
  $('#mConfirmarCobro', m).onclick = async (e) => {
    e.target.disabled = true;
    try {
      const r = await api('POST', `/pedidos/${p.id}/cobrar`);
      toast(r.mensaje, 'ok');
      await VISTAS.pedidos();
      verNota(await api('GET', `/ventas/${r.venta_id}`));
    } catch (err) { e.target.disabled = false; toast(err.message, 'error'); }
  };
}

function cancelarPedido(id, codigo) {
  const m = abrirModal(`<h2>Cancelar pedido ${esc(codigo)}</h2>
    <p class="muted">Las botellas reservadas vuelven al stock y el cliente verá el pedido como cancelado.</p>
    <form id="fCancelar" novalidate><div class="campo"><label class="req">Motivo</label><input name="motivo" maxlength="150" placeholder="Ej. el cliente no pasó a recoger"><div class="msg"></div></div>
    <div class="pie"><button type="button" class="btn sec" data-cerrar>Volver</button><button class="btn peligro">Cancelar pedido</button></div></form>`);
  const f = $('#fCancelar', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    if (d.motivo.trim().length < 3) return mostrarErrores(f, { motivo: 'Mínimo 3 caracteres' });
    try { const r = await api('POST', `/pedidos/${id}/cancelar`, d); cerrarModal(); toast(r.mensaje, 'ok'); VISTAS.pedidos(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

// ---------- Mi asistencia ----------
VISTAS.asistencia = async () => {
  const [datos, sede] = await Promise.all([
    Sesion.puede('asistencia.ver_propia') ? api('GET', '/asistencia/mia') : { siguiente: 'ENTRADA', dias: [] },
    Sesion.puede('asistencia.marcar') ? api('GET', '/sede').catch(() => null) : null]);
  vista.innerHTML = `<div class="cabecera"><div><h1>Mi asistencia</h1><p class="muted">Registro personal de entradas y salidas.</p></div></div>
    ${Sesion.puede('asistencia.marcar') ? `<div class="panel marcador">
      <div class="muted" id="hoy"></div><div class="hora" id="hora">--:--</div>
      <div class="estado-ubic espera" id="estadoUbic">${ICONOS.sede}Al marcar se registrará la ubicación de este dispositivo</div>
      <form id="fMarcar" novalidate><div class="campo"><input name="pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" autocomplete="off"><div class="msg"></div></div>
      <button class="btn grande ${datos.siguiente === 'SALIDA' ? 'peligro' : ''}">Marcar ${datos.siguiente === 'ENTRADA' ? 'ENTRADA' : 'SALIDA'}</button></form></div>` : ''}
    ${sede ? `<div class="panel sede-info">${ICONOS.sede}<div><strong>${esc(sede.nombre)}</strong><br>${esc(sede.direccion)} · radio permitido ${sede.radio_m} m.
      Si no da permiso de ubicación, la marca se guarda como <strong>sin ubicación</strong> y se avisa al administrador.</div></div>` : ''}
    <div class="panel"><h3>Últimos 30 días</h3>${tablaAsistencia(datos.dias, false)}</div>`;

  const reloj = () => { const h = $('#hora'); if (!h) return clearInterval(iv);
    const d = new Date(); h.textContent = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    $('#hoy').textContent = d.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' }); };
  const iv = setInterval(reloj, 1000); reloj();

  const f = $('#fMarcar');
  if (f) f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    if (!R.pin.test(d.pin)) return mostrarErrores(f, { pin: 'Ingrese su PIN (4 a 6 dígitos)' });
    const est = $('#estadoUbic'); const btn = f.querySelector('button'); btn.disabled = true;
    est.className = 'estado-ubic espera'; est.innerHTML = `${ICONOS.sede}Obteniendo la ubicación del dispositivo…`;
    const { ubicacion, motivo } = await obtenerUbicacion();
    est.className = `estado-ubic ${ubicacion ? 'ok' : 'mal'}`;
    est.innerHTML = `${ICONOS.sede}${ubicacion ? `Ubicación obtenida (precisión ±${ubicacion.precision} m)` : `${esc(motivo)}: se registrará sin ubicación`}`;
    try {
      const r = await api('POST', '/asistencia/marcar', { pin: d.pin, ubicacion });
      toast(r.mensaje, r.registro.ubicacion === 'DENTRO' ? 'ok' : 'error'); setTimeout(VISTAS.asistencia, 1200);
    } catch (err) { btn.disabled = false; mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
};

// Cada marca muestra la hora y la ubicación: verde = dentro del radio de la sede; rojo = fuera o sin ubicación (clic = ver en el mapa)
function tablaAsistencia(dias, conEmpleado) {
  return `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th>${conEmpleado ? '<th>Empleado</th>' : ''}<th>Marcas</th><th class="num">Horas</th><th>Estado</th></tr></thead>
    <tbody>${dias.length ? dias.map((d) => `<tr><td>${fecha(d.fecha)}</td>${conEmpleado ? `<td>${esc(d.empleado)}${d.area ? `<br><span class="muted small">${esc(d.area)}</span>` : ''}</td>` : ''}
      <td><div class="chips">${d.marcas.map(chipMarca).join('')}</div></td>
      <td class="num">${d.horas}</td><td>${d.abierta ? '<span class="badge b-aviso">Sin salida</span>' : '<span class="badge b-ok">Completo</span>'}</td></tr>`).join('')
      : `<tr><td colspan="${conEmpleado ? 5 : 4}" class="vacio">Sin registros</td></tr>`}</tbody></table></div>`;
}


// ---------- Clientes ----------
VISTAS.clientes = async () => {
  vista.innerHTML = `<div class="cabecera"><div><h1>Clientes</h1><p class="muted">Se registran solos al vender con CI/NIT, o puede darlos de alta aquí.</p></div>
      <button class="btn" id="btnNuevoCli">+ Nuevo cliente</button></div>
    <div class="toolbar"><input class="buscar" id="cBuscar" placeholder="Buscar por nombre o CI/NIT…"></div>
    <div class="tabla-wrap"><table><thead><tr><th>Nombre</th><th>CI / NIT</th><th>Celular</th><th>Correo</th><th class="num">Compras</th><th class="num">Total comprado</th><th></th></tr></thead>
    <tbody id="tClientes"></tbody></table></div>`;
  let t;
  const cargar = async () => {
    const lista = await api('GET', `/clientes?q=${encodeURIComponent($('#cBuscar').value)}`);
    $('#tClientes').innerHTML = lista.length ? lista.map((c) => `<tr><td><strong>${esc(c.nombre)}</strong></td><td>${esc(c.ci_nit || '—')}</td><td>${esc(c.telefono || '—')}</td><td>${esc(c.correo || '—')}</td>
      <td class="num">${c.compras}</td><td class="num">${bs(c.total_comprado)}</td><td class="acciones"><button class="btn sec mini" data-ed="${c.id}">Editar</button></td></tr>`).join('')
      : '<tr><td colspan="7" class="vacio">No se encontraron clientes</td></tr>';
    $('#tClientes').onclick = (e) => { const b = e.target.closest('[data-ed]'); if (b) formCliente(lista.find((c) => c.id === Number(b.dataset.ed)), cargar); };
  };
  $('#cBuscar').oninput = () => { clearTimeout(t); t = setTimeout(cargar, 250); };
  $('#btnNuevoCli').onclick = () => formCliente(null, cargar);
  cargar();
};

function formCliente(c, alGuardar) {
  const nuevo = !c; c = c || {};
  const campo = (name, label, attrs = '', req = false) => `<div class="campo"><label class="${req ? 'req' : ''}">${label}</label><input name="${name}" value="${esc(c[name] || '')}" ${attrs}><div class="msg"></div></div>`;
  const m = abrirModal(`<h2>${nuevo ? 'Nuevo cliente' : 'Editar cliente'}</h2><form id="fCli" novalidate>
    ${campo('nombre', 'Nombre completo', '', true)}
    <div class="fila">${campo('ci_nit', 'CI / NIT', 'inputmode="numeric"')}${campo('telefono', 'Celular', 'inputmode="numeric" placeholder="71234567"')}</div>
    ${campo('correo', 'Correo electrónico', 'type="email"')}
    <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">${nuevo ? 'Registrar' : 'Guardar'}</button></div></form>`);
  const f = $('#fCli', m);
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = datosForm(f); const er = {};
    if (!R.nombre.test(d.nombre.trim())) er.nombre = d.nombre.trim() ? 'Solo letras y espacios' : 'Obligatorio';
    if (d.ci_nit.trim() && !/^[0-9]{5,13}(-[0-9A-Za-z]{1,2})?$/.test(d.ci_nit.trim())) er.ci_nit = 'Solo números (5 a 13)';
    if (d.telefono.trim() && !R.telefono.test(d.telefono.trim())) er.telefono = '8 dígitos, inicia con 6 o 7';
    if (d.correo.trim() && !R.correo.test(d.correo.trim())) er.correo = 'Formato de correo inválido';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    try { const r = nuevo ? await api('POST', '/clientes', d) : await api('PUT', `/clientes/${c.id}`, d); cerrarModal(); toast(r.mensaje, 'ok'); alGuardar(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

// ---------- Almacén ----------
let pestanaAlm = 'stock';
VISTAS.almacen = async () => {
  const gestiona = Sesion.puede('productos.gestionar');
  const mueve = Sesion.puede('inventario.mover');
  const alertas = Sesion.puede('inventario.alertas') ? await api('GET', '/inventario/alertas') : [];
  vista.innerHTML = `<div class="cabecera"><div><h1>Almacén</h1><p class="muted">Stock disponible, entradas y salidas de botellas.</p></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">${mueve ? '<button class="btn" id="btnMov">± Registrar movimiento</button>' : ''}${gestiona ? '<button class="btn sec" id="btnProd">+ Nuevo producto</button>' : ''}</div></div>
    ${alertas.length ? `<div class="alerta aviso"><strong>${alertas.length} producto${alertas.length > 1 ? 's' : ''} con stock bajo:</strong> ${alertas.map((a) => `${esc(a.nombre)} (${a.stock}/${a.stock_minimo})`).join(' · ')}</div>` : ''}
    <div class="pestanas" id="pest"><button data-p="stock">Productos y stock</button><button data-p="mov">Historial de movimientos</button></div>
    <div id="alm"></div>`;
  const pintarPest = () => document.querySelectorAll('#pest button').forEach((b) => b.classList.toggle('activa', b.dataset.p === pestanaAlm));
  $('#pest').onclick = (e) => { const b = e.target.closest('button'); if (b) { pestanaAlm = b.dataset.p; pintarPest(); cargar(); } };
  const cargar = async () => (pestanaAlm === 'stock' ? tablaStock(gestiona, cargar) : tablaMov());
  if ($('#btnMov')) $('#btnMov').onclick = () => formMovimiento(null, () => VISTAS.almacen());
  if ($('#btnProd')) $('#btnProd').onclick = () => formProducto(null, () => VISTAS.almacen());
  pintarPest(); cargar();
};

async function tablaStock(gestiona, recargar) {
  $('#alm').innerHTML = `<div class="toolbar"><input class="buscar" id="pBuscar" placeholder="Buscar por nombre, código, línea o cepa…">
    <select id="pTipo"><option value="">Todos los tipos</option>${['Tinto', 'Blanco', 'Rosado', 'Espumante', 'Singani'].map((t) => `<option>${t}</option>`).join('')}</select>
    <label class="small" style="margin:0"><input type="checkbox" id="pBajo"> Solo stock bajo</label></div>
    <div class="tabla-wrap"><table><thead><tr><th>Código</th><th>Producto</th><th>Línea</th><th>Tipo</th><th class="num">Precio</th><th class="num">Stock</th><th class="num">Mínimo</th><th>Estado</th><th></th></tr></thead><tbody id="tProd"></tbody></table></div>`;
  let t;
  const cargar = async () => {
    const q = new URLSearchParams({ q: $('#pBuscar').value, tipo: $('#pTipo').value, bajo: $('#pBajo').checked ? '1' : '' });
    const lista = await api('GET', `/inventario/productos?${q}`);
    $('#tProd').innerHTML = lista.length ? lista.map((p) => `<tr class="${p.activo ? '' : 'inactivo'}"><td style="white-space:nowrap">${esc(p.codigo)}</td>
      <td><strong>${esc(p.nombre)}</strong><br><span class="muted small">${esc(p.variedad || '')}${p.anada ? ' · ' + p.anada : ''}</span></td><td>${esc(p.linea || '—')}</td><td>${esc(p.tipo)}</td>
      <td class="num">${bs(p.precio)}</td><td class="num ${p.stock === 0 ? 'stock-cero' : p.bajo ? 'stock-bajo' : ''}">${p.stock}</td><td class="num">${p.stock_minimo}</td>
      <td>${!p.activo ? '<span class="badge b-off">Oculto</span>' : p.stock === 0 ? '<span class="badge b-off">Agotado</span>' : p.bajo ? '<span class="badge b-aviso">Stock bajo</span>' : '<span class="badge b-ok">Disponible</span>'}</td>
      <td class="acciones">${Sesion.puede('inventario.mover') ? `<button class="btn sec mini" data-mov="${p.id}">± Stock</button>` : ''}
        ${gestiona ? `<button class="btn sec mini" data-ed="${p.id}">Editar</button><button class="btn ${p.activo ? 'peligro' : 'ok'} mini" data-act="${p.id}" data-v="${p.activo ? 0 : 1}" data-n="${esc(p.nombre)}">${p.activo ? 'Ocultar' : 'Mostrar'}</button>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="9" class="vacio">Sin productos para este filtro</td></tr>';
    $('#tProd').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.mov) formMovimiento(Number(b.dataset.mov), () => VISTAS.almacen());
      if (b.dataset.ed) formProducto(lista.find((x) => x.id === Number(b.dataset.ed)), () => VISTAS.almacen());
      if (b.dataset.act) {
        const oculta = b.dataset.v === '0';
        if (!(await confirmar(oculta ? 'Ocultar producto' : 'Mostrar producto', oculta ? `<strong>${b.dataset.n}</strong> dejará de aparecer en la tienda y en las ventas. Su historial se conserva.` : `<strong>${b.dataset.n}</strong> volverá a la tienda.`, oculta ? 'Ocultar' : 'Mostrar', oculta ? 'peligro' : 'ok'))) return;
        try { const r = await api('PATCH', `/inventario/productos/${b.dataset.act}/activo`, { activo: b.dataset.v === '1' }); toast(r.mensaje, 'ok'); VISTAS.almacen(); } catch (err) { toast(err.message, 'error'); }
      }
    };
  };
  $('#pBuscar').oninput = () => { clearTimeout(t); t = setTimeout(cargar, 250); };
  $('#pTipo').onchange = cargar; $('#pBajo').onchange = cargar;
  cargar();
}

async function tablaMov() {
  const lista = await api('GET', '/inventario/movimientos');
  $('#alm').innerHTML = `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Motivo</th><th class="num">Cantidad</th><th class="num">Stock resultante</th><th>Responsable</th><th>Detalle</th></tr></thead>
    <tbody>${lista.length ? lista.map((m) => `<tr><td>${fechaHora(m.fecha)}</td><td><strong>${esc(m.producto)}</strong></td>
      <td class="${m.tipo === 'ENTRADA' ? 'mov-entrada' : 'mov-salida'}">${m.tipo === 'ENTRADA' ? '↓ Entrada' : '↑ Salida'}</td><td>${esc(m.motivo.replace('_', ' ').toLowerCase())}</td>
      <td class="num">${m.tipo === 'ENTRADA' ? '+' : '−'}${m.cantidad}</td><td class="num">${m.stock_resultante}</td><td>${esc(m.usuario || 'Cliente (tienda)')}</td><td class="muted small">${esc(m.observacion || '')}</td></tr>`).join('')
      : '<tr><td colspan="8" class="vacio">Sin movimientos</td></tr>'}</tbody></table></div>`;
}

const MOTIVOS = { ENTRADA: [['PRODUCCION', 'Producción'], ['COMPRA', 'Compra'], ['DEVOLUCION', 'Devolución'], ['AJUSTE', 'Ajuste de inventario']],
  SALIDA: [['MERMA', 'Merma / rotura'], ['DISTRIBUCION', 'Distribución'], ['AJUSTE', 'Ajuste de inventario']] };
async function formMovimiento(productoId, alGuardar) {
  const prods = await api('GET', '/inventario/productos');
  const m = abrirModal(`<h2>Registrar movimiento de almacén</h2><form id="fMov" novalidate>
    <div class="campo"><label class="req">Producto</label><select name="producto_id"><option value="">Seleccione…</option>${prods.filter((p) => p.activo).map((p) => `<option value="${p.id}" ${p.id === productoId ? 'selected' : ''}>${esc(p.nombre)} · stock ${p.stock}</option>`).join('')}</select><div class="msg"></div></div>
    <div class="fila"><div class="campo"><label class="req">Movimiento</label><select name="tipo"><option value="ENTRADA">Entrada (suma)</option><option value="SALIDA">Salida (resta)</option></select><div class="msg"></div></div>
      <div class="campo"><label class="req">Motivo</label><select name="motivo"></select><div class="msg"></div></div></div>
    <div class="campo"><label class="req">Cantidad (botellas)</label><input name="cantidad" type="number" min="1" inputmode="numeric"><div class="msg"></div></div>
    <div class="campo"><label>Observación</label><input name="observacion" maxlength="150" placeholder="Ej. Lote de embotellado de octubre"><div class="msg"></div></div>
    <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">Registrar</button></div></form>`);
  const f = $('#fMov', m);
  const pintarMotivos = () => { f.motivo.innerHTML = MOTIVOS[f.tipo.value].map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); };
  f.tipo.onchange = pintarMotivos; pintarMotivos();
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = datosForm(f); const er = {};
    if (!d.producto_id) er.producto_id = 'Seleccione un producto';
    if (!(Number.isInteger(Number(d.cantidad)) && Number(d.cantidad) > 0)) er.cantidad = 'Cantidad entera mayor a 0';
    if (d.motivo === 'AJUSTE' && d.observacion.trim().length < 3) er.observacion = 'Explique el ajuste';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    try { const r = await api('POST', '/inventario/movimientos', d); cerrarModal(); toast(r.mensaje, 'ok'); alGuardar(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

function formProducto(p, alGuardar) {
  const nuevo = !p; p = p || {};
  const campo = (name, label, attrs = '', req = false) => `<div class="campo"><label class="${req ? 'req' : ''}">${label}</label><input name="${name}" value="${esc(p[name] ?? '')}" ${attrs}><div class="msg"></div></div>`;
  const m = abrirModal(`<h2>${nuevo ? 'Nuevo producto' : `Editar ${esc(p.nombre)}`}</h2><form id="fProd" novalidate>
    <div class="fila">${campo('codigo', 'Código', 'placeholder="VT-008" style="text-transform:uppercase"', true)}${campo('nombre', 'Nombre', '', true)}</div>
    <div class="fila">${campo('linea', 'Línea', 'placeholder="Terruño, Dúo…"')}
      <div class="campo"><label class="req">Tipo</label><select name="tipo"><option value="">Seleccione…</option>${['Tinto', 'Blanco', 'Rosado', 'Espumante', 'Singani'].map((t) => `<option ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select><div class="msg"></div></div></div>
    <div class="fila">${campo('variedad', 'Cepa / variedad')}${campo('anada', 'Añada (año)', 'type="number" inputmode="numeric"')}</div>
    <div class="fila">${campo('precio', 'Precio (Bs)', 'type="number" step="0.01" min="0"', true)}${campo('stock_minimo', 'Stock mínimo', 'type="number" min="0"', true)}</div>
    <div class="fila">${campo('graduacion', '% alcohol', 'type="number" step="0.1"')}${campo('origen', 'Origen')}</div>
    ${campo('maridaje', 'Maridaje (separado por comas)', 'placeholder="Carnes rojas,Quesos maduros"')}
    <div class="campo"><label>Descripción</label><input name="descripcion" maxlength="255" value="${esc(p.descripcion || '')}"><div class="msg"></div></div>
    <label class="small"><input type="checkbox" name="destacado" value="1" ${p.destacado ? 'checked' : ''}> Mostrar entre los destacados de la tienda</label>
    ${nuevo ? '<p class="muted small">El producto nace con stock 0; registre su primera entrada desde “± Stock”.</p>' : ''}
    <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">${nuevo ? 'Registrar' : 'Guardar'}</button></div></form>`);
  const f = $('#fProd', m);
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = datosForm(f); const er = {};
    if (!/^[A-Za-z0-9-]{3,20}$/.test(d.codigo.trim())) er.codigo = d.codigo.trim() ? 'Letras, números y guion (3 a 20)' : 'Obligatorio';
    if (!d.nombre.trim()) er.nombre = 'Obligatorio';
    if (!d.tipo) er.tipo = 'Seleccione un tipo';
    if (!(Number(d.precio) > 0)) er.precio = 'Precio mayor a 0';
    if (!(Number.isInteger(Number(d.stock_minimo)) && d.stock_minimo !== '' && Number(d.stock_minimo) >= 0)) er.stock_minimo = 'Entero de 0 en adelante';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    try { const r = nuevo ? await api('POST', '/inventario/productos', d) : await api('PUT', `/inventario/productos/${p.id}`, d); cerrarModal(); toast(r.mensaje, 'ok'); alGuardar(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

// ---------- Asistencia del personal (admin) ----------
VISTAS.personal = async () => {
  const [usuarios, areas] = await Promise.all([api('GET', '/usuarios'), api('GET', '/usuarios/areas')]);
  const hace7 = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  vista.innerHTML = `<div class="cabecera"><div><h1>Asistencia del personal</h1><p class="muted">Entradas, salidas y horas trabajadas.</p></div></div>
    <div class="toolbar"><select id="aArea"><option value="">Todas las áreas</option>${areas.map((a) => `<option value="${a.id}">${esc(a.nombre)}</option>`).join('')}</select>
      <select id="aUsuario"><option value="">Todo el personal</option>${usuarios.map((u) => `<option value="${u.id}">${esc(u.nombres)} ${esc(u.apellidos)}</option>`).join('')}</select>
      <select id="aUbic"><option value="">Toda ubicación</option><option value="AVISO">Solo con aviso (fuera o sin ubicación)</option></select>
      <label class="small" style="margin:0">Desde</label><input type="date" id="aDesde" value="${hace7}"><label class="small" style="margin:0">Hasta</label><input type="date" id="aHasta"></div>
    <p class="small muted">Verde: marcó dentro de los 50 m de la sede. Rojo: fuera del radio o sin ubicación. Haga clic en una marca para verla en el mapa.</p>
    <div id="tAsis"></div>`;
  const cargar = async () => {
    const q = new URLSearchParams({ area_id: $('#aArea').value, usuario_id: $('#aUsuario').value, desde: $('#aDesde').value, hasta: $('#aHasta').value });
    let dias = await api('GET', `/asistencia/todas?${q}`);
    if ($('#aUbic').value) dias = dias.filter((d) => d.marcas.some((m) => m.ubicacion !== 'DENTRO'));
    $('#tAsis').innerHTML = tablaAsistencia(dias, true);
  };
  ['#aArea', '#aUsuario', '#aUbic', '#aDesde', '#aHasta'].forEach((s) => { $(s).onchange = cargar; });
  cargar();
};

// ---------- Roles y permisos (roles dinámicos) ----------
// El administrador crea roles y elige sus permisos. Los permisos son un catálogo fijo:
// cada uno corresponde a una acción programada en el sistema.
VISTAS.roles = async () => {
  vista.innerHTML = `<div class="cabecera"><div><h1>Roles y permisos</h1><p class="muted">Cree roles nuevos combinando los permisos del sistema. Los cambios se aplican de inmediato.</p></div>
      <button class="btn" id="btnNuevoRol">+ Nuevo rol</button></div>
    <div class="tabla-wrap"><table><thead><tr><th>Rol</th><th>Descripción</th><th class="num">Permisos</th><th class="num">Usuarios activos</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tRoles"></tbody></table></div>
    <div class="panel" style="margin-top:1.2rem"><h3>Matriz de permisos por rol</h3><p class="small muted">Se genera desde la base de datos (tabla <code>rol_permiso</code>).</p><div id="matriz"></div></div>`;
  let roles = []; let permisos = [];
  const cargar = async () => {
    [roles, permisos] = await Promise.all([api('GET', '/roles'), api('GET', '/roles/permisos')]);
    $('#tRoles').innerHTML = roles.map((r) => `<tr class="${r.estado === 'ACTIVO' ? '' : 'inactivo'}">
      <td>${rolBadge(r.nombre)}${r.protegido ? '<br><span class="small muted">Rol del sistema</span>' : ''}</td><td>${esc(r.descripcion)}</td>
      <td class="num">${r.permisos.length}</td><td class="num">${r.usuarios_activos}</td><td>${estadoBadge(r.estado)}</td>
      <td class="acciones">${r.protegido ? '<span class="small muted">No editable</span>' : `<button class="btn sec mini" data-ed="${r.id}">Editar</button>
        ${r.estado === 'ACTIVO' ? `<button class="btn peligro mini" data-est="INACTIVO" data-id="${r.id}">Desactivar</button>` : `<button class="btn ok mini" data-est="ACTIVO" data-id="${r.id}">Reactivar</button>`}`}</td></tr>`).join('');
    const activos = roles.filter((r) => r.estado === 'ACTIVO');
    const modulos = [...new Set(permisos.map((p) => p.modulo))];
    $('#matriz').innerHTML = `<div class="tabla-wrap"><table class="matriz"><thead><tr><th>Permiso</th>${activos.map((r) => `<th class="rot">${esc(r.nombre)}</th>`).join('')}</tr></thead><tbody>
      ${modulos.map((mo) => `<tr><td colspan="${activos.length + 1}" class="small" style="color:var(--oro);text-transform:uppercase;letter-spacing:.06em">${esc(mo)}</td></tr>
        ${permisos.filter((p) => p.modulo === mo).map((p) => `<tr><td>${esc(p.descripcion)}<br><code class="small muted">${esc(p.codigo)}</code></td>
          ${activos.map((r) => (r.permisos.includes(p.id) ? '<td class="si">✓</td>' : '<td class="no">·</td>')).join('')}</tr>`).join('')}`).join('')}
      </tbody></table></div>`;
  };
  $('#btnNuevoRol').onclick = () => formRol(null, roles, permisos, cargar);
  $('#tRoles').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ed) formRol(roles.find((r) => r.id === Number(b.dataset.ed)), roles, permisos, cargar);
    if (b.dataset.est) {
      const r = roles.find((x) => x.id === Number(b.dataset.id)); const baja = b.dataset.est === 'INACTIVO';
      const ok = await confirmar(baja ? 'Desactivar rol' : 'Reactivar rol', baja
        ? `El rol <strong>${esc(r.nombre)}</strong> ya no se podrá asignar a usuarios. Solo se puede desactivar si ningún usuario activo lo tiene.`
        : `El rol <strong>${esc(r.nombre)}</strong> se podrá asignar de nuevo.`, baja ? 'Desactivar' : 'Reactivar', baja ? 'peligro' : 'ok');
      if (!ok) return;
      try { const x = await api('PATCH', `/roles/${r.id}/estado`, { estado: b.dataset.est }); toast(x.mensaje, 'ok'); cargar(); }
      catch (err) { toast(err.message, 'error'); }
    }
  };
  cargar();
};

function formRol(rol, roles, permisos, alGuardar) {
  const nuevo = !rol; rol = rol || { nombre: '', descripcion: '', permisos: [] };
  const modulos = [...new Set(permisos.map((p) => p.modulo))];
  const m = abrirModal(`<h2>${nuevo ? 'Nuevo rol' : `Editar rol ${esc(rol.nombre)}`}</h2>
    <form id="fRol" novalidate>
      <div class="fila"><div class="campo"><label class="req">Nombre del rol</label><input name="nombre" value="${esc(rol.nombre)}" maxlength="30" placeholder="Sommelier"><div class="msg"></div></div>
        <div class="campo"><label>Copiar permisos de</label><select id="copiar"><option value="">—</option>${roles.filter((r) => r.id !== rol.id).map((r) => `<option value="${r.id}">${esc(r.nombre)}</option>`).join('')}</select></div></div>
      <div class="campo"><label class="req">Descripción</label><input name="descripcion" value="${esc(rol.descripcion)}" maxlength="150" placeholder="Qué hace este rol en la bodega"><div class="msg"></div></div>
      <div class="campo"><label class="req">Permisos <span class="small muted" id="cuenta"></span></label><input type="hidden" name="permisos"><div class="msg"></div>
        <div class="lista-permisos">${modulos.map((mo) => `<div class="permisos-grupo"><h4>${esc(mo)}<button type="button" data-todos="${esc(mo)}">marcar todos</button></h4>
          ${permisos.filter((p) => p.modulo === mo).map((p) => `<label class="permiso-check"><input type="checkbox" value="${p.id}" data-mod="${esc(mo)}" ${rol.permisos.includes(p.id) ? 'checked' : ''}>
            <span>${esc(p.descripcion)}<br><code>${esc(p.codigo)}</code></span></label>`).join('')}</div>`).join('')}</div></div>
      <div class="pie"><button type="button" class="btn sec" data-cerrar>Cancelar</button><button class="btn">${nuevo ? 'Crear rol' : 'Guardar cambios'}</button></div>
    </form>`);
  const f = $('#fRol', m);
  const checks = () => [...f.querySelectorAll('.permiso-check input')];
  const contar = () => { $('#cuenta', m).textContent = `(${checks().filter((c) => c.checked).length} seleccionados)`; };
  f.addEventListener('change', contar); contar();
  $('#copiar', m).onchange = (e) => { const r = roles.find((x) => x.id === Number(e.target.value)); if (r) { checks().forEach((c) => { c.checked = r.permisos.includes(Number(c.value)); }); contar(); } };
  f.onclick = (e) => { const b = e.target.closest('[data-todos]'); if (!b) return;
    const g = checks().filter((c) => c.dataset.mod === b.dataset.todos); const todos = g.every((c) => c.checked); g.forEach((c) => { c.checked = !todos; }); contar(); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = { nombre: f.nombre.value.trim(), descripcion: f.descripcion.value.trim(), permisos: checks().filter((c) => c.checked).map((c) => Number(c.value)) };
    const er = {};
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'-]{2,29}$/.test(d.nombre)) er.nombre = d.nombre ? 'De 3 a 30 letras' : 'Obligatorio';
    if (d.descripcion.length < 5) er.descripcion = d.descripcion ? 'Mínimo 5 caracteres' : 'Obligatorio';
    if (!d.permisos.length) er.permisos = 'Seleccione al menos un permiso';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    try { const r = nuevo ? await api('POST', '/roles', d) : await api('PUT', `/roles/${rol.id}`, d); cerrarModal(); toast(r.mensaje, 'ok'); alGuardar(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

// ---------- Sede y ubicación ----------
// Punto de referencia para validar la asistencia. El radio es fijo: 50 m.
const mapaEmbed = (lat, lng) => { const d = 0.0025;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`; };

/** Extrae coordenadas de un enlace completo de Google Maps o de un texto "lat, lng" */
function coordsDeTexto(t) {
  t = decodeURIComponent(String(t || ''));
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/];
  for (const p of pats) { const m = t.match(p); if (m) return { lat: Number(m[1]), lng: Number(m[2]) }; }
  return null;
}

VISTAS.sede = async () => {
  const s = await api('GET', '/sede');
  vista.innerHTML = `<div class="cabecera"><div><h1>Sede y ubicación</h1><p class="muted">Dirección de la bodega. La asistencia se valida dentro de un radio fijo de 50 m.</p></div></div>
    <div class="grid-2">
      <div class="panel"><h3>Dirección de la sede</h3>
        <form id="fSede" novalidate>
          <div class="campo"><label class="req">Nombre</label><input name="nombre" value="${esc(s.nombre)}" maxlength="80"><div class="msg"></div></div>
          <div class="campo"><label class="req">Dirección</label><input name="direccion" value="${esc(s.direccion)}" maxlength="200"><div class="msg"></div>
            <button type="button" class="btn sec mini" id="btnBuscar" style="margin-top:.4rem">Buscar esta dirección en el mapa</button></div>
          <div class="campo"><label>Pegar enlace de Google Maps o coordenadas</label><input id="enlace" placeholder="https://www.google.com/maps/place/...  o  -19.0398, -65.2569">
            <div class="ayuda">Use el enlace completo (el que aparece en la barra del navegador). Los enlaces cortos maps.app.goo.gl no se pueden leer desde la página.</div></div>
          <div class="fila"><div class="campo"><label class="req">Latitud</label><input name="latitud" value="${s.latitud}" inputmode="decimal"><div class="msg"></div></div>
            <div class="campo"><label class="req">Longitud</label><input name="longitud" value="${s.longitud}" inputmode="decimal"><div class="msg"></div></div></div>
          <div class="campo"><label>Radio permitido</label><input value="50 metros (fijo)" disabled></div>
          <div class="pie" style="justify-content:space-between"><button type="button" class="btn sec" id="btnAqui">${ICONOS.sede} Usar mi ubicación actual</button><button class="btn">Guardar dirección</button></div>
        </form>
        <p class="small muted">Última actualización: ${fechaHora(s.actualizado_en)}</p></div>
      <div class="panel"><h3>Vista previa</h3><iframe class="mapa" id="mapa" title="Mapa de la sede" loading="lazy" src="${mapaEmbed(s.latitud, s.longitud)}"></iframe>
        <p class="small"><a id="verGoogle" href="${enlaceMapa(s.latitud, s.longitud)}" target="_blank" rel="noopener">Abrir en Google Maps</a></p></div>
    </div>`;
  const f = $('#fSede');
  const poner = (lat, lng) => { f.latitud.value = Number(lat).toFixed(7); f.longitud.value = Number(lng).toFixed(7); refrescar(); };
  const refrescar = () => { const lat = Number(f.latitud.value); const lng = Number(f.longitud.value);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { $('#mapa').src = mapaEmbed(lat, lng); $('#verGoogle').href = enlaceMapa(lat, lng); } };
  f.latitud.onchange = refrescar; f.longitud.onchange = refrescar;
  $('#enlace').oninput = (e) => { const c = coordsDeTexto(e.target.value); if (c) { poner(c.lat, c.lng); toast('Coordenadas leídas del enlace', 'ok'); } };
  $('#btnAqui').onclick = async () => {
    toast('Obteniendo la ubicación de este dispositivo…');
    const { ubicacion, motivo } = await obtenerUbicacion();
    if (!ubicacion) return toast(motivo, 'error');
    poner(ubicacion.latitud, ubicacion.longitud); toast(`Ubicación actual cargada (precisión ±${ubicacion.precision} m). Revise y guarde.`, 'ok');
  };
  $('#btnBuscar').onclick = async () => {
    const q = f.direccion.value.trim(); if (q.length < 5) return toast('Escriba la dirección primero', 'error');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
      const [x] = await r.json();
      if (!x) return toast('No se encontró esa dirección. Pruebe con el enlace de Google Maps o las coordenadas.', 'error');
      poner(x.lat, x.lon); toast('Dirección encontrada. Revise el punto en el mapa y guarde.', 'ok');
    } catch { toast('No se pudo consultar el mapa (sin internet). Ingrese las coordenadas a mano.', 'error'); }
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = { nombre: f.nombre.value.trim(), direccion: f.direccion.value.trim(), latitud: f.latitud.value.trim(), longitud: f.longitud.value.trim() };
    const er = {};
    if (d.nombre.length < 3) er.nombre = 'Obligatorio';
    if (d.direccion.length < 5) er.direccion = 'Obligatorio (mínimo 5 caracteres)';
    if (!(Math.abs(Number(d.latitud)) <= 90) || d.latitud === '') er.latitud = 'Entre -90 y 90';
    if (!(Math.abs(Number(d.longitud)) <= 180) || d.longitud === '') er.longitud = 'Entre -180 y 180';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    const ok = await confirmar('Cambiar la dirección de la sede', 'Desde ahora, las marcas de asistencia se compararán con esta nueva ubicación (radio de 50 m). El cambio queda en la auditoría.', 'Guardar');
    if (!ok) return;
    try { const r = await api('PUT', '/sede', { ...d, latitud: Number(d.latitud), longitud: Number(d.longitud) }); toast(r.mensaje, 'ok'); VISTAS.sede(); }
    catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
};

// ---------- Auditoría ----------
VISTAS.auditoria = async () => {
  const [acciones, usuarios] = await Promise.all([api('GET', '/auditoria/acciones'), api('GET', '/usuarios')]);
  vista.innerHTML = `<div class="cabecera"><div><h1>Auditoría</h1><p class="muted">Inicios de sesión, cambios de clave, altas y bajas de cuentas, y otras acciones clave.</p></div></div>
    <div class="toolbar"><select id="fNiv"><option value="">Todos los niveles</option><option value="AVISO">Solo avisos (en rojo)</option><option value="INFO">Solo informativos</option></select>
      <select id="fAcc"><option value="">Todas las acciones</option>${acciones.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
      <select id="fUsu"><option value="">Todos los usuarios</option>${usuarios.map((u) => `<option value="${u.id}">@${esc(u.username)}</option>`).join('')}</select>
      <input type="date" id="fDes"><input type="date" id="fHas"></div>
    <div class="tabla-wrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Nivel</th><th>Acción</th><th>Detalle</th><th>IP</th></tr></thead><tbody id="tAud"></tbody></table></div>`;
  const color = (a) => (/FALLIDO|DENEGADO|BLOQUEADA|RECHAZADO|DESACTIVADO|CANCELADO/.test(a) ? 'b-error' : /EXPIRADA|RESET|CAMBIO/.test(a) ? 'b-aviso' : /LOGIN_OK|CREADO|REACTIVADO|COBRADO|RECIBIDO|ACTUALIZAD/.test(a) ? 'b-ok' : 'b-off');
  const cargar = async () => {
    const q = new URLSearchParams({ nivel: $('#fNiv').value, accion: $('#fAcc').value, usuario_id: $('#fUsu').value, desde: $('#fDes').value, hasta: $('#fHas').value });
    const filas = await api('GET', `/auditoria?${q}`);
    $('#tAud').innerHTML = filas.length ? filas.map((f) => `<tr class="${f.nivel === 'AVISO' ? 'fila-aviso' : ''}"><td style="white-space:nowrap">${fechaHora(f.fecha)}</td><td>${f.username ? '@' + esc(f.username) : `<span class="muted">${/PEDIDO_WEB/.test(f.accion) ? 'Cliente web' : '—'}</span>`}</td>
      <td>${f.nivel === 'AVISO' ? '<span class="badge b-error">⚠ AVISO</span>' : '<span class="badge b-off">Info</span>'}</td>
      <td><span class="badge ${f.nivel === 'AVISO' ? 'b-error' : color(f.accion)}">${esc(f.accion)}</span></td><td class="detalle">${esc(f.detalle || '')}</td><td class="small muted">${esc(f.ip || '')}</td></tr>`).join('')
      : '<tr><td colspan="6" class="vacio">Sin registros para este filtro</td></tr>';
  };
  ['#fNiv', '#fAcc', '#fUsu', '#fDes', '#fHas'].forEach((s) => { $(s).onchange = cargar; });
  cargar();
};

// ---------- Mi cuenta ----------
VISTAS.perfil = async () => {
  const u = Sesion.usuario;
  vista.innerHTML = `<div class="cabecera"><div><h1>Mi cuenta</h1><p class="muted">${esc(u.nombres)} ${esc(u.apellidos)} · @${esc(u.username)} · ${esc(u.correo)}</p></div>${rolBadge(u.rol)}</div>
    <div class="grid-2">
      <div class="panel"><h3>Cambiar contraseña</h3><form id="fClave" novalidate>
        <div class="campo"><label class="req">Contraseña actual</label><input name="actual" type="password" autocomplete="current-password"><div class="msg"></div></div>
        <div class="campo"><label class="req">Nueva contraseña</label><input name="nueva" type="password" autocomplete="new-password"><div class="msg"></div></div>
        <div class="campo"><label class="req">Repetir nueva contraseña</label><input name="repetir" type="password" autocomplete="new-password"><div class="msg"></div></div>
        <button class="btn">Actualizar contraseña</button></form></div>
      <div class="panel"><h3>Cambiar PIN de asistencia</h3><form id="fPin" novalidate>
        <div class="campo"><label class="req">Contraseña</label><input name="password" type="password" autocomplete="current-password"><div class="msg"></div></div>
        <div class="campo"><label class="req">Nuevo PIN</label><input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"><div class="msg"></div></div>
        <button class="btn sec">Actualizar PIN</button></form></div>
    </div>`;
  formClave($('#fClave'), () => vista.querySelector('#fClave').reset());
  const fp = $('#fPin');
  fp.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(fp); const er = {};
    if (!d.password) er.password = 'Obligatorio'; if (!R.pin.test(d.pin)) er.pin = 'De 4 a 6 dígitos';
    mostrarErrores(fp, er); if (Object.keys(er).length) return;
    try { const r = await api('PUT', '/auth/pin', d); toast(r.mensaje, 'ok'); fp.reset(); }
    catch (err) { mostrarErrores(fp, err.campos); toast(err.message, 'error'); }
  };
};

function formClave(f, alTerminar) {
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f); const er = {};
    if (!d.actual) er.actual = 'Obligatorio';
    if (!claveOk(d.nueva)) er.nueva = 'Mín. 8 caracteres con letras y números';
    else if (d.nueva === d.actual) er.nueva = 'Debe ser distinta a la actual';
    if (d.repetir !== d.nueva) er.repetir = 'Las contraseñas no coinciden';
    mostrarErrores(f, er); if (Object.keys(er).length) return;
    try {
      const r = await api('PUT', '/auth/clave', { actual: d.actual, nueva: d.nueva });
      Sesion.actualizarUsuario({ ...Sesion.usuario, debe_cambiar_clave: false });
      toast(r.mensaje, 'ok'); alTerminar();
    } catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

/** Primer ingreso o clave reseteada: no se puede usar el sistema hasta cambiarla */
function forzarCambioClave() {
  const m = abrirModal(`<h2>${ICONOS.candado.replace('<svg', '<svg style="width:22px;height:22px;vertical-align:-4px;color:var(--vino)"')} Cambie su contraseña</h2>
    <p class="muted">Está usando una contraseña temporal asignada por el administrador. Por seguridad, defina una nueva para continuar.</p>
    <form id="fForzar" novalidate>
      <div class="campo"><label class="req">Contraseña temporal</label><input name="actual" type="password"><div class="msg"></div></div>
      <div class="campo"><label class="req">Nueva contraseña</label><input name="nueva" type="password"><div class="msg"></div></div>
      <div class="campo"><label class="req">Repetir nueva contraseña</label><input name="repetir" type="password"><div class="msg"></div></div>
      <div class="pie"><button type="button" class="btn sec" id="salirForzar">Cerrar sesión</button><button class="btn">Guardar y continuar</button></div>
    </form>`, { cerrable: false });
  $('#salirForzar', m).onclick = () => cerrarSesion('SALIDA');
  formClave($('#fForzar', m), cerrarModal);
}

// ---------- Arranque ----------
(async function iniciar() {
  try {
    const r = await api('GET', '/auth/me'); // valida la sesión y trae permisos actualizados
    Sesion.actualizarUsuario(r.usuario);
  } catch { return; }
  pintarMenu();
  addEventListener('hashchange', navegar);
  navegar();
})();
