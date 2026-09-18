const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const db = new DatabaseSync(path.join(__dirname, "data", "tienda.db"));
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id        TEXT PRIMARY KEY,
    nombre    TEXT NOT NULL,
    categoria TEXT NOT NULL,
    precio    INTEGER NOT NULL CHECK (precio > 0),
    imagen    TEXT NOT NULL,
    talles    TEXT NOT NULL DEFAULT '',          -- "S,M,L" o vacío si no tiene talles
    stock     INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    activo    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT NOT NULL UNIQUE,
    nombre    TEXT NOT NULL,
    email     TEXT NOT NULL,
    foto      TEXT,
    creado    TEXT NOT NULL
  );

  -- cliente_id queda vacío cuando se compra como invitado
  CREATE TABLE IF NOT EXISTS pedidos (
    id            TEXT PRIMARY KEY,
    cliente_id    INTEGER REFERENCES clientes(id),
    fecha         TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    telefono      TEXT NOT NULL,
    email         TEXT NOT NULL,
    ciudad        TEXT NOT NULL,
    provincia     TEXT NOT NULL,
    direccion     TEXT NOT NULL,
    total         INTEGER NOT NULL,
    estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'cancelado')),
    mp_payment_id TEXT
  );

  -- Se guarda nombre y precio de ese momento: si el catálogo cambia, el pedido no se altera
  CREATE TABLE IF NOT EXISTS pedido_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id       TEXT NOT NULL REFERENCES pedidos(id),
    producto_id     TEXT NOT NULL REFERENCES productos(id),
    nombre          TEXT NOT NULL,
    talle           TEXT NOT NULL,
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario INTEGER NOT NULL
  );
`);

function transaccion(funcion) {
  db.exec("BEGIN");
  try {
    const resultado = funcion();
    db.exec("COMMIT");
    return resultado;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// data/productos.json manda sobre nombre, precio, imagen y talles.
// El stock solo se toma del JSON cuando el producto es nuevo; después vive en la base.
function sincronizarCatalogo() {
  const catalogo = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "productos.json"), "utf8"));
  const guardar = db.prepare(`
    INSERT INTO productos (id, nombre, categoria, precio, imagen, talles, stock, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      nombre = excluded.nombre, categoria = excluded.categoria, precio = excluded.precio,
      imagen = excluded.imagen, talles = excluded.talles, activo = 1`);

  transaccion(() => {
    db.exec("UPDATE productos SET activo = 0");
    for (const p of catalogo) {
      guardar.run(p.id, p.nombre, p.categoria, p.precio, p.imagen, p.talles.join(","), p.stock);
    }
  });
}

function aProducto(fila) {
  return { ...fila, talles: fila.talles ? fila.talles.split(",") : [] };
}

function listarProductos() {
  return db.prepare("SELECT id, nombre, categoria, precio, imagen, talles, stock FROM productos WHERE activo = 1 ORDER BY rowid")
    .all().map(aProducto);
}

function obtenerProducto(id) {
  const fila = db.prepare("SELECT id, nombre, categoria, precio, imagen, talles, stock FROM productos WHERE id = ? AND activo = 1").get(id);
  return fila ? aProducto(fila) : null;
}

module.exports = { db, transaccion, sincronizarCatalogo, listarProductos, obtenerProducto };
