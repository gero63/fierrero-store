// Volvemos a usar "carrito" para que tu formulario de pago lo reconozca
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

function saveCart() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

function obtenerCarrito() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

function calcularTotal() {
  return carrito.reduce((total, p) => total + (p.precio * p.cantidad), 0);
}

// Esta parte detecta el clic y lee los datos (REMERAS, CROPS Y ACCESORIOS)
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('btn')) {
    const productElement = e.target.closest('.product');
    if (!productElement) return;

    const nombre = productElement.querySelector('h3').innerText;
    const precioTexto = productElement.querySelector('.price').innerText;
    const precio = parseInt(precioTexto.replace('$', '').replace(/\./g, '').trim());
    const imagen = productElement.querySelector('img').src;
    
    const selectTalle = productElement.querySelector('.size-select');
    const talle = selectTalle ? selectTalle.value : "Único";

    // Lógica para guardar
    const item = carrito.find(p => p.nombre === nombre && p.talle === talle);
    if (item) {
      item.cantidad++;
    } else {
      carrito.push({ nombre, precio, imagen, talle, cantidad: 1 });
    }

    saveCart();
    
    // Feedback visual
    const originalText = e.target.innerText;
    e.target.innerText = "¡AGREGADO! ✅";
    setTimeout(() => { e.target.innerText = originalText; }, 1500);
  }
});

// Función para mostrar en carrito.html
function mostrarCarrito() {
  const cont = document.getElementById("lista-carrito");
  const totalSpan = document.getElementById("total");
  if(!cont) return; 

  cont.innerHTML = "";
  let total = 0;

  if (carrito.length === 0) {
    cont.innerHTML = "<p style='text-align:center; padding:20px;'>Tu carrito está vacío.</p>";
  }

  carrito.forEach((p, i) => {
    total += p.precio * p.cantidad;
    cont.innerHTML += `
      <div class="item">
        <img src="${p.imagen}">
        <div>
          <strong>${p.nombre}</strong>
          <p>Talle: ${p.talle}</p>
          <p>$${p.precio.toLocaleString()} x ${p.cantidad}</p>
          <button onclick="removeItem(${i})" style="color:#ff3e00; cursor:pointer; border:none; background:none;">[ Eliminar ]</button>
        </div>
      </div>`;
  });

  if(totalSpan) totalSpan.innerText = "$" + total.toLocaleString('es-AR');
}

function removeItem(index) {
  carrito.splice(index, 1);
  saveCart();
  mostrarCarrito();
}

document.addEventListener("DOMContentLoaded", mostrarCarrito);