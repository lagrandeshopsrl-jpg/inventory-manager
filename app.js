let products = JSON.parse(localStorage.getItem('products') || '[]');

if(products.length===0){
products = [
{barcode:'8005860854055',name:'PROSCIUTTO COTTO',supplier:'昌盛',buyPrice:'12.50',sellPrice:'18.90'}
];
}

let currentIndex = null;

function saveStorage(){
localStorage.setItem('products', JSON.stringify(products));
}

function renderProducts(){

const search = document.getElementById('search').value.toLowerCase();

const table = document.getElementById('productTable');

table.innerHTML='';

products.filter(p =>
(p.barcode||'').toLowerCase().includes(search) ||
(p.name||'').toLowerCase().includes(search) ||
(p.supplier||'').toLowerCase().includes(search)
).forEach((p,index)=>{

table.innerHTML += `
<tr>
<td><input type="checkbox"></td>
<td>${p.barcode}</td>
<td>${p.name}</td>
<td>${p.supplier}</td>
<td>${p.buyPrice}</td>
<td>${p.sellPrice}</td>
<td>
<button class="edit" onclick="openModal(${index})">✏</button>
<button class="delete" onclick="deleteProduct(${index})">🗑</button>
</td>
</tr>
`;
});
}

function openModal(index){

currentIndex=index;

const p=products[index];

document.getElementById('barcode').value=p.barcode||'';
document.getElementById('name').value=p.name||'';
document.getElementById('supplier').value=p.supplier||'';
document.getElementById('buy').value=p.buyPrice||'';
document.getElementById('sell').value=p.sellPrice||'';

document.getElementById('modal').style.display='flex';
}

function closeModal(){
document.getElementById('modal').style.display='none';
}

function saveProduct(){

products[currentIndex]={
barcode:document.getElementById('barcode').value,
name:document.getElementById('name').value,
supplier:document.getElementById('supplier').value,
buyPrice:document.getElementById('buy').value,
sellPrice:document.getElementById('sell').value
};

saveStorage();
renderProducts();
closeModal();
}

function deleteProduct(index){
if(confirm('Eliminare prodotto?')){
products.splice(index,1);
saveStorage();
renderProducts();
}
}

function toggleAll(){
document.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=true);
}

window.onload=renderProducts;
