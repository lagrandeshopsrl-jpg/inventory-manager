
let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;
let editingIndex = null;

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
                    <button onclick="openEditModal(${start + index})">Modifica</button>
                    <button onclick="deleteProduct(${start + index})">Elimina</button>
                </div>
            </td>
        </tr>
        `;
    });

    document.getElementById('pageInfo').innerText =
        `Pagina ${currentPage} di ${totalPages}`;
}

function openEditModal(index){

    editingIndex = index;

    const p = products[index];

    document.getElementById('editBarcode').value = p.barcode || '';
    document.getElementById('editName').value = p.name || '';
    document.getElementById('editSupplier').value = p.supplier || '';
    document.getElementById('editBuy').value = p.buyPrice || '';
    document.getElementById('editSell').value = p.sellPrice || '';

    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal(){
    document.getElementById('editModal').style.display = 'none';
}

function saveEditProduct(){

    if(editingIndex === null) return;

    products[editingIndex].barcode =
        document.getElementById('editBarcode').value;

    products[editingIndex].name =
        document.getElementById('editName').value;

    products[editingIndex].supplier =
        document.getElementById('editSupplier').value;

    products[editingIndex].buyPrice =
        document.getElementById('editBuy').value;

    products[editingIndex].sellPrice =
        document.getElementById('editSell').value;

    saveStorage();

    renderProducts();

    closeEditModal();

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

window.onload = function(){

    renderProducts();

    const search = document.getElementById('search');

    if(search){
        search.focus();
    }
};
