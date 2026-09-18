const express = require("express");
const crypto = require("crypto");
const { db, transaccion, obtenerProducto } = require("./db");
const { clienteDeSesion } = require("./auth");
const pagos = require("./pagos");
const { WHATSAPP_NUMERO, MP_ACCESS_TOKEN } = require("./config");

const router = express.Router();
const HORAS_PARA_PAGAR = 24;

/* ===== VALIDACIONES ===== */
function textoValido(valor, min, max) {
  const texto = typeof valor === "string" ? valor.trim() : "";
  return texto.length >= min && texto.length <= max ? texto : null;
}

function validarCliente(datos) {
  const cliente = {
    nombre: textoValido(datos.nombre, 3, 80),
    telefono: textoValido(datos.telefono, 8, 20),
    email: textoValido(datos.email, 5, 100),
    ciudad: textoValido(datos.ciudad, 2, 60),
    provincia: textoValido(datos.provincia, 2, 60),
    direccion: textoValido(datos.direccion, 3, 120),
  };

  if (!cliente.nombre) return { error: "Ingresá tu nombre y apellido." };
  if (!cliente.telefono || !/^[0-9+()\s-]+$/.test(cliente.telefono)) return { error: "Ingresá un teléfono válido." };
  if (!cliente.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) return { error: "Ingresá un email válido." };
  if (!cliente.ciudad) return { error: "Ingresá tu ciudad." };
  if (!cliente.provincia) return { error: "Ingresá tu provincia." };
  if (!cliente.direccion) return { error: "Ingresá tu dirección." };

  return { cliente };
}

// Arma los items del pedido con nombre y precio de la base de datos,
// nunca de lo que mande el navegador.
function validarItems(itemsRecibidos) {
  if (!Array.isArray(itemsRecibidos) || itemsRecibidos.length === 0 || itemsRecibidos.length > 50) {
    return { error: "Tu carrito está vacío." };
  }

  const items = [];
  const unidadesPorProducto = {};

  for (const recibido of itemsRecibidos) {
    const producto = typeof recibido?.id === "string" ? obtenerProducto(recibido.id) : null;
    if (!producto) return { error: "Uno de los productos del carrito ya no existe." };

    const tieneTalles = producto.talles.length > 0;
    const talle = tieneTalles ? recibido.talle : "Único";
    if (tieneTalles && !producto.talles.includes(talle)) {
      return { error: `Talle inválido para ${producto.nombre}.` };
    }

    const cantidad = recibido.cantidad;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
      return { error: `Cantidad inválida para ${producto.nombre}.` };
    }

    unidadesPorProducto[producto.id] = (unidadesPorProducto[producto.id] || 0) + cantidad;
    if (unidadesPorProducto[producto.id] > producto.stock) {
      return { error: `No hay stock suficiente de ${producto.nombre} (quedan ${producto.stock}).` };
    }

    items.push({ id: producto.id, nombre: producto.nombre, talle, cantidad, precioUnitario: producto.precio });
  }

  return { items };
}

/* ===== OPERACIONES SOBRE PEDIDOS ===== */
function calcularTotal(items) {
  return items.reduce((total, i) => total + i.precioUnitario * i.cantidad, 0);
}

// Valida y guarda el pedido descontando el stock, todo junto en una transacción:
// o se guarda todo o no se guarda nada.
function registrarPedido(cliente, itemsRecibidos, clienteId) {
  const validacion = validarItems(itemsRecibidos);
  if (validacion.error) return validacion;

  const { items } = validacion;
  const pedido = {
    id: crypto.randomUUID(),
    fecha: new Date().toISOString(),
    cliente,
    items,
    total: calcularTotal(items),
    estado: "pendiente",
  };

  transaccion(() => {
    db.prepare(`
      INSERT INTO pedidos (id, cliente_id, fecha, nombre, telefono, email, ciudad, provincia, direccion, total, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(pedido.id, clienteId, pedido.fecha, cliente.nombre, cliente.telefono, cliente.email,
        cliente.ciudad, cliente.provincia, cliente.direccion, pedido.total, pedido.estado);

    for (const item of items) {
      // "AND stock >= ?" evita vender de más aunque dos compras lleguen casi juntas
      const descuento = db.prepare("UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?")
        .run(item.cantidad, item.id, item.cantidad);
      if (descuento.changes === 0) throw new Error(`Sin stock de ${item.nombre}`);

      db.prepare(`
        INSERT INTO pedido_items (pedido_id, producto_id, nombre, talle, cantidad, precio_unitario)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run(pedido.id, item.id, item.nombre, item.talle, item.cantidad, item.precioUnitario);
    }
  });

  return { pedido };
}

function itemsDelPedido(idPedido) {
  return db.prepare("SELECT producto_id, nombre, talle, cantidad, precio_unitario AS precioUnitario FROM pedido_items WHERE pedido_id = ?")
    .all(idPedido);
}

// Cancela un pedido pendiente y devuelve sus unidades al stock
function cancelarPedido(idPedido) {
  transaccion(() => {
    const pedido = db.prepare("SELECT estado FROM pedidos WHERE id = ?").get(idPedido);
    if (!pedido || pedido.estado !== "pendiente") return;

    db.prepare("UPDATE pedidos SET estado = 'cancelado' WHERE id = ?").run(idPedido);
    for (const item of itemsDelPedido(idPedido)) {
      db.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?").run(item.cantidad, item.producto_id);
    }
  });
}

function marcarPagado(idPedido, idPago) {
  transaccion(() => {
    const pedido = db.prepare("SELECT estado FROM pedidos WHERE id = ?").get(idPedido);
    if (!pedido || pedido.estado === "pagado") return;

    // Pagó después de vencido: su stock ya se había liberado, así que se vuelve a descontar
    if (pedido.estado === "cancelado") {
      for (const item of itemsDelPedido(idPedido)) {
        db.prepare("UPDATE productos SET stock = max(stock - ?, 0) WHERE id = ?").run(item.cantidad, item.producto_id);
      }
    }
    db.prepare("UPDATE pedidos SET estado = 'pagado', mp_payment_id = ? WHERE id = ?").run(String(idPago), idPedido);
  });
}

// Los pedidos que nadie pagó en 24 horas devuelven su stock.
// Solo se usa con Mercado Pago configurado: con el link fijo no hay forma de saber quién pagó.
function liberarPedidosVencidos() {
  const limite = new Date(Date.now() - HORAS_PARA_PAGAR * 60 * 60 * 1000).toISOString();
  const vencidos = db.prepare("SELECT id FROM pedidos WHERE estado = 'pendiente' AND fecha < ?").all(limite);
  vencidos.forEach(p => cancelarPedido(p.id));
  if (vencidos.length) console.log(`Se cancelaron ${vencidos.length} pedido(s) sin pagar.`);
}

function armarMensajeWhatsapp(pedido) {
  const detalle = pedido.items
    .map(i => `🛒 *${i.nombre}*\n   Talle: ${i.talle}\n   Cantidad: ${i.cantidad}\n   Subtotal: $${(i.precioUnitario * i.cantidad).toLocaleString("es-AR")}`)
    .join("\n\n");
  const { cliente } = pedido;

  return `🛍️ *NUEVO PEDIDO #${pedido.id.slice(0, 8)} - FIERRERO STORE*

👤 *DATOS DEL CLIENTE*
*Nombre:* ${cliente.nombre}
*Teléfono:* ${cliente.telefono}
*Email:* ${cliente.email}

📍 *DIRECCIÓN DE ENVÍO*
*Calle:* ${cliente.direccion}
*Ciudad:* ${cliente.ciudad}, ${cliente.provincia}

📦 *PRODUCTOS*
${detalle}

💰 *TOTAL A PAGAR: $${pedido.total.toLocaleString("es-AR")}*

---------------------------------------
✅ _El cliente está siendo redirigido a Mercado Pago..._`;
}

// Express 4 no captura errores de funciones async: este envoltorio los pasa al manejador de errores
const conManejoDeErrores = (funcion) => (req, res, next) => funcion(req, res, next).catch(next);

/* ===== RUTAS ===== */
router.post("/api/pedidos", conManejoDeErrores(async (req, res) => {
  const datos = req.body || {};

  const resultadoCliente = validarCliente(datos.cliente || {});
  if (resultadoCliente.error) return res.status(400).json({ error: resultadoCliente.error });

  const cliente = clienteDeSesion(req);
  const registro = registrarPedido(resultadoCliente.cliente, datos.items, cliente ? cliente.id : null);
  if (registro.error) return res.status(400).json({ error: registro.error });

  const { pedido } = registro;
  let pagoUrl;
  try {
    pagoUrl = await pagos.obtenerUrlDePago(pedido);
  } catch (error) {
    console.error("Error al crear el pago:", error.message);
    cancelarPedido(pedido.id);
    return res.status(502).json({ error: "No pudimos iniciar el pago. Probá de nuevo en unos minutos." });
  }

  res.status(201).json({
    pedidoId: pedido.id,
    total: pedido.total,
    pagoUrl,
    whatsappUrl: `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(armarMensajeWhatsapp(pedido))}`,
  });
}));

router.get("/api/mis-pedidos", (req, res) => {
  const cliente = clienteDeSesion(req);
  if (!cliente) return res.status(401).json({ error: "Ingresá con tu cuenta para ver tus pedidos." });

  const pedidos = db.prepare("SELECT id, fecha, total, estado FROM pedidos WHERE cliente_id = ? ORDER BY fecha DESC").all(cliente.id);
  res.json(pedidos.map(p => ({
    ...p,
    numero: p.id.slice(0, 8),
    items: itemsDelPedido(p.id).map(({ producto_id, ...item }) => item),
  })));
});

// Sirve para la página "gracias". El id es un UUID imposible de adivinar y solo se expone el estado.
router.get("/api/pedidos/:id/estado", (req, res) => {
  const pedido = db.prepare("SELECT id, total, estado FROM pedidos WHERE id = ?").get(req.params.id);
  if (!pedido) return res.status(404).json({ error: "Pedido no encontrado." });
  res.json({ numero: pedido.id.slice(0, 8), total: pedido.total, estado: pedido.estado });
});

// Mercado Pago avisa acá cuando hay novedades de un pago
router.post("/api/mp/webhook", conManejoDeErrores(async (req, res) => {
  const tipo = req.query.type || req.query.topic || req.body?.type;
  const idPago = req.query["data.id"] || req.query.id || req.body?.data?.id;

  if (!MP_ACCESS_TOKEN || tipo !== "payment" || !idPago) return res.sendStatus(200);

  const pago = await pagos.obtenerPago(idPago);
  // Pagos ajenos a la tienda no traen nuestra referencia: se ignoran
  const pedido = typeof pago.external_reference === "string"
    ? db.prepare("SELECT id, total FROM pedidos WHERE id = ?").get(pago.external_reference)
    : null;

  if (pedido && pago.status === "approved") {
    if (pago.transaction_amount === pedido.total) {
      marcarPagado(pedido.id, idPago);
    } else {
      console.error(`Pago ${idPago} aprobado por $${pago.transaction_amount}, pero el pedido ${pedido.id} es de $${pedido.total}. Revisar a mano.`);
    }
  }
  res.sendStatus(200); // Si algo falla arriba, responde 500 y Mercado Pago reintenta
}));

module.exports = { router, liberarPedidosVencidos };
