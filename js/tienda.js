// ===== Bodegas Aranjuez — Tienda en línea =====
// Catálogo real (GET /api/catalogo), carrito en el navegador y reserva de pedidos
// (POST /api/pedidos). El cajero cobra el pedido desde el sistema interno.
const $ = (s, r = document) => r.querySelector(s);

// ---------- Íconos de la tienda ----------
const IC = {
  carrito: svg('<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>'),
  mas: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  reserva: svg('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M9 15l2 2 4-4"/>'),
  tienda: svg('<path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M10 20v-5h4v5"/>'),
  pago: svg('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>'),
  uva: svg('<circle cx="9" cy="9" r="2.5"/><circle cx="15" cy="9" r="2.5"/><circle cx="12" cy="13.5" r="2.5"/><circle cx="12" cy="19" r="2.5"/><path d="M12 6.5V3l3-1"/>'),
};
const OCASION_ICONO = {
  'Carnes rojas': '<path d="M4 14c0-5 4-9 9-9 4 0 7 3 7 7 0 5-5 8-10 8-3 0-6-2-6-6z"/><circle cx="14" cy="10" r="2"/>',
  Parrilla: '<path d="M4 10h16a8 8 0 0 1-16 0z"/><path d="M8 18l-2 4M16 18l2 4M9 3c0 2 2 2 2 4M14 3c0 2 2 2 2 4"/>',
  'Quesos maduros': '<path d="M3 17l9-10 9 5v5z"/><path d="M3 17h18"/><circle cx="10" cy="14" r="1"/><circle cx="15" cy="15" r="1"/>',
  Pastas: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 7c1-2 3-2 4 0s3 2 4 0"/>',
  'Pescados y mariscos': '<path d="M3 12c3-5 9-6 14-2l4-3v10l-4-3c-5 4-11 3-14-2z"/><circle cx="8" cy="11" r="1"/>',
  Ensaladas: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15z"/><path d="M5 19l8-8"/>',
  Aperitivo: '<path d="M8 3h8l-1 7a3 3 0 0 1-6 0z"/><path d="M12 13v7M9 21h6"/>',
  Postres: '<path d="M4 12h16v8H4z"/><path d="M4 16h16M12 4v4M10 8h4"/>',
  Celebraciones: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  Cócteles: '<path d="M4 4h16l-8 9z"/><path d="M12 13v7M8 21h8"/>',
  Digestivo: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M12 14v6M9 21h6"/>',
};

// ---------- Botellas dibujadas en SVG ----------
const COLORES = {
  Tinto:     { liquido: ['#8a1f36', '#2b0a12'], glow: 'rgba(160, 35, 62, .55)' },
  Blanco:    { liquido: ['#fbf0c4', '#c9a95c'], glow: 'rgba(240, 210, 120, .38)' },
  Rosado:    { liquido: ['#ffc2cf', '#b4405a'], glow: 'rgba(255, 150, 170, .4)' },
  Espumante: { liquido: ['#fffbe6', '#d9c27a'], glow: 'rgba(255, 235, 170, .36)' },
  Singani:   { liquido: ['#f4fafa', '#9fbfc6'], glow: 'rgba(170, 210, 215, .32)' },
};
const ETIQUETAS = [
  { fondo: '#f6eedd', texto: '#5a1424' }, { fondo: '#16100f', texto: '#e8c983' },
  { fondo: '#6b1f2e', texto: '#f6e2b3' }, { fondo: '#e9dcc0', texto: '#2b0a12' },
];
const FORMAS = {
  bordelesa: 'M25 6 H35 V42 C35 52 48 55 48 70 V180 Q48 192 36 192 H24 Q12 192 12 180 V70 C12 55 25 52 25 42 Z',
  espumante: 'M26 6 H34 V36 C34 60 50 66 50 92 V182 Q50 193 38 193 H22 Q10 193 10 182 V92 C10 66 26 60 26 34 Z',
  singani: 'M26 6 H34 V48 C34 54 46 55 46 64 V184 Q46 193 37 193 H23 Q14 193 14 184 V64 C14 55 26 54 26 48 Z',
};
let uid = 0;
const glow = (p) => (COLORES[p.tipo] || COLORES.Tinto).glow;

function botella(p, alto = 200) {
  const c = (COLORES[p.tipo] || COLORES.Tinto).liquido;
  const forma = p.tipo === 'Espumante' ? FORMAS.espumante : p.tipo === 'Singani' ? FORMAS.singani : FORMAS.bordelesa;
  const et = ETIQUETAS[p.id % ETIQUETAS.length];
  const palabra = String(p.variedad || p.nombre).split(/[ -]/)[0].toUpperCase().slice(0, 10);
  const fs = Math.min(5.6, 27 / (palabra.length * 0.62));
  const id = `b${++uid}`;
  const lx = p.tipo === 'Singani' ? 17 : 14; const lw = p.tipo === 'Singani' ? 26 : 32;
  return `<svg class="botella" viewBox="0 0 60 200" width="${Math.round(alto * 0.3)}" height="${alto}" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>
      <linearGradient id="${id}v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
    </defs>
    <path d="${forma}" fill="url(#${id})" stroke="rgba(255,255,255,.35)" stroke-width="1"/>
    ${p.tipo === 'Espumante' ? '<path d="M25 4 H35 V40 C35 46 38 50 40 54 H20 C22 50 25 46 25 40 Z" fill="#d9b46c"/><path d="M25 30 H35" stroke="#a8843f" stroke-width="1.2"/>' : '<rect x="24" y="0" width="12" height="9" rx="2" fill="' + (p.tipo === 'Singani' ? '#2a2a2a' : '#d9b46c') + '"/>'}
    <rect x="${lx}" y="104" width="${lw}" height="52" rx="3" fill="${et.fondo}" stroke="rgba(217,180,108,.7)" stroke-width=".6"/>
    <text x="30" y="114" text-anchor="middle" font-family="Georgia, serif" font-size="3.4" letter-spacing=".6" fill="${et.texto}" opacity=".75">ARANJUEZ</text>
    <path d="M${lx + 5} 117.5 H${lx + lw - 5}" stroke="${et.texto}" stroke-width=".4" opacity=".5"/>
    <text x="30" y="131" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${fs.toFixed(2)}" fill="${et.texto}">${esc(palabra)}</text>
    <text x="30" y="143" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="4.2" fill="${et.texto}" opacity=".85">${p.anada || 'Singani'}</text>
    <path d="${forma}" fill="url(#${id}v)"/>
  </svg>`;
}

// ---------- Estado ----------
let PRODUCTOS = [];
let filtroLinea = 'Todas';
let filtroTipo = 'Todos';
let filtroOcasion = null;
const ORDEN_TIPOS = ['Tinto', 'Blanco', 'Rosado', 'Espumante', 'Singani'];
const porId = (id) => PRODUCTOS.find((p) => p.id === Number(id));

const Carrito = {
  clave: 'aranjuez_carrito',
  items: [],
  cargar() { try { this.items = JSON.parse(localStorage.getItem(this.clave)) || []; } catch { this.items = []; } },
  guardar() { try { localStorage.setItem(this.clave, JSON.stringify(this.items)); } catch { /* modo privado */ } pintarContador(); },
  cantidadDe(id) { return (this.items.find((i) => i.id === id) || {}).cantidad || 0; },
  poner(id, cantidad) {
    const p = porId(id); if (!p) return;
    const cant = Math.max(0, Math.min(cantidad, p.stock, 24));
    this.items = this.items.filter((i) => i.id !== id);
    if (cant > 0) this.items.push({ id, cantidad: cant });
    this.guardar();
  },
  // Quita productos que ya no existen y ajusta cantidades al stock actual
  sanear() {
    let cambio = false;
    this.items = this.items.filter((i) => {
      const p = porId(i.id);
      if (!p || p.stock <= 0) { cambio = true; return false; }
      if (i.cantidad > p.stock) { i.cantidad = p.stock; cambio = true; }
      return true;
    });
    this.guardar();
    return cambio;
  },
  get unidades() { return this.items.reduce((s, i) => s + i.cantidad, 0); },
  get total() { return this.items.reduce((s, i) => s + (porId(i.id)?.precio || 0) * i.cantidad, 0); },
  vaciar() { this.items = []; this.guardar(); },
};

function disponibilidad(stock) {
  if (stock <= 0) return '<span class="badge b-off">Agotado</span>';
  if (stock <= 10) return `<span class="badge b-aviso">Quedan ${stock}</span>`;
  return '<span class="badge b-ok">Disponible</span>';
}
const meta = (p) => [p.variedad, p.anada, p.origen && p.origen.split(',')[0]].filter(Boolean).map(esc).join(' · ');

function pintarContador(animar) {
  const c = $('#contador'); const n = Carrito.unidades;
  c.textContent = n; c.classList.toggle('hidden', n === 0);
  if (animar) { c.classList.remove('pulso'); void c.offsetWidth; c.classList.add('pulso'); }
}

function agregar(id, cantidad = 1, boton) {
  const p = porId(id); if (!p) return;
  const ya = Carrito.cantidadDe(p.id);
  if (ya + cantidad > p.stock) return toast(p.stock ? `Solo hay ${p.stock} unidades de ${p.nombre}` : `${p.nombre} está agotado`, 'error');
  if (ya + cantidad > 24) return toast('Máximo 24 unidades por producto. Para compras mayores, visítenos.', 'aviso');
  Carrito.poner(p.id, ya + cantidad);
  pintarContador(true);
  toast(`${cantidad} × ${p.nombre} en su carrito`, 'ok');
  if (boton) {
    const html = boton.innerHTML;
    boton.classList.add('listo'); boton.innerHTML = `${IC.check}Agregado`;
    setTimeout(() => { boton.classList.remove('listo'); boton.innerHTML = html; }, 1200);
  }
}

// ---------- Hero: vitrina rotativa ----------
let vIdx = 0; let vTimer;
function pintarVitrina(i, animar = true) {
  const lista = PRODUCTOS.filter((p) => p.destacado);
  if (!lista.length) return;
  vIdx = (i + lista.length) % lista.length;
  const p = lista[vIdx];
  const aplicar = () => {
    $('#vHalo').style.setProperty('--glow', glow(p).replace(/[\d.]+\)$/, '.7)'));
    $('#vTipo').textContent = p.tipo;
    $('#vImg').innerHTML = botella(p, 270);
    $('#vInfo').innerHTML = `<h3>${esc(p.nombre)}</h3><p class="meta">${meta(p)}</p>
      <div class="vitrina-pie"><span class="precio">${bs(p.precio)}</span>
      ${p.stock > 0 ? `<button type="button" class="btn btn-agregar" data-agregar="${p.id}">${IC.carrito}Agregar</button>` : disponibilidad(0)}</div>`;
    $('#vF1').innerHTML = `<strong>${p.graduacion ? `${Number(p.graduacion).toFixed(1).replace('.', ',')}%` : '—'}</strong>alcohol`;
    $('#vF2').innerHTML = `<strong>${esc((p.maridaje[0] || p.tipo))}</strong>ideal para`;
    $('#vPuntos').innerHTML = lista.map((x, k) => `<button type="button" class="${k === vIdx ? 'activo' : ''}" data-v="${k}" aria-label="Ver ${esc(x.nombre)}"></button>`).join('');
    $('#vImg').classList.remove('saliendo'); $('#vInfo').classList.remove('saliendo');
  };
  if (!animar) return aplicar();
  $('#vImg').classList.add('saliendo'); $('#vInfo').classList.add('saliendo');
  setTimeout(aplicar, 300);
}
function rotarVitrina() {
  clearInterval(vTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  vTimer = setInterval(() => pintarVitrina(vIdx + 1), 6000);
}

// ---------- Secciones ----------
function pintarBeneficios() {
  $('#beneficios').innerHTML = [[IC.reserva, 'Reserve en línea'], [IC.tienda, 'Retire en tienda'], [IC.pago, 'Pague al retirar']]
    .map(([i, t]) => `<li>${i}${t}</li>`).join('');
}

function pintarFranja() {
  const tipos = new Set(PRODUCTOS.map((p) => p.tipo)).size;
  const valles = new Set(PRODUCTOS.map((p) => (p.origen || '').split(',')[0]).filter(Boolean)).size;
  const desde = Math.min(...PRODUCTOS.map((p) => p.precio));
  $('#franja').innerHTML = [
    [PRODUCTOS.length, 'etiquetas en catálogo'], [tipos, 'estilos: tintos a singanis'],
    [valles, valles === 1 ? 'valle de origen' : 'valles de origen'], [bs(desde).replace(',00', ''), 'precio desde'],
  ].map(([n, t]) => `<div><strong>${esc(n)}</strong><span>${t}</span></div>`).join('');
}

function pintarEstante() {
  const orden = [...PRODUCTOS].sort((a, b) => ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo) || b.destacado - a.destacado);
  $('#estante').innerHTML = orden.map((p) => `
    <button type="button" class="botella-estante ${p.stock > 0 ? '' : 'agotada'}" data-detalle="${p.id}" style="--glow:${glow(p)}" aria-label="${esc(p.nombre)}, ${bs(p.precio)}">
      ${botella(p, 168)}
      <span class="est-nombre">${esc(p.nombre)}</span>
      <span class="est-precio">${p.stock > 0 ? bs(p.precio) : 'Agotado'}</span>
    </button>`).join('');
}

function pintarLineas() {
  const lineas = [...new Set(PRODUCTOS.map((p) => p.linea).filter(Boolean))];
  $('#lineas').innerHTML = ['Todas', ...lineas].map((l) =>
    `<button type="button" class="chip ${l === filtroLinea ? 'activo' : ''}" data-linea="${esc(l)}" aria-pressed="${l === filtroLinea}">${l === 'Todas' ? 'Todas las líneas' : esc(l)}</button>`).join('');
}

function pintarDestacados() {
  $('#destacados').innerHTML = PRODUCTOS.filter((p) => p.destacado).map((p) => `
    <article class="sel-card vidrio" style="--glow:${glow(p)}" data-detalle="${p.id}">
      ${botella(p, 190)}
      <div>
        <span class="tag-tipo">${esc(p.tipo)}</span>
        <h3>${esc(p.nombre)}</h3>
        <p class="meta">${meta(p)}</p>
        <p class="nota-cata">${esc(p.descripcion || '')}</p>
        <div class="sel-pie"><span class="precio">${bs(p.precio)}</span>
          ${p.stock > 0 ? `<button type="button" class="btn mini btn-agregar" data-agregar="${p.id}">${IC.mas}Agregar</button>` : disponibilidad(0)}</div>
      </div>
    </article>`).join('');
}

function pintarOcasiones() {
  const cuenta = new Map();
  PRODUCTOS.forEach((p) => p.maridaje.forEach((m) => cuenta.set(m, (cuenta.get(m) || 0) + 1)));
  const lista = [...cuenta.entries()].sort((a, b) => b[1] - a[1]);
  $('#listaOcasiones').innerHTML = lista.map(([m, n]) => `
    <button type="button" class="ocasion vidrio" data-ocasion="${esc(m)}">
      <span class="ico">${OCASION_ICONO[m] ? svg(OCASION_ICONO[m]) : IC.uva}</span>
      <span><strong>${esc(m)}</strong><br><small>${n} ${n === 1 ? 'opción' : 'opciones'}</small></span>
    </button>`).join('');
}

function pintarChips() {
  const tipos = [...new Set(PRODUCTOS.map((p) => p.tipo))].sort((a, b) => ORDEN_TIPOS.indexOf(a) - ORDEN_TIPOS.indexOf(b));
  $('#chips').innerHTML = ['Todos', ...tipos].map((t) =>
    `<button type="button" class="chip ${t === filtroTipo ? 'activo' : ''}" data-tipo="${esc(t)}" aria-pressed="${t === filtroTipo}">${esc(t === 'Todos' ? t : `${t}s`)}</button>`).join('');
}

function tarjeta(p) {
  return `<article class="prod vidrio" style="--glow:${glow(p)}">
    <button type="button" class="prod-img" data-detalle="${p.id}" aria-label="Ver detalle de ${esc(p.nombre)}">
      <span class="tag-tipo">${esc(p.tipo)}</span>${disponibilidad(p.stock)}
      ${botella(p, 185)}
    </button>
    <div class="prod-body">
      <span class="meta">${meta(p)}</span>
      <h3><button type="button" data-detalle="${p.id}">${esc(p.nombre)}</button></h3>
      <p>${esc(p.descripcion || '')}</p>
      <div class="prod-pie">
        <span class="precio">${bs(p.precio)}</span>
        <button type="button" class="btn mini btn-agregar" data-agregar="${p.id}" ${p.stock > 0 ? '' : 'disabled'}>${p.stock > 0 ? `${IC.mas}Agregar` : 'Agotado'}</button>
      </div>
    </div>
  </article>`;
}

function pintarGrid() {
  const q = $('#buscar').value.trim().toLowerCase();
  let lista = PRODUCTOS.filter((p) =>
    (filtroTipo === 'Todos' || p.tipo === filtroTipo) &&
    (filtroLinea === 'Todas' || p.linea === filtroLinea) &&
    (!filtroOcasion || p.maridaje.includes(filtroOcasion)) &&
    (!q || `${p.nombre} ${p.linea || ''} ${p.tipo} ${p.variedad || ''} ${p.origen || ''} ${p.descripcion || ''} ${p.maridaje.join(' ')}`.toLowerCase().includes(q)));
  const orden = $('#orden').value;
  const cmp = {
    'precio-asc': (a, b) => a.precio - b.precio,
    'precio-desc': (a, b) => b.precio - a.precio,
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    destacados: (a, b) => (b.destacado - a.destacado) || (b.stock > 0) - (a.stock > 0) || ORDEN_TIPOS.indexOf(a.tipo) - ORDEN_TIPOS.indexOf(b.tipo),
  }[orden];
  lista = [...lista].sort(cmp);
  $('#filtroOcasion').innerHTML = filtroOcasion
    ? `<p style="margin:0 0 1rem"><span class="filtro-activo">Ideal para: ${esc(filtroOcasion)} <button type="button" id="quitarOcasion" aria-label="Quitar filtro">×</button></span></p>` : '';
  $('#resultado').textContent = `${lista.length} ${lista.length === 1 ? 'producto' : 'productos'}`;
  $('#grid').innerHTML = lista.length ? lista.map(tarjeta).join('')
    : '<p class="vacio" style="grid-column:1/-1">No encontramos productos con esa búsqueda. Pruebe con otra palabra o quite los filtros.</p>';
}

// ---------- Detalle de producto ----------
function abrirDetalle(p) {
  let cant = 1;
  const max = Math.max(0, Math.min(p.stock - Carrito.cantidadDe(p.id), 24 - Carrito.cantidadDe(p.id)));
  const m = $('#modal');
  m.innerHTML = `<div class="modal-fondo" id="fondoDetalle">
    <div class="modal detalle" role="dialog" aria-modal="true" aria-labelledby="tituloDetalle">
      <button type="button" class="cerrar-x" id="cerrarDetalle" aria-label="Cerrar">×</button>
      <div class="detalle-img" style="--glow:${glow(p)}">${botella(p, 260)}</div>
      <div>
        <span class="tag-tipo">${esc(p.tipo)}</span>
        <h2 id="tituloDetalle">${esc(p.nombre)}</h2>
        <p class="muted" style="margin:0">${esc(p.descripcion || '')}</p>
        <div class="ficha">
          <div><span>Cepa</span><strong>${esc(p.variedad || '—')}</strong></div>
          <div><span>Añada</span><strong>${esc(p.anada || 'Sin añada')}</strong></div>
          <div><span>Origen</span><strong>${esc(p.origen || '—')}</strong></div>
          <div><span>Alcohol</span><strong>${p.graduacion ? `${Number(p.graduacion).toFixed(1).replace('.', ',')}% vol.` : '—'}</strong></div>
        </div>
        ${p.maridaje.length ? `<div class="small muted">Ideal para</div><div class="maridajes">${p.maridaje.map((x) => `<span class="badge b-admin">${esc(x)}</span>`).join('')}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><span class="precio" style="font-size:1.9rem">${bs(p.precio)}</span>${disponibilidad(p.stock)}</div>
        ${max > 0 ? `<div class="comprar-fila">
            <div class="cantidad" aria-label="Cantidad"><button type="button" id="dMenos" aria-label="Menos">−</button><output id="dCant">1</output><button type="button" id="dMas" aria-label="Más">+</button></div>
            <button type="button" class="btn" id="dAgregar">${IC.carrito}Agregar al carrito</button></div>
          ${Carrito.cantidadDe(p.id) ? `<p class="small muted" style="margin:.6rem 0 0">Ya tiene ${Carrito.cantidadDe(p.id)} en su carrito.</p>` : ''}`
        : `<p class="small muted" style="margin-top:1rem">${p.stock > 0 ? 'Ya tiene en su carrito todas las unidades disponibles.' : 'Producto agotado por ahora. Vuelva pronto.'}</p>`}
      </div>
    </div></div>`;
  const cerrar = () => { m.innerHTML = ''; document.removeEventListener('keydown', tecla); };
  const tecla = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', tecla);
  $('#cerrarDetalle').onclick = cerrar;
  $('#fondoDetalle').onmousedown = (e) => { if (e.target.id === 'fondoDetalle') cerrar(); };
  if (max > 0) {
    const pintar = () => { $('#dCant').textContent = cant; $('#dMenos').disabled = cant <= 1; $('#dMas').disabled = cant >= max; };
    $('#dMenos').onclick = () => { cant--; pintar(); };
    $('#dMas').onclick = () => { cant++; pintar(); };
    $('#dAgregar').onclick = () => { agregar(p.id, cant); cerrar(); };
    pintar();
    $('#dAgregar').focus();
  } else $('#cerrarDetalle').focus();
}

// ---------- Carrito y reserva ----------
let paso = 'carrito';
let ultimoPedido = null;

function abrirCarrito(nuevoPaso = 'carrito') {
  paso = nuevoPaso;
  pintarCarrito();
  $('#cajon').classList.add('abierto'); $('#cajonFondo').classList.add('abierto');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#cerrarCarrito').focus(), 50);
}
function cerrarCarrito() {
  $('#cajon').classList.remove('abierto'); $('#cajonFondo').classList.remove('abierto');
  document.body.style.overflow = '';
  if (paso === 'listo') paso = 'carrito';
}

function pintarCarrito() {
  const idx = { carrito: 0, datos: 1, listo: 2 }[paso];
  $('#pasosCompra').querySelectorAll('span').forEach((s, k) => s.classList.toggle('activo', k <= idx));
  const cuerpo = $('#cajonCuerpo'); const pie = $('#cajonPie');

  if (paso === 'listo') {
    const r = ultimoPedido;
    cuerpo.innerHTML = `<div class="exito"><div class="check">${IC.check}</div>
      <h2 style="margin:0">¡Pedido reservado!</h2>
      <p class="muted">Gracias, ${esc(r.nombre)}. Apartamos sus botellas.</p>
      <div class="codigo-pedido">${esc(r.codigo)}</div>
      <p class="small muted">Guarde este código. Preséntelo en caja junto con su celular <strong>${esc(r.telefono)}</strong> para pagar <strong>${bs(r.total)}</strong> y retirar su pedido.</p></div>`;
    pie.innerHTML = `<div style="display:grid;gap:.5rem"><a class="btn bloque" href="#seguimiento" id="irSeguir">Ver estado del pedido</a>
      <button type="button" class="btn sec bloque" id="seguirComprando">Seguir comprando</button></div>`;
    $('#irSeguir').onclick = () => { cerrarCarrito(); consultarPedido(r.codigo, r.telefono); };
    $('#seguirComprando').onclick = cerrarCarrito;
    return;
  }

  if (!Carrito.items.length) {
    cuerpo.innerHTML = `<div class="carrito-vacio">${IC.carrito}<p>Su carrito está vacío.</p><p class="small">Explore el catálogo y agregue sus botellas favoritas.</p></div>`;
    pie.innerHTML = '<button type="button" class="btn sec bloque" id="irCatalogo">Ver catálogo</button>';
    $('#irCatalogo').onclick = () => { cerrarCarrito(); location.hash = '#catalogo'; };
    return;
  }

  if (paso === 'carrito') {
    cuerpo.innerHTML = Carrito.items.map((i) => {
      const p = porId(i.id);
      return `<div class="item" data-id="${p.id}">
        <div class="item-img" style="--glow:${glow(p)}">${botella(p, 70)}</div>
        <div><h4>${esc(p.nombre)}</h4><div class="small">${bs(p.precio)} c/u</div>
          <div class="cantidad chica" style="margin-top:.4rem"><button type="button" data-menos="${p.id}" aria-label="Menos" ${i.cantidad <= 1 ? 'disabled' : ''}>−</button><output>${i.cantidad}</output><button type="button" data-mas="${p.id}" aria-label="Más" ${i.cantidad >= Math.min(p.stock, 24) ? 'disabled' : ''}>+</button></div></div>
        <div class="item-der"><strong>${bs(p.precio * i.cantidad)}</strong><button type="button" class="quitar" data-quitar="${p.id}">Quitar</button></div>
      </div>`;
    }).join('');
    pie.innerHTML = `<div class="total-fila"><span class="muted">Total (${Carrito.unidades} ${Carrito.unidades === 1 ? 'unidad' : 'unidades'})</span><strong>${bs(Carrito.total)}</strong></div>
      <button type="button" class="btn bloque grande" id="continuar">Continuar con la reserva</button>
      <p class="small muted" style="text-align:center;margin:.6rem 0 0">No se cobra nada en línea. Paga al retirar.</p>`;
    $('#continuar').onclick = () => { paso = 'datos'; pintarCarrito(); };
    return;
  }

  // paso === 'datos'
  const guardado = (() => { try { return JSON.parse(localStorage.getItem('aranjuez_cliente')) || {}; } catch { return {}; } })();
  cuerpo.innerHTML = `<div class="resumen-mini">${Carrito.items.map((i) => { const p = porId(i.id); return `${i.cantidad} × ${esc(p.nombre)}`; }).join('<br>')}
      <div style="margin-top:.5rem"><strong>Total: ${bs(Carrito.total)}</strong></div></div>
    <form id="fPedido" novalidate>
      <div class="campo"><label class="req" for="pNombre">Nombre completo</label><input id="pNombre" name="cliente_nombre" autocomplete="name" value="${esc(guardado.cliente_nombre || '')}"><div class="msg"></div></div>
      <div class="campo"><label class="req" for="pTel">Celular</label><input id="pTel" name="cliente_telefono" inputmode="numeric" maxlength="8" autocomplete="tel" placeholder="71234567" value="${esc(guardado.cliente_telefono || '')}"><div class="msg"></div></div>
      <div class="campo"><label for="pCi">CI o NIT <span class="small muted">(para su nota de venta)</span></label><input id="pCi" name="cliente_ci_nit" inputmode="numeric" value="${esc(guardado.cliente_ci_nit || '')}"><div class="msg"></div></div>
      <div class="campo"><label for="pCorreo">Correo <span class="small muted">(opcional)</span></label><input id="pCorreo" name="cliente_correo" type="email" autocomplete="email" value="${esc(guardado.cliente_correo || '')}"><div class="msg"></div></div>
      <div class="campo"><label for="pNota">Nota para la tienda <span class="small muted">(opcional)</span></label><textarea id="pNota" name="nota" rows="2" maxlength="255" placeholder="Ej. paso a recoger el sábado por la mañana"></textarea></div>
      <label style="display:flex;gap:.5rem;align-items:flex-start;font-size:.84rem"><input type="checkbox" name="mayor" style="width:auto;margin-top:.2rem"> Declaro ser mayor de 18 años.</label>
      <div class="msg" id="msgMayor" style="color:var(--error);font-size:.8rem"></div>
    </form>`;
  pie.innerHTML = `<div style="display:grid;grid-template-columns:auto 1fr;gap:.5rem"><button type="button" class="btn sec" id="volver">← Volver</button>
    <button type="submit" form="fPedido" class="btn" id="confirmar" style="justify-content:center">Confirmar reserva · ${bs(Carrito.total)}</button></div>`;
  $('#volver').onclick = () => { paso = 'carrito'; pintarCarrito(); };
  $('#fPedido').onsubmit = enviarPedido;
  setTimeout(() => $('#pNombre').focus(), 50);
}

async function enviarPedido(e) {
  e.preventDefault();
  const f = e.target; const d = datosForm(f); const er = {};
  d.cliente_nombre = d.cliente_nombre.trim(); d.cliente_telefono = d.cliente_telefono.trim(); d.cliente_ci_nit = d.cliente_ci_nit.trim(); d.cliente_correo = d.cliente_correo.trim();
  if (!d.cliente_nombre) er.cliente_nombre = 'Ingrese su nombre';
  else if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]{3,100}$/.test(d.cliente_nombre)) er.cliente_nombre = 'Solo letras y espacios';
  if (!/^[67][0-9]{7}$/.test(d.cliente_telefono)) er.cliente_telefono = 'Celular de 8 dígitos que empiece en 6 o 7';
  if (d.cliente_ci_nit && !/^[0-9]{5,13}(-[0-9A-Za-z]{1,2})?$/.test(d.cliente_ci_nit)) er.cliente_ci_nit = 'Solo números (5 a 13 dígitos)';
  if (d.cliente_correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.cliente_correo)) er.cliente_correo = 'Formato de correo inválido';
  mostrarErrores(f, er);
  $('#msgMayor').textContent = d.mayor ? '' : 'Debe confirmar que es mayor de edad';
  if (Object.keys(er).length || !d.mayor) return;

  const btn = $('#confirmar'); btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const { mayor, ...datos } = d;
    const r = await api('POST', '/pedidos', { ...datos, items: Carrito.items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })) });
    try { localStorage.setItem('aranjuez_cliente', JSON.stringify({ cliente_nombre: d.cliente_nombre, cliente_telefono: d.cliente_telefono, cliente_ci_nit: d.cliente_ci_nit, cliente_correo: d.cliente_correo })); } catch { /* sin almacenamiento */ }
    ultimoPedido = { codigo: r.codigo, total: r.total, telefono: d.cliente_telefono, nombre: d.cliente_nombre.split(' ')[0] };
    Carrito.vaciar();
    paso = 'listo'; pintarCarrito();
    $('#sCodigo').value = r.codigo; $('#sTel').value = d.cliente_telefono;
    await cargarCatalogo(); // el stock cambió
  } catch (err) {
    btn.disabled = false; btn.textContent = `Confirmar reserva · ${bs(Carrito.total)}`;
    if (err.status === 409) {
      // Alguien compró antes: refrescamos stock y volvemos al carrito
      toast(err.message, 'error');
      await cargarCatalogo();
      paso = 'carrito'; pintarCarrito();
    } else { mostrarErrores(f, err.campos); toast(err.message, 'error'); }
  }
}

// ---------- Seguimiento ----------
async function consultarPedido(codigo, telefono) {
  const res = $('#resSeguir');
  res.innerHTML = '<div class="estado-pedido"><p class="muted" style="margin:0">Buscando…</p></div>';
  try {
    const p = await api('GET', `/pedidos/seguimiento?${new URLSearchParams({ codigo, telefono })}`);
    const pasos = [
      { t: 'Pedido recibido', s: fechaHora(p.fecha), hecho: true },
      { t: 'Listo para retirar', s: p.estado === 'PENDIENTE' ? 'Pase por caja con su código' : '', hecho: p.estado !== 'CANCELADO' },
      p.estado === 'CANCELADO'
        ? { t: 'Cancelado', s: `${fechaHora(p.fecha_atencion)}${p.motivo_cancelacion ? ` · ${esc(p.motivo_cancelacion)}` : ''}`, cancelado: true }
        : { t: 'Entregado y pagado', s: p.estado === 'ENTREGADO' ? `${fechaHora(p.fecha_atencion)} · Nota ${esc(p.nro_nota)}` : 'Pendiente', hecho: p.estado === 'ENTREGADO' },
    ];
    const estadoBadge = { PENDIENTE: 'b-aviso', ENTREGADO: 'b-ok', CANCELADO: 'b-error' }[p.estado];
    res.innerHTML = `<div class="estado-pedido">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><h3>${esc(p.codigo)}</h3><span class="badge ${estadoBadge}">${esc(p.estado.charAt(0) + p.estado.slice(1).toLowerCase())}</span></div>
      <p class="small muted" style="margin:0">A nombre de ${esc(p.cliente_nombre)}</p>
      <ol class="linea-tiempo">${pasos.map((x) => `<li class="${x.hecho ? 'hecho' : ''} ${x.cancelado ? 'cancelado' : ''}">${x.t}<small>${x.s}</small></li>`).join('')}</ol>
      <ul class="mini-lista">${p.detalle.map((d) => `<li><span>${d.cantidad} × ${esc(d.nombre)}</span><span>${bs(d.subtotal)}</span></li>`).join('')}
        <li><strong>Total</strong><strong>${bs(p.total)}</strong></li></ul></div>`;
  } catch (err) {
    res.innerHTML = `<div class="alerta error" style="margin:0">${esc(err.message)}</div>`;
  }
}

// ---------- Carga y eventos ----------
async function cargarCatalogo() {
  PRODUCTOS = await api('GET', '/catalogo');
  if (Carrito.sanear()) toast('Actualizamos su carrito según el stock disponible', 'aviso');
  pintarFranja(); pintarEstante(); pintarLineas(); pintarDestacados(); pintarOcasiones(); pintarChips(); pintarGrid();
  pintarVitrina(vIdx, false);
  pintarContador();
}

document.addEventListener('click', (e) => {
  const ag = e.target.closest('[data-agregar]');
  if (ag) { e.stopPropagation(); return agregar(Number(ag.dataset.agregar), 1, ag); }
  const det = e.target.closest('[data-detalle]');
  if (det) return abrirDetalle(porId(det.dataset.detalle));
  const oc = e.target.closest('[data-ocasion]');
  if (oc) {
    filtroOcasion = oc.dataset.ocasion; filtroTipo = 'Todos'; filtroLinea = 'Todas'; pintarLineas(); $('#buscar').value = '';
    pintarChips(); pintarGrid();
    return $('#catalogo').scrollIntoView();
  }
  if (e.target.id === 'quitarOcasion') { filtroOcasion = null; pintarGrid(); }
  const v = e.target.closest('[data-v]');
  if (v) { pintarVitrina(Number(v.dataset.v)); rotarVitrina(); }
});
$('#lineas').addEventListener('click', (e) => {
  const ln = e.target.closest('[data-linea]'); if (!ln) return;
  filtroLinea = ln.dataset.linea; pintarLineas(); pintarGrid();
});
$('#chips').addEventListener('click', (e) => {
  const c = e.target.closest('[data-tipo]'); if (!c) return;
  filtroTipo = c.dataset.tipo; pintarChips(); pintarGrid();
});
let tBuscar;
$('#buscar').addEventListener('input', () => { clearTimeout(tBuscar); tBuscar = setTimeout(pintarGrid, 150); });
$('#orden').addEventListener('change', pintarGrid);

$('#abrirCarrito').onclick = () => abrirCarrito();
$('#cerrarCarrito').onclick = cerrarCarrito;
$('#cajonFondo').onclick = cerrarCarrito;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#cajon').classList.contains('abierto')) cerrarCarrito(); });
$('#cajonCuerpo').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.mas) Carrito.poner(Number(b.dataset.mas), Carrito.cantidadDe(Number(b.dataset.mas)) + 1);
  if (b.dataset.menos) Carrito.poner(Number(b.dataset.menos), Carrito.cantidadDe(Number(b.dataset.menos)) - 1);
  if (b.dataset.quitar) Carrito.poner(Number(b.dataset.quitar), 0);
  if (b.dataset.mas || b.dataset.menos || b.dataset.quitar) pintarCarrito();
});

$('#fSeguir').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target; const d = datosForm(f); const er = {};
  d.codigo = d.codigo.trim().toUpperCase(); d.telefono = d.telefono.trim();
  if (/^\d{1,6}$/.test(d.codigo)) d.codigo = `PW-${d.codigo.padStart(6, '0')}`; // acepta solo el número
  if (!/^PW-\d{6}$/.test(d.codigo)) er.codigo = 'Formato PW-000000';
  if (!/^[67][0-9]{7}$/.test(d.telefono)) er.telefono = 'Celular de 8 dígitos';
  mostrarErrores(f, er); if (Object.keys(er).length) return;
  f.codigo.value = d.codigo;
  consultarPedido(d.codigo, d.telefono);
};

// Arranque
$('#logo').innerHTML = ICONOS.logo + 'Bodegas Aranjuez';
$('#logoPie').innerHTML = ICONOS.logo + 'Bodegas Aranjuez';
$('#icoCarrito').outerHTML = IC.carrito;
if (Sesion.token) { const b = $('#btnAcceso'); b.href = 'app.html'; b.textContent = 'Volver al sistema'; }
pintarBeneficios();
Carrito.cargar();
pintarContador();
cargarCatalogo().then(() => { pintarVitrina(0, false); rotarVitrina(); }).catch((err) => {
  $('#grid').innerHTML = `<div class="alerta error" style="grid-column:1/-1">No pudimos cargar el catálogo. ${esc(err.message)}</div>`;
  $('#vInfo').innerHTML = '<p class="muted">Catálogo no disponible por el momento.</p>';
});
