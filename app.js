
let products = JSON.parse(localStorage.getItem('products') || '[]');

if(products.length===0){
products=[
{barcode:'8005860854055',name:'PROSCIUTTO COTTO',supplier:'GranTerre',buyPrice:'12.50',sellPrice:'18.90'}
];
}

let currentIndex = 0;

function saveStorage(){
localStorage.setItem('products', JSON.stringify(products'));
}

function render(){

const body = document.getElementById('tableBody');
body.innerHTML='';

products.forEach((p,index)=>{
body.innerHTML += `
<tr>
<td>${p.barcode||''}</td>
<td>${p.name||''}</td>
<td>${p.supplier||''}</td>
<td>${p.buyPrice||''}</td>
<td>${p.sellPrice||''}</td>
<td><button class="edit-btn" onclick="openModal(${index})">Modifica</button></td>
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

document.getElementById('editModal').style.display='flex';
}

function closeModal(){
document.getElementById('editModal').style.display='none';
}

function saveProduct(){

products[currentIndex].barcode=document.getElementById('barcode').value;
products[currentIndex].name=document.getElementById('name').value;
products[currentIndex].supplier=document.getElementById('supplier').value;
products[currentIndex].buyPrice=document.getElementById('buy').value;
products[currentIndex].sellPrice=document.getElementById('sell').value;

localStorage.setItem('products', JSON.stringify(products));

render();
closeModal();
}

window.onload=render;
