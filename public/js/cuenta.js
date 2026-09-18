/* Página "Mi cuenta": datos del cliente y su historial de pedidos. */

const contenido = document.getElementById("contenido");

const TEXTO_ESTADO = {
  pendiente: "Pendiente de pago",
  pagado: "Pagado",
  cancelado: "Cancelado",
};

function dibujarPedido(pedido) {
  const lineas = pedido.items.map(item => `
    <div class="linea-resumen">
      <span>${escapar(item.nombre)} (${escapar(item.talle)}) x ${item.cantidad}</span>
      <span>${formatearPrecio(item.precioUnitario * item.cantidad)}</span>
    </div>`).join("");

  return `
    <article class="pedido">
      <div class="pedido-cabecera">
        <strong>Pedido #${escapar(pedido.numero)}</strong>
        <span class="estado estado-${escapar(pedido.estado)}">${TEXTO_ESTADO[pedido.estado] || escapar(pedido.estado)}</span>
      </div>
      <p class="pedido-fecha">${new Date(pedido.fecha).toLocaleDateString("es-AR")}</p>
      ${lineas}
      <div class="linea-resumen pedido-total"><span>Total</span><span>${formatearPrecio(pedido.total)}</span></div>
    </article>`;
}

async function iniciar() {
  const { googleDisponible, cliente } = await obtenerSesion();

  if (!cliente) {
    contenido.innerHTML = googleDisponible
      ? `<p class="vacio">Ingresá con tu cuenta de Google para ver tus pedidos y comprar más rápido.</p>
         <a class="btn btn-grande btn-enlace" href="/auth/google?volver=/cuenta.html">Ingresar con Google</a>`
      : `<p class="vacio">El ingreso con cuenta no está disponible por el momento.</p>`;
    return;
  }

  const respuesta = await fetch("/api/mis-pedidos");
  const pedidos = respuesta.ok ? await respuesta.json() : [];

  contenido.innerHTML = `
    <div class="perfil">
      ${cliente.foto ? `<img src="${escapar(cliente.foto)}" alt="" referrerpolicy="no-referrer">` : ""}
      <div>
        <strong>${escapar(cliente.nombre)}</strong>
        <p>${escapar(cliente.email)}</p>
      </div>
      <button id="salir" class="btn-eliminar">Cerrar sesión</button>
    </div>
    <h2 class="subtitulo">Mis pedidos</h2>
    ${pedidos.length ? pedidos.map(dibujarPedido).join("") : `<p class="vacio">Todavía no hiciste ningún pedido.</p>`}`;

  document.getElementById("salir").addEventListener("click", async () => {
    await cerrarSesion();
    window.location.href = "index.html";
  });
}

iniciar().catch(() => {
  contenido.innerHTML = `<p class="vacio">No pudimos cargar tu cuenta. Probá recargar la página.</p>`;
});
