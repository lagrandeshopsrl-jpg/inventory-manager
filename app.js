let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;
let editingIndex = null;

function valueOf(p, keys){
  for(const k of keys){
    if(p && p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k];
  }
  return '';
}
function getBarcode(p){ return valueOf(p,['barcode','Barcode','codice','EAN','条码']); }
function getName(p){ return valueOf(p,['name','prodotto','Prodotto','Nome','商品']); }
function getSupplier(p){ return valueOf(p,['supplier','fornitore','Fornitore','Supplier','供应商']); }
function getBuy(p){ return valueOf(p,['buyPrice','acquisto','Acquisto','Prezzo Acquisto','进价']); }
function getSell(p){ return valueOf(p,['sellPrice','vendita','Vendita','Prezzo Vendita','售价']); }

function saveStorage(){ localStorage.setItem('products', JSON.stringify(products)); }

function renderProducts(){
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  const table = document.getElementById('productTable');
  table.innerHTML = '';

  const matches = [];
  products.forEach((p, idx)=>{
    if(
      String(getBarcode(p)).toLowerCase().includes(search) ||
      String(getName(p)).toLowerCase().includes(search) ||
      String(getSupplier(p)).toLowerCase().includes(search)
    ) matches.push(idx);
  });

  const totalPages = Math.max(1, Math.ceil(matches.length/itemsPerPage));
  if(currentPage > totalPages) currentPage = totalPages;

  const pageIndexes = matches.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);

  pageIndexes.forEach(realIndex=>{
    const p = products[realIndex];
    table.innerHTML += `
      <tr>
        <td><input type="checkbox" class="product-checkbox" data-index="${realIndex}"></td>
        <td>${getBarcode(p)}</td>
        <td>${getName(p)}</td>
        <td>${getSupplier(p) || '-'}</td>
        <td>${getBuy(p)}</td>
        <td>${getSell(p)}</td>
        <td>
          <div class="action-buttons">
            <button class="edit-btn" onclick="openEditModal(${realIndex})">✎</button>
            <button class="delete-btn" onclick="deleteProduct(${realIndex})">🗑</button>
          </div>
        </td>
      </tr>`;
  });

  document.getElementById('pageInfo').innerText = `Pagina ${currentPage} di ${totalPages}`;
}

function openEditModal(index){
  editingIndex = index;
  const p = products[index];

  document.getElementById('editBarcode').value = getBarcode(p);
  document.getElementById('editName').value = getName(p);
  document.getElementById('editSupplier').value = getSupplier(p);
  document.getElementById('editBuy').value = getBuy(p);
  document.getElementById('editSell').value = getSell(p);

  document.getElementById('editModal').style.display='flex';
}

function closeEditModal(){
  document.getElementById('editModal').style.display='none';
  editingIndex = null;
}

function saveEditProduct(){
  if(editingIndex === null) return;

  const barcode = document.getElementById('editBarcode').value.trim();
  const name = document.getElementById('editName').value.trim();
  const supplier = document.getElementById('editSupplier').value.trim();
  const buyPrice = document.getElementById('editBuy').value.trim();
  const sellPrice = document.getElementById('editSell').value.trim();

  products[editingIndex] = {
    ...products[editingIndex],
    barcode, name, supplier, buyPrice, sellPrice,
    prodotto:name, fornitore:supplier, acquisto:buyPrice, vendita:sellPrice
  };

  saveStorage();
  renderProducts();
  closeEditModal();
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
  document.querySelectorAll('.product-checkbox').forEach(cb=>cb.checked=allSelected);
  document.getElementById('toggleSelectBtn').innerText = allSelected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

function deleteSelectedProducts(){
  const selected=[];
  document.querySelectorAll('.product-checkbox').forEach(cb=>{ if(cb.checked) selected.push(parseInt(cb.dataset.index)); });
  if(selected.length===0){ alert('Nessun prodotto selezionato'); return; }
  if(confirm('Eliminare prodotti selezionati?')){
    selected.sort((a,b)=>b-a).forEach(i=>products.splice(i,1));
    saveStorage();
    renderProducts();
  }
}

function nextPage(){ currentPage++; renderProducts(); }
function prevPage(){ if(currentPage>1) currentPage--; renderProducts(); }


function exportCSV(){
  const rows = products.map(p => ({
    Barcode: getBarcode(p),
    Prodotto: getName(p),
    Fornitore: getSupplier(p),
    Acquisto: getBuy(p),
    Vendita: getSell(p)
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Prodotti");

  XLSX.writeFile(workbook, "prodotti.xlsx");
}


function normalizeKey(key){ return String(key || '').trim().toLowerCase().replace(/\s+/g,''); }
function getValue(row, keys){
  const map={}; Object.keys(row).forEach(k=>map[normalizeKey(k)]=row[k]);
  for(const k of keys){ const v=map[normalizeKey(k)]; if(v!==undefined) return v; }
  return '';
}

function importExcel(event){
  const file=event.target.files[0];
  if(!file) return;
  const fileName=file.name.toLowerCase();
  const reader=new FileReader();

  reader.onload=function(e){
    try{
      const workbook = fileName.endsWith('.csv')
        ? XLSX.read(e.target.result,{type:'string'})
        : XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
      let imported=0, updated=0;

      rows.forEach(row=>{
        const product={
          barcode:getValue(row,['Barcode','Codice','EAN','条码']),
          name:getValue(row,['Prodotto','Nome','Product','商品']),
          supplier:getValue(row,['Fornitore','Supplier','Nome Fornitore','供应商']),
          buyPrice:getValue(row,['Acquisto','Prezzo Acquisto','BuyPrice','进价']),
          sellPrice:getValue(row,['Vendita','Prezzo Vendita','SellPrice','售价'])
        };
        if(!product.barcode) return;
        const existing=products.findIndex(p=>String(getBarcode(p))===String(product.barcode));
        if(existing>=0){ products[existing]={...products[existing],...product}; updated++; }
        else{ products.push(product); imported++; }
      });

      saveStorage(); renderProducts();
      alert(`Import completato!\nNuovi: ${imported}\nAggiornati: ${updated}`);
    }catch(err){ console.error(err); alert('Errore importazione file'); }
  };

  if(fileName.endsWith('.csv')) reader.readAsText(file,'UTF-8');
  else reader.readAsArrayBuffer(file);
}

window.onload=function(){
  renderProducts();
  const search=document.getElementById('search');
  if(search) search.focus();
};




function normalizeSupplierName(name){
  const value = String(name || '').trim();
  return value || 'Senza fornitore';
}





/* FIX FINALE FORNITORI */
function supplierNameOf(p){
  const v = String(getSupplier(p) || '').trim();
  return v || 'Senza fornitore';
}

function showSuppliers(){
  const tableCard = document.querySelector('.table-card');
  const pagination = document.querySelector('.pagination');
  const toolbar = document.querySelector('.toolbar');
  const suppliersView = document.getElementById('suppliersView');
  const suppliersList = document.getElementById('suppliersList');
  const suppliersSummary = document.getElementById('suppliersSummary');

  if(toolbar) toolbar.style.display = 'none';
  if(tableCard) tableCard.style.display = 'none';
  if(pagination) pagination.style.display = 'none';
  if(suppliersView) suppliersView.style.display = 'block';

  const groups = {};

  products.forEach((p, index)=>{
    const supplier = supplierNameOf(p);
    if(!groups[supplier]) groups[supplier] = [];
    groups[supplier].push({product:p, index});
  });

  const names = Object.keys(groups).sort((a,b)=>a.localeCompare(b));

  if(suppliersSummary){
    suppliersSummary.innerHTML = `
      <div class="summary-box">Fornitori totali: ${names.length}</div>
      <div class="summary-box">Prodotti totali: ${products.length}</div>
    `;
  }

  if(!suppliersList) return;

  if(names.length === 0){
    suppliersList.innerHTML = '<p>Nessun fornitore trovato.</p>';
    return;
  }

  suppliersList.innerHTML = names.map((name, idx)=>{
    const rows = groups[name].map(item=>{
      const p = item.product;
      return `
        <tr>
          <td>${getBarcode(p)}</td>
          <td>${getName(p)}</td>
          <td>${getBuy(p)}</td>
          <td>${getSell(p)}</td>
          <td><button class="edit-btn" onclick="openEditModal(${item.index})">Modifica</button></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="supplier-section">
        <div class="supplier-title" onclick="toggleSupplierSection(${idx})">
          <div>${name}</div>
          <span>${groups[name].length} prodotti</span>
        </div>
        <div class="supplier-products" id="supplier-section-${idx}">
          <table>
            <thead>
              <tr>
                <th>Barcode</th>
                <th>Prodotto</th>
                <th>Acquisto</th>
                <th>Vendita</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function toggleSupplierSection(id){
  const el = document.getElementById('supplier-section-' + id);
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function showProducts(){
  const tableCard = document.querySelector('.table-card');
  const pagination = document.querySelector('.pagination');
  const toolbar = document.querySelector('.toolbar');
  const suppliersView = document.getElementById('suppliersView');

  if(toolbar) toolbar.style.display = 'flex';
  if(tableCard) tableCard.style.display = 'block';
  if(pagination) pagination.style.display = 'flex';
  if(suppliersView) suppliersView.style.display = 'none';

  renderProducts();
}
