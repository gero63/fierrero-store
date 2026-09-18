// Uso: npm run stock -- <id-producto> <cantidad>     Ejemplo: npm run stock -- remera1 25
const { db } = require("../db");

const [id, cantidad] = process.argv.slice(2);
const stock = Number(cantidad);

if (!id || !Number.isInteger(stock) || stock < 0) {
  console.log("Uso: npm run stock -- <id-producto> <cantidad>");
  process.exit(1);
}

const resultado = db.prepare("UPDATE productos SET stock = ? WHERE id = ?").run(stock, id);
console.log(resultado.changes ? `Stock de "${id}" actualizado a ${stock}.` : `No existe el producto "${id}".`);
