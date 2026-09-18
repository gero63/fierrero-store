/* Página a la que vuelve Mercado Pago. El aviso del pago puede tardar unos segundos en llegar al servidor. */

const titulo = document.getElementById("titulo");
const detalle = document.getElementById("detalle");

const idPedido = new URLSearchParams(window.location.search).get("pedido");
const INTENTOS_MAXIMOS = 10;

async function consultarEstado(intento) {
  const respuesta = await fetch(`/api/pedidos/${encodeURIComponent(idPedido)}/estado`);
  if (!respuesta.ok) throw new Error("Pedido no encontrado");
  const pedido = await respuesta.json();

  if (pedido.estado === "pagado") {
    titulo.textContent = "¡Pago confirmado!";
    detalle.textContent = `Recibimos tu pago del pedido #${pedido.numero}. Te vamos a contactar para coordinar el envío.`;
  } else if (pedido.estado === "cancelado") {
    titulo.textContent = "Pedido cancelado";
    detalle.textContent = `El pedido #${pedido.numero} fue cancelado. Podés volver a hacerlo desde la tienda.`;
  } else if (intento < INTENTOS_MAXIMOS) {
    titulo.textContent = "Esperando la confirmación del pago...";
    detalle.textContent = `Pedido #${pedido.numero}. Puede demorar unos segundos.`;
    setTimeout(() => consultarEstado(intento + 1).catch(mostrarError), 3000);
  } else {
    titulo.textContent = "Tu pago todavía no se confirmó";
    detalle.textContent = `El pedido #${pedido.numero} sigue pendiente. Si ya pagaste, se va a actualizar en breve y lo vas a ver en "Mis pedidos".`;
  }
}

function mostrarError() {
  titulo.textContent = "No encontramos tu pedido";
  detalle.textContent = "Revisá el enlace o volvé a la tienda.";
}

if (idPedido) {
  consultarEstado(1).catch(mostrarError);
} else {
  mostrarError();
}
