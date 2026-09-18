/* Estado de la sesión (quién está logueado). Requiere cart.js para escapar textos. */

let sesionPendiente = null;

// Se pide una sola vez por página: { googleDisponible, cliente, ultimoPedido }
function obtenerSesion() {
  if (!sesionPendiente) {
    sesionPendiente = fetch("/api/me")
      .then(respuesta => respuesta.json())
      .catch(() => ({ googleDisponible: false, cliente: null, ultimoPedido: null }));
  }
  return sesionPendiente;
}

async function cerrarSesion() {
  await fetch("/auth/logout", { method: "POST" });
}

function primerNombre(nombreCompleto) {
  return nombreCompleto.split(" ")[0];
}

// Muestra "Ingresar" o "Hola, Nombre" en el menú de la tienda
async function dibujarEnlaceCuenta() {
  const enlace = document.getElementById("enlace-cuenta");
  if (!enlace) return;

  const { googleDisponible, cliente } = await obtenerSesion();
  if (cliente) {
    enlace.textContent = `Hola, ${primerNombre(cliente.nombre)}`;
    enlace.href = "cuenta.html";
    enlace.hidden = false;
  } else if (googleDisponible) {
    enlace.textContent = "Ingresar";
    enlace.href = "/auth/google?volver=/";
    enlace.hidden = false;
  }
}
