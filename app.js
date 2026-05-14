let products = JSON.parse(localStorage.getItem('products') || '[]');

let allSelected = false;
let currentEdit = null;

function saveStorage(){
localStorage.setItem('products', JSON.stringify(products));
}

function renderProducts(){

const search = document.getElementById('search').value.toLowerCase();
const table = document.getElementById('productTable');

table.innerHTML='';

products.filter(p =>
String(p.barcode||'').toLowerCase().includes(search) ||
String(p.name||'').toLowerCase().includes(search) ||
String(p.supplier||'').toLowerCase().includes(search)
).forEach((p,index)=>{

table.innerHTML += `
<tr>
<td><input type="checkbox" class="product-check"></td>
<td>${p.barcode||''}</td>
<td>${p.name||''}</td>
<td>${p.supplier||''}</td>
<td>${p.buyPrice||''}</td>
<td>${p.sellPrice||''}</td>
<td>
<button class="action-btn edit-btn" onclick="openModal(${index})">Modifica</button>
<button class="action-btn delete-btn" onclick="deleteProduct(${index})">Elimina</button>
</td>
</tr>
`;

});
}

function toggleSelectProducts(){

allSelected = !allSelected;

document.querySelectorAll('.product-check').forEach(c=>{
c.checked = allSelected;
});

document.getElementById('toggleBtn').innerText =
allSelected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

function openModal(index){

currentEdit = index;

const p = products[index];

document.getElementById('editBarcode').value = p.barcode || '';
document.getElementById('editName').value = p.name || '';
document.getElementById('editSupplier').value = p.supplier || '';
document.getElementById('editBuy').value = p.buyPrice || '';
document.getElementById('editSell').value = p.sellPrice || '';

document.getElementById('editModal').style.display='flex';
}

function closeModal(){
document.getElementById('editModal').style.display='none';
}

function saveEdit(){

products[currentEdit].barcode =
document.getElementById('editBarcode').value;

products[currentEdit].name =
document.getElementById('editName').value;

products[currentEdit].supplier =
document.getElementById('editSupplier').value;

products[currentEdit].buyPrice =
document.getElementById('editBuy').value;

products[currentEdit].sellPrice =
document.getElementById('editSell').value;

saveStorage();
renderProducts();
closeModal();

alert('Prodotto modificato!');
}

function deleteProduct(index){

if(confirm('Eliminare prodotto?')){

products.splice(index,1);

saveStorage();

renderProducts();
}
}

window.onload = function(){

renderProducts();

document.getElementById('search').focus();

};
