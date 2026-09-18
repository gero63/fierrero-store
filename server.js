const express = require("express");
const cookieSession = require("cookie-session");
const path = require("path");

const config = require("./config");
const { sincronizarCatalogo, listarProductos } = require("./db");
const auth = require("./auth");
const pedidos = require("./pedidos");

sincronizarCatalogo();

const app = express();
const usaHttps = config.BASE_URL.startsWith("https://");
if (usaHttps) app.set("trust proxy", 1);

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

// La sesión vive en una cookie firmada: no hace falta guardarla en el servidor
app.use(cookieSession({
  name: "sesion",
  keys: [config.SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: "lax",
  httpOnly: true,
  secure: usaHttps,
}));

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/productos", (req, res) => {
  res.json(listarProductos());
});

app.use(auth.router);
app.use(pedidos.router);

// Cualquier error inesperado responde en JSON
app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? "Error interno del servidor." : "Solicitud inválida." });
});

if (config.MP_ACCESS_TOKEN) {
  pedidos.liberarPedidosVencidos();
  setInterval(pedidos.liberarPedidosVencidos, 60 * 60 * 1000).unref();
}

app.listen(config.PUERTO, () => {
  console.log(`Fierrero Store corriendo en ${config.BASE_URL}`);
  if (!config.MP_ACCESS_TOKEN) console.log("Aviso: sin MP_ACCESS_TOKEN se usa el link fijo de Mercado Pago (sin confirmación automática de pagos).");
  if (!config.SESSION_SECRET_CONFIGURADO) console.log("Aviso: sin SESSION_SECRET las sesiones se pierden al reiniciar el servidor.");
  if (!auth.GOOGLE_DISPONIBLE) console.log("Aviso: sin GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET el login con Google queda desactivado.");
});
