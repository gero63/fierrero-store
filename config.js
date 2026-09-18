const crypto = require("crypto");

try { process.loadEnvFile(); } catch { /* sin .env: se usan los valores por defecto */ }

const PUERTO = process.env.PORT || 3000;

// Dirección pública del sitio. Google y Mercado Pago la usan para volver a la tienda.
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PUERTO}`).replace(/\/$/, "");

module.exports = {
  PUERTO,
  BASE_URL,
  BASE_URL_CONFIGURADA: Boolean(process.env.BASE_URL),
  WHATSAPP_NUMERO: process.env.WHATSAPP_NUMERO || "543492215273",

  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_LINK_FIJO: process.env.MP_LINK_FIJO || "https://link.mercadopago.com.ar/fierrerostore7482992",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  SESSION_SECRET_CONFIGURADO: Boolean(process.env.SESSION_SECRET),
  SESSION_SECRET: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
};
