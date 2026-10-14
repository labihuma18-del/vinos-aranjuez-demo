// =====================================================================
//  Bodegas Aranjuez — MODO DEMOSTRACIÓN
//  Simula el backend (Node + MySQL) dentro del navegador, con la misma
//  lógica: bcrypt, roles y permisos, sesiones con inactividad, baja lógica,
//  caja, ventas, clientes, almacén (kardex), asistencia, auditoría y tienda en línea (pedidos web). Los datos viven en este navegador.
// =====================================================================
(function () {
  const KEY = 'bodegas_aranjuez_demo_v1';
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
  const SEMILLA = { 1: ['Vino2026*', '1111'], 2: ['Vino2026*', '2222'], 3: ['Vino2026*', '3333'], 4: ['Vino2026*', '4444'], 5: ['Vino2026*', '5555'], 6: ['Vino2026*', '6666'] };
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
      '$2b$10$v6lRcAuQ25oXCBJop/9kKOl2mz//bpqqW4UeOILRxMCZI4B8SfUNW', '$2b$10$wOVdVzC0RpSZfvCp4OmXOu0x7Rjz8jpB8ldLCsbqrVeXJzXPIdFhG'];
    const u = (id, nombres, apellidos, ci, correo, telefono, username, rol_id, area_id, estado) => ({
      id, nombres, apellidos, ci, correo, telefono, username, password_hash: PH, pin_hash: pins[id - 1], rol_id, area_id, estado,
      debe_cambiar_clave: 0, intentos_fallidos: 0, bloqueado_hasta: null, creado_en: '2026-10-01 09:00:00', actualizado_en: '2026-10-01 09:00:00' });
    const permisos = ['usuarios.ver', 'usuarios.crear', 'usuarios.editar', 'usuarios.desactivar', 'auditoria.ver', 'caja.operar', 'caja.ver_todas',
      'ventas.registrar', 'ventas.ver_propias', 'ventas.ver_todas', 'asistencia.marcar', 'asistencia.ver_propia', 'asistencia.ver_todas', 'pedidos.gestionar',
      'productos.ver', 'productos.gestionar', 'inventario.mover', 'inventario.alertas', 'clientes.gestionar'];
    const P = (id, codigo, nombre, linea, tipo, variedad, anada, origen, graduacion, maridaje, descripcion, precio, stock, stock_minimo, destacado) =>
      ({ id, codigo, nombre, linea, tipo, variedad, anada, origen, graduacion, maridaje, descripcion, precio, stock, stock_minimo, destacado, activo: 1 });
    return {
      seq: { usuarios: 6, sesiones: 0, cajas: 1, ventas: 1, movimientos: 2, asistencia: 4, auditoria: 7, pedidos: 2, clientes: 2, movimientos_inv: 21, productos: 15 },
      roles: [
        { id: 1, nombre: 'Administrador', descripcion: 'Acceso total al sistema y gestión de usuarios' },
        { id: 2, nombre: 'Cajero', descripcion: 'Ventas y apertura/cierre de caja' },
        { id: 3, nombre: 'Empleado', descripcion: 'Registro e historial personal de asistencia' },
        { id: 4, nombre: 'Encargado de almacén', descripcion: 'Productos, entradas y salidas de inventario y alertas de stock' }],
      rol_permiso: { 1: permisos, 2: ['caja.operar', 'ventas.registrar', 'ventas.ver_propias', 'pedidos.gestionar', 'asistencia.marcar', 'asistencia.ver_propia', 'productos.ver', 'clientes.gestionar'],
        3: ['asistencia.marcar', 'asistencia.ver_propia'],
        4: ['asistencia.marcar', 'asistencia.ver_propia', 'productos.ver', 'productos.gestionar', 'inventario.mover', 'inventario.alertas'] },
      usuarios: [
        u(1, 'Carla', 'Mendoza Rojas', '7845123', 'admin@bodegasaranjuez.bo', '71234567', 'admin', 1, 1, 'ACTIVO'),
        u(2, 'Luis', 'Flores Arancibia', '6123987', 'lflores@bodegasaranjuez.bo', '72345678', 'cajero1', 2, 2, 'ACTIVO'),
        u(3, 'Ana', 'Quispe Mamani', '8456321', 'aquispe@bodegasaranjuez.bo', '73456789', 'cajero2', 2, 2, 'ACTIVO'),
        u(4, 'Jorge', 'Vargas Cruz', '5987456', 'jvargas@bodegasaranjuez.bo', '74567890', 'empleado1', 3, 4, 'ACTIVO'),
        u(5, 'Rosa', 'Choque Pérez', '9123654', 'rchoque@bodegasaranjuez.bo', '75678901', 'empleado2', 3, 5, 'INACTIVO'),
        u(6, 'Marcelo', 'Gutiérrez Vaca', '6789012', 'mgutierrez@bodegasaranjuez.bo', '76789012', 'almacen1', 4, 3, 'ACTIVO')],
      sesiones: [],
      productos: [
        P(1, "VT-001", "Alma de Tannat", "Alma de Tannat", "Tinto", "Tannat", 2019, "Valle Central de Tarija", 14.0, "Carnes rojas,Quesos maduros", "Tannat de altura con paso por barrica de roble. Taninos firmes, ciruela negra, cacao y un final largo y especiado.", 145, 24, 6, 1),
        P(2, "VT-002", "Terruño Cabernet Sauvignon", "Terruño", "Tinto", "Cabernet Sauvignon", 2020, "Valle Central de Tarija", 13.5, "Carnes rojas,Pastas", "Cuerpo medio, aromas a cassis y pimienta negra. Acompaña quesos maduros y guisos.", 95, 40, 8, 0),
        P(3, "VT-003", "Terruño Malbec", "Terruño", "Tinto", "Malbec", 2021, "Valle Central de Tarija", 13.5, "Carnes rojas,Parrilla", "Color violeta intenso, frutos rojos maduros y final suave. Para cenas con amigos.", 85, 30, 8, 0),
        P(4, "VT-004", "Juan Cruz Reserva", "Juan Cruz", "Tinto", "Cabernet Sauvignon - Tannat", 2020, "Valle Central de Tarija", 14.0, "Parrilla,Quesos maduros", "Corte de dos cepas de viñedos de altura. Mora, violeta y un toque ahumado de la barrica.", 120, 12, 6, 0),
        P(5, "VB-001", "Terruño Moscatel de Alejandría", "Terruño", "Blanco", "Moscatel de Alejandría", 2023, "Valle Central de Tarija", 12.5, "Aperitivo,Postres", "Blanco aromático y fresco, con notas florales y de durazno. Servir bien frío.", 68, 35, 8, 1),
        P(6, "VB-002", "Dúo Blanco", "Dúo", "Blanco", "Torrontés - Sauvignon Blanc", 2024, "Valle Central de Tarija", 12.5, "Pescados y mariscos,Ensaladas", "Dos cepas en una copa: cítrico, floral y de acidez viva. Perfecto con pescados y ensaladas.", 72, 25, 6, 0),
        P(7, "VB-003", "Terruño Chardonnay", "Terruño", "Blanco", "Chardonnay", 2022, "Valle Central de Tarija", 13.0, "Pescados y mariscos,Pastas", "Meses en roble. Untuoso, con vainilla, manzana asada y frutos secos.", 98, 8, 10, 0),
        P(8, "VR-001", "Dúo Rosado", "Dúo", "Rosado", "Tannat - Garnacha", 2024, "Valle Central de Tarija", 12.0, "Aperitivo,Ensaladas", "Rosado frutal y fresco, de color salmón brillante. Para aperitivos y días de sol.", 70, 20, 6, 0),
        P(9, "VE-001", "Espumante Brut Nature", "Aranjuez", "Espumante", "Chardonnay - Pinot Noir", 2022, "Valle Central de Tarija", 12.0, "Celebraciones,Aperitivo", "Método tradicional con 24 meses sobre lías. Burbuja fina y final seco. Para brindar.", 150, 15, 6, 1),
        P(10, "VE-002", "Espumante Demi-Sec", "Aranjuez", "Espumante", "Moscatel", 2023, "Valle Central de Tarija", 11.0, "Celebraciones,Postres", "Dulzor equilibrado y aromas a flor de azahar. El compañero ideal de la torta.", 110, 4, 8, 0),
        P(11, "SG-001", "Singani Etiqueta Negra", "Aranjuez", "Singani", "Moscatel de Alejandría", null, "Valle Central de Tarija", 40.0, "Cócteles,Digestivo", "Destilado de uva moscatel de altura, suave, con notas de flores y frutas secas.", 130, 30, 8, 0),
        P(12, "SG-002", "Singani Tradicional 1 L", "Aranjuez", "Singani", "Moscatel de Alejandría", null, "Valle Central de Tarija", 40.0, "Cócteles", "El singani clásico de Bolivia: transparente, aromático y de carácter firme. Base del chuflay.", 80, 45, 10, 0),
        P(13, "VT-005", "Tannat Origen", "Tannat Origen", "Tinto", "Tannat", 2021, "Valle Central de Tarija", 14.0, "Carnes rojas,Parrilla", "El Tannat en su expresión más directa: color profundo, fruta negra y taninos jugosos.", 110, 18, 6, 1),
        P(14, "VT-006", "Cabernet Franc", "Cabernet Franc", "Tinto", "Cabernet Franc", 2021, "Valle Central de Tarija", 13.5, "Pastas,Quesos maduros", "Pimiento rojo asado, frambuesa y hierbas secas. Fresco, elegante y de taninos suaves.", 105, 14, 6, 0),
        P(15, "VT-007", "Dúo Tinto", "Dúo", "Tinto", "Tannat - Malbec", 2022, "Valle Central de Tarija", 13.5, "Carnes rojas,Pastas", "Dos cepas que se complementan: la fuerza del Tannat y la suavidad del Malbec.", 78, 28, 8, 0)],
      areas: [{ id: 1, nombre: 'Administración' }, { id: 2, nombre: 'Ventas' }, { id: 3, nombre: 'Almacenamiento' }, { id: 4, nombre: 'Producción' }, { id: 5, nombre: 'Distribución' }],
      clientes: [
        { id: 1, nombre: 'Mario Torres', ci_nit: '4567891', telefono: '77889900', correo: 'mtorres@correo.bo', activo: 1, creado_en: '2026-10-09 11:30:00' },
        { id: 2, nombre: 'Patricia Salinas', ci_nit: '3456789', telefono: '76543210', correo: 'psalinas@correo.bo', activo: 1, creado_en: '2026-10-13 18:20:00' }],
      movimientos_inv: [
        { id: 1, producto_id: 1, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 26, stock_resultante: 26, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 2, producto_id: 2, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 41, stock_resultante: 41, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 3, producto_id: 3, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 30, stock_resultante: 30, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 4, producto_id: 4, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 12, stock_resultante: 12, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 5, producto_id: 5, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 36, stock_resultante: 36, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 6, producto_id: 6, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 25, stock_resultante: 25, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 7, producto_id: 7, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 8, stock_resultante: 8, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 8, producto_id: 8, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 20, stock_resultante: 20, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 9, producto_id: 9, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 17, stock_resultante: 17, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 10, producto_id: 10, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 4, stock_resultante: 4, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 11, producto_id: 11, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 30, stock_resultante: 30, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 12, producto_id: 12, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 45, stock_resultante: 45, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 13, producto_id: 13, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 18, stock_resultante: 18, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 14, producto_id: 14, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 14, stock_resultante: 14, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 15, producto_id: 15, tipo: 'ENTRADA', motivo: 'PRODUCCION', cantidad: 28, stock_resultante: 28, observacion: "Carga inicial de inventario", usuario_id: 6, venta_id: null, fecha: '2026-10-01 09:00:00' },
        { id: 16, producto_id: 1, tipo: 'SALIDA', motivo: 'VENTA', cantidad: 2, stock_resultante: 24, observacion: "Venta NV-000001", usuario_id: 2, venta_id: 1, fecha: '2026-10-09 11:30:00' },
        { id: 17, producto_id: 2, tipo: 'SALIDA', motivo: 'VENTA', cantidad: 1, stock_resultante: 40, observacion: "Venta NV-000001", usuario_id: 2, venta_id: 1, fecha: '2026-10-09 11:30:00' },
        { id: 18, producto_id: 9, tipo: 'SALIDA', motivo: 'RESERVA_WEB', cantidad: 1, stock_resultante: 16, observacion: "Pedido PW-000002", usuario_id: null, venta_id: null, fecha: '2026-10-10 10:05:00' },
        { id: 19, producto_id: 9, tipo: 'ENTRADA', motivo: 'DEVOLUCION', cantidad: 1, stock_resultante: 17, observacion: "Pedido PW-000002 cancelado", usuario_id: 2, venta_id: null, fecha: '2026-10-10 18:00:00' },
        { id: 20, producto_id: 9, tipo: 'SALIDA', motivo: 'RESERVA_WEB', cantidad: 2, stock_resultante: 15, observacion: "Pedido PW-000001", usuario_id: null, venta_id: null, fecha: '2026-10-13 18:20:00' },
        { id: 21, producto_id: 5, tipo: 'SALIDA', motivo: 'RESERVA_WEB', cantidad: 1, stock_resultante: 35, observacion: "Pedido PW-000001", usuario_id: null, venta_id: null, fecha: '2026-10-13 18:20:00' }],
      cajas: [{ id: 1, usuario_id: 2, fecha_apertura: '2026-10-09 09:00:00', monto_inicial: 200, fecha_cierre: '2026-10-09 19:00:00',
        monto_esperado: 565, monto_contado: 565, diferencia: 0, estado: 'CERRADA', observaciones: 'Cierre sin novedad' }],
      ventas: [{ id: 1, nro_nota: 'NV-000001', caja_id: 1, usuario_id: 2, cliente_id: 1, cliente_nombre: 'Mario Torres', cliente_ci_nit: '4567891', total: 385, estado: 'EMITIDA', fecha: '2026-10-09 11:30:00' }],
      detalle_venta: [{ venta_id: 1, producto_id: 1, cantidad: 2, precio_unitario: 145, subtotal: 290 }, { venta_id: 1, producto_id: 2, cantidad: 1, precio_unitario: 95, subtotal: 95 }],
      movimientos: [
        { id: 1, caja_id: 1, usuario_id: 2, tipo: 'INGRESO', concepto: 'Venta NV-000001', monto: 385, venta_id: 1, fecha: '2026-10-09 11:30:00' },
        { id: 2, caja_id: 1, usuario_id: 2, tipo: 'EGRESO', concepto: 'Compra de bolsas', monto: 20, venta_id: null, fecha: '2026-10-09 15:00:00' }],
      asistencia: [
        { id: 1, usuario_id: 2, tipo: 'ENTRADA', fecha_hora: '2026-10-09 08:55:00', metodo: 'PIN_KIOSCO' },
        { id: 2, usuario_id: 2, tipo: 'SALIDA', fecha_hora: '2026-10-09 19:05:00', metodo: 'PIN_KIOSCO' },
        { id: 3, usuario_id: 4, tipo: 'ENTRADA', fecha_hora: '2026-10-09 08:30:00', metodo: 'PIN_SESION' },
        { id: 4, usuario_id: 4, tipo: 'SALIDA', fecha_hora: '2026-10-09 17:30:00', metodo: 'PIN_SESION' }],
      auditoria: [
        { id: 1, usuario_id: 1, accion: 'USUARIO_CREADO', entidad: 'usuarios', entidad_id: 5, detalle: 'Alta de empleado2 (Empleado)', ip: '127.0.0.1', fecha: '2026-10-01 10:00:00' },
        { id: 6, usuario_id: 1, accion: 'USUARIO_CREADO', entidad: 'usuarios', entidad_id: 6, detalle: 'Alta de almacen1 (Encargado de almacén)', ip: '127.0.0.1', fecha: '2026-10-02 09:00:00' },
        { id: 7, usuario_id: 6, accion: 'ENTRADA_INVENTARIO', entidad: 'productos', entidad_id: 13, detalle: 'Tannat Origen: carga inicial', ip: '127.0.0.1', fecha: '2026-10-01 09:00:00' },
        { id: 2, usuario_id: 1, accion: 'USUARIO_DESACTIVADO', entidad: 'usuarios', entidad_id: 5, detalle: 'Baja lógica de empleado2', ip: '127.0.0.1', fecha: '2026-10-05 12:00:00' },
        { id: 3, usuario_id: 2, accion: 'LOGIN_OK', entidad: 'usuarios', entidad_id: 2, detalle: 'Inicio de sesión', ip: '127.0.0.1', fecha: '2026-10-09 08:58:00' },
        { id: 4, usuario_id: 2, accion: 'PEDIDO_CANCELADO', entidad: 'pedidos', entidad_id: 2, detalle: 'PW-000002: El cliente no pasó a recoger', ip: '127.0.0.1', fecha: '2026-10-10 18:00:00' },
        { id: 5, usuario_id: null, accion: 'PEDIDO_WEB_RECIBIDO', entidad: 'pedidos', entidad_id: 1, detalle: 'PW-000001 de Patricia Salinas por Bs 368', ip: '127.0.0.1', fecha: '2026-10-13 18:20:00' }],
      pedidos: [
        { id: 1, codigo: 'PW-000001', cliente_nombre: 'Patricia Salinas', cliente_telefono: '76543210', cliente_ci_nit: '3456789', cliente_correo: 'psalinas@correo.bo', nota: 'Paso a recoger el sábado por la mañana',
          total: 368, estado: 'PENDIENTE', fecha: '2026-10-13 18:20:00', atendido_por: null, fecha_atencion: null, venta_id: null, motivo_cancelacion: null },
        { id: 2, codigo: 'PW-000002', cliente_nombre: 'Diego Arce', cliente_telefono: '70011223', cliente_ci_nit: null, cliente_correo: null, nota: null,
          total: 150, estado: 'CANCELADO', fecha: '2026-10-10 10:05:00', atendido_por: 2, fecha_atencion: '2026-10-10 18:00:00', venta_id: null, motivo_cancelacion: 'El cliente no pasó a recoger' }],
      detalle_pedido: [
        { pedido_id: 1, producto_id: 9, cantidad: 2, precio_unitario: 150, subtotal: 300 },
        { pedido_id: 1, producto_id: 5, cantidad: 1, precio_unitario: 68, subtotal: 68 },
        { pedido_id: 2, producto_id: 9, cantidad: 1, precio_unitario: 150, subtotal: 150 }],
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
  function kardex(db, productoId, tipo, motivo, cantidad, observacion, usuarioId, ventaId) {
    const p = db.productos.find((x) => x.id === productoId);
    db.movimientos_inv.push({ id: sig(db, 'movimientos_inv'), producto_id: productoId, tipo, motivo, cantidad, stock_resultante: p.stock,
      observacion: observacion ? String(observacion).slice(0, 150) : null, usuario_id: usuarioId ?? null, venta_id: ventaId ?? null, fecha: ahora() });
  }
  function clienteDeVenta(db, { nombre: nom, ci_nit, telefono = null, correo = null }) {
    if (!ci_nit) return null;
    const c = db.clientes.find((x) => x.ci_nit === ci_nit); if (c) return c.id;
    const id = sig(db, 'clientes');
    db.clientes.push({ id, nombre: String(nom || 'Sin nombre').slice(0, 100), ci_nit, telefono, correo, activo: 1, creado_en: ahora() });
    return id;
  }
  const permisosDe = (db, rolId) => db.rol_permiso[rolId] || [];
  const perfil = (db, u) => ({ id: u.id, nombres: u.nombres, apellidos: u.apellidos, username: u.username, correo: u.correo,
    rol: rol(db, u.rol_id).nombre, debe_cambiar_clave: !!u.debe_cambiar_clave, permisos: permisosDe(db, u.rol_id) });
  const vistaUsuario = (db, u) => ({ id: u.id, nombres: u.nombres, apellidos: u.apellidos, ci: u.ci, correo: u.correo, telefono: u.telefono,
    username: u.username, rol_id: u.rol_id, rol: rol(db, u.rol_id).nombre, area_id: u.area_id, area: (db.areas.find((x) => x.id === u.area_id) || {}).nombre || null, estado: u.estado, debe_cambiar_clave: u.debe_cambiar_clave,
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
    correo: limpio(d.correo).toLowerCase(), telefono: limpio(d.telefono) || null, username: d.username ? limpio(d.username).toLowerCase() : undefined, rol_id: Number(d.rol_id), area_id: d.area_id ? Number(d.area_id) : null });
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
      dias[k] ??= { usuario_id: r.usuario_id, empleado: r.empleado, area: r.area, fecha, marcas: [], minutos: 0, _e: null };
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

    // ---- CATÁLOGO PÚBLICO (tienda, sin sesión) ----
    if (mod === 'catalogo' && method === 'GET') {
      const ORD = ['Blanco', 'Espumante', 'Rosado', 'Singani', 'Tinto'];
      return [200, db.productos.filter((p) => p.activo)
        .sort((x, y) => y.destacado - x.destacado || ORD.indexOf(x.tipo) - ORD.indexOf(y.tipo) || x.nombre.localeCompare(y.nombre))
        .map(({ activo, maridaje, destacado, stock_minimo, ...p }) => ({ ...p, destacado: !!destacado, maridaje: maridaje ? maridaje.split(',') : [] }))];
    }

    // ---- PEDIDOS WEB ----
    if (mod === 'pedidos') {
      const prod = (id) => db.productos.find((x) => x.id === Number(id));
      if (!a && method === 'POST') {
        const campos = {};
        const nom = String(body.cliente_nombre || '').trim(); const tel = String(body.cliente_telefono || '').trim();
        const ci = String(body.cliente_ci_nit || '').trim(); const correo = String(body.cliente_correo || '').trim();
        if (!nom) campos.cliente_nombre = 'Ingrese su nombre'; else if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{3,100}$/.test(nom)) campos.cliente_nombre = 'Solo letras y espacios';
        if (!tel) campos.cliente_telefono = 'Ingrese su celular'; else if (!REGLAS.telefono.test(tel)) campos.cliente_telefono = 'Celular de 8 dígitos (ej. 71234567)';
        if (ci && !/^[0-9]{5,13}(-[0-9A-Z]{1,2})?$/i.test(ci)) campos.cliente_ci_nit = 'CI/NIT inválido';
        if (correo && !REGLAS.correo.test(correo)) campos.cliente_correo = 'Formato de correo inválido';
        if (Object.keys(campos).length) fallo(400, 'Revise sus datos', { campos });
        const items = new Map();
        for (const it of Array.isArray(body.items) ? body.items : []) {
          const id = Number(it.producto_id); const cant = Number(it.cantidad);
          if (!Number.isInteger(id) || !Number.isInteger(cant) || cant <= 0) fallo(400, 'Cantidades inválidas');
          items.set(id, (items.get(id) || 0) + cant);
        }
        if (!items.size) fallo(400, 'Su carrito está vacío');
        if ([...items.values()].some((x) => x > 24)) fallo(400, 'Máximo 24 unidades por producto. Para compras mayores, contáctenos.');
        let total = 0; const det = [];
        for (const [id, cant] of items) {   // se valida todo antes de modificar (como una transacción)
          const p = prod(id);
          if (!p || !p.activo) fallo(400, 'Uno de los productos ya no está disponible');
          if (p.stock < cant) fallo(409, p.stock ? `Solo quedan ${p.stock} unidades de "${p.nombre}"` : `"${p.nombre}" está agotado`, { producto_id: p.id, disponible: p.stock });
          const subtotal = r2(p.precio * cant); total += subtotal; det.push({ p, cant, subtotal });
        }
        total = r2(total);
        const id = sig(db, 'pedidos'); const codigo = `PW-${String(id).padStart(6, '0')}`;
        db.pedidos.push({ id, codigo, cliente_nombre: nom, cliente_telefono: tel, cliente_ci_nit: ci.toUpperCase() || null, cliente_correo: correo.toLowerCase() || null,
          nota: String(body.nota || '').trim().slice(0, 255) || null, total, estado: 'PENDIENTE', fecha: ahora(), atendido_por: null, fecha_atencion: null, venta_id: null, motivo_cancelacion: null });
        for (const d of det) { db.detalle_pedido.push({ pedido_id: id, producto_id: d.p.id, cantidad: d.cant, precio_unitario: d.p.precio, subtotal: d.subtotal }); d.p.stock -= d.cant; kardex(db, d.p.id, 'SALIDA', 'RESERVA_WEB', d.cant, `Pedido ${codigo}`, null, null); }
        audit(db, null, 'PEDIDO_WEB_RECIBIDO', 'pedidos', id, `${codigo} de ${nom} por Bs ${total}`);
        return [201, { mensaje: 'Pedido recibido', codigo, total }];
      }
      if (a === 'seguimiento' && method === 'GET') {
        const codigo = String(q.codigo || '').trim().toUpperCase(); const tel = String(q.telefono || '').trim();
        if (!/^PW-\d{6}$/.test(codigo) || !REGLAS.telefono.test(tel)) fallo(400, 'Ingrese el código (PW-000000) y su celular');
        const p = db.pedidos.find((x) => x.codigo === codigo && x.cliente_telefono === tel);
        if (!p) fallo(404, 'No encontramos un pedido con ese código y celular');
        const v = db.ventas.find((x) => x.id === p.venta_id);
        return [200, { codigo: p.codigo, cliente_nombre: p.cliente_nombre, total: p.total, estado: p.estado, fecha: p.fecha, fecha_atencion: p.fecha_atencion,
          motivo_cancelacion: p.motivo_cancelacion, nro_nota: v ? v.nro_nota : null,
          detalle: db.detalle_pedido.filter((d) => d.pedido_id === p.id).map((d) => ({ cantidad: d.cantidad, subtotal: d.subtotal, nombre: prod(d.producto_id).nombre, tipo: prod(d.producto_id).tipo })) }];
      }
      const c = auth(); permitir(db, c, method, url, 'pedidos.gestionar');
      const extendido = (p) => {
        const v = db.ventas.find((x) => x.id === p.venta_id); const at = p.atendido_por && usr(db, p.atendido_por);
        return { ...p, nro_nota: v ? v.nro_nota : null, atendido_por_nombre: at ? nombre(at) : null,
          unidades: db.detalle_pedido.filter((d) => d.pedido_id === p.id).reduce((s, d) => s + d.cantidad, 0) };
      };
      if (!a && method === 'GET') {
        const est = ['PENDIENTE', 'ENTREGADO', 'CANCELADO'].includes(q.estado) ? q.estado : null;
        return [200, db.pedidos.filter((p) => !est || p.estado === est)
          .sort((x, y) => (y.estado === 'PENDIENTE') - (x.estado === 'PENDIENTE') || y.fecha.localeCompare(x.fecha)).map(extendido)];
      }
      const ped = db.pedidos.find((x) => x.id === Number(a));
      if (a && !b && method === 'GET') {
        if (!ped) fallo(404, 'Pedido no encontrado');
        return [200, { ...extendido(ped), detalle: db.detalle_pedido.filter((d) => d.pedido_id === ped.id).map((d) => ({ ...d, codigo: prod(d.producto_id).codigo, nombre: prod(d.producto_id).nombre })) }];
      }
      if (a && b === 'cobrar' && method === 'POST') {
        const caja = cajaAbierta(db, c.u.id); if (!caja) fallo(400, 'Debe abrir su caja antes de cobrar un pedido', { codigo: 'SIN_CAJA' });
        if (!ped) fallo(404, 'Pedido no encontrado');
        if (ped.estado !== 'PENDIENTE') fallo(400, `El pedido ya está ${ped.estado.toLowerCase()}`);
        const id = sig(db, 'ventas'); const nro = `NV-${String(id).padStart(6, '0')}`;
        const cliId = clienteDeVenta(db, { nombre: ped.cliente_nombre, ci_nit: ped.cliente_ci_nit, telefono: ped.cliente_telefono, correo: ped.cliente_correo });
        db.ventas.push({ id, nro_nota: nro, caja_id: caja.id, usuario_id: c.u.id, cliente_id: cliId, cliente_nombre: ped.cliente_nombre, cliente_ci_nit: ped.cliente_ci_nit, total: ped.total, estado: 'EMITIDA', fecha: ahora() });
        db.detalle_pedido.filter((d) => d.pedido_id === ped.id).forEach((d) => db.detalle_venta.push({ venta_id: id, producto_id: d.producto_id, cantidad: d.cantidad, precio_unitario: d.precio_unitario, subtotal: d.subtotal }));
        db.movimientos.push({ id: sig(db, 'movimientos'), caja_id: caja.id, usuario_id: c.u.id, tipo: 'INGRESO', concepto: `Venta ${nro} (pedido web ${ped.codigo})`, monto: ped.total, venta_id: id, fecha: ahora() });
        Object.assign(ped, { estado: 'ENTREGADO', atendido_por: c.u.id, fecha_atencion: ahora(), venta_id: id });
        audit(db, c.u.id, 'PEDIDO_COBRADO', 'pedidos', ped.id, `${ped.codigo} → ${nro} por Bs ${ped.total}`);
        return [200, { mensaje: `Pedido ${ped.codigo} cobrado. Nota ${nro}`, venta_id: id, nro_nota: nro }];
      }
      if (a && b === 'cancelar' && method === 'POST') {
        const motivo = String(body.motivo || '').trim();
        if (motivo.length < 3) fallo(400, 'Indique el motivo', { campos: { motivo: 'Mínimo 3 caracteres' } });
        if (!ped) fallo(404, 'Pedido no encontrado');
        if (ped.estado !== 'PENDIENTE') fallo(400, `El pedido ya está ${ped.estado.toLowerCase()}`);
        db.detalle_pedido.filter((d) => d.pedido_id === ped.id).forEach((d) => { prod(d.producto_id).stock += d.cantidad; kardex(db, d.producto_id, 'ENTRADA', 'DEVOLUCION', d.cantidad, `Pedido ${ped.codigo} cancelado`, c.u.id, null); });
        Object.assign(ped, { estado: 'CANCELADO', atendido_por: c.u.id, fecha_atencion: ahora(), motivo_cancelacion: motivo.slice(0, 150) });
        audit(db, c.u.id, 'PEDIDO_CANCELADO', 'pedidos', ped.id, `${ped.codigo}: ${motivo}`);
        return [200, { mensaje: `Pedido ${ped.codigo} cancelado. El stock fue devuelto.` }];
      }
    }

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
      if (a === 'areas' && method === 'GET') { P('usuarios.ver', 'asistencia.ver_todas'); return [200, db.areas]; }
      const areaOk = (id) => id === null || !!db.areas.find((x) => x.id === id);
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
        if (!areaOk(d.area_id)) fallo(400, 'Área inexistente', { campos: { area_id: 'Área inexistente' } });
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
        if (!areaOk(d.area_id)) fallo(400, 'Área inexistente', { campos: { area_id: 'Área inexistente' } });
        const dup = duplicados({ ci: d.ci, correo: d.correo }, objetivo.id); if (Object.keys(dup).length) fallo(409, 'Datos duplicados', { campos: dup });
        const rolAntes = rol(db, objetivo.rol_id).nombre; const cambio = objetivo.rol_id !== d.rol_id;
        Object.assign(objetivo, { nombres: d.nombres, apellidos: d.apellidos, ci: d.ci, correo: d.correo, telefono: d.telefono, rol_id: d.rol_id, area_id: d.area_id, actualizado_en: ahora() });
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

    // ---- INVENTARIO (almacén) ----
    if (mod === 'inventario') {
      const c = auth(); const P = (...x) => permitir(db, c, method, url, ...x);
      const TIPOS = ['Tinto', 'Blanco', 'Rosado', 'Espumante', 'Singani'];
      const MOT_E = ['PRODUCCION', 'COMPRA', 'DEVOLUCION', 'AJUSTE']; const MOT_S = ['MERMA', 'DISTRIBUCION', 'AJUSTE'];
      const txt = (v) => String(v ?? '').trim();
      const validarProd = (d) => {
        const e = {};
        if (!txt(d.codigo)) e.codigo = 'El código es obligatorio'; else if (!/^[A-Z0-9-]{3,20}$/.test(txt(d.codigo).toUpperCase())) e.codigo = 'Letras, números y guion (3 a 20)';
        if (!txt(d.nombre)) e.nombre = 'El nombre es obligatorio'; else if (txt(d.nombre).length > 100) e.nombre = 'Máximo 100 caracteres';
        if (!TIPOS.includes(d.tipo)) e.tipo = 'Seleccione un tipo';
        const precio = Number(d.precio); if (!Number.isFinite(precio) || precio <= 0 || precio > 100000) e.precio = 'Precio mayor a 0';
        const min = Number(d.stock_minimo); if (d.stock_minimo === '' || d.stock_minimo == null || !Number.isInteger(min) || min < 0 || min > 10000) e.stock_minimo = 'Entero de 0 en adelante';
        if (d.anada && (!Number.isInteger(Number(d.anada)) || Number(d.anada) < 1990 || Number(d.anada) > 2100)) e.anada = 'Año de cosecha inválido';
        if (d.graduacion && (!(Number(d.graduacion) > 0) || Number(d.graduacion) > 100)) e.graduacion = '% de alcohol inválido';
        return e;
      };
      const normProd = (d) => ({ codigo: txt(d.codigo).toUpperCase(), nombre: txt(d.nombre), linea: txt(d.linea) || null, tipo: d.tipo, variedad: txt(d.variedad) || null,
        anada: d.anada ? Number(d.anada) : null, origen: txt(d.origen) || null, graduacion: d.graduacion ? Number(d.graduacion) : null, maridaje: txt(d.maridaje) || null,
        descripcion: txt(d.descripcion).slice(0, 255) || null, precio: Number(d.precio), stock_minimo: Number(d.stock_minimo), destacado: d.destacado ? 1 : 0 });
      if (a === 'productos' && !b && method === 'GET') {
        P('productos.ver');
        let l = db.productos;
        if (q.q) { const t = String(q.q).toLowerCase(); l = l.filter((p) => [p.nombre, p.codigo, p.linea, p.variedad].some((x) => String(x || '').toLowerCase().includes(t))); }
        if (TIPOS.includes(q.tipo)) l = l.filter((p) => p.tipo === q.tipo);
        if (q.bajo === '1') l = l.filter((p) => p.stock <= p.stock_minimo);
        return [200, [...l].sort((x, y) => y.activo - x.activo || TIPOS.indexOf(x.tipo) - TIPOS.indexOf(y.tipo) || x.nombre.localeCompare(y.nombre)).map((p) => ({ ...p, bajo: p.stock <= p.stock_minimo ? 1 : 0 }))];
      }
      if (a === 'alertas' && method === 'GET') {
        P('inventario.alertas');
        return [200, db.productos.filter((p) => p.activo && p.stock <= p.stock_minimo).sort((x, y) => (x.stock - x.stock_minimo) - (y.stock - y.stock_minimo) || x.nombre.localeCompare(y.nombre))
          .map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre, tipo: p.tipo, stock: p.stock, stock_minimo: p.stock_minimo, faltan: p.stock_minimo - p.stock }))];
      }
      if (a === 'productos' && !b && method === 'POST') {
        P('productos.gestionar');
        const e = validarProd(body); if (Object.keys(e).length) fallo(400, 'Revise los campos marcados', { campos: e });
        const d = normProd(body);
        if (db.productos.some((p) => p.codigo === d.codigo)) fallo(409, 'Datos duplicados', { campos: { codigo: 'Este código ya existe' } });
        const id = sig(db, 'productos'); db.productos.push({ id, ...d, stock: 0, activo: 1 });
        audit(db, c.u.id, 'PRODUCTO_CREADO', 'productos', id, `${d.codigo} ${d.nombre}`);
        return [201, { mensaje: 'Producto registrado con stock 0. Registre su primera entrada.', id }];
      }
      if (a === 'productos' && b && method === 'PUT') {
        P('productos.gestionar'); const p = db.productos.find((x) => x.id === Number(b)); if (!p) fallo(404, 'Producto no encontrado');
        const e = validarProd(body); if (Object.keys(e).length) fallo(400, 'Revise los campos marcados', { campos: e });
        const d = normProd(body);
        if (db.productos.some((x) => x.codigo === d.codigo && x.id !== p.id)) fallo(409, 'Datos duplicados', { campos: { codigo: 'Este código ya existe' } });
        Object.assign(p, d); audit(db, c.u.id, 'PRODUCTO_ACTUALIZADO', 'productos', p.id, `${d.codigo} ${d.nombre}`);
        return [200, { mensaje: 'Producto actualizado' }];
      }
      if (a === 'productos' && b && seg[3] === 'activo' && method === 'PATCH') {
        P('productos.gestionar'); const p = db.productos.find((x) => x.id === Number(b)); if (!p) fallo(404, 'Producto no encontrado');
        p.activo = body.activo ? 1 : 0; audit(db, c.u.id, p.activo ? 'PRODUCTO_ACTIVADO' : 'PRODUCTO_DESACTIVADO', 'productos', p.id, null);
        return [200, { mensaje: p.activo ? 'Producto visible en la tienda' : 'Producto oculto de la tienda (el historial se conserva)' }];
      }
      if (a === 'movimientos' && method === 'GET') {
        P('productos.ver');
        return [200, db.movimientos_inv.filter((m) => !q.producto_id || m.producto_id === Number(q.producto_id))
          .sort((x, y) => y.fecha.localeCompare(x.fecha) || y.id - x.id).slice(0, 200).map((m) => {
            const p = db.productos.find((x) => x.id === m.producto_id); const u = m.usuario_id && usr(db, m.usuario_id);
            return { id: m.id, fecha: m.fecha, tipo: m.tipo, motivo: m.motivo, cantidad: m.cantidad, stock_resultante: m.stock_resultante, observacion: m.observacion,
              codigo: p.codigo, producto: p.nombre, usuario: u ? nombre(u) : null };
          })];
      }
      if (a === 'movimientos' && method === 'POST') {
        P('inventario.mover');
        const { producto_id, tipo, motivo } = body; const cant = Number(body.cantidad); const campos = {}; const obs = txt(body.observacion);
        if (!['ENTRADA', 'SALIDA'].includes(tipo)) campos.tipo = 'Seleccione entrada o salida';
        else if (!(tipo === 'ENTRADA' ? MOT_E : MOT_S).includes(motivo)) campos.motivo = 'Motivo no válido para este movimiento';
        if (!Number.isInteger(cant) || cant <= 0 || cant > 100000) campos.cantidad = 'Cantidad entera mayor a 0';
        if (!Number.isInteger(Number(producto_id))) campos.producto_id = 'Seleccione un producto';
        if (motivo === 'AJUSTE' && obs.length < 3) campos.observacion = 'Explique el ajuste';
        if (Object.keys(campos).length) fallo(400, 'Revise los campos marcados', { campos });
        const p = db.productos.find((x) => x.id === Number(producto_id)); if (!p) fallo(404, 'Producto no encontrado');
        if (tipo === 'SALIDA' && p.stock < cant) fallo(400, `Stock insuficiente de "${p.nombre}" (disponible: ${p.stock})`, { campos: { cantidad: `Máximo ${p.stock}` } });
        p.stock += tipo === 'ENTRADA' ? cant : -cant;
        kardex(db, p.id, tipo, motivo, cant, obs || null, c.u.id, null);
        audit(db, c.u.id, tipo === 'ENTRADA' ? 'ENTRADA_INVENTARIO' : 'SALIDA_INVENTARIO', 'productos', p.id, `${p.nombre}: ${tipo === 'ENTRADA' ? '+' : '-'}${cant} (${motivo})`);
        return [201, { mensaje: `${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada. Stock de "${p.nombre}": ${p.stock}` }];
      }
    }

    // ---- CLIENTES ----
    if (mod === 'clientes') {
      const c = auth(); permitir(db, c, method, url, 'clientes.gestionar');
      const validarCli = (d) => {
        const e = {}; const nom = String(d.nombre || '').trim(); const ci = String(d.ci_nit || '').trim(); const tel = String(d.telefono || '').trim(); const cor = String(d.correo || '').trim();
        if (!nom) e.nombre = 'El nombre es obligatorio'; else if (!REGLAS.nombre.test(nom)) e.nombre = 'Solo letras y espacios (2 a 60)';
        if (ci && !/^[0-9]{5,13}(-[0-9A-Z]{1,2})?$/i.test(ci)) e.ci_nit = 'CI/NIT inválido (solo números, 5 a 13)';
        if (tel && !REGLAS.telefono.test(tel)) e.telefono = 'Celular de 8 dígitos (ej. 71234567)';
        if (cor && !REGLAS.correo.test(cor)) e.correo = 'Formato de correo inválido';
        return e;
      };
      const normCli = (d) => ({ nombre: String(d.nombre).trim(), ci_nit: String(d.ci_nit || '').trim().toUpperCase() || null, telefono: String(d.telefono || '').trim() || null, correo: String(d.correo || '').trim().toLowerCase() || null });
      if (!a && method === 'GET') {
        const t = String(q.q || '').toLowerCase();
        return [200, db.clientes.filter((x) => x.nombre.toLowerCase().includes(t) || String(x.ci_nit || '').toLowerCase().includes(t)).sort((x, y) => x.nombre.localeCompare(y.nombre)).map((x) => {
          const vs = db.ventas.filter((v) => v.cliente_id === x.id);
          return { ...x, compras: vs.length, total_comprado: r2(vs.filter((v) => v.estado === 'EMITIDA').reduce((s, v) => s + v.total, 0)) };
        })];
      }
      if (!a && method === 'POST') {
        const e = validarCli(body); if (Object.keys(e).length) fallo(400, 'Revise los campos marcados', { campos: e });
        const d = normCli(body);
        if (d.ci_nit && db.clientes.some((x) => x.ci_nit === d.ci_nit)) fallo(409, 'Datos duplicados', { campos: { ci_nit: 'Ya existe un cliente con este CI/NIT' } });
        const id = sig(db, 'clientes'); db.clientes.push({ id, ...d, activo: 1, creado_en: ahora() });
        audit(db, c.u.id, 'CLIENTE_CREADO', 'clientes', id, d.nombre); return [201, { mensaje: 'Cliente registrado', id }];
      }
      if (a && method === 'PUT') {
        const cl = db.clientes.find((x) => x.id === Number(a)); if (!cl) fallo(404, 'Cliente no encontrado');
        const e = validarCli(body); if (Object.keys(e).length) fallo(400, 'Revise los campos marcados', { campos: e });
        const d = normCli(body);
        if (d.ci_nit && db.clientes.some((x) => x.ci_nit === d.ci_nit && x.id !== cl.id)) fallo(409, 'Datos duplicados', { campos: { ci_nit: 'Ya existe un cliente con este CI/NIT' } });
        Object.assign(cl, d); audit(db, c.u.id, 'CLIENTE_ACTUALIZADO', 'clientes', cl.id, d.nombre); return [200, { mensaje: 'Cliente actualizado' }];
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
      if (a === 'productos' && method === 'GET') { P('ventas.registrar'); return [200, db.productos.filter((p) => p.activo).sort((x, y) => x.tipo.localeCompare(y.tipo) || x.nombre.localeCompare(y.nombre))]; }
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
        const cliId = clienteDeVenta(db, { nombre: cliente, ci_nit: ciNit });
        db.ventas.push({ id, nro_nota: nro, caja_id: caja.id, usuario_id: c.u.id, cliente_id: cliId, cliente_nombre: cliente.slice(0, 100), cliente_ci_nit: ciNit, total, estado: 'EMITIDA', fecha: ahora() });
        for (const d of det) { db.detalle_venta.push({ venta_id: id, producto_id: d.p.id, cantidad: d.cant, precio_unitario: d.p.precio, subtotal: d.subtotal }); d.p.stock -= d.cant; kardex(db, d.p.id, 'SALIDA', 'VENTA', d.cant, `Venta ${nro}`, c.u.id, id); }
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
        const ped = db.pedidos.find((x) => x.venta_id === v.id);
        return [200, { ...conVendedor(v), pedido_codigo: ped ? ped.codigo : null, detalle }];
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
      const conNombre = (r) => { const u = usr(db, r.usuario_id); const ar = db.areas.find((x) => x.id === u.area_id); return { ...r, empleado: nombre(u), area: ar ? ar.nombre : null, area_id: u.area_id }; };
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
        const rows = db.asistencia.filter((r) => { const f = r.fecha_hora.slice(0, 10); return f >= desde && f <= hasta && (!q.usuario_id || r.usuario_id === Number(q.usuario_id)); }).map(conNombre).filter((r) => !q.area_id || r.area_id === Number(q.area_id));
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
