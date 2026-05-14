
let products = JSON.parse(localStorage.getItem('products') || '[]');
let editIndex = null;
let selected = false;

function saveStorage(){
localStorage.setItem('products', JSON.stringify(products));
}

function getBuy(p){
return p.buyPrice || p.acquisto || '';
}

function getSell(p){
return p.sellPrice || p.vendita || '';
}

function renderProducts(){

const search = document.getElementById('search').value.toLowerCase();

const table = document.getElementById('productTable');

table.innerHTML='';

products.filter(p =>
String(p.barcode || '').toLowerCase().includes(search) ||
String(p.name || p.prodotto || '').toLowerCase().includes(search) ||
String(p.supplier || p.fornitore || '').toLowerCase().includes(search)
).forEach((p,index)=>{

table.innerHTML += `
<tr>
<td><input type="checkbox" class="check"></td>
<td>${p.barcode || ''}</td>
<td>${p.name || p.prodotto || ''}</td>
<td>${p.supplier || p.fornitore || ''}</td>
<td>${getBuy(p)}</td>
<td>${getSell(p)}</td>
<td>
<button class="action-btn edit" onclick="openEdit(${index})">Modifica</button>
<button class="action-btn delete" onclick="deleteProduct(${index})">Elimina</button>
</td>
</tr>
`;
});
}

function openEdit(index){

editIndex = index;

const p = products[index];

document.getElementById('editBarcode').value = p.barcode || '';
document.getElementById('editName').value = p.name || p.prodotto || '';
document.getElementById('editSupplier').value = p.supplier || p.fornitore || '';
document.getElementById('editBuy').value = getBuy(p);
document.getElementById('editSell').value = getSell(p);

document.getElementById('editModal').style.display='flex';
}

function closeModal(){
document.getElementById('editModal').style.display='none';
}

function saveEdit(){

products[editIndex].barcode = document.getElementById('editBarcode').value;
products[editIndex].name = document.getElementById('editName').value;
products[editIndex].supplier = document.getElementById('editSupplier').value;
products[editIndex].buyPrice = document.getElementById('editBuy').value;
products[editIndex].sellPrice = document.getElementById('editSell').value;

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

function toggleSelectProducts(){

selected = !selected;

document.querySelectorAll('.check').forEach(c=>{
c.checked = selected;
});

document.getElementById('toggleBtn').innerText =
selected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

window.onload = renderProducts;
