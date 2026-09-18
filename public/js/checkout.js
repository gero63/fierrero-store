/* Página de finalizar compra: envía el pedido al servidor y redirige al pago. */

const formulario = document.getElementById("formulario-pedido");
const botonPagar = document.getElementById("pagar");
const mensajeError = document.getElementById("error");
const resumen = document.getElementById("resumen");
const totalElemento = document.getElementById("total");

function mostrarError(texto) {
  mensajeError.textContent = texto;
  mensajeError.hidden = false;
}

function dibujarResumen(productos) {
  const detalle = detalleDelCarrito(productos);

  resumen.innerHTML = detalle.map(item => `
    <div class="linea-resumen">
      <span>${escapar(item.producto.nombre)} (${escapar(item.talle)}) x ${item.cantidad}</span>
      <span>${formatearPrecio(item.producto.precio * item.cantidad)}</span>
    </div>`).join("");
  totalElemento.textContent = formatearPrecio(calcularTotal(detalle));

  if (detalle.length === 0) {
    mostrarError("Tu carrito está vacío. Volvé a la tienda para agregar productos.");
    botonPagar.disabled = true;
  }
}

async function enviarPedido(e) {
  e.preventDefault();
  mensajeError.hidden = true;
  botonPagar.disabled = true;
  botonPagar.textContent = "Procesando...";

  // Se abre YA (dentro del clic) para que el navegador no bloquee la ventana de WhatsApp
  const ventanaWhatsapp = window.open("", "_blank");

  const datos = new FormData(formulario);
  const pedido = {
    cliente: Object.fromEntries(datos),
    items: obtenerCarrito(),
  };

  try {
    const respuesta = await fetch("/api/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedido),
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.error);

    if (ventanaWhatsapp) ventanaWhatsapp.location = resultado.whatsappUrl;
    vaciarCarrito();
    window.location.href = resultado.pagoUrl;
  } catch (error) {
    if (ventanaWhatsapp) ventanaWhatsapp.close();
    mostrarError(error.message || "No pudimos enviar tu pedido. Probá de nuevo.");
    botonPagar.disabled = false;
    botonPagar.textContent = "Pagar con Mercado Pago";
  }
}

// Si el cliente está logueado se completan sus datos; si no, se le ofrece ingresar (comprar como invitado sigue siendo posible)
async function prepararSesion() {
  const { googleDisponible, cliente, ultimoPedido } = await obtenerSesion();
  const aviso = document.getElementById("aviso-sesion");
  const texto = document.getElementById("texto-sesion");
  const enlace = document.getElementById("enlace-sesion");

  if (cliente) {
    texto.textContent = `Comprando como ${cliente.nombre} (${cliente.email}).`;
    enlace.hidden = true;
    aviso.hidden = false;

    const datos = { nombre: cliente.nombre, email: cliente.email, ...ultimoPedido };
    for (const [campo, valor] of Object.entries(datos)) {
      const input = formulario.elements[campo];
      if (input && !input.value) input.value = valor;
    }
  } else if (googleDisponible) {
    texto.textContent = "¿Tenés cuenta? Ingresá para completar tus datos y ver tus pedidos.";
    aviso.hidden = false;
  }
}

formulario.addEventListener("submit", enviarPedido);
prepararSesion();

cargarProductos()
  .then(dibujarResumen)
  .catch(() => mostrarError("No pudimos cargar tu carrito. Probá recargar la página."));
