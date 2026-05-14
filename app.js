let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;
let editingIndex = null;
let currentView = 'products';

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

function setActiveMenu(view){
  document.getElementById('menuProducts').classList.toggle('active', view === 'products');
  document.getElementById('menuSuppliers').classList.toggle('active', view === 'suppliers');
}

function showProducts(){
  currentView = 'products';
  setActiveMenu('products');

  document.getElementById('pageTitle').innerText = 'Gestione Prodotti';
  document.getElementById('pageSubtitle').innerText = 'Gestionale Magazzino / 库存管理';

  document.getElementById('productsPage').classList.remove('hidden');
  document.getElementById('suppliersPage').classList.add('hidden');

  renderProducts();
  setTimeout(()=>document.getElementById('search')?.focus(),50);
}

function showSuppliers(){
  currentView = 'suppliers';
  setActiveMenu('suppliers');

  document.getElementById('pageTitle').innerText = 'Fornitori';
  document.getElementById('pageSubtitle').innerText = 'Cartelle fornitori / 供应商文件夹';

  document.getElementById('productsPage').classList.add('hidden');
  document.getElementById('suppliersPage').classList.remove('hidden');

  renderSupplierFolders();
}

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

function supplierNameOf(p){
  const s = String(getSupplier(p) || '').trim();
  return s || 'Senza fornitore';
}

function groupBySuppliers(){
  const groups = {};
  products.forEach((p, index)=>{
    const s = supplierNameOf(p);
    if(!groups[s]) groups[s] = [];
    groups[s].push({product:p,index});
  });
  return groups;
}

function renderSupplierFolders(){
  const groups = groupBySuppliers();
  const search = (document.getElementById('supplierSearch')?.value || '').toLowerCase();
  const names = Object.keys(groups).filter(n=>n.toLowerCase().includes(search)).sort((a,b)=>a.localeCompare(b));

  document.getElementById('supplierStats').innerHTML = `
    <div class="stat-box">Fornitori totali: ${Object.keys(groups).length}</div>
    <div class="stat-box">Prodotti totali: ${products.length}</div>
  `;

  document.getElementById('supplierDetail').classList.add('hidden');
  document.getElementById('supplierFolders').classList.remove('hidden');

  if(names.length === 0){
    document.getElementById('supplierFolders').innerHTML = '<p>Nessun fornitore trovato.</p>';
    return;
  }

  document.getElementById('supplierFolders').innerHTML = names.map(name=>`
    <div class="folder-card" onclick="openSupplierFolder('${encodeURIComponent(name)}')">
      <div class="folder-icon">📁</div>
      <div class="folder-name">${name}</div>
      <div class="folder-count">${groups[name].length} prodotti</div>
    </div>
  `).join('');
}

function openSupplierFolder(encodedName){
  const name = decodeURIComponent(encodedName);
  const groups = groupBySuppliers();
  const items = groups[name] || [];

  document.getElementById('supplierFolders').classList.add('hidden');
  document.getElementById('supplierDetail').classList.remove('hidden');

  const rows = items.map(item=>{
    const p = item.product;
    return `
      <tr>
        <td>${getBarcode(p)}</td>
        <td>${getName(p)}</td>
        <td>${getBuy(p)}</td>
        <td>${getSell(p)}</td>
        <td>
          <button class="edit-btn" onclick="openEditModal(${item.index})">Modifica</button>
          <button class="delete-btn" onclick="deleteProduct(${item.index})">Elimina</button>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('supplierDetail').innerHTML = `
    <div class="supplier-detail-header">
      <h2>📁 ${name}</h2>
      <button class="back-folder" onclick="renderSupplierFolders()">Torna alle cartelle</button>
    </div>
    <div class="table-card">
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
  `;
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
  closeEditModal();

  if(currentView === 'suppliers') renderSupplierFolders();
  else renderProducts();
}

function deleteProduct(index){
  if(confirm('Eliminare prodotto?')){
    products.splice(index,1);
    saveStorage();
    if(currentView === 'suppliers') renderSupplierFolders();
    else renderProducts();
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

function exportExcel(){
  const rows = products.map(p => ({
    Barcode:getBarcode(p),
    Prodotto:getName(p),
    Fornitore:getSupplier(p),
    Acquisto:getBuy(p),
    Vendita:getSell(p)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prodotti');
  XLSX.writeFile(wb, 'prodotti.xlsx');
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
  showProducts();
};
