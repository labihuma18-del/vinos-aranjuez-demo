# Bodegas Aranjuez — Mockup

Tienda en línea y sistema interno de **Bodegas Aranjuez**, listos para usar desde el navegador **sin instalar nada**.
Es una **maqueta funcional** para revisarlo online y organizar funcionamiento. 
## Páginas

| Archivo | Qué es | Quién la usa |
|---|---|---|
| `index.html` | Tienda: estante de botellas, catálogo, carrito, reserva y seguimiento | Clientes (pública) |
| `login.html` | Inicio de sesión | Personal |
| `app.html` | Sistema con menú según el rol | Personal |
| `kiosco.html` | Marcado de asistencia con CI y PIN | Trabajadores |

**Usuarios de prueba** (contraseña `Vino2026*`): `admin`, `cajero1`, `cajero2`, `almacen1`, `empleado1`, `empleado2` (desactivado).
**Pedido de prueba:** `PW-000001`, celular `76543210`.

## Notas
- Los datos viven en el navegador (localStorage). En el login, **Restablecer datos de prueba** vuelve al estado inicial.
- Para conectar estas mismas pantallas a MySQL se quitan las líneas `bcrypt.min.js` y `js/mock.js` de los HTML en el archivo local
