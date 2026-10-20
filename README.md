# Bodegas Aranjuez — Sistema de control

Tienda en línea y sistema interno de **Bodegas Aranjuez**, versión demo para previsualización de las funciones
El servidor se simula con `js/mock.js` La integracion con sql por ahora es local. 

## Páginas

|Archivo|Qué es|Quién la usa|
|-|-|-|
|`index.html`|Tienda: estante de botellas, catálogo, carrito, reserva y seguimiento|Clientes (pública)|
|`login.html`|Inicio de sesión|Personal|
|`app.html`|Sistema con menú según el rol|Personal|
|`kiosco.html`|Marcado de asistencia con CI, PIN y ubicación|Trabajadores|
|`guia.html`|Guía, usuarios de prueba y guion de 12 minutos|Docente y grupo|

**Usuarios de prueba** (contraseña `Vino2026\*`): `admin`, `cajero1`, `cajero2`, `almacen1`, `empleado1`, `empleado2` (desactivado).
**Pedido de prueba:** `PW-000001`, celular `76543210`.

## Notas

* Para conectar las pantallas a MySQL no olvidar quitar las líneas `bcrypt.min.js` y `js/mock.js` de los HTML.

