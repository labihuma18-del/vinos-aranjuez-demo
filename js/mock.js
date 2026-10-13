// =====================================================================
//  Vitis Gran Reserva — MODO DEMOSTRACIÓN
//  Simula el backend (Node + MySQL) dentro del navegador, con la misma
//  lógica: bcrypt, roles y permisos, sesiones con inactividad, baja lógica,
//  caja, ventas, asistencia y auditoría. Los datos viven en este navegador.
// =====================================================================
(function () {
  const KEY = 'vitis_gran_reserva_demo_v1';
  const INACTIVIDAD_MIN = 15, MAX_INTENTOS = 5, BLOQUEO_MIN = 15;
  const bc = window.dcodeIO && window.dcodeIO.bcrypt;

  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const ahora = () => fmt(new Date());
  const hoy = () => ahora().slice(0, 10);
  const ms = (s) => new Date(s.replace(' ', 'T')).getTime();
  const r2 = (n) => Math.round(Number(n) * 100) / 100;
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());

  // Respaldo si la librería bcrypt no cargara (no debería pasar)
  const SEMILLA = { 1: ['Vino2026*', '1111'], 2: ['Vino2026*', '2222'], 3: ['Vino2026*', '3333'], 4: ['Vino2026*', '4444'], 5: ['Vino2026*', '5555'] };
  const hash = (t) => (bc ? bc.hashSync(String(t), 8) : 'plano:' + t);
  function verificar(texto, h, uid, idx) {
    texto = String(texto);
    if (h.startsWith('plano:')) return h === 'plano:' + texto;
    if (bc) return bc.compareSync(texto, h);
    return SEMILLA[uid] ? SEMILLA[uid][idx] === texto : false;
  }

  function semilla() {
    const PH = '$2b$10$e8Xqy2a2DuhAk.sSxJ8yOupUON5dftGrAnzu6nVs2veG4ZvUtAlgi'; // Vino2026*
    const pins = ['$2b$10$jTBVSC8NKnCNS4DSu3sJKuprbAcFT9dei/OhkPNdKemff8zskp2O.', '$2b$10$PPcFyq9uziEejkOQ5rP4j.ujx0mQ4.163jedYPUJrtaKPmUwB7jZy',
      '$2b$10$BPBzxn99cc6qET5.oatHTeQqAGS0ohs/yKOWqMDh3x9l2UOu4scjK', '$2b$10$PzJtLbXTNNqxPpa/zoLSNuc2wGqXEL0MP5KRAELoOlnyqOZV//Hia',
      '$2b$10$v6lRcAuQ25oXCBJop/9kKOl2mz//bpqqW4UeOILRxMCZI4B8SfUNW'];
    const u = (id, nombres, apellidos, ci, correo, telefono, username, rol_id, estado) => ({
      id, nombres, apellidos, ci, correo, telefono, username, password_hash: PH, pin_hash: pins[id - 1], rol_id, estado,
      debe_cambiar_clave: 0, intentos_fallidos: 0, bloqueado_hasta: null, creado_en: '2026-10-01 09:00:00', actualizado_en: '2026-10-01 09:00:00' });
    const permisos = ['usuarios.ver', 'usuarios.crear', 'usuarios.editar', 'usuarios.desactivar', 'auditoria.ver', 'caja.operar', 'caja.ver_todas',
      'ventas.registrar', 'ventas.ver_propias', 'ventas.ver_todas', 'asistencia.marcar', 'asistencia.ver_propia', 'asistencia.ver_todas'];
    return {
      seq: { usuarios: 5, sesiones: 0, cajas: 1, ventas: 1, movimientos: 2, asistencia: 4, auditoria: 3 },
      roles: [
        { id: 1, nombre: 'Administrador', descripcion: 'Acceso total al sistema y gestión de usuarios' },
        { id: 2, nombre: 'Cajero', descripcion: 'Ventas y apertura/cierre de caja' },
        { id: 3, nombre: 'Empleado', descripcion: 'Registro e historial personal de asistencia' }],
      rol_permiso: { 1: permisos, 2: ['caja.operar', 'ventas.registrar', 'ventas.ver_propias'], 3: ['asistencia.marcar', 'asistencia.ver_propia'] },
      usuarios: [
        u(1, 'Carla', 'Mendoza Rojas', '7845123', 'admin@vitisgranreserva.bo', '71234567', 'admin', 1, 'ACTIVO'),
        u(2, 'Luis', 'Flores Arancibia', '6123987', 'lflores@vitisgranreserva.bo', '72345678', 'cajero1', 2, 'ACTIVO'),
        u(3, 'Ana', 'Quispe Mamani', '8456321', 'aquispe@vitisgranreserva.bo', '73456789', 'cajero2', 2, 'ACTIVO'),
        u(4, 'Jorge', 'Vargas Cruz', '5987456', 'jvargas@vitisgranreserva.bo', '74567890', 'empleado1', 3, 'ACTIVO'),
        u(5, 'Rosa', 'Choque Pérez', '9123654', 'rchoque@vitisgranreserva.bo', '75678901', 'empleado2', 3, 'INACTIVO')],
      sesiones: [],
      productos: [
        { id: 1, codigo: 'VT-001', nombre: 'Tannat Reserva 750 ml', tipo: 'Tinto', precio: 95, stock: 40 },
        { id: 2, codigo: 'VT-002', nombre: 'Cabernet Sauvignon 750 ml', tipo: 'Tinto', precio: 78, stock: 55 },
        { id: 3, codigo: 'VT-003', nombre: 'Malbec de Altura 750 ml', tipo: 'Tinto', precio: 85, stock: 30 },
        { id: 4, codigo: 'VB-001', nombre: 'Moscatel de Alejandría 750 ml', tipo: 'Blanco', precio: 65, stock: 35 },
        { id: 5, codigo: 'VB-002', nombre: 'Sauvignon Blanc 750 ml', tipo: 'Blanco', precio: 72, stock: 25 },
        { id: 6, codigo: 'VR-001', nombre: 'Rosado de Altura 750 ml', tipo: 'Rosado', precio: 68, stock: 20 },
        { id: 7, codigo: 'VE-001', nombre: 'Espumante Brut 750 ml', tipo: 'Espumante', precio: 120, stock: 15 },
        { id: 8, codigo: 'SG-001', nombre: 'Singani Etiqueta Negra 700 ml', tipo: 'Singani', precio: 110, stock: 30 },
        { id: 9, codigo: 'SG-002', nombre: 'Singani Tradicional 1 L', tipo: 'Singani', precio: 75, stock: 45 }],
      cajas: [{ id: 1, usuario_id: 2, fecha_apertura: '2026-10-09 09:00:00', monto_inicial: 200, fecha_cierre: '2026-10-09 19:00:00',
        monto_esperado: 448, monto_contado: 448, diferencia: 0, estado: 'CERRADA', observaciones: 'Cierre sin novedad' }],
      ventas: [{ id: 1, nro_nota: 'NV-000001', caja_id: 1, usuario_id: 2, cliente_nombre: 'Mario Torres', cliente_ci_nit: '4567891', total: 268, estado: 'EMITIDA', fecha: '2026-10-09 11:30:00' }],
      detalle_venta: [{ venta_id: 1, producto_id: 1, cantidad: 2, precio_unitario: 95, subtotal: 190 }, { venta_id: 1, producto_id: 2, cantidad: 1, precio_unitario: 78, subtotal: 78 }],
      movimientos: [
        { id: 1, caja_id: 1, usuario_id: 2, tipo: 'INGRESO', concepto: 'Venta NV-000001', monto: 268, venta_id: 1, fecha: '2026-10-09 11:30:00' },
        { id: 2, caja_id: 1, usuario_id: 2, tipo: 'EGRESO', concepto: 'Compra de bolsas', monto: 20, venta_id: null, fecha: '2026-10-09 15:00:00' }],
      asistencia: [
        { id: 1, usuario_id: 2, tipo: 'ENTRADA', fecha_hora: '2026-10-09 08:55:00', metodo: 'PIN_KIOSCO' },
        { id: 2, usuario_id: 2, tipo: 'SALIDA', fecha_hora: '2026-10-09 19:05:00', metodo: 'PIN_KIOSCO' },
        { id: 3, usuario_id: 4, tipo: 'ENTRADA', fecha_hora: '2026-10-09 08:30:00', metodo: 'PIN_SESION' },
        { id: 4, usuario_id: 4, tipo: 'SALIDA', fecha_hora: '2026-10-09 17:30:00', metodo: 'PIN_SESION' }],
      auditoria: [
        { id: 1, usuario_id: 1, accion: 'USUARIO_CREADO', entidad: 'usuarios', entidad_id: 5, detalle: 'Alta de empleado2 (Empleado)', ip: '127.0.0.1', fecha: '2026-10-01 10:00:00' },
        { id: 2, usuario_id: 1, accion: 'USUARIO_DESACTIVADO', entidad: 'usuarios', entidad_id: 5, detalle: 'Baja lógica de empleado2', ip: '127.0.0.1', fecha: '2026-10-05 12:00:00' },
        { id: 3, usuario_id: 2, accion: 'LOGIN_OK', entidad: 'usuarios', entidad_id: 2, detalle: 'Inicio de sesión', ip: '127.0.0.1', fecha: '2026-10-09 08:58:00' }],
    };
  }

  let memoria = null;
  function cargar() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch { /* sin almacenamiento */ }
    return memoria || semilla();
  }
  function guardar(db) { memoria = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* sin almacenamiento */ } }

  window.reiniciarDemo = function () {
    try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch { /* nada */ }
    memoria = null; location.reload();
  };

  // ---------- utilidades tipo SQL ----------
  class HttpError { constructor(status, body) { this.status = status; this.body = body; } }
  const fallo = (status, error, extra = {}) => { throw new HttpError(status, { error, ...extra }); };
  const sig = (db, t) => ++db.seq[t];
  const rol = (db, id) => db.roles.find((r) => r.id === Number(id));
  const usr = (db, id) => db.usuarios.find((u) => u.id === Number(id));
  const nombre = (u) => `${u.nombres} ${u.apellidos}`;
  function audit(db, usuarioId, accion, entidad, entidadId, detalle) {
    db.auditoria.push({ id: sig(db, 'auditoria'), usuario_id: usuarioId ?? null, accion, entidad: entidad ?? null, entidad_id: entidadId ?? null,
      detalle: detalle ? String(detalle).slice(0, 255) : null, ip: '127.0.0.1', fecha: ahora() });
  }
  const permisosDe = (db, rolId) => db.rol_permiso[rolId] || [];
  const perfil = (db, u) => ({ id: u.id, nombres: u.nombres, apellidos: u.apellidos, username: u.username, correo: u.correo,
    rol: rol(db, u.rol_id).nombre, debe_cambiar_clave: !!u.debe_cambiar_clave, permisos: permisosDe(db, u.rol_id) });
  const vistaUsuario = (db, u) => ({ id: u.id, nombres: u.nombres, apellidos: u.apellidos, ci: u.ci, correo: u.correo, telefono: u.telefono,
    username: u.username, rol_id: u.rol_id, rol: rol(db, u.rol_id).nombre, estado: u.estado, debe_cambiar_clave: u.debe_cambiar_clave,
    creado_en: u.creado_en, actualizado_en: u.actualizado_en });

  // ---------- validaciones (idénticas al backend) ----------
  const REGLAS = { nombre: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{2,60}$/, ci: /^[0-9]{5,10}(-[0-9A-Z]{1,2})?$/, correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    telefono: /^[67][0-9]{7}$/, username: /^[a-z0-9._]{4,30}$/, pin: /^[0-9]{4,6}$/ };
  const claveValida = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
  const limpio = (v) => (typeof v === 'string' ? v.trim() : v);
  function validarUsuario(d, esNuevo) {
    const e = {};
    const req = (c, et) => { if (!limpio(d[c])) e[c] = `${et} es obligatorio`; return !e[c]; };
    if (req('nombres', 'El nombre') && !REGLAS.nombre.test(limpio(d.nombres))) e.nombres = 'Solo letras y espacios (2 a 60)';
    if (req('apellidos', 'El apellido') && !REGLAS.nombre.test(limpio(d.apellidos))) e.apellidos = 'Solo letras y espacios (2 a 60)';
    if (req('ci', 'El CI') && !REGLAS.ci.test(limpio(d.ci).toUpperCase())) e.ci = 'CI inválido (ej. 7845123 o 7845123-1A)';
    if (req('correo', 'El correo') && !REGLAS.correo.test(limpio(d.correo))) e.correo = 'Formato de correo inválido';
    if (limpio(d.telefono) && !REGLAS.telefono.test(limpio(d.telefono))) e.telefono = 'Celular de 8 dígitos (ej. 71234567)';
    if (!Number.isInteger(Number(d.rol_id)) || Number(d.rol_id) <= 0) e.rol_id = 'Seleccione un rol';
    if (esNuevo) {
      if (req('username', 'El usuario') && !REGLAS.username.test(limpio(d.username))) e.username = 'Minúsculas, números, punto o guion bajo (4 a 30)';
      if (!claveValida(d.password)) e.password = 'Mínimo 8 caracteres, con letras y números';
      if (!REGLAS.pin.test(String(d.pin || ''))) e.pin = 'El PIN debe tener de 4 a 6 dígitos';
    }
    return e;
  }
  const normalizar = (d) => ({ nombres: limpio(d.nombres), apellidos: limpio(d.apellidos), ci: limpio(d.ci).toUpperCase(),
    correo: limpio(d.correo).toLowerCase(), telefono: limpio(d.telefono) || null, username: d.username ? limpio(d.username).toLowerCase() : undefined, rol_id: Number(d.rol_id) });
  const montoValido = (m) => m !== '' && m !== null && m !== undefined && Number.isFinite(Number(m)) && Number(m) >= 0 && Number(m) <= 1000000;

  // ---------- sesión (equivale al middleware autenticar + permitir) ----------
  function autenticar(db, headers) {
    const h = headers.Authorization || headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) fallo(401, 'Debe iniciar sesión', { codigo: 'NO_AUTENTICADO' });
    const s = db.sesiones.find((x) => x.jti === token);
    if (!s || s.revocada) fallo(401, 'La sesión fue cerrada. Vuelva a ingresar.', { codigo: 'SESION_INVALIDA' });
    const u = usr(db, s.usuario_id);
    if (Date.now() - ms(s.ultima_actividad) > INACTIVIDAD_MIN * 60000 || Date.now() > ms(s.expira_en)) {
      s.revocada = 1; audit(db, u.id, 'SESION_EXPIRADA', 'sesiones', s.id, `Inactividad mayor a ${INACTIVIDAD_MIN} min`);
      fallo(401, 'Su sesión expiró por inactividad.', { codigo: 'SESION_EXPIRADA' });
    }
    if (u.estado !== 'ACTIVO') { s.revocada = 1; fallo(401, 'Su cuenta fue desactivada.', { codigo: 'CUENTA_INACTIVA' }); }
    s.ultima_actividad = ahora();
    return { s, u, p: new Set(permisosDe(db, u.rol_id)) };
  }
  function permitir(db, ctx, method, url, ...codigos) {
    if (codigos.some((c) => ctx.p.has(c))) return;
    audit(db, ctx.u.id, 'ACCESO_DENEGADO', null, null, `${method} ${url} (requiere ${codigos.join(' o ')})`);
    fallo(403, 'No tiene permiso para realizar esta acción', { codigo: 'SIN_PERMISO' });
  }
  function intentoFallido(db, u, motivo) {
    const intentos = u.intentos_fallidos + 1;
    if (intentos >= MAX_INTENTOS) {
      u.intentos_fallidos = 0; u.bloqueado_hasta = fmt(new Date(Date.now() + BLOQUEO_MIN * 60000));
      audit(db, u.id, 'CUENTA_BLOQUEADA', 'usuarios', u.id, `${MAX_INTENTOS} intentos fallidos (${motivo})`);
    } else u.intentos_fallidos = intentos;
    audit(db, u.id, motivo === 'PIN' ? 'PIN_FALLIDO' : 'LOGIN_FALLIDO', 'usuarios', u.id, `Intento ${intentos} de ${MAX_INTENTOS}`);
  }
  const bloqueado = (u) => u.bloqueado_hasta && ms(u.bloqueado_hasta) > Date.now();

  // ---------- caja ----------
  const cajaAbierta = (db, uid) => db.cajas.find((c) => c.usuario_id === uid && c.estado === 'ABIERTA');
  function resumen(db, caja) {
    const movs = db.movimientos.filter((m) => m.caja_id === caja.id);
    const ingresos = r2(movs.filter((m) => m.tipo === 'INGRESO').reduce((a, m) => a + m.monto, 0));
    const egresos = r2(movs.filter((m) => m.tipo === 'EGRESO').reduce((a, m) => a + m.monto, 0));
    return { ingresos, egresos, nro_ventas: movs.filter((m) => m.venta_id).length, esperado: r2(caja.monto_inicial + ingresos - egresos) };
  }

  // ---------- asistencia ----------
  function ultimaHoy(db, uid) {
    const h = db.asistencia.filter((a) => a.usuario_id === uid && a.fecha_hora.slice(0, 10) === hoy());
    return h.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora) || a.id - b.id).pop();
  }
  function marcar(db, uid, metodo) {
    const ult = ultimaHoy(db, uid);
    const reg = { id: sig(db, 'asistencia'), usuario_id: uid, tipo: ult && ult.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA', fecha_hora: ahora(), metodo };
    db.asistencia.push(reg);
    return { id: reg.id, tipo: reg.tipo, fecha_hora: reg.fecha_hora };
  }
  function porDia(rows) {
    const dias = {};
    for (const r of [...rows].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora))) {
      const fecha = r.fecha_hora.slice(0, 10); const k = `${r.usuario_id}|${fecha}`;
      dias[k] ??= { usuario_id: r.usuario_id, empleado: r.empleado, fecha, marcas: [], minutos: 0, _e: null };
      const d = dias[k];
      d.marcas.push({ tipo: r.tipo, hora: r.fecha_hora.slice(11, 16), metodo: r.metodo });
      if (r.tipo === 'ENTRADA') d._e = ms(r.fecha_hora);
      else if (d._e) { d.minutos += Math.round((ms(r.fecha_hora) - d._e) / 60000); d._e = null; }
    }
    return Object.values(dias).map(({ _e, ...d }) => ({ ...d, horas: `${Math.floor(d.minutos / 60)}h ${pad(d.minutos % 60)}m`, abierta: !!_e }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  // ===================== RUTAS =====================
  function manejar(db, method, path, q, body, headers) {
    const seg = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    const [mod, a, b] = seg;
    const url = '/api/' + seg.join('/');
    const auth = () => autenticar(db, headers);

    // ---- AUTH ----
    if (mod === 'auth') {
      if (a === 'login' && method === 'POST') {
        const usuario = String(body.usuario || '').trim().toLowerCase(); const password = String(body.password || '');
        if (!usuario || !password) fallo(400, 'Ingrese usuario y contraseña');
        const u = db.usuarios.find((x) => x.username === usuario || x.correo === usuario);
        if (!u) { audit(db, null, 'LOGIN_FALLIDO', null, null, `Usuario inexistente: ${usuario}`); fallo(401, 'Usuario o contraseña incorrectos'); }
        if (bloqueado(u)) fallo(423, `Cuenta bloqueada por intentos fallidos. Intente en ${Math.ceil((ms(u.bloqueado_hasta) - Date.now()) / 60000)} min.`);
        if (!verificar(password, u.password_hash, u.id, 0)) { intentoFallido(db, u, 'CLAVE'); fallo(401, 'Usuario o contraseña incorrectos'); }
        if (u.estado !== 'ACTIVO') { audit(db, u.id, 'LOGIN_RECHAZADO', 'usuarios', u.id, 'Cuenta inactiva'); fallo(403, 'Su cuenta está desactivada. Contacte al administrador.'); }
        u.intentos_fallidos = 0; u.bloqueado_hasta = null;
        const jti = uuid();
        db.sesiones.push({ id: sig(db, 'sesiones'), usuario_id: u.id, jti, creada_en: ahora(), ultima_actividad: ahora(), expira_en: fmt(new Date(Date.now() + 8 * 3600000)), revocada: 0 });
        audit(db, u.id, 'LOGIN_OK', 'usuarios', u.id, 'Inicio de sesión');
        return [200, { token: jti, inactividad_min: INACTIVIDAD_MIN, usuario: perfil(db, u) }];
      }
      const c = auth();
      if (a === 'logout' && method === 'POST') {
        c.s.revocada = 1; const inac = body && body.motivo === 'INACTIVIDAD';
        audit(db, c.u.id, inac ? 'SESION_EXPIRADA' : 'LOGOUT', 'sesiones', c.s.id, inac ? 'Cierre automático por inactividad' : 'Cierre de sesión');
        return [200, { mensaje: 'Sesión cerrada correctamente' }];
      }
      if (a === 'me' && method === 'GET') return [200, { inactividad_min: INACTIVIDAD_MIN, usuario: perfil(db, c.u) }];
      if (a === 'clave' && method === 'PUT') {
        const { actual, nueva } = body;
        if (!actual || !verificar(actual, c.u.password_hash, c.u.id, 0)) fallo(400, 'La contraseña actual no es correcta', { campos: { actual: 'Incorrecta' } });
        if (!claveValida(nueva)) fallo(400, 'Contraseña nueva inválida', { campos: { nueva: 'Mínimo 8 caracteres, con letras y números' } });
        if (actual === nueva) fallo(400, 'La nueva contraseña debe ser distinta', { campos: { nueva: 'Igual a la actual' } });
        c.u.password_hash = hash(nueva); c.u.debe_cambiar_clave = 0;
        db.sesiones.forEach((s) => { if (s.usuario_id === c.u.id && s.id !== c.s.id) s.revocada = 1; });
        audit(db, c.u.id, 'CAMBIO_CLAVE', 'usuarios', c.u.id, 'El usuario cambió su contraseña');
        return [200, { mensaje: 'Contraseña actualizada' }];
      }
      if (a === 'pin' && method === 'PUT') {
        if (!body.password || !verificar(body.password, c.u.password_hash, c.u.id, 0)) fallo(400, 'Contraseña incorrecta', { campos: { password: 'Incorrecta' } });
        if (!REGLAS.pin.test(String(body.pin || ''))) fallo(400, 'PIN inválido', { campos: { pin: 'De 4 a 6 dígitos' } });
        c.u.pin_hash = hash(body.pin); audit(db, c.u.id, 'CAMBIO_PIN', 'usuarios', c.u.id, 'El usuario cambió su PIN');
        return [200, { mensaje: 'PIN actualizado' }];
      }
    }

    // ---- USUARIOS ----
    if (mod === 'usuarios') {
      const c = auth();
      const P = (...x) => permitir(db, c, method, url, ...x);
      const duplicados = ({ ci, correo, username }, excluir = 0) => {
        const e = {};
        for (const r of db.usuarios.filter((x) => x.id !== excluir)) {
          if (r.ci === ci) e.ci = 'Este CI ya está registrado';
          if (r.correo === correo) e.correo = 'Este correo ya está registrado';
          if (username && r.username === username) e.username = 'Este nombre de usuario ya existe';
        }
        return e;
      };
      const adminsActivos = (excluir) => db.usuarios.filter((x) => x.rol_id === 1 && x.estado === 'ACTIVO' && x.id !== excluir).length;

      if (a === 'roles' && method === 'GET') { P('usuarios.ver'); return [200, db.roles]; }
      if (!a && method === 'GET') {
        P('usuarios.ver');
        let lista = db.usuarios;
        if (q.q) { const t = String(q.q).trim().toLowerCase(); lista = lista.filter((u) => nombre(u).toLowerCase().includes(t) || u.ci.toLowerCase().includes(t) || u.username.includes(t)); }
        if (q.rol_id) lista = lista.filter((u) => u.rol_id === Number(q.rol_id));
        if (q.estado) lista = lista.filter((u) => u.estado === q.estado);
        lista = [...lista].sort((x, y) => x.estado.localeCompare(y.estado) || x.apellidos.localeCompare(y.apellidos) || x.nombres.localeCompare(y.nombres));
        return [200, lista.map((u) => vistaUsuario(db, u))];
      }
      if (!a && method === 'POST') {
        P('usuarios.crear');
        const er = validarUsuario(body, true);
        if (Object.keys(er).length) fallo(400, 'Revise los campos marcados', { campos: er });
        const d = normalizar(body); const r = rol(db, d.rol_id);
        if (!r) fallo(400, 'Rol inexistente', { campos: { rol_id: 'Rol inexistente' } });
        const dup = duplicados(d); if (Object.keys(dup).length) fallo(409, 'Datos duplicados', { campos: dup });
        const id = sig(db, 'usuarios');
        db.usuarios.push({ id, ...d, password_hash: hash(body.password), pin_hash: hash(body.pin), estado: 'ACTIVO', debe_cambiar_clave: 1,
          intentos_fallidos: 0, bloqueado_hasta: null, creado_en: ahora(), actualizado_en: ahora() });
        audit(db, c.u.id, 'USUARIO_CREADO', 'usuarios', id, `Alta de ${d.username} (${r.nombre})`);
        return [201, { mensaje: 'Usuario creado. Deberá cambiar su contraseña al ingresar.', id }];
      }
      const objetivo = a && usr(db, a);
      if (a && !b && method === 'GET') { P('usuarios.ver'); if (!objetivo) fallo(404, 'Usuario no encontrado'); return [200, vistaUsuario(db, objetivo)]; }
      if (a && !b && method === 'PUT') {
        P('usuarios.editar'); if (!objetivo) fallo(404, 'Usuario no encontrado');
        const er = validarUsuario(body, false); if (Object.keys(er).length) fallo(400, 'Revise los campos marcados', { campos: er });
        const d = normalizar(body); const r = rol(db, d.rol_id);
        if (!r) fallo(400, 'Rol inexistente', { campos: { rol_id: 'Rol inexistente' } });
        if (objetivo.rol_id === 1 && d.rol_id !== 1) {
          if (objetivo.id === c.u.id) fallo(400, 'No puede quitarse a sí mismo el rol de Administrador', { campos: { rol_id: 'No permitido' } });
          if (objetivo.estado === 'ACTIVO' && adminsActivos(objetivo.id) === 0) fallo(400, 'Debe quedar al menos un Administrador activo');
        }
        const dup = duplicados({ ci: d.ci, correo: d.correo }, objetivo.id); if (Object.keys(dup).length) fallo(409, 'Datos duplicados', { campos: dup });
        const rolAntes = rol(db, objetivo.rol_id).nombre; const cambio = objetivo.rol_id !== d.rol_id;
        Object.assign(objetivo, { nombres: d.nombres, apellidos: d.apellidos, ci: d.ci, correo: d.correo, telefono: d.telefono, rol_id: d.rol_id, actualizado_en: ahora() });
        if (cambio) db.sesiones.forEach((s) => { if (s.usuario_id === objetivo.id) s.revocada = 1; });
        audit(db, c.u.id, cambio ? 'CAMBIO_ROL' : 'USUARIO_ACTUALIZADO', 'usuarios', objetivo.id, `Edición de ${objetivo.username}${cambio ? ` | rol: ${rolAntes} → ${r.nombre}` : ''}`);
        return [200, { mensaje: 'Usuario actualizado' }];
      }
      if (a && b === 'reset-clave' && method === 'POST') {
        P('usuarios.editar'); if (!objetivo) fallo(404, 'Usuario no encontrado');
        if (!claveValida(body.password)) fallo(400, 'Contraseña inválida', { campos: { password: 'Mínimo 8 caracteres, con letras y números' } });
        Object.assign(objetivo, { password_hash: hash(body.password), debe_cambiar_clave: 1, intentos_fallidos: 0, bloqueado_hasta: null });
        db.sesiones.forEach((s) => { if (s.usuario_id === objetivo.id) s.revocada = 1; });
        audit(db, c.u.id, 'RESET_CLAVE', 'usuarios', objetivo.id, `Contraseña temporal asignada a ${objetivo.username}`);
        return [200, { mensaje: 'Contraseña restablecida. El usuario deberá cambiarla al ingresar.' }];
      }
      if (a && b === 'estado' && method === 'PATCH') {
        P('usuarios.desactivar'); const estado = body.estado;
        if (!['ACTIVO', 'INACTIVO'].includes(estado)) fallo(400, 'Estado inválido');
        if (!objetivo) fallo(404, 'Usuario no encontrado');
        if (objetivo.estado === estado) fallo(400, `El usuario ya está ${estado.toLowerCase()}`);
        if (estado === 'INACTIVO') {
          if (objetivo.id === c.u.id) fallo(400, 'No puede desactivar su propia cuenta');
          if (objetivo.rol_id === 1 && adminsActivos(objetivo.id) === 0) fallo(400, 'Debe quedar al menos un Administrador activo');
          if (cajaAbierta(db, objetivo.id)) fallo(400, 'El usuario tiene una caja abierta. Debe cerrarla antes de desactivarlo.');
          db.sesiones.forEach((s) => { if (s.usuario_id === objetivo.id) s.revocada = 1; });
        }
        objetivo.estado = estado;
        audit(db, c.u.id, estado === 'INACTIVO' ? 'USUARIO_DESACTIVADO' : 'USUARIO_REACTIVADO', 'usuarios', objetivo.id,
          `${estado === 'INACTIVO' ? 'Baja lógica' : 'Reactivación'} de ${objetivo.username}`);
        return [200, { mensaje: estado === 'INACTIVO' ? 'Usuario desactivado (su historial se conserva)' : 'Usuario reactivado' }];
      }
    }

    // ---- CAJA ----
    if (mod === 'caja') {
      const c = auth(); const P = (...x) => permitir(db, c, method, url, ...x);
      if (a === 'actual' && method === 'GET') {
        P('caja.operar'); const caja = cajaAbierta(db, c.u.id);
        if (!caja) return [200, { caja: null }];
        const movimientos = db.movimientos.filter((m) => m.caja_id === caja.id).sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id - x.id);
        return [200, { caja, resumen: resumen(db, caja), movimientos }];
      }
      if (a === 'abrir' && method === 'POST') {
        P('caja.operar');
        if (!montoValido(body.monto_inicial)) fallo(400, 'Monto inicial inválido', { campos: { monto_inicial: 'Ingrese un monto mayor o igual a 0' } });
        if (cajaAbierta(db, c.u.id)) fallo(400, 'Ya tiene una caja abierta');
        const id = sig(db, 'cajas');
        db.cajas.push({ id, usuario_id: c.u.id, fecha_apertura: ahora(), monto_inicial: r2(body.monto_inicial), fecha_cierre: null, monto_esperado: null,
          monto_contado: null, diferencia: null, estado: 'ABIERTA', observaciones: null });
        audit(db, c.u.id, 'CAJA_ABIERTA', 'cajas', id, `Monto inicial Bs ${r2(body.monto_inicial)}`);
        return [201, { mensaje: 'Caja abierta', id }];
      }
      if (a === 'movimientos' && method === 'POST') {
        P('caja.operar'); const monto = r2(body.monto); const campos = {};
        if (!['INGRESO', 'EGRESO'].includes(body.tipo)) campos.tipo = 'Seleccione ingreso o egreso';
        if (!body.concepto || String(body.concepto).trim().length < 3) campos.concepto = 'Describa el movimiento (mín. 3 caracteres)';
        if (!montoValido(monto) || monto <= 0) campos.monto = 'Monto mayor a 0';
        if (Object.keys(campos).length) fallo(400, 'Revise los campos', { campos });
        const caja = cajaAbierta(db, c.u.id); if (!caja) fallo(400, 'Debe abrir caja primero');
        if (body.tipo === 'EGRESO' && monto > resumen(db, caja).esperado) fallo(400, 'El egreso supera el efectivo disponible en caja', { campos: { monto: 'Saldo insuficiente' } });
        db.movimientos.push({ id: sig(db, 'movimientos'), caja_id: caja.id, usuario_id: c.u.id, tipo: body.tipo, concepto: String(body.concepto).trim().slice(0, 150), monto, venta_id: null, fecha: ahora() });
        return [201, { mensaje: 'Movimiento registrado' }];
      }
      if (a === 'cerrar' && method === 'POST') {
        P('caja.operar');
        if (!montoValido(body.monto_contado)) fallo(400, 'Monto contado inválido', { campos: { monto_contado: 'Ingrese el efectivo contado' } });
        const caja = cajaAbierta(db, c.u.id); if (!caja) fallo(400, 'No tiene una caja abierta');
        const { esperado } = resumen(db, caja); const contado = r2(body.monto_contado); const diferencia = r2(contado - esperado);
        Object.assign(caja, { estado: 'CERRADA', fecha_cierre: ahora(), monto_esperado: esperado, monto_contado: contado, diferencia,
          observaciones: String(body.observaciones || '').trim().slice(0, 255) || null });
        audit(db, c.u.id, 'CAJA_CERRADA', 'cajas', caja.id, `Esperado Bs ${esperado} | Contado Bs ${contado} | Diferencia Bs ${diferencia}`);
        return [200, { mensaje: 'Caja cerrada', arqueo: { esperado, contado, diferencia } }];
      }
      if (a === 'historial' && method === 'GET') {
        P('caja.operar', 'caja.ver_todas');
        const todas = q.todas === '1' && c.p.has('caja.ver_todas');
        const filas = db.cajas.filter((x) => todas || x.usuario_id === c.u.id).sort((x, y) => y.fecha_apertura.localeCompare(x.fecha_apertura))
          .map((x) => ({ ...x, cajero: nombre(usr(db, x.usuario_id)) }));
        return [200, filas];
      }
    }

    // ---- VENTAS ----
    if (mod === 'ventas') {
      const c = auth(); const P = (...x) => permitir(db, c, method, url, ...x);
      const verTodas = c.p.has('ventas.ver_todas');
      if (a === 'productos' && method === 'GET') { P('ventas.registrar'); return [200, [...db.productos].sort((x, y) => x.tipo.localeCompare(y.tipo) || x.nombre.localeCompare(y.nombre))]; }
      if (!a && method === 'POST') {
        P('ventas.registrar');
        const items = Array.isArray(body.items) ? body.items : [];
        const cliente = String(body.cliente_nombre || '').trim() || 'Sin nombre'; const ciNit = String(body.cliente_ci_nit || '').trim() || null;
        if (!items.length) fallo(400, 'Agregue al menos un producto');
        if (items.some((i) => !Number.isInteger(Number(i.cantidad)) || Number(i.cantidad) <= 0)) fallo(400, 'Cantidades inválidas');
        if (ciNit && !/^[0-9]{5,13}(-[0-9A-Z]{1,2})?$/.test(ciNit)) fallo(400, 'CI/NIT inválido', { campos: { cliente_ci_nit: 'Solo números (5 a 13)' } });
        const caja = cajaAbierta(db, c.u.id); if (!caja) fallo(400, 'Debe abrir caja antes de vender');
        let total = 0; const det = [];
        for (const it of items) {
          const p = db.productos.find((x) => x.id === Number(it.producto_id)); const cant = Number(it.cantidad);
          if (!p) fallo(400, `Producto ${it.producto_id} no existe`);
          if (p.stock < cant) fallo(400, `Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`);
          const subtotal = r2(p.precio * cant); total += subtotal; det.push({ p, cant, subtotal });
        }
        total = r2(total);
        const id = sig(db, 'ventas'); const nro = `NV-${String(id).padStart(6, '0')}`;
        db.ventas.push({ id, nro_nota: nro, caja_id: caja.id, usuario_id: c.u.id, cliente_nombre: cliente.slice(0, 100), cliente_ci_nit: ciNit, total, estado: 'EMITIDA', fecha: ahora() });
        for (const d of det) { db.detalle_venta.push({ venta_id: id, producto_id: d.p.id, cantidad: d.cant, precio_unitario: d.p.precio, subtotal: d.subtotal }); d.p.stock -= d.cant; }
        db.movimientos.push({ id: sig(db, 'movimientos'), caja_id: caja.id, usuario_id: c.u.id, tipo: 'INGRESO', concepto: `Venta ${nro}`, monto: total, venta_id: id, fecha: ahora() });
        audit(db, c.u.id, 'VENTA_REGISTRADA', 'ventas', id, `${nro} por Bs ${total}`);
        return [201, { mensaje: `Venta ${nro} registrada`, id, nro_nota: nro, total }];
      }
      const conVendedor = (v) => { const u = usr(db, v.usuario_id); return { ...v, vendedor_usuario: u.username, vendedor: nombre(u) }; };
      if (!a && method === 'GET') {
        P('ventas.ver_propias', 'ventas.ver_todas');
        return [200, db.ventas.filter((v) => verTodas || v.usuario_id === c.u.id).sort((x, y) => y.fecha.localeCompare(x.fecha)).map(conVendedor)];
      }
      if (a && method === 'GET') {
        P('ventas.ver_propias', 'ventas.ver_todas');
        const v = db.ventas.find((x) => x.id === Number(a));
        if (!v || (!verTodas && v.usuario_id !== c.u.id)) fallo(404, 'Venta no encontrada');
        const detalle = db.detalle_venta.filter((d) => d.venta_id === v.id).map((d) => { const p = db.productos.find((x) => x.id === d.producto_id); return { ...d, codigo: p.codigo, nombre: p.nombre }; });
        return [200, { ...conVendedor(v), detalle }];
      }
    }

    // ---- ASISTENCIA ----
    if (mod === 'asistencia') {
      if (a === 'kiosco' && method === 'POST') {
        const ci = String(body.ci || '').trim().toUpperCase(); const pin = String(body.pin || '');
        if (!ci || !pin) fallo(400, 'Ingrese su CI y PIN');
        const u = db.usuarios.find((x) => x.ci === ci);
        if (!u) fallo(401, 'CI o PIN incorrectos');
        if (bloqueado(u)) fallo(423, 'Cuenta bloqueada temporalmente por intentos fallidos');
        if (!verificar(pin, u.pin_hash, u.id, 1)) { intentoFallido(db, u, 'PIN'); fallo(401, 'CI o PIN incorrectos'); }
        if (u.estado !== 'ACTIVO') fallo(403, 'Cuenta desactivada. No puede registrar asistencia.');
        u.intentos_fallidos = 0;
        const reg = marcar(db, u.id, 'PIN_KIOSCO');
        return [201, { mensaje: `${reg.tipo} registrada: ${nombre(u)}`, registro: reg }];
      }
      const c = auth(); const P = (...x) => permitir(db, c, method, url, ...x);
      const conNombre = (r) => ({ ...r, empleado: nombre(usr(db, r.usuario_id)) });
      if (a === 'marcar' && method === 'POST') {
        P('asistencia.marcar');
        if (!verificar(String(body.pin || ''), c.u.pin_hash, c.u.id, 1)) { intentoFallido(db, c.u, 'PIN'); fallo(400, 'PIN incorrecto', { campos: { pin: 'Incorrecto' } }); }
        c.u.intentos_fallidos = 0;
        const reg = marcar(db, c.u.id, 'PIN_SESION');
        return [201, { mensaje: `${reg.tipo} registrada a las ${reg.fecha_hora.slice(11, 16)}`, registro: reg }];
      }
      if (a === 'mia' && method === 'GET') {
        P('asistencia.ver_propia');
        const desde = fmt(new Date(Date.now() - 31 * 864e5)).slice(0, 10);
        const rows = db.asistencia.filter((r) => r.usuario_id === c.u.id && r.fecha_hora.slice(0, 10) >= desde).map(conNombre);
        const ult = ultimaHoy(db, c.u.id);
        return [200, { siguiente: ult && ult.tipo === 'ENTRADA' ? 'SALIDA' : 'ENTRADA', dias: porDia(rows) }];
      }
      if (a === 'todas' && method === 'GET') {
        P('asistencia.ver_todas');
        const desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde) ? q.desde : fmt(new Date(Date.now() - 7 * 864e5)).slice(0, 10);
        const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta) ? q.hasta : '2999-12-31';
        const rows = db.asistencia.filter((r) => { const f = r.fecha_hora.slice(0, 10); return f >= desde && f <= hasta && (!q.usuario_id || r.usuario_id === Number(q.usuario_id)); }).map(conNombre);
        return [200, porDia(rows)];
      }
    }

    // ---- AUDITORÍA ----
    if (mod === 'auditoria') {
      const c = auth(); permitir(db, c, method, url, 'auditoria.ver');
      if (a === 'acciones') return [200, [...new Set(db.auditoria.map((x) => x.accion))].sort()];
      if (!a) {
        const filas = db.auditoria.filter((x) => (!q.accion || x.accion === q.accion) && (!q.usuario_id || x.usuario_id === Number(q.usuario_id))
          && (!q.desde || x.fecha.slice(0, 10) >= q.desde) && (!q.hasta || x.fecha.slice(0, 10) <= q.hasta))
          .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id - x.id).slice(0, 500)
          .map((x) => ({ ...x, username: x.usuario_id ? usr(db, x.usuario_id).username : null }));
        return [200, filas];
      }
    }
    fallo(404, 'Ruta no encontrada');
  }

  // ---------- intercepta fetch('/api/...') ----------
  const fetchOriginal = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = async function (input, opts = {}) {
    const urlTxt = typeof input === 'string' ? input : input.url;
    if (!/^\/api(\/|$)/.test(urlTxt)) return fetchOriginal(input, opts);
    const u = new URL(urlTxt, 'http://demo.local');
    const q = Object.fromEntries([...u.searchParams.entries()].filter(([, v]) => v !== ''));
    let body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch { return respuesta(400, { error: 'JSON inválido' }); }
    await new Promise((r) => setTimeout(r, 60)); // pequeña latencia, como un servidor real
    const db = cargar();
    try {
      const [status, data] = manejar(db, (opts.method || 'GET').toUpperCase(), u.pathname, q, body, opts.headers || {});
      guardar(db); return respuesta(status, data);
    } catch (e) {
      if (e instanceof HttpError) { guardar(db); return respuesta(e.status, e.body); }
      console.error(e); return respuesta(500, { error: 'Error interno del servidor' });
    }
  };
  function respuesta(status, data) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
})();
