
let products = JSON.parse(localStorage.getItem('products') || '[]');
let editingIndex = -1;

function saveStorage(){
    localStorage.setItem('products', JSON.stringify(products));
}

function clearInputs(){
    document.getElementById('barcode').value = '';
    document.getElementById('name').value = '';
    document.getElementById('buyPrice').value = '';
    document.getElementById('sellPrice').value = '';
    document.getElementById('quantity').value = '';
}

function saveProduct(){

    const product = {
        barcode: document.getElementById('barcode').value.trim(),
        name: document.getElementById('name').value.trim(),
        buyPrice: document.getElementById('buyPrice').value,
        sellPrice: document.getElementById('sellPrice').value,
        quantity: document.getElementById('quantity').value
    };

    if(!product.barcode || !product.name){
        alert('Inserisci barcode e nome prodotto');
        return;
    }

    if(editingIndex === -1){
        products.push(product);
    }else{
        products[editingIndex] = product;
        editingIndex = -1;
    }

    saveStorage();
    clearInputs();
    renderProducts();
}

function editProduct(index){

    const p = products[index];

    document.getElementById('barcode').value = p.barcode;
    document.getElementById('name').value = p.name;
    document.getElementById('buyPrice').value = p.buyPrice;
    document.getElementById('sellPrice').value = p.sellPrice;
    document.getElementById('quantity').value = p.quantity;

    editingIndex = index;

    window.scrollTo({top:0,behavior:'smooth'});
}

function deleteProduct(index){

    if(confirm('Eliminare prodotto?')){
        products.splice(index,1);
        saveStorage();
        renderProducts();
    }
}

function renderProducts(){

    const search = document.getElementById('search').value.toLowerCase();

    const table = document.getElementById('productTable');

    table.innerHTML = '';

    const filtered = products.filter(p =>
        String(p.barcode).toLowerCase().includes(search) ||
        String(p.name).toLowerCase().includes(search)
    );

    filtered.forEach((p,index)=>{

        table.innerHTML += `
        <tr>
            <td>${p.barcode}</td>
            <td>${p.name}</td>
            <td>${p.buyPrice}</td>
            <td>${p.sellPrice}</td>
            <td>${p.quantity}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editProduct(${index})">Modifica</button>
                    <button onclick="deleteProduct(${index})">Elimina</button>
                </div>
            </td>
        </tr>
        `;
    });
}

function exportCSV(){

    let csv = "Barcode,Prodotto,Acquisto,Vendita,Quantita\n";

    products.forEach(p=>{
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

function importExcel(event){

    const file = event.target.files[0];

    if(!file){
        return;
    }

    const reader = new FileReader();

    reader.onload = function(e){

        const data = new Uint8Array(e.target.result);

        const workbook = XLSX.read(data,{type:'array'});

        const sheetName = workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];

        const json = XLSX.utils.sheet_to_json(worksheet,{defval:''});

        json.forEach(row=>{

            products.push({
                barcode: row.Barcode || row.barcode || '',
                name: row.Prodotto || row.prodotto || row.Name || '',
                buyPrice: row.Acquisto || row.buyPrice || '',
                sellPrice: row.Vendita || row.sellPrice || '',
                quantity: row.Quantita || row.quantity || ''
            });

        });

        saveStorage();
        renderProducts();

        alert('Importazione completata!');
    };

    reader.readAsArrayBuffer(file);
}

renderProducts();
