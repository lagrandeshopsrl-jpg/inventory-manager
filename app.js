
let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;

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

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));

    if(currentPage > totalPages){
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;

    const paginated = filtered.slice(start, end);

    paginated.forEach((p,index)=>{

        table.innerHTML += `
        <tr>
            <td><input type="checkbox" class="product-checkbox" data-index="${start + index}"></td>
            <td>${p.barcode || ''}</td>
            <td>${p.name || ''}</td>
            <td>${p.supplier || '-'}</td>
            <td>${p.buyPrice || ''}</td>
            <td>${p.sellPrice || ''}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editProduct(${start + index})">Modifica</button>
                    <button onclick="deleteProduct(${start + index})">Elimina</button>
                </div>
            </td>
        </tr>
        `;
    });

    document.getElementById('pageInfo').innerText =
        `Pagina ${currentPage} di ${totalPages}`;
}

function editProduct(index){

    const p = products[index];

    const nuovoBarcode = prompt('Barcode', p.barcode || '');
    if(nuovoBarcode === null) return;

    const nuovoNome = prompt('Nome prodotto', p.name || '');
    if(nuovoNome === null) return;

    const nuovoFornitore = prompt('Fornitore', p.supplier || '');
    if(nuovoFornitore === null) return;

    const nuovoAcquisto = prompt('Prezzo acquisto', p.buyPrice || '');
    if(nuovoAcquisto === null) return;

    const nuovoVendita = prompt('Prezzo vendita', p.sellPrice || '');
    if(nuovoVendita === null) return;

    products[index] = {
        ...products[index],
        barcode: nuovoBarcode,
        name: nuovoNome,
        supplier: nuovoFornitore,
        buyPrice: nuovoAcquisto,
        sellPrice: nuovoVendita
    };

    saveStorage();
    renderProducts();

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

    allSelected = !allSelected;

    document.querySelectorAll('.product-checkbox').forEach(cb=>{
        cb.checked = allSelected;
    });

    document.getElementById('toggleSelectBtn').innerText =
        allSelected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

function deleteSelectedProducts(){

    const selected = [];

    document.querySelectorAll('.product-checkbox').forEach(cb=>{
        if(cb.checked){
            selected.push(parseInt(cb.dataset.index));
        }
    });

    if(selected.length === 0){
        alert('Nessun prodotto selezionato');
        return;
    }

    if(confirm('Eliminare prodotti selezionati?')){

        selected.sort((a,b)=>b-a);

        selected.forEach(index=>{
            products.splice(index,1);
        });

        saveStorage();
        renderProducts();
    }
}

function nextPage(){
    currentPage++;
    renderProducts();
}

function prevPage(){
    if(currentPage > 1){
        currentPage--;
        renderProducts();
    }
}

function exportCSV(){

    let csv = "Barcode,Prodotto,Fornitore,Acquisto,Vendita\n";

    products.forEach(p=>{
        csv += `${p.barcode || ''},${p.name || ''},${p.supplier || ''},${p.buyPrice || ''},${p.sellPrice || ''}\n`;
    });

    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'prodotti.csv';
    a.click();

    URL.revokeObjectURL(url);
}

window.onload = function(){

    renderProducts();

    const search = document.getElementById('search');

    if(search){
        search.focus();
    }
};
