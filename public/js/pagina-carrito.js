/* Página del carrito: muestra los productos elegidos con sus precios reales. */

const lista = document.getElementById("lista-carrito");
const resumen = document.getElementById("resumen-carrito");
const totalElemento = document.getElementById("total");

let productos = [];

function dibujarCarritoVacio() {
  lista.innerHTML = `
    <div class="carrito-vacio">
      <div class="carrito-vacio-icono">🛒</div>
      <h2>Tu carrito está vacío</h2>
      <p>Todavía no agregaste ningún producto.</p>
      <a href="index.html" class="btn">Ver productos</a>
    </div>`;
  resumen.hidden = true;
}

function dibujarCarrito() {
  const detalle = detalleDelCarrito(productos);

  if (detalle.length === 0) {
    dibujarCarritoVacio();
    return;
  }

  lista.innerHTML = detalle.map(item => {
    const p = item.producto;
    const aviso = item.cantidad > p.stock
      ? `<p class="aviso">Solo quedan ${p.stock} unidades de este producto.</p>`
      : "";
    return `
      <div class="item">
        <img src="${p.imagen}" alt="${escapar(p.nombre)}">
        <div>
          <strong>${escapar(p.nombre)}</strong>
          <p>Talle: ${escapar(item.talle)}</p>
          <p>${formatearPrecio(p.precio)} x ${item.cantidad}</p>
          ${aviso}
          <button class="btn-eliminar" data-id="${p.id}" data-talle="${escapar(item.talle)}">Eliminar</button>
        </div>
        <div class="price">${formatearPrecio(p.precio * item.cantidad)}</div>
      </div>`;
  }).join("");

  totalElemento.textContent = formatearPrecio(calcularTotal(detalle));
  resumen.hidden = false;
}

lista.addEventListener("click", (e) => {
  const boton = e.target.closest(".btn-eliminar");
  if (!boton) return;

  quitarDelCarrito(boton.dataset.id, boton.dataset.talle);
  dibujarCarrito();
});

cargarProductos()
  .then(datos => {
    productos = datos;
    dibujarCarrito();
  })
  .catch(() => {
    lista.innerHTML = `<p class="vacio">No pudimos cargar tu carrito. Probá recargar la página.</p>`;
  });
