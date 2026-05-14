
let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;

let currentPage = 1;

let allSelected = false;

function saveStorage(){
    localStorage.setItem('products', JSON.stringify(products));
}

function renderProducts(){

    const searchInput = document.getElementById('search');

    const search = searchInput
        ? searchInput.value.toLowerCase()
        : '';

    const table = document.getElementById('productTable');

    table.innerHTML = '';

    const filtered = products.filter(p =>
        String(p.barcode || '').toLowerCase().includes(search) ||
        String(p.name || '').toLowerCase().includes(search) ||
        String(p.supplier || '').toLowerCase().includes(search)
    );

    const totalPages = Math.max(1,
        Math.ceil(filtered.length / itemsPerPage)
    );

    if(currentPage > totalPages){
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * itemsPerPage;

    const end = start + itemsPerPage;

    const paginated = filtered.slice(start,end);

    paginated.forEach((p,index)=>{

        table.innerHTML += `
        <tr>
            <td>
                <input
                    type="checkbox"
                    class="product-checkbox"
                    data-index="${start + index}"
                >
            </td>

            <td>${p.barcode || ''}</td>

            <td>${p.name || ''}</td>

            <td>${p.supplier || '-'}</td>

            <td>${p.buyPrice || ''}</td>

            <td>${p.sellPrice || ''}</td>

            <td>${p.quantity || ''}</td>

            <td>
                <div class="action-buttons">

                    <button onclick="editProduct(${start + index})">
                        Modifica
                    </button>

                    <button onclick="deleteProduct(${start + index})">
                        Elimina
                    </button>

                </div>
            </td>
        </tr>
        `;
    });

    document.getElementById('pageInfo').innerText =
        `Pagina ${currentPage} di ${totalPages}`;
}

function toggleSelectProducts(){

    allSelected = !allSelected;

    document.querySelectorAll('.product-checkbox').forEach(cb=>{
        cb.checked = allSelected;
    });

    const btn = document.getElementById('toggleSelectBtn');

    btn.innerText = allSelected
        ? 'Deseleziona prodotti'
        : 'Seleziona prodotti';
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

function editProduct(index){

    const p = products[index];

    const nuovoNome =
        prompt('Modifica nome prodotto', p.name);

    if(nuovoNome === null) return;

    const nuovoPrezzo =
        prompt('Modifica prezzo vendita', p.sellPrice);

    if(nuovoPrezzo === null) return;

    const nuovaQuantita =
        prompt('Modifica quantità', p.quantity);

    if(nuovaQuantita === null) return;

    products[index].name = nuovoNome;
    products[index].sellPrice = nuovoPrezzo;
    products[index].quantity = nuovaQuantita;

    saveStorage();

    renderProducts();
}

function deleteProduct(index){

    if(confirm('Eliminare prodotto?')){

        products.splice(index,1);

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

    let csv =
        "Barcode,Prodotto,Fornitore,Acquisto,Vendita,Quantita\\n";

    products.forEach(p=>{

        csv +=
            `${p.barcode},${p.name},${p.supplier || ''},${p.buyPrice || ''},${p.sellPrice || ''},${p.quantity || ''}\\n`;
    });

    const blob =
        new Blob([csv], {type:'text/csv'});

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement('a');

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

        const data =
            new Uint8Array(e.target.result);

        const workbook =
            XLSX.read(data,{type:'array'});

        const sheetName =
            workbook.SheetNames[0];

        const worksheet =
            workbook.Sheets[sheetName];

        const json =
            XLSX.utils.sheet_to_json(
                worksheet,
                {defval:''}
            );

        json.forEach(row=>{

            products.push({

                barcode:
                    row.Barcode || '',

                name:
                    row.Prodotto || '',

                supplier:
                    row.Fornitore || '',

                buyPrice:
                    row.Acquisto || '',

                sellPrice:
                    row.Vendita || '',

                quantity:
                    row.Quantita || ''
            });

        });

        saveStorage();

        renderProducts();

        alert('Importazione completata!');
    };

    reader.readAsArrayBuffer(file);
}

window.onload = function(){

    renderProducts();

    const search =
        document.getElementById('search');

    if(search){
        search.focus();
    }
};
