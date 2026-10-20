# Bodegas Aranjuez — Sistema de control

Proyecto académico de tienda en línea y sistema interno de gestión para Bodegas Aranjuez.

El sistema original funciona en un entorno local por el momento. Para facilitar su presentación y permitir que cualquier integrante del grupo pueda acceder sin instalar el proyecto, se desarrolló una maqueta virtual de demostración, compatible con GitHub Pages.

La maqueta utiliza `js/mock.js` para simular las operaciones del servidor y permitir la navegación por las principales funcionalidades.

## Páginas

| Archivo | Descripción |
|---|---|
| `index.html` | Tienda, catálogo, carrito, reservas y seguimiento de pedidos. |
| `login.html` | Inicio de sesión del personal. |
| `app.html` | Sistema interno con menú según el rol. |
| `kiosco.html` | Marcado de asistencia. |
| `guia.html` | Guía de uso, usuarios de prueba y guion de exposición. |

## Datos de prueba

- **Contraseña:** `Vino2026*`
- **Usuarios:** `admin`, `cajero1`, `cajero2`, `almacen1`, `empleado1` y `empleado2` (desactivado).
- **Pedido:** `PW-000001`
- **Celular:** `76543210`

## Nota

Esta versión es una maqueta para exposición académica. El sistema original y su integración con SQL se mantienen en el entorno local; las operaciones de la versión publicada se simulan mediante `js/mock.js`.

**Para conectar las pantallas al backend real, eliminar las referencias a `js/mock.js` y `bcrypt.min.js` de los HTML únicamente después de adaptar y verificar la integración con el backend y la autenticación correspondientes.**
