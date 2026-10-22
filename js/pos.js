// ===== Punto de venta (POS) y facturas =====
// Una sola pantalla para el cajero: vende en el mostrador, cobra pedidos de la tienda en línea
// y emite la factura. Está pensada para vender RÁPIDO: búsqueda mientras escribe, código o escáner + Enter,
// "3*VT-001" agrega 3, botones de vuelto, atajos de teclado y pedidos web que aparecen solos.
// (Usa los ayudantes de app.js y api.js: $, vista, abrirModal, api, toast, bs, esc…)

const METODOS_PAGO = { EFECTIVO: 'Efectivo', QR: 'QR', TARJETA: 'Tarjeta' };
const COLOR_TIPO = { Tinto: '#c0455f', Blanco: '#e7dc9e', Rosado: '#ec94a8' };
let posPedidoACargar = null;      // id de un pedido web que debe abrirse cargado (viene de “Pedidos web”)
let posTimer = null;

const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const redondear = (n) => Math.round(Number(n) * 100) / 100;

// ---------------------------------------------------------------------------------------------
// Pantalla: Punto de venta
// ---------------------------------------------------------------------------------------------
VISTAS.pos = async () => {
  clearInterval(posTimer);
  if (!Sesion.puede('caja.operar')) {
    vista.innerHTML = `<div class="cabecera"><div><h1>Punto de venta</h1></div></div>
      <div class="alerta aviso">Su rol puede registrar ventas pero no abrir una caja, y toda venta entra a la caja de quien la hace. Pida al administrador el permiso <code>caja.operar</code>.</div>`;
    return;
  }
  const { caja } = await api('GET', '/caja/actual');
  if (!caja) return posSinCaja();

  let productos = await api('GET', '/ventas/productos');
  let pendientes = Sesion.puede('pedidos.gestionar') ? await api('GET', '/pedidos?estado=PENDIENTE') : [];
  const puedePedidos = Sesion.puede('pedidos.gestionar');

  const st = { carrito: [], pedido: null, metodo: 'EFECTIVO', recibido: '', nombre: '', nit: '', tipo: 'Todos', q: '', cobrando: false, abiertoPedidos: false };
  const BORRADOR = 'posBorrador';

  // --- esqueleto (se dibuja una sola vez; después se actualizan solo las partes que cambian) ---
  vista.innerHTML = `
    <div class="cabecera"><div><h1>Punto de venta</h1>
      <p class="muted">Cajero: <strong>${esc(Sesion.usuario.nombres)} ${esc(Sesion.usuario.apellidos)}</strong> · <span class="badge b-ok">Caja #${caja.id} abierta</span></p></div>
      <div class="atajos small muted"><kbd>F2</kbd> buscar · <kbd>F9</kbd> cobrar · <kbd>Esc</kbd> limpiar</div></div>
    <div class="pos">
      <section class="pos-izq">
        <div id="posPedidos"></div>
        <div class="pos-buscar">
          <input id="posQ" placeholder="Buscar un vino o escribir su código y Enter…" autocomplete="off" spellcheck="false" aria-label="Buscar producto">
          <span class="pos-ayuda small muted">Ej.: <code>VT-001</code> · <code>3*VT-001</code> agrega 3 · escáner de códigos</span>
        </div>
        <div class="chips" id="posTipos"></div>
        <div class="pos-grid" id="posGrid"></div>
      </section>
      <aside class="pos-der panel" aria-label="Ticket de venta">
        <div id="posBanner"></div>
        <div class="pos-cli">
          <div class="pos-cli-fila">
            <div class="campo"><label for="posNit">NIT / CI</label><input id="posNit" inputmode="numeric" autocomplete="off" placeholder="Vacío = consumidor final"></div>
            <div class="campo"><label for="posNombre">Razón social</label><input id="posNombre" autocomplete="off" placeholder="Sin nombre"></div>
          </div>
          <div class="sugerencias hidden" id="posSug"></div>
          <div class="msg-cli small" id="posMsgCli"></div>
        </div>
        <div class="pos-lineas" id="posLineas"></div>
        <div class="pos-total"><span>Total</span><strong id="posTotal">Bs 0,00</strong></div>
        <div class="metodos" id="posMetodos" role="radiogroup" aria-label="Forma de pago">
          ${Object.entries(METODOS_PAGO).map(([k, t]) => `<button type="button" class="metodo" data-m="${k}" role="radio">${t}</button>`).join('')}
        </div>
        <div id="posEfectivo">
          <div class="campo"><label for="posRec">Recibido (Bs)</label><input id="posRec" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Exacto"></div>
          <div class="billetes" id="posBilletes"></div>
          <div class="cambio" id="posCambio"></div>
        </div>
        <p class="small muted hidden" id="posOtro"></p>
        <button class="btn ok grande bloque" id="posCobrar" disabled>Cobrar y facturar</button>
      </aside>
    </div>`;

  // --- ayudantes ---
  const stockDe = (id) => (productos.find((p) => p.id === id) || { stock: 0 }).stock;
  const enTicket = (id) => (st.carrito.find((i) => i.producto_id === id) || { cantidad: 0 }).cantidad;
  const total = () => redondear(st.carrito.reduce((s, i) => s + i.precio * i.cantidad, 0));
  const guardarBorrador = () => {
    try { if (!st.pedido) sessionStorage.setItem(BORRADOR, JSON.stringify({ carrito: st.carrito, nombre: st.nombre, nit: st.nit, metodo: st.metodo })); } catch { /* sin almacenamiento */ }
  };

  /** Separa “3*VT-001” en cantidad y texto de búsqueda */
  const parsear = (txt) => {
    const m = txt.trim().match(/^(\d{1,2})\s*[*xX]\s*(.*)$/);
    return m ? { n: Number(m[1]) || 1, texto: m[2].trim() } : { n: 1, texto: txt.trim() };
  };
  const filtrar = (texto) => {
    const fichas = sinTildes(texto).split(/\s+/).filter(Boolean);
    let lista = productos;
    if (!fichas.length) {
      if (st.tipo === 'Frecuentes') lista = productos.filter((p) => p.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 8);
      else if (st.tipo !== 'Todos') lista = productos.filter((p) => p.tipo === st.tipo);
      else lista = [...productos].sort((a, b) => b.vendidos - a.vendidos);   // “Todos”: los más vendidos primero
      return lista;
    }
    return productos.filter((p) => {
      const hay = sinTildes(`${p.codigo} ${p.nombre} ${p.tipo} ${p.variedad || ''} ${p.linea || ''} ${p.anada || ''}`);
      return fichas.every((f) => hay.includes(f));
    });
  };

  // --- partes de la pantalla ---
  function pintarTipos() {
    const tipos = ['Todos', 'Frecuentes', ...new Set(productos.map((p) => p.tipo))];
    $('#posTipos').innerHTML = tipos.map((t) => `<button type="button" class="btn mini ${st.tipo === t ? '' : 'sec'}" data-t="${esc(t)}">${t === 'Frecuentes' ? '★ ' : ''}${esc(t)}</button>`).join('');
  }
  function pintarGrid(destacar) {
    const { texto } = parsear(st.q);
    const lista = filtrar(texto);
    $('#posGrid').innerHTML = lista.length ? lista.map((p, k) => {
      const libres = p.stock - enTicket(p.id);
      const cls = libres <= 0 ? 'agotado' : libres <= p.stock_minimo ? 'bajo' : '';
      return `<button type="button" class="tile ${cls} ${destacar === p.id ? 'flash' : ''} ${k === 0 && texto ? 'primero' : ''}" data-id="${p.id}" ${libres <= 0 ? 'disabled' : ''}
          style="--tipo:${COLOR_TIPO[p.tipo] || '#d9b46c'}" title="${esc(p.nombre)}">
        <span class="t-cod">${esc(p.codigo)}</span>
        <span class="t-nom">${esc(p.nombre)}</span>
        <span class="t-det">${esc(p.tipo)}${p.anada ? ` · ${p.anada}` : ''}</span>
        <span class="t-pie"><strong>${bs(p.precio)}</strong><small>${libres <= 0 ? (p.stock <= 0 ? 'Agotado' : 'Todo en el ticket') : libres <= p.stock_minimo ? `Quedan ${libres}` : `${libres} disp.`}</small></span>
        ${enTicket(p.id) ? `<span class="t-en">${enTicket(p.id)}</span>` : ''}
      </button>`;
    }).join('') : `<p class="vacio">${texto ? `Ningún producto coincide con “${esc(texto)}”.` : st.tipo === 'Frecuentes' ? 'Aún no hay ventas del último mes. Elija “Todos”.' : 'Sin productos en esta categoría.'}</p>`;
  }
  function pintarLineas(destacar) {
    $('#posLineas').innerHTML = st.carrito.length ? st.carrito.map((i) => `<div class="linea ${destacar === i.producto_id ? 'flash' : ''}" data-id="${i.producto_id}">
        <div class="l-nom"><strong>${esc(i.nombre)}</strong><small>${esc(i.codigo)} · ${bs(i.precio)}</small></div>
        <div class="l-cant">
          <button type="button" class="paso" data-d="-1" aria-label="Quitar uno" ${st.pedido ? 'disabled' : ''}>−</button>
          <input class="cant" type="number" min="1" value="${i.cantidad}" aria-label="Cantidad" ${st.pedido ? 'disabled' : ''}>
          <button type="button" class="paso" data-d="1" aria-label="Agregar uno" ${st.pedido ? 'disabled' : ''}>+</button>
        </div>
        <div class="l-sub">${bs(i.precio * i.cantidad)}</div>
        ${st.pedido ? '<span></span>' : '<button type="button" class="quitar" data-quitar aria-label="Quitar producto">✕</button>'}
      </div>`).join('')
      : `<div class="ticket-vacio">${ICONOS.pos}<p>El ticket está vacío</p><small>Toque un producto, escriba su código o cargue un pedido web.</small></div>`;
  }
  function pintarPago() {
    const t = total();
    $('#posTotal').textContent = bs(t);
    $('#posMetodos').querySelectorAll('.metodo').forEach((b) => { b.classList.toggle('activo', b.dataset.m === st.metodo); b.setAttribute('aria-checked', b.dataset.m === st.metodo); });
    const efectivo = st.metodo === 'EFECTIVO';
    $('#posEfectivo').classList.toggle('hidden', !efectivo);
    const otro = $('#posOtro');
    otro.classList.toggle('hidden', efectivo);
    otro.textContent = st.metodo === 'QR' ? 'Confirme en su banca móvil que el pago del cliente llegó antes de cobrar. No entra al efectivo del cajón.' : 'Pase la tarjeta por el terminal y verifique la aprobación antes de cobrar. No entra al efectivo del cajón.';
    const rec = st.recibido === '' ? t : Number(st.recibido);
    if (efectivo) {
      const sugeridos = [];
      for (const paso of [10, 50, 100, 200]) { const v = Math.ceil(t / paso) * paso; if (v > t && !sugeridos.includes(v)) sugeridos.push(v); }
      $('#posBilletes').innerHTML = t > 0 ? [`<button type="button" class="btn mini sec" data-rec="${t}">Exacto</button>`, ...sugeridos.slice(0, 4).map((v) => `<button type="button" class="btn mini sec" data-rec="${v}">${v}</button>`)].join('') : '';
      const falta = redondear(t - rec);
      $('#posCambio').innerHTML = t === 0 ? '' : falta > 0 ? `<span class="falta">Faltan ${bs(falta)}</span>` : `<span>Vuelto</span><strong>${bs(redondear(rec - t))}</strong>`;
    }
    const valido = st.carrito.length > 0 && (!efectivo || rec >= t) && !st.cobrando;
    const btn = $('#posCobrar');
    btn.disabled = !valido;
    btn.innerHTML = st.cobrando ? 'Emitiendo factura…' : st.carrito.length ? `Cobrar ${bs(t)} y facturar <kbd>F9</kbd>` : 'Cobrar y facturar';
    $('#posLimpiar') && ($('#posLimpiar').disabled = !st.carrito.length);
  }
  function pintarBanner() {
    $('#posBanner').innerHTML = st.pedido ? `<div class="banner-pedido"><div><strong>Cobrando pedido ${esc(st.pedido.codigo)}</strong>
        <small>${esc(st.pedido.cliente_nombre)} · Cel. ${esc(st.pedido.cliente_telefono)}${st.pedido.nota ? ` · “${esc(st.pedido.nota)}”` : ''}</small></div>
        <button type="button" class="btn mini sec" id="posSoltar">Soltar pedido</button></div>`
      : (st.carrito.length ? '<div class="banner-limpiar"><button type="button" class="btn mini sec" id="posLimpiar">Vaciar ticket</button></div>' : '');
  }
  function pintarPedidos() {
    const caja = $('#posPedidos'); if (!puedePedidos) { caja.innerHTML = ''; return; }
    if (!pendientes.length) { caja.innerHTML = '<div class="pedidos-web vacio-web"><span>Pedidos web</span><small>Sin pedidos pendientes. Los nuevos aparecerán aquí solos.</small></div>'; return; }
    caja.innerHTML = `<div class="pedidos-web">
      <button type="button" class="pw-cab" id="posTogglePed" aria-expanded="${st.abiertoPedidos}"><span>Pedidos web <b class="pulso">${pendientes.length}</b></span><small>${st.abiertoPedidos ? 'Ocultar' : 'Ver y cobrar'}</small></button>
      <div class="pw-lista ${st.abiertoPedidos ? '' : 'hidden'}">${pendientes.map((p) => `<div class="pw-item ${st.pedido && st.pedido.id === p.id ? 'activo' : ''}">
          <div><strong>${esc(p.codigo)}</strong> · ${esc(p.cliente_nombre)}<small>${p.unidades} botella${p.unidades === 1 ? '' : 's'} · ${bs(p.total)} · ${fechaHora(p.fecha)}</small></div>
          <button type="button" class="btn mini" data-ped="${p.id}">Cargar</button></div>`).join('')}</div></div>`;
  }
  const pintarTodo = (idDestacado) => { pintarTipos(); pintarGrid(idDestacado); pintarLineas(idDestacado); pintarBanner(); pintarPago(); pintarPedidos(); };

  // --- acciones del ticket ---
  function agregar(id, n = 1) {
    if (st.pedido) { toast('Está cobrando un pedido web. Suéltelo para armar otra venta.', 'aviso'); return false; }
    const p = productos.find((x) => x.id === id); if (!p) return false;
    const ya = st.carrito.find((i) => i.producto_id === id);
    const nuevo = (ya ? ya.cantidad : 0) + n;
    if (nuevo > p.stock) { toast(`Solo quedan ${p.stock} de “${p.nombre}”`, 'error'); return false; }
    if (ya) ya.cantidad = nuevo; else st.carrito.push({ producto_id: p.id, nombre: p.nombre, codigo: p.codigo, precio: p.precio, cantidad: n });
    guardarBorrador(); pintarGrid(id); pintarLineas(id); pintarBanner(); pintarPago();
    return true;
  }
  function fijarCantidad(id, c) {
    const it = st.carrito.find((i) => i.producto_id === id); if (!it) return;
    c = Math.floor(Number(c));
    if (!(c >= 1)) c = 1;
    if (c > stockDe(id)) { c = stockDe(id); toast(`Solo quedan ${c} de “${it.nombre}”`, 'error'); }
    it.cantidad = c;
    guardarBorrador(); pintarGrid(); pintarLineas(); pintarPago();
  }
  function quitar(id) { st.carrito = st.carrito.filter((i) => i.producto_id !== id); guardarBorrador(); pintarGrid(); pintarLineas(); pintarBanner(); pintarPago(); }
  function limpiarVenta() {
    Object.assign(st, { carrito: [], pedido: null, recibido: '', nombre: '', nit: '', q: '' });
    $('#posNit').value = ''; $('#posNombre').value = ''; $('#posRec').value = ''; $('#posQ').value = ''; $('#posMsgCli').textContent = '';
    ocultarSugerencias(); try { sessionStorage.removeItem(BORRADOR); } catch { /* nada */ }
    pintarTodo(); $('#posQ').focus();
  }
  async function cargarPedido(id) {
    try {
      const p = await api('GET', `/pedidos/${id}`);
      if (p.estado !== 'PENDIENTE') { toast(`El pedido ya está ${p.estado.toLowerCase()}`, 'error'); await refrescar(); return; }
      st.pedido = p;
      st.carrito = p.detalle.map((d) => ({ producto_id: d.producto_id, nombre: d.nombre, codigo: d.codigo, precio: d.precio_unitario, cantidad: d.cantidad }));
      st.nombre = p.cliente_nombre; st.nit = p.cliente_ci_nit || ''; st.recibido = '';
      $('#posNombre').value = st.nombre; $('#posNit').value = st.nit; $('#posMsgCli').textContent = 'Datos del pedido. Puede corregirlos para la factura.';
      pintarTodo();
    } catch (e) { toast(e.message, 'error'); }
  }

  // --- cliente: autocompletado por NIT/CI o nombre ---
  let tSug = null; let sugerencias = [];
  function ocultarSugerencias() { $('#posSug').classList.add('hidden'); sugerencias = []; }
  function pedirSugerencias(texto) {
    clearTimeout(tSug);
    if (texto.trim().length < 2 || st.pedido) { ocultarSugerencias(); return; }
    tSug = setTimeout(async () => {
      try {
        sugerencias = await api('GET', `/ventas/clientes?q=${encodeURIComponent(texto.trim())}`);
        const caja = $('#posSug');
        if (!sugerencias.length) { caja.classList.add('hidden'); return; }
        caja.innerHTML = sugerencias.map((c, k) => `<button type="button" data-k="${k}"><strong>${esc(c.nombre)}</strong><small>${esc(c.ci_nit)}</small></button>`).join('');
        caja.classList.remove('hidden');
      } catch { /* sin conexión: se escribe a mano */ }
    }, 180);
  }
  function elegirCliente(c) {
    st.nombre = c.nombre; st.nit = c.ci_nit; $('#posNombre').value = c.nombre; $('#posNit').value = c.ci_nit;
    $('#posMsgCli').textContent = 'Cliente registrado'; ocultarSugerencias(); guardarBorrador();
  }

  // --- cobrar ---
  async function cobrar() {
    if (st.cobrando || !st.carrito.length) return;
    const t = total();
    const nit = st.nit.trim();
    if (nit && !/^[0-9]{5,13}(-[0-9A-Za-z]{1,2})?$/.test(nit)) { $('#posNit').focus(); return toast('NIT/CI inválido: solo números (5 a 13 dígitos)', 'error'); }
    if (st.metodo === 'EFECTIVO' && st.recibido !== '' && Number(st.recibido) < t) return toast('El monto recibido no cubre el total', 'error');
    st.cobrando = true; pintarPago();
    const datos = { cliente_nombre: st.nombre.trim(), cliente_ci_nit: nit, metodo_pago: st.metodo };
    if (st.metodo === 'EFECTIVO') datos.monto_recibido = st.recibido === '' ? t : Number(st.recibido);
    try {
      let r;
      if (st.pedido) r = await api('POST', `/pedidos/${st.pedido.id}/cobrar`, datos);
      else r = await api('POST', '/ventas', { ...datos, items: st.carrito.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })) });
      const factura = await api('GET', `/ventas/${r.venta_id ?? r.id}`);
      st.cobrando = false;
      limpiarVenta();
      await refrescar();
      verFactura(factura, { cambio: r.cambio, alCerrar: () => $('#posQ') && $('#posQ').focus() });
    } catch (e) {
      st.cobrando = false;
      if (e.campos && e.campos.cliente_ci_nit) $('#posNit').focus();
      toast(e.message, 'error');
      await refrescar();   // el stock pudo cambiar: se vuelve a leer
      pintarPago();
    }
  }

  // --- datos en vivo: stock y pedidos web ---
  async function refrescar(avisarNuevos = false) {
    try {
      const [prods, pend] = await Promise.all([api('GET', '/ventas/productos'), puedePedidos ? api('GET', '/pedidos?estado=PENDIENTE') : []]);
      const cambioStock = JSON.stringify(prods.map((p) => [p.id, p.stock, p.precio])) !== JSON.stringify(productos.map((p) => [p.id, p.stock, p.precio]));
      const nuevos = pend.filter((p) => !pendientes.some((x) => x.id === p.id));
      const cambioPed = pend.length !== pendientes.length || nuevos.length > 0;
      productos = prods; pendientes = pend;
      // si el pedido cargado ya no está pendiente (lo cobró o canceló otra persona), se suelta
      if (st.pedido && !pend.some((p) => p.id === st.pedido.id)) { toast(`El pedido ${st.pedido.codigo} ya no está pendiente`, 'aviso'); st.pedido = null; st.carrito = []; pintarLineas(); pintarBanner(); pintarPago(); }
      if (cambioStock) { pintarTipos(); pintarGrid(); }
      if (cambioPed) pintarPedidos();
      if (avisarNuevos) for (const n of nuevos) toast(`Nuevo pedido web ${n.codigo}: ${n.cliente_nombre} · ${bs(n.total)}`, 'ok');
      actualizarPendientes();
    } catch { /* sin conexión: se reintenta */ }
  }
  posTimer = setInterval(() => { if (!document.getElementById('posQ')) return clearInterval(posTimer); refrescar(true); }, 10000);

  // --- eventos ---
  const q = $('#posQ');
  q.oninput = () => { st.q = q.value; pintarGrid(); };
  q.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const { n, texto } = parsear(q.value); if (!texto) return;
    const exacto = productos.find((p) => p.codigo.toLowerCase() === texto.toLowerCase());
    const lista = exacto ? [exacto] : filtrar(texto);
    if (!lista.length) return toast(`Nada coincide con “${texto}”`, 'error');
    if (agregar(lista[0].id, n)) { q.value = ''; st.q = ''; pintarGrid(lista[0].id); }
  };
  $('#posTipos').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) { st.tipo = b.dataset.t; q.value = ''; st.q = ''; pintarTipos(); pintarGrid(); q.focus(); } };
  $('#posGrid').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b && !b.disabled) { agregar(Number(b.dataset.id)); } };
  $('#posLineas').onclick = (e) => {
    const fila = e.target.closest('.linea'); if (!fila) return;
    const id = Number(fila.dataset.id);
    const paso = e.target.closest('.paso');
    if (paso) fijarCantidad(id, enTicket(id) + Number(paso.dataset.d));
    if (e.target.closest('[data-quitar]')) quitar(id);
  };
  $('#posLineas').onchange = (e) => { if (e.target.classList.contains('cant')) fijarCantidad(Number(e.target.closest('.linea').dataset.id), e.target.value); };
  $('#posBanner').onclick = (e) => {
    if (e.target.closest('#posSoltar')) limpiarVenta();
    if (e.target.closest('#posLimpiar')) limpiarVenta();
  };
  $('#posPedidos').onclick = (e) => {
    if (e.target.closest('#posTogglePed')) { st.abiertoPedidos = !st.abiertoPedidos; pintarPedidos(); }
    const b = e.target.closest('[data-ped]'); if (b) cargarPedido(Number(b.dataset.ped));
  };
  $('#posMetodos').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { st.metodo = b.dataset.m; st.recibido = ''; $('#posRec').value = ''; guardarBorrador(); pintarPago(); if (st.metodo === 'EFECTIVO') $('#posRec').focus(); } };
  $('#posRec').oninput = (e) => { st.recibido = e.target.value; pintarPago(); };
  $('#posRec').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); cobrar(); } };
  $('#posBilletes').onclick = (e) => { const b = e.target.closest('[data-rec]'); if (b) { st.recibido = b.dataset.rec; $('#posRec').value = b.dataset.rec; pintarPago(); $('#posCobrar').focus(); } };
  $('#posCobrar').onclick = cobrar;
  $('#posNit').oninput = (e) => { st.nit = e.target.value; $('#posMsgCli').textContent = ''; guardarBorrador(); pedirSugerencias(st.nit); };
  $('#posNombre').oninput = (e) => { st.nombre = e.target.value; $('#posMsgCli').textContent = ''; guardarBorrador(); pedirSugerencias(st.nombre); };
  $('#posSug').onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) elegirCliente(sugerencias[Number(b.dataset.k)]); };
  for (const id of ['#posNit', '#posNombre']) {
    $(id).onkeydown = (e) => {
      if (e.key === 'Enter' && sugerencias.length) { e.preventDefault(); elegirCliente(sugerencias[0]); }
      if (e.key === 'Escape') ocultarSugerencias();
    };
  }

  // Atajos de teclado (se reemplazan en cada apertura de la pantalla)
  document.onkeydown = (e) => {
    if (!document.getElementById('posQ') || document.querySelector('#modal .modal')) return;
    if (e.key === 'F2') { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'F9') { e.preventDefault(); cobrar(); }
    else if (e.key === 'Escape') { if (q.value) { q.value = ''; st.q = ''; pintarGrid(); } else if (st.carrito.length || st.pedido) confirmar('Vaciar el ticket', 'Se quitarán todos los productos del ticket actual.', 'Vaciar', 'peligro').then((si) => { if (si) limpiarVenta(); }); }
  };

  // Recupera un borrador si el cajero cambió de pantalla sin cobrar
  try {
    const b = JSON.parse(sessionStorage.getItem(BORRADOR) || 'null');
    if (b && Array.isArray(b.carrito)) {
      st.carrito = b.carrito.filter((i) => productos.some((p) => p.id === i.producto_id && p.stock >= 1)).map((i) => ({ ...i, cantidad: Math.min(i.cantidad, stockDe(i.producto_id)) }));
      st.nombre = b.nombre || ''; st.nit = b.nit || ''; st.metodo = METODOS_PAGO[b.metodo] ? b.metodo : 'EFECTIVO';
      $('#posNombre').value = st.nombre; $('#posNit').value = st.nit;
    }
  } catch { /* borrador dañado: se ignora */ }

  pintarTodo();
  if (posPedidoACargar) { const id = posPedidoACargar; posPedidoACargar = null; st.abiertoPedidos = true; await cargarPedido(id); }
  else q.focus();
};

/** Sin caja abierta: se abre aquí mismo, sin cambiar de pantalla */
function posSinCaja() {
  vista.innerHTML = `<div class="cabecera"><div><h1>Punto de venta</h1><p class="muted">Cajero: <strong>${esc(Sesion.usuario.nombres)} ${esc(Sesion.usuario.apellidos)}</strong></p></div>
      <span class="badge b-off">Sin caja abierta</span></div>
    <div class="panel" style="max-width:440px"><h3>Abra su caja para empezar a vender</h3>
      <p class="muted small">Cuente el efectivo con el que inicia el turno. Todas sus ventas y cobros entrarán a esta caja.</p>
      <form id="fAbrirPos" novalidate><div class="campo"><label class="req" for="montoIni">Monto inicial (Bs)</label>
        <input id="montoIni" name="monto_inicial" type="number" min="0" step="0.01" placeholder="200.00" inputmode="decimal"><div class="msg"></div></div>
        <button class="btn grande bloque">Abrir caja y vender</button></form></div>`;
  const f = $('#fAbrirPos'); $('#montoIni').focus();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    if (d.monto_inicial === '' || Number(d.monto_inicial) < 0) return mostrarErrores(f, { monto_inicial: 'Ingrese un monto ≥ 0' });
    try { const r = await api('POST', '/caja/abrir', d); toast(r.mensaje, 'ok'); VISTAS.pos(); } catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}

/** Abre el POS con un pedido web ya cargado (botón “Cobrar” de Pedidos web) */
function irAlPOS(pedidoId) {
  posPedidoACargar = pedidoId;
  if (location.hash === '#pos') VISTAS.pos(); else location.hash = '#pos';
}

// ---------------------------------------------------------------------------------------------
// Pantalla: Facturas (historial, reimpresión y anulación)
// ---------------------------------------------------------------------------------------------
let filtroFactura = { estado: '', metodo: '', texto: '' };
VISTAS.ventas = async () => {
  const todas = Sesion.puede('ventas.ver_todas');
  const lista = await api('GET', '/ventas');
  vista.innerHTML = `
    <div class="cabecera"><div><h1>Facturas</h1><p class="muted">${todas ? 'Facturas de todos los vendedores' : 'Sus facturas'} · documento simulado, sin validez fiscal.</p></div>
      ${Sesion.puede('ventas.registrar') ? '<a class="btn" href="#pos">' + ICONOS.pos + ' Ir al punto de venta</a>' : ''}</div>
    <div class="kpis" id="kFact"></div>
    <div class="toolbar">
      <input class="buscar" id="fFTexto" placeholder="Buscar por N° de factura, cliente, NIT o vendedor…" value="${esc(filtroFactura.texto)}">
      <select id="fFEstado"><option value="">Todas</option><option value="EMITIDA">Vigentes</option><option value="ANULADA">Anuladas</option></select>
      <select id="fFMetodo"><option value="">Todo pago</option>${Object.entries(METODOS_PAGO).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
    </div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Vendedor</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead>
      <tbody id="tFact"></tbody></table></div>`;
  $('#fFEstado').value = filtroFactura.estado; $('#fFMetodo').value = filtroFactura.metodo;

  const pintar = () => {
    const t = sinTildes(filtroFactura.texto);
    const filas = lista.filter((v) => (!filtroFactura.estado || v.estado === filtroFactura.estado) && (!filtroFactura.metodo || v.metodo_pago === filtroFactura.metodo)
      && (!t || sinTildes(`${v.nro_factura} ${v.nro_nota} ${v.cliente_nombre} ${v.vendedor}`).includes(t)));
    const vigentes = filas.filter((v) => v.estado === 'EMITIDA');
    const suma = (arr) => redondear(arr.reduce((s, v) => s + Number(v.total), 0));
    $('#kFact').innerHTML = [['Facturas vigentes', vigentes.length], ['Total facturado', bs(suma(vigentes)), true], ['En efectivo', bs(suma(vigentes.filter((v) => v.metodo_pago === 'EFECTIVO')))],
      ['QR y tarjeta', bs(suma(vigentes.filter((v) => v.metodo_pago !== 'EFECTIVO')))]]
      .map(([l, v, d]) => `<div class="kpi ${d ? 'destacado' : ''}"><div class="l">${l}</div><div class="v">${v}</div></div>`).join('');
    $('#tFact').innerHTML = filas.length ? filas.map((v) => `<tr class="${v.estado === 'ANULADA' ? 'fila-anulada' : ''}">
        <td style="white-space:nowrap"><strong>N° ${v.nro_factura ?? '—'}</strong><br><span class="small muted">${esc(v.nro_nota)}</span></td><td style="white-space:nowrap">${fechaHora(v.fecha)}</td><td>${esc(v.cliente_nombre)}</td>
        <td><span class="badge ${v.canal === 'WEB' ? 'b-otro' : 'b-off'}">${v.canal === 'WEB' ? 'Pedido web' : 'Mostrador'}</span></td>
        <td><span class="badge b-admin">${METODOS_PAGO[v.metodo_pago]}</span></td><td>${esc(v.vendedor)}</td><td class="num">${bs(v.total)}</td>
        <td><span class="badge ${v.estado === 'ANULADA' ? 'b-error' : 'b-ok'}">${v.estado === 'ANULADA' ? 'Anulada' : 'Vigente'}</span></td>
        <td class="acciones"><button class="btn sec mini" data-ver="${v.id}">Ver factura</button></td></tr>`).join('')
      : '<tr><td colspan="9" class="vacio">No hay facturas con ese filtro</td></tr>';
  };
  $('#fFTexto').oninput = (e) => { filtroFactura.texto = e.target.value; pintar(); };
  $('#fFEstado').onchange = (e) => { filtroFactura.estado = e.target.value; pintar(); };
  $('#fFMetodo').onchange = (e) => { filtroFactura.metodo = e.target.value; pintar(); };
  $('#tFact').onclick = async (e) => {
    const b = e.target.closest('[data-ver]'); if (!b) return;
    verFactura(await api('GET', `/ventas/${b.dataset.ver}`), { alCambiar: () => VISTAS.ventas() });
  };
  pintar();
};

// ---------------------------------------------------------------------------------------------
// Factura (vista, impresión y anulación)
// ---------------------------------------------------------------------------------------------
function montoEnLetras(monto) {
  const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
    'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const apocope = (s) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
  const centenas = (x) => {
    if (x === 100) return 'cien';
    const c = Math.floor(x / 100); const r = x % 100; let s = C[c];
    if (r) { if (s) s += ' '; s += r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ` y ${U[r % 10]}` : ''); }
    return s;
  };
  const entero = (x) => {
    if (x === 0) return 'cero';
    const mill = Math.floor(x / 1e6); const mil = Math.floor((x % 1e6) / 1000); const resto = x % 1000; let s = '';
    if (mill) s += mill === 1 ? 'un millón' : `${apocope(entero(mill))} millones`;
    if (mil) s += `${s ? ' ' : ''}${mil === 1 ? 'mil' : `${apocope(centenas(mil))} mil`}`;
    if (resto) s += `${s ? ' ' : ''}${centenas(resto)}`;
    return s;
  };
  const n = Math.round(Number(monto) * 100);
  const e = Math.floor(n / 100); const cts = String(n % 100).padStart(2, '0');
  const letras = entero(e);
  return `${letras.charAt(0).toUpperCase()}${letras.slice(1)} ${cts}/100 Bolivianos`;
}

/** Cuadro de verificación DE DEMOSTRACIÓN: se dibuja a partir del CUF, pero no es un código QR real */
function qrSimulado(cuf) {
  const N = 21; const celdas = [];
  let h = 0; for (const ch of cuf) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h; };
  const buscador = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let on;
    if (buscador(x, y)) {
      const lx = x < 7 ? x : x - (N - 7); const ly = y < 7 ? y : y - (N - 7);
      on = lx === 0 || lx === 6 || ly === 0 || ly === 6 || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4);
    } else on = rnd() % 2 === 0;
    if (on) celdas.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
  }
  return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" width="92" height="92" role="img" aria-label="Código de verificación de demostración" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${N + 2}" height="${N + 2}" fill="#fff"/><g fill="#111">${celdas.join('')}</g></svg>`;
}

/**
 * Muestra la factura. opciones: { cambio, alCerrar, alCambiar }
 *  - cambio: vuelto a entregar (se resalta cuando se acaba de cobrar)
 *  - alCambiar: se llama después de anular, para refrescar la lista
 */
function verFactura(v, opciones = {}) {
  const f = v.factura; const e = v.empresa;
  const anulada = v.estado === 'ANULADA';
  const puedeAnular = !anulada && Sesion.puede('ventas.anular');
  const m = abrirModal(`
    ${opciones.cambio != null && opciones.cambio > 0 ? `<div class="vuelto-grande"><span>Entregue de vuelto</span><strong>${bs(opciones.cambio)}</strong></div>` : ''}
    <div class="factura" id="facturaImp">
      ${anulada ? '<div class="sello">ANULADA</div>' : ''}
      <div class="fac-enc">
        <div class="fac-emisor"><strong>${esc(e.razon_social)}</strong><br>${esc(e.sucursal)}<br>${esc(e.direccion)}<br>Tel. ${esc(e.telefono || '—')} · ${esc(e.municipio)}</div>
        <div class="fac-num"><h2>FACTURA</h2><small>Con derecho a crédito fiscal · SIMULADA</small><br>
          <strong>N° ${f.nro_factura}</strong><br><span>NIT ${esc(e.nit)}</span></div>
      </div>
      <div class="fac-cuf"><b>CUF:</b> ${esc(f.cuf)}</div>
      <div class="fac-actividad">${esc(e.actividad)}</div>
      <div class="fac-cliente">
        <div><b>Fecha:</b> ${fechaHora(f.fecha_emision)}</div>
        <div><b>NIT/CI:</b> ${esc(f.nit_ci)}</div>
        <div style="grid-column:1/-1"><b>Nombre / Razón social:</b> ${esc(f.razon_social)}</div>
      </div>
      <table class="fac-tabla"><thead><tr><th>Código</th><th>Descripción</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${v.detalle.map((d) => `<tr><td>${esc(d.codigo)}</td><td>${esc(d.nombre)}</td><td class="num">${d.cantidad}</td><td class="num">${bs(d.precio_unitario)}</td><td class="num">${bs(d.subtotal)}</td></tr>`).join('')}</tbody></table>
      <div class="fac-total"><div class="son">Son: ${montoEnLetras(v.total)}</div><div class="monto">Total Bs <strong>${Number(v.total).toLocaleString('es-BO', { minimumFractionDigits: 2 })}</strong></div></div>
      <div class="fac-pie">
        <div class="fac-pago">
          <b>Forma de pago:</b> ${METODOS_PAGO[v.metodo_pago]}${v.metodo_pago === 'EFECTIVO' && v.monto_recibido != null ? ` · Recibido ${bs(v.monto_recibido)} · Vuelto ${bs(v.cambio)}` : ''}<br>
          <b>Vendedor:</b> ${esc(v.vendedor)} (@${esc(v.vendedor_usuario)}) · ID ${v.usuario_id}<br>
          <b>Venta:</b> ${esc(v.nro_nota)} · Caja #${v.caja_id}${v.pedido_codigo ? ` · Pedido web ${esc(v.pedido_codigo)}` : ''}
          ${anulada ? `<br><b class="rojo">Anulada</b> por ${esc(v.anulada_por_nombre)} el ${fechaHora(v.fecha_anulacion)}: ${esc(v.motivo_anulacion)}` : ''}
        </div>
        <div class="fac-qr">${qrSimulado(f.cuf)}<small>Verificación<br>(demostración)</small></div>
      </div>
      <p class="fac-ley">${esc(e.leyenda)}</p>
    </div>
    <div class="pie no-imprimir">
      <button class="btn sec" data-cerrar>${opciones.alCerrar ? 'Nueva venta' : 'Cerrar'}</button>
      ${puedeAnular ? '<button class="btn peligro" id="fAnular">Anular factura</button>' : ''}
      <button class="btn" id="fImprimir">Imprimir / PDF</button>
    </div>`);
  m.classList.add('modal-factura');
  if (opciones.alCerrar) {
    const cierre = () => { cerrarModal(); opciones.alCerrar(); };
    m.querySelectorAll('[data-cerrar]').forEach((b) => { b.onclick = cierre; });
    m.parentElement.addEventListener('mousedown', (ev) => { if (ev.target.classList.contains('modal-fondo')) opciones.alCerrar(); });
  }
  $('#fImprimir', m).onclick = () => window.print();
  if (puedeAnular) $('#fAnular', m).onclick = () => anularFactura(v, opciones);
}

function anularFactura(v, opciones) {
  const m = abrirModal(`<h2>Anular factura N° ${v.factura.nro_factura}</h2>
    <p class="muted">Las botellas vuelven al stock y se descuenta ${bs(v.total)} de la caja #${v.caja_id}. Solo se puede anular mientras esa caja siga abierta. La anulación queda como <strong>aviso en rojo</strong> en la auditoría.</p>
    <form id="fAnul" novalidate><div class="campo"><label class="req">Motivo</label><input name="motivo" maxlength="150" placeholder="Ej. el cliente se arrepintió / error en el NIT"><div class="msg"></div></div>
    <div class="pie"><button type="button" class="btn sec" data-cerrar>Volver</button><button class="btn peligro">Anular factura</button></div></form>`);
  const f = $('#fAnul', m);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = datosForm(f);
    if (d.motivo.trim().length < 3) return mostrarErrores(f, { motivo: 'Mínimo 3 caracteres' });
    try {
      const r = await api('POST', `/ventas/${v.id}/anular`, d);
      cerrarModal(); toast(r.mensaje, 'ok');
      if (opciones.alCambiar) opciones.alCambiar();
      if (opciones.alCerrar) opciones.alCerrar();
    } catch (err) { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  };
}
