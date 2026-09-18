/* Funciones compartidas por todas las páginas.
   El carrito guarda SOLO id, talle y cantidad. Nombre y precio se piden siempre al servidor. */

const CLAVE_CARRITO = "carrito";

function obtenerCarrito() {
  try {
    const carrito = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
    return Array.isArray(carrito) ? carrito.filter(item => typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

function guardarCarrito(carrito) {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
}

function vaciarCarrito() {
  localStorage.removeItem(CLAVE_CARRITO);
}

function unidadesEnCarrito(id) {
  return obtenerCarrito()
    .filter(item => item.id === id)
    .reduce((total, item) => total + item.cantidad, 0);
}

function agregarAlCarrito(id, talle) {
  const carrito = obtenerCarrito();
  const item = carrito.find(i => i.id === id && i.talle === talle);

  if (item) {
    item.cantidad++;
  } else {
    carrito.push({ id, talle, cantidad: 1 });
  }
  guardarCarrito(carrito);
}

function quitarDelCarrito(id, talle) {
  guardarCarrito(obtenerCarrito().filter(i => !(i.id === id && i.talle === talle)));
}

async function cargarProductos() {
  const respuesta = await fetch("/api/productos");
  if (!respuesta.ok) throw new Error("No se pudo cargar el catálogo");
  return respuesta.json();
}

// Une cada item del carrito con los datos reales del producto (precio, imagen, etc.)
// y descarta los que ya no existen en el catálogo.
function detalleDelCarrito(productos) {
  return obtenerCarrito()
    .map(item => ({ ...item, producto: productos.find(p => p.id === item.id) }))
    .filter(item => item.producto);
}

function calcularTotal(detalle) {
  return detalle.reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
}

function formatearPrecio(numero) {
  return "$" + numero.toLocaleString("es-AR");
}

// Evita que un texto se interprete como HTML al armar plantillas con innerHTML
function escapar(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
