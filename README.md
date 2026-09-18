# Fierrero Store

Tienda online de remeras, crop tops y accesorios. Frontend en HTML/CSS/JS puro y backend en Node + Express con base de datos SQLite.

## Cómo correrlo

Requiere [Node.js](https://nodejs.org) **22.13 o superior** (trae SQLite incluido).

```bash
npm install
npm start
```

Abrir http://localhost:3000. Funciona sin configurar nada; para activar el login con Google y los pagos automáticos, copiar `.env.example` a `.env` y completarlo (ver "Configuración").

## Estructura

```
server.js            Arranque de la app y configuración de Express
config.js            Variables de entorno en un solo lugar
db.js                Base de datos SQLite: tablas y consultas de productos
auth.js              Login con Google (OAuth) y sesión
pedidos.js           Validación y registro de pedidos, webhook de Mercado Pago
pagos.js             Comunicación con la API de Mercado Pago
scripts/stock.js     Reponer stock:  npm run stock -- remera1 25
data/productos.json  Catálogo (nombre, precio, talles, stock inicial)
data/tienda.db       Base de datos (se crea sola, no se sube a git)
public/              Todo lo que ve el navegador (HTML, css/, js/, img/)
```

## Base de datos

Cuatro tablas: `productos`, `clientes`, `pedidos` (con `cliente_id` vacío cuando se compra como invitado) y `pedido_items`. El pedido guarda nombre y precio del momento de la compra, así que cambiar el catálogo no altera pedidos viejos.

- **Cambiar precios, nombres o agregar productos:** editar `data/productos.json` y reiniciar el servidor. Un producto que se quita del JSON deja de mostrarse (pero sus pedidos viejos se conservan).
- **Stock:** el valor del JSON se usa solo cuando el producto es nuevo; después el stock vive en la base y baja con cada compra. Para reponer: `npm run stock -- <id> <cantidad>`.
- El stock se descuenta dentro de una transacción con `UPDATE ... WHERE stock >= cantidad`, así dos compras simultáneas de la última unidad no pueden vender de más.

## Flujo de compra

1. El carrito (en el navegador) guarda solo `id`, `talle` y `cantidad`.
2. `POST /api/pedidos`: el servidor valida los datos, calcula el total con los precios de la base, descuenta el stock y guarda el pedido como `pendiente`.
3. Se crea el pago en Mercado Pago por el monto exacto, se abre WhatsApp con el resumen y se redirige a pagar.
4. Mercado Pago avisa al **webhook** (`/api/mp/webhook`). El servidor le pregunta a Mercado Pago el estado real del pago (no confía en el aviso), comprueba que el monto coincida con el pedido y lo pasa a `pagado`.
5. Los pedidos que nadie paga en 24 horas se cancelan y devuelven su stock. Si un pedido vencido se paga igual, el webhook lo vuelve a `pagado`.

Comprar como invitado siempre está permitido. Con sesión iniciada el pedido queda asociado al cliente, se completan sus datos en el checkout y puede ver su historial en "Mi cuenta".

## Configuración (`.env`)

Todo es opcional. Cada variable está explicada en `.env.example`.

| Para activar | Variables | Detalle |
|---|---|---|
| Login con Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crear un "ID de cliente de OAuth" (aplicación web) y cargar como URI de redirección `<BASE_URL>/auth/google/callback` (en local: `http://localhost:3000/auth/google/callback`) |
| Pagos con confirmación automática | `MP_ACCESS_TOKEN` y `BASE_URL` pública | Mercado Pago necesita una dirección accesible desde internet para llamar al webhook. Para probar en local se puede usar un túnel (por ejemplo ngrok) y poner esa dirección en `BASE_URL` |
| Sesiones estables | `SESSION_SECRET` | Texto largo y aleatorio. Sin él, todos deben volver a loguearse cada vez que se reinicia el servidor |

## Qué mejoró respecto a la versión original

| Antes | Ahora |
|---|---|
| Catálogo copiado a mano en `index.html` (39 bloques) | Catálogo en la base de datos; el navegador dibuja las tarjetas |
| Sin control de stock | Stock por producto, validado y descontado de forma atómica |
| El precio se leía del HTML y se podía falsear desde DevTools | El carrito guarda solo `id`, `talle` y `cantidad`; el servidor calcula el total |
| El pedido solo se mandaba por WhatsApp | Pedidos guardados en la base con estado (`pendiente`, `pagado`, `cancelado`) |
| Pago con un link fijo sin relación con el total | Pago por el monto exacto y confirmación automática por webhook |
| Sin cuentas: el carrito se perdía y no había historial | Login opcional con Google, datos precargados e historial de pedidos |
| CSS embebido y duplicado, JS inline | Un solo `estilos.css` y un `.js` por página |
| Validación solo con `required` | Validación en el navegador y, obligatoria, en el servidor |
| Imágenes sin `alt`, sin meta description, filtros con `javascript:void(0)` | `alt`, `meta description`, `<label for>`, filtros como `<button>`, `loading="lazy"` |

## Limitaciones conocidas

- **Sin `MP_ACCESS_TOKEN`** se usa el link fijo de Mercado Pago, que no queda atado al total del pedido ni se confirma solo: los pedidos quedan `pendientes` y hay que revisarlos a mano. En ese modo tampoco se cancelan automáticamente los pedidos viejos.
- El código del pago con Mercado Pago (preferencia y webhook) está probado contra un simulador, pero no contra la API real: conviene hacer una compra de prueba con credenciales de prueba antes de usarlo.
- Un pago rechazado no cancela el pedido (Mercado Pago permite reintentar); se cancela solo al pasar las 24 horas.
- No hay panel de administración: los pedidos se consultan directamente en `data/tienda.db` (por ejemplo con [DB Browser for SQLite](https://sqlitebrowser.org)).
- Las imágenes siguen en JPG sin comprimir; convertirlas a WebP reduciría el peso de la página.
