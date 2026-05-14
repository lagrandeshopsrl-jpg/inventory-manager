
let products = JSON.parse(localStorage.getItem('products') || '[]');

if(products.length === 0){
products = [
{
id: 1,
barcode: '8005860854055',
name: 'SILICONE TRASPARENTE ACETICO ML.280',
supplier: '昌盛',
purchasePrice: 1.6,
salePrice: 3.0
}
];
}

function saveStorage(){
localStorage.setItem('products', JSON.stringify(products));
}

function renderProducts(){

const search = document.getElementById('search').value.toLowerCase();

const table = document.getElementById('productTable');

table.innerHTML = '';

const filtered = products.filter(p =>
String(p.barcode || '').toLowerCase().includes(search) ||
String(p.name || '').toLowerCase().includes(search) ||
String(p.supplier || '').toLowerCase().includes(search)
);

filtered.forEach(product => {

const tr = document.createElement('tr');

tr.innerHTML = `
<td><input value="${product.barcode}" id="barcode-${product.id}"></td>

<td><input value="${product.name}" id="name-${product.id}"></td>

<td><input value="${product.supplier}" id="supplier-${product.id}"></td>

<td><input type="number" step="0.01" value="${product.purchasePrice}" id="purchase-${product.id}"></td>

<td><input type="number" step="0.01" value="${product.salePrice}" id="sale-${product.id}"></td>

<td>
<div class="actions">
<button class="save" onclick="saveEdit(${product.id})">Salva</button>
<button class="delete" onclick="deleteProduct(${product.id})">Elimina</button>
</div>
</td>
`;

table.appendChild(tr);

});

saveStorage();
}

function saveEdit(id){

const product = products.find(p => p.id === id);

product.barcode = document.getElementById(`barcode-${id}`).value;
product.name = document.getElementById(`name-${id}`).value;
product.supplier = document.getElementById(`supplier-${id}`).value;
product.purchasePrice = parseFloat(document.getElementById(`purchase-${id}`).value) || 0;
product.salePrice = parseFloat(document.getElementById(`sale-${id}`).value) || 0;

saveStorage();

alert('Prodotto modificato correttamente');
}

function deleteProduct(id){

products = products.filter(p => p.id !== id);

saveStorage();

renderProducts();
}

function exportCSV(){

const headers = ['Barcode','Prodotto','Fornitore','Acquisto','Vendita'];

const rows = products.map(p => [
p.barcode,
p.name,
p.supplier,
p.purchasePrice,
p.salePrice
]);

const csv = [headers, ...rows]
.map(r => r.join(','))
.join('\n');

const blob = new Blob([csv], {type:'text/csv'});

const link = document.createElement('a');

link.href = URL.createObjectURL(blob);
link.download = 'prodotti.csv';
link.click();
}

function importExcel(event){

const file = event.target.files[0];

const reader = new FileReader();

reader.onload = function(e){

const data = new Uint8Array(e.target.result);

const workbook = XLSX.read(data, {type:'array'});

const sheet = workbook.Sheets[workbook.SheetNames[0]];

const json = XLSX.utils.sheet_to_json(sheet);

products = json.map((item,index) => ({
id: Date.now() + index,
barcode: item.Barcode || '',
name: item.Prodotto || '',
supplier: item.Fornitore || '',
purchasePrice: Number(item.Acquisto || 0),
salePrice: Number(item.Vendita || 0)
}));

saveStorage();

renderProducts();
};

reader.readAsArrayBuffer(file);
}

renderProducts();
