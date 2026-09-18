const express = require("express");
const crypto = require("crypto");
const { db } = require("./db");
const { BASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = require("./config");

const router = express.Router();

const GOOGLE_DISPONIBLE = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;
// Solo se puede volver a estas páginas después de loguearse (evita redirecciones a sitios externos)
const PAGINAS_PERMITIDAS = ["/", "/carrito.html", "/finalizar.html", "/cuenta.html"];

// Devuelve el cliente logueado o null. La sesión solo guarda el id, firmado en una cookie.
function clienteDeSesion(req) {
  const id = req.session?.clienteId;
  if (!id) return null;
  return db.prepare("SELECT id, nombre, email, foto FROM clientes WHERE id = ?").get(id) || null;
}

function guardarCliente(perfil) {
  db.prepare(`
    INSERT INTO clientes (google_id, nombre, email, foto, creado) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(google_id) DO UPDATE SET nombre = excluded.nombre, email = excluded.email, foto = excluded.foto`)
    .run(perfil.sub, perfil.name || perfil.email, perfil.email, perfil.picture || null, new Date().toISOString());
  return db.prepare("SELECT id FROM clientes WHERE google_id = ?").get(perfil.sub);
}

/* Paso 1: mandamos al usuario a Google */
router.get("/auth/google", (req, res) => {
  if (!GOOGLE_DISPONIBLE) return res.status(503).send("El ingreso con Google no está configurado.");

  const state = crypto.randomBytes(16).toString("hex");
  req.session.state = state;
  req.session.volver = PAGINAS_PERMITIDAS.includes(req.query.volver) ? req.query.volver : "/";

  const parametros = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${parametros}`);
});

/* Paso 2: Google nos devuelve al usuario con un "code" que canjeamos por sus datos */
router.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const stateEsperado = req.session.state;
  const volver = req.session.volver || "/";
  req.session.state = null;

  // Si el state no coincide, el pedido no salió de nuestro propio botón (posible CSRF)
  if (!GOOGLE_DISPONIBLE || !code || !state || state !== stateEsperado) return res.redirect(volver);

  try {
    const respuestaToken = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!respuestaToken.ok) throw new Error(`Google respondió ${respuestaToken.status} al canjear el code`);
    const { access_token } = await respuestaToken.json();

    const respuestaPerfil = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!respuestaPerfil.ok) throw new Error(`Google respondió ${respuestaPerfil.status} al pedir el perfil`);
    const perfil = await respuestaPerfil.json();

    if (!perfil.sub || !perfil.email || perfil.email_verified === false) throw new Error("Perfil de Google incompleto");

    const cliente = guardarCliente(perfil);
    req.session = { clienteId: cliente.id }; // sesión nueva: descarta cualquier valor anterior
  } catch (error) {
    console.error("Error en el login con Google:", error.message);
  }
  res.redirect(volver);
});

router.post("/auth/logout", (req, res) => {
  req.session = null;
  res.sendStatus(204);
});

/* Datos de la sesión actual, para que las páginas sepan qué mostrar */
router.get("/api/me", (req, res) => {
  const cliente = clienteDeSesion(req);
  let ultimoPedido = null;

  if (cliente) {
    ultimoPedido = db.prepare(`
      SELECT telefono, ciudad, provincia, direccion FROM pedidos
      WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 1`).get(cliente.id) || null;
  }
  res.json({ googleDisponible: GOOGLE_DISPONIBLE, cliente, ultimoPedido });
});

module.exports = { router, clienteDeSesion, GOOGLE_DISPONIBLE };
