
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

    const nuovoBarcode =
        prompt('Modifica barcode', p.barcode);

    if(nuovoBarcode === null) return;

    const nuovoNome =
        prompt('Modifica nome prodotto', p.name);

    if(nuovoNome === null) return;

    const nuovoFornitore =
        prompt('Modifica fornitore', p.supplier || '');

    if(nuovoFornitore === null) return;

    const nuovoAcquisto =
        prompt('Modifica prezzo acquisto', p.buyPrice || '');

    if(nuovoAcquisto === null) return;

    const nuovoVendita =
        prompt('Modifica prezzo vendita', p.sellPrice || '');

    if(nuovoVendita === null) return;

    products[index].barcode = nuovoBarcode;
    products[index].name = nuovoNome;
    products[index].supplier = nuovoFornitore;
    products[index].buyPrice = nuovoAcquisto;
    products[index].sellPrice = nuovoVendita;

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

    const fileName = file.name.toLowerCase();

    if(fileName.endsWith('.csv')){

        const reader = new FileReader();

        reader.onload = function(e){

            const text = e.target.result;

            const rows = text.split('\n');

            rows.slice(1).forEach(line=>{

                if(!line.trim()) return;

                const cols = line.split(',');

                products.push({
                    barcode: cols[0] || '',
                    name: cols[1] || '',
                    supplier: cols[2] || '',
                    buyPrice: cols[3] || '',
                    sellPrice: cols[4] || '',
                    quantity: cols[5] || ''
                });

            });

            saveStorage();

            renderProducts();

            alert('CSV importato correttamente!');
        };

        reader.readAsText(file);

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

        alert('Excel importato correttamente!');
    };

    reader.readAsArrayBuffer(file);
}


function normalizeKey(key){

    return String(key || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g,'');
}

function getValue(row, possibleKeys){

    const normalizedMap = {};

    Object.keys(row).forEach(k=>{
        normalizedMap[normalizeKey(k)] = row[k];
    });

    for(const key of possibleKeys){

        const value = normalizedMap[normalizeKey(key)];

        if(value !== undefined){
            return value;
        }
    }

    return '';
}

function importExcel(event){

    const file = event.target.files[0];

    if(!file){
        return;
    }

    const fileName = file.name.toLowerCase();

    const reader = new FileReader();

    reader.onload = function(e){

        let json = [];

        try{

            if(fileName.endsWith('.csv')){

                const text = e.target.result;

                const workbook = XLSX.read(text,{type:'string'});

                const sheetName = workbook.SheetNames[0];

                const worksheet = workbook.Sheets[sheetName];

                json = XLSX.utils.sheet_to_json(
                    worksheet,
                    {defval:''}
                );

            }else{

                const data =
                    new Uint8Array(e.target.result);

                const workbook =
                    XLSX.read(data,{
                        type:'array'
                    });

                const sheetName =
                    workbook.SheetNames[0];

                const worksheet =
                    workbook.Sheets[sheetName];

                json = XLSX.utils.sheet_to_json(
                    worksheet,
                    {defval:''}
                );
            }

            let imported = 0;
            let updated = 0;

            json.forEach(row=>{

                const product = {

                    barcode: getValue(row,[
                        'Barcode',
                        'Codice',
                        'Codice Barre',
                        'EAN',
                        '条码'
                    ]),

                    name: getValue(row,[
                        'Prodotto',
                        'Nome',
                        'Articolo',
                        'Product',
                        '商品'
                    ]),

                    supplier: getValue(row,[
                        'Fornitore',
                        'fornitore',
                        'FORNITORE',
                        'Supplier',
                        'Nome Fornitore',
                        '供应商'
                    ]),

                    buyPrice: getValue(row,[
                        'Acquisto',
                        'Prezzo Acquisto',
                        'BuyPrice'
                    ]),

                    sellPrice: getValue(row,[
                        'Vendita',
                        'Prezzo Vendita',
                        'SellPrice'
                    ]),

                    quantity: getValue(row,[
                        'Quantita',
                        'Quantità',
                        'Qta',
                        'Quantity'
                    ])
                };

                if(!product.barcode) return;

                const existingIndex = products.findIndex(
                    p => String(p.barcode) === String(product.barcode)
                );

                if(existingIndex !== -1){

                    products[existingIndex] = {
                        ...products[existingIndex],
                        ...product
                    };

                    updated++;

                }else{

                    products.push(product);

                    imported++;
                }

            });

            saveStorage();

            renderProducts();

            alert(
                'Import completato!\\n' +
                'Nuovi prodotti: ' + imported + '\\n' +
                'Aggiornati: ' + updated
            );

        }catch(err){

            console.error(err);

            alert('Errore importazione file');
        }
    };

    if(fileName.endsWith('.csv')){

        reader.readAsText(file,'UTF-8');

    }else{

        reader.readAsArrayBuffer(file);
    }
}


window.onload = function(){

    renderProducts();

    const search =
        document.getElementById('search');

    if(search){
        search.focus();
    }
};
