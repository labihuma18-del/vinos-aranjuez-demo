# Bodegas Aranjuez — Versión en línea (GitHub Pages)

Tienda en línea y sistema interno de **Bodegas Aranjuez**, listos para usar desde el navegador **sin instalar nada**.
Es una **maqueta funcional**: el servidor se simula con `js/mock.js` (mismas reglas que el backend real: bcrypt, roles y permisos, 403, bloqueo por intentos, reserva de stock, cobro en caja, kardex de almacén, roles creados por el administrador, ubicación al marcar asistencia y auditoría con avisos) y los datos se guardan en el navegador de quien lo abre. La integracion con sql por ahora es local. 

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

* Los datos viven en el navegador (localStorage). En el login, **Restablecer datos de prueba** vuelve al estado inicial.
* Si el navegador bloquea el almacenamiento (ventana privada), la demo funciona igual mientras no se recargue la página.
* **Ubicación:** GitHub Pages usa HTTPS, así que el navegador pide permiso de ubicación al marcar asistencia. La sede de demostración es la Facultad de Ciencias y Tecnología de la USFX (radio fijo de 50 m); el administrador la cambia en **Sede y ubicación**.
* Para conectar estas mismas pantallas a MySQL se quitan las líneas `bcrypt.min.js` y `js/mock.js` de los HTML.

