
let products = JSON.parse(localStorage.getItem('products') || '[]');

function saveProducts() {
localStorage.setItem('products', JSON.stringify(products));
}

function addProduct() {
const product = {
barcode: document.getElementById('barcode').value,
name: document.getElementById('name').value,
buyPrice: document.getElementById('buyPrice').value,
sellPrice: document.getElementById('sellPrice').value,
quantity: document.getElementById('quantity').value
};

products.push(product);
saveProducts();
renderProducts();
}

function deleteProduct(index) {
products.splice(index,1);
saveProducts();
renderProducts();
}

function renderProducts() {
const search = document.getElementById('search').value.toLowerCase();
const table = document.getElementById('productTable');

table.innerHTML = '';

products
.filter(p =>
(p.name || '').toLowerCase().includes(search) ||
(p.barcode || '').includes(search)
)
.forEach((p,index) => {
table.innerHTML += `
<tr>
<td>${p.barcode}</td>
<td>${p.name}</td>
<td>${p.buyPrice}</td>
<td>${p.sellPrice}</td>
<td>${p.quantity}</td>
<td><button onclick="deleteProduct(${index})">Elimina</button></td>
</tr>`;
});
}

function exportCSV() {
let csv = "Barcode,Prodotto,Acquisto,Vendita,Quantita\n";

products.forEach(p => {
csv += `${p.barcode},${p.name},${p.buyPrice},${p.sellPrice},${p.quantity}\n`;
});

const blob = new Blob([csv], {type:'text/csv'});
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = 'prodotti.csv';
a.click();

URL.revokeObjectURL(url);
}

function importExcel(event) {
const file = event.target.files[0];
const reader = new FileReader();

reader.onload = function(e) {
const data = new Uint8Array(e.target.result);

const workbook = XLSX.read(data, {type:'array'});
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const json = XLSX.utils.sheet_to_json(worksheet);

json.forEach(row => {
products.push({
barcode: row.Barcode || '',
name: row.Prodotto || '',
buyPrice: row.Acquisto || '',
sellPrice: row.Vendita || '',
quantity: row.Quantita || ''
});
});

saveProducts();
renderProducts();

alert('Importazione completata!');
};

reader.readAsArrayBuffer(file);
}

renderProducts();
