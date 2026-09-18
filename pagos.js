const { BASE_URL, BASE_URL_CONFIGURADA, MP_ACCESS_TOKEN, MP_LINK_FIJO } = require("./config");

async function pedirAMercadoPago(ruta, opciones = {}) {
  const respuesta = await fetch(`https://api.mercadopago.com${ruta}`, {
    ...opciones,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!respuesta.ok) throw new Error(`Mercado Pago respondió ${respuesta.status} en ${ruta}`);
  return respuesta.json();
}

// Con MP_ACCESS_TOKEN se crea un pago por el monto exacto del pedido.
// Sin token se usa el link fijo (el monto NO queda atado al pedido y no hay confirmación automática).
async function obtenerUrlDePago(pedido) {
  if (!MP_ACCESS_TOKEN) return MP_LINK_FIJO;

  const preferencia = {
    items: pedido.items.map(i => ({
      title: `${i.nombre} (${i.talle})`,
      quantity: i.cantidad,
      unit_price: i.precioUnitario,
      currency_id: "ARS",
    })),
    external_reference: pedido.id,
  };

  // Mercado Pago necesita direcciones públicas: solo se envían si BASE_URL está configurada
  if (BASE_URL_CONFIGURADA) {
    const volver = `${BASE_URL}/gracias.html?pedido=${pedido.id}`;
    preferencia.notification_url = `${BASE_URL}/api/mp/webhook`;
    preferencia.back_urls = { success: volver, pending: volver, failure: volver };
    preferencia.auto_return = "approved";
  }

  const datos = await pedirAMercadoPago("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(preferencia),
  });
  return datos.init_point;
}

// La notificación del webhook solo avisa "hay novedades del pago X".
// El estado real se le pregunta a Mercado Pago con nuestro token, así nadie puede falsearlo.
function obtenerPago(idPago) {
  return pedirAMercadoPago(`/v1/payments/${encodeURIComponent(idPago)}`);
}

module.exports = { obtenerUrlDePago, obtenerPago };
