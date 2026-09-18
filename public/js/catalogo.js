/* Página principal: dibuja el catálogo, el buscador y el filtro por categoría. */

const CATEGORIAS = [
  { id: "remeras", titulo: "Remeras" },
  { id: "croptops", titulo: "Crop Tops" },
  { id: "accesorios", titulo: "Accesorios" },
];

const contenedor = document.getElementById("lista-productos");
const buscador = document.getElementById("buscador");

let productos = [];

function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tituloDeCategoria(id) {
  return CATEGORIAS.find(c => c.id === id).titulo;
}

/* ===== DIBUJAR ===== */
function tarjetaProducto(p) {
  const selectorTalle = p.talles.length
    ? `<div class="size-selector">
         <label for="talle-${p.id}">Seleccioná tu talle:</label>
         <select id="talle-${p.id}" class="size-select">
           ${p.talles.map(t => `<option value="${t}"${t === "M" ? " selected" : ""}>${t}</option>`).join("")}
         </select>
       </div>`
    : "";

  const boton = p.stock > 0
    ? `<button class="btn btn-agregar" data-id="${p.id}">AGREGAR AL CARRITO</button>`
    : `<button class="btn" disabled>SIN STOCK</button>`;

  return `
    <article class="product">
      <img src="${p.imagen}" alt="${escapar(p.nombre)}" loading="lazy">
      <div class="product-info">
        <h3>${escapar(p.nombre)}</h3>
        ${selectorTalle}
        <div class="price">${formatearPrecio(p.precio)}</div>
        ${boton}
      </div>
    </article>`;
}

function dibujarCatalogo(categoriaActiva, texto) {
  const busqueda = normalizar(texto.trim());
  let html = "";

  for (const categoria of CATEGORIAS) {
    if (categoriaActiva !== "todas" && categoriaActiva !== categoria.id) continue;

    // Se busca en el nombre y también en la categoría (ej: "remera" muestra todas las remeras)
    const coinciden = productos.filter(p =>
      p.categoria === categoria.id &&
      normalizar(`${p.nombre} ${categoria.titulo}`).includes(busqueda)
    );
    if (coinciden.length === 0) continue;

    html += `<h2 class="categoria-titulo">${categoria.titulo}</h2>`;
    html += coinciden.map(tarjetaProducto).join("");
  }

  contenedor.innerHTML = html || `<p class="vacio">No encontramos productos con esa búsqueda.</p>`;
}

/* ===== BUSCADOR Y FILTRO ===== */
buscador.addEventListener("input", () => dibujarCatalogo("todas", buscador.value));

document.querySelector(".filters").addEventListener("click", (e) => {
  const boton = e.target.closest("[data-categoria]");
  if (!boton) return;

  buscador.value = "";
  dibujarCatalogo(boton.dataset.categoria, "");
});

/* ===== AGREGAR AL CARRITO ===== */
contenedor.addEventListener("click", (e) => {
  const boton = e.target.closest(".btn-agregar");
  if (!boton) return;

  const producto = productos.find(p => p.id === boton.dataset.id);
  const selectTalle = boton.closest(".product").querySelector(".size-select");
  const talle = selectTalle ? selectTalle.value : "Único";

  const textoOriginal = "AGREGAR AL CARRITO";
  let mensaje = "¡AGREGADO! ✅";

  if (unidadesEnCarrito(producto.id) >= producto.stock) {
    mensaje = "MÁXIMO DISPONIBLE";
  } else {
    agregarAlCarrito(producto.id, talle);
  }

  boton.textContent = mensaje;
  setTimeout(() => { boton.textContent = textoOriginal; }, 1500);
});

/* ===== INICIO ===== */
dibujarEnlaceCuenta();

cargarProductos()
  .then(datos => {
    productos = datos;
    dibujarCatalogo("todas", "");
  })
  .catch(() => {
    contenedor.innerHTML = `<p class="vacio">No pudimos cargar los productos. Probá recargar la página.</p>`;
  });
