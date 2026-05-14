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


/* ===== CRONOLOGIA PRODOTTI AGGIUNTI ===== */
let productHistory = JSON.parse(localStorage.getItem('productHistory') || '[]');

function saveHistory(){
  localStorage.setItem('productHistory', JSON.stringify(productHistory));
}

function addHistoryEntry(product, action='Aggiunto'){
  productHistory.unshift({
    action,
    time: new Date().toISOString(),
    barcode: getBarcode(product),
    name: getName(product),
    supplier: getSupplier(product),
    buyPrice: getBuy(product),
    sellPrice: getSell(product)
  });
  saveHistory();
}

function formatDateIT(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT');
}

function formatTimeIT(iso){
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function showHistory(){
  currentView = 'history';

  document.getElementById('menuProducts')?.classList.remove('active');
  document.getElementById('menuSuppliers')?.classList.remove('active');
  document.getElementById('menuHistory')?.classList.add('active');

  document.getElementById('pageTitle').innerText = 'Cronologia';
  document.getElementById('pageSubtitle').innerText = 'Prodotti aggiunti di recente / 最近添加';

  document.getElementById('productsPage').classList.add('hidden');
  document.getElementById('suppliersPage').classList.add('hidden');
  document.getElementById('historyPage').classList.remove('hidden');

  renderHistory();
}

function renderHistory(){
  const search = (document.getElementById('historySearch')?.value || '').toLowerCase();
  const list = document.getElementById('historyList');

  const filtered = productHistory.filter(h =>
    String(h.barcode || '').toLowerCase().includes(search) ||
    String(h.name || '').toLowerCase().includes(search) ||
    String(h.supplier || '').toLowerCase().includes(search)
  );

  if(filtered.length === 0){
    list.innerHTML = '<div class="history-day"><div class="history-day-title">Nessuna cronologia trovata</div></div>';
    return;
  }

  const groups = {};
  filtered.forEach(h=>{
    const day = formatDateIT(h.time);
    if(!groups[day]) groups[day] = [];
    groups[day].push(h);
  });

  list.innerHTML = Object.keys(groups).map(day=>{
    const items = groups[day].map(h=>`
      <div class="history-item">
        <div class="history-time">${formatTimeIT(h.time)}</div>
        <div>
          <div class="history-product">${h.name || '-'}</div>
          <div class="history-meta">Barcode: ${h.barcode || '-'} · Fornitore: ${h.supplier || '-'}</div>
        </div>
        <div class="history-badge">${h.action || 'Aggiunto'}</div>
      </div>
    `).join('');

    return `
      <div class="history-day">
        <div class="history-day-title">${day}</div>
        ${items}
      </div>
    `;
  }).join('');
}

function clearHistory(){
  if(confirm('Svuotare tutta la cronologia?')){
    productHistory = [];
    saveHistory();
    renderHistory();
  }
}

/* Sovrascrivo setActiveMenu per includere cronologia */
const oldSetActiveMenu = setActiveMenu;
setActiveMenu = function(view){
  document.getElementById('menuProducts')?.classList.toggle('active', view === 'products');
  document.getElementById('menuSuppliers')?.classList.toggle('active', view === 'suppliers');
  document.getElementById('menuHistory')?.classList.toggle('active', view === 'history');
};

/* Sovrascrivo showProducts/showSuppliers per nascondere cronologia */
const oldShowProducts = showProducts;
showProducts = function(){
  document.getElementById('historyPage')?.classList.add('hidden');
  oldShowProducts();
};

const oldShowSuppliers = showSuppliers;
showSuppliers = function(){
  document.getElementById('historyPage')?.classList.add('hidden');
  oldShowSuppliers();
};

/* Sovrascrivo importExcel: registra nuovi prodotti in cronologia */
const oldImportExcel = importExcel;
importExcel = function(event){
  const beforeBarcodes = new Set(products.map(p => String(getBarcode(p))));
  const oldAlert = window.alert;

  window.alert = function(msg){
    window.alert = oldAlert;

    products.forEach(p=>{
      const b = String(getBarcode(p));
      if(b && !beforeBarcodes.has(b)){
        addHistoryEntry(p, 'Aggiunto');
      }
    });

    oldAlert(msg);
  };

  oldImportExcel(event);
};

/* ===== SELEZIONE PRODOTTI NELLA CARTELLA FORNITORE ===== */
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
        <td><input type="checkbox" class="supplier-product-checkbox" data-index="${item.index}"></td>
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
      <div class="supplier-detail-actions">
        <button onclick="selectAllSupplierProducts()">Seleziona tutti</button>
        <button onclick="deselectAllSupplierProducts()">Deseleziona</button>
        <button class="danger" onclick="deleteSelectedSupplierProducts()">Elimina selezionati</button>
        <button class="back-folder" onclick="renderSupplierFolders()">Torna alle cartelle</button>
      </div>
    </div>
    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th></th>
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

function selectAllSupplierProducts(){
  document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>cb.checked=true);
}

function deselectAllSupplierProducts(){
  document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>cb.checked=false);
}

function deleteSelectedSupplierProducts(){
  const selected = [];
  document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>{
    if(cb.checked) selected.push(parseInt(cb.dataset.index));
  });

  if(selected.length === 0){
    alert('Nessun prodotto selezionato');
    return;
  }

  if(confirm('Eliminare i prodotti selezionati di questo fornitore?')){
    selected.sort((a,b)=>b-a).forEach(i=>products.splice(i,1));
    saveStorage();
    renderSupplierFolders();
  }
}


/* ===== NUOVO PRODOTTO ===== */
function openNewProductModal(){
  const modal = document.getElementById('newProductModal');

  document.getElementById('newBarcode').value = '';
  document.getElementById('newName').value = '';
  document.getElementById('newSupplier').value = '';
  document.getElementById('newBuy').value = '';
  document.getElementById('newSell').value = '';

  modal.style.display = 'flex';

  setTimeout(()=>document.getElementById('newBarcode')?.focus(), 100);
}

function closeNewProductModal(){
  document.getElementById('newProductModal').style.display = 'none';
}

function saveNewProduct(){
  const product = {
    barcode: document.getElementById('newBarcode').value.trim(),
    name: document.getElementById('newName').value.trim(),
    supplier: document.getElementById('newSupplier').value.trim(),
    buyPrice: document.getElementById('newBuy').value.trim(),
    sellPrice: document.getElementById('newSell').value.trim()
  };

  if(!product.barcode){
    alert('Inserisci il barcode');
    return;
  }

  if(!product.name){
    alert('Inserisci il nome prodotto');
    return;
  }

  const existing = products.findIndex(p => String(getBarcode(p)) === String(product.barcode));

  if(existing >= 0){
    if(!confirm('Questo barcode esiste già. Vuoi aggiornare il prodotto esistente?')){
      return;
    }

    products[existing] = {
      ...products[existing],
      ...product,
      prodotto: product.name,
      fornitore: product.supplier,
      acquisto: product.buyPrice,
      vendita: product.sellPrice
    };

    saveStorage();

    if(typeof addHistoryEntry === 'function'){
      addHistoryEntry(products[existing], 'Aggiornato');
    }

  }else{
    products.unshift({
      ...product,
      prodotto: product.name,
      fornitore: product.supplier,
      acquisto: product.buyPrice,
      vendita: product.sellPrice
    });

    saveStorage();

    if(typeof addHistoryEntry === 'function'){
      addHistoryEntry(products[0], 'Aggiunto');
    }
  }

  closeNewProductModal();

  if(currentView === 'suppliers'){
    renderSupplierFolders();
  }else if(currentView === 'history'){
    renderHistory();
  }else{
    currentPage = 1;
    renderProducts();
  }
}


/* ===== IMPORTAZIONI COME CARTELLE CON ELIMINA TUTTO ===== */
let importSessions = JSON.parse(localStorage.getItem('importSessions') || '[]');

function saveImportSessions(){
  localStorage.setItem('importSessions', JSON.stringify(importSessions));
}

function createImportSession(fileName, importedProducts){
  if(!importedProducts || importedProducts.length === 0) return;

  const session = {
    id: 'imp_' + Date.now(),
    fileName: fileName || 'Importazione',
    time: new Date().toISOString(),
    products: importedProducts.map(p=>({
      barcode: getBarcode(p),
      name: getName(p),
      supplier: getSupplier(p),
      buyPrice: getBuy(p),
      sellPrice: getSell(p)
    }))
  };

  importSessions.unshift(session);
  saveImportSessions();
}

function renderImportSessions(){
  const box = document.getElementById('importSessionsList');
  if(!box) return;

  if(importSessions.length === 0){
    box.innerHTML = '';
    return;
  }

  box.innerHTML = importSessions.map(session=>{
    return `
      <div class="import-session">
        <div class="import-session-header">
          <div onclick="toggleImportSession('${session.id}')">
            <div class="import-session-title">📁 Importazione: ${session.fileName || ''}</div>
            <div class="import-session-meta">
              ${formatDateIT(session.time)} ${formatTimeIT(session.time)} · ${session.products.length} prodotti
            </div>
          </div>
          <div class="import-session-actions">
            <button class="session-open" onclick="toggleImportSession('${session.id}')">Apri</button>
            <button class="session-delete" onclick="deleteWholeImportSession('${session.id}')">Elimina importazione</button>
          </div>
        </div>
        <div class="import-session-body" id="body-${session.id}">
          <div class="import-selected-actions">
            <button onclick="selectImportProducts('${session.id}')">Seleziona tutti</button>
            <button onclick="deselectImportProducts('${session.id}')">Deseleziona</button>
            <button class="danger" onclick="deleteSelectedImportProducts('${session.id}')">Elimina selezionati</button>
          </div>
          <table class="import-products-table">
            <thead>
              <tr>
                <th></th>
                <th>Barcode</th>
                <th>Prodotto</th>
                <th>Fornitore</th>
                <th>Acquisto</th>
                <th>Vendita</th>
              </tr>
            </thead>
            <tbody>
              ${session.products.map(p=>`
                <tr>
                  <td><input type="checkbox" class="import-check-${session.id}" data-barcode="${p.barcode}"></td>
                  <td>${p.barcode || ''}</td>
                  <td>${p.name || ''}</td>
                  <td>${p.supplier || ''}</td>
                  <td>${p.buyPrice || ''}</td>
                  <td>${p.sellPrice || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function toggleImportSession(id){
  const body = document.getElementById('body-' + id);
  if(!body) return;
  body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

function selectImportProducts(id){
  document.querySelectorAll('.import-check-' + id).forEach(cb=>cb.checked=true);
}

function deselectImportProducts(id){
  document.querySelectorAll('.import-check-' + id).forEach(cb=>cb.checked=false);
}

function deleteProductsByBarcodes(barcodes){
  const set = new Set(barcodes.map(b=>String(b)));
  products = products.filter(p => !set.has(String(getBarcode(p))));
  saveStorage();
}

function deleteWholeImportSession(id){
  const session = importSessions.find(s=>s.id===id);
  if(!session) return;

  if(confirm('Eliminare tutti i prodotti di questa importazione?')){
    deleteProductsByBarcodes(session.products.map(p=>p.barcode));

    importSessions = importSessions.filter(s=>s.id!==id);
    saveImportSessions();

    productHistory.unshift({
      action:'Eliminata importazione',
      time:new Date().toISOString(),
      barcode:'',
      name: session.fileName,
      supplier:'',
      buyPrice:'',
      sellPrice:''
    });
    saveHistory();

    renderImportSessions();
    renderHistory();
  }
}

function deleteSelectedImportProducts(id){
  const selected = [];
  document.querySelectorAll('.import-check-' + id).forEach(cb=>{
    if(cb.checked) selected.push(cb.dataset.barcode);
  });

  if(selected.length === 0){
    alert('Nessun prodotto selezionato');
    return;
  }

  if(confirm('Eliminare i prodotti selezionati da questa importazione?')){
    deleteProductsByBarcodes(selected);

    const session = importSessions.find(s=>s.id===id);
    if(session){
      const selectedSet = new Set(selected.map(String));
      session.products = session.products.filter(p=>!selectedSet.has(String(p.barcode)));
      if(session.products.length === 0){
        importSessions = importSessions.filter(s=>s.id!==id);
      }
      saveImportSessions();
    }

    renderImportSessions();
    renderHistory();
  }
}

/* Sovrascrivo renderHistory per includere cartelle importazioni */
const originalRenderHistoryV31 = renderHistory;
renderHistory = function(){
  renderImportSessions();
  originalRenderHistoryV31();
};

/* Sovrascrivo importExcel: crea una cartella importazione eliminabile */
const originalImportExcelV31 = importExcel;
importExcel = function(event){
  const file = event.target.files[0];
  if(!file) return;

  const beforeBarcodes = new Set(products.map(p => String(getBarcode(p))));
  const fileName = file.name || 'Importazione';

  const oldAlert = window.alert;

  window.alert = function(msg){
    window.alert = oldAlert;

    const newProducts = products.filter(p => {
      const b = String(getBarcode(p));
      return b && !beforeBarcodes.has(b);
    });

    createImportSession(fileName, newProducts);

    newProducts.forEach(p=>{
      if(typeof addHistoryEntry === 'function'){
        addHistoryEntry(p, 'Aggiunto');
      }
    });

    oldAlert(msg);
  };

  originalImportExcelV31(event);
};


/* ===== CRONOLOGIA DEFINITIVA: SUDDIVISA PER OGNI IMPORTAZIONE ===== */
if(typeof importSessions === 'undefined'){
  var importSessions = JSON.parse(localStorage.getItem('importSessions') || '[]');
}

function saveImportSessions(){
  localStorage.setItem('importSessions', JSON.stringify(importSessions));
}

function createImportSession(fileName, importedProducts){
  if(!importedProducts || importedProducts.length === 0) return;

  const session = {
    id: 'imp_' + Date.now(),
    fileName: fileName || 'Importazione',
    time: new Date().toISOString(),
    products: importedProducts.map(p=>({
      barcode: getBarcode(p),
      name: getName(p),
      supplier: getSupplier(p),
      buyPrice: getBuy(p),
      sellPrice: getSell(p)
    }))
  };

  importSessions.unshift(session);
  saveImportSessions();
}

function renderImportSessions(){
  const box = document.getElementById('importSessionsList');
  if(!box) return;

  if(importSessions.length === 0){
    box.innerHTML = `
      <div class="import-session">
        <div class="import-session-header">
          <div>
            <div class="import-session-title">Nessuna importazione salvata</div>
            <div class="import-session-meta">Le prossime importazioni compariranno qui come cartelle.</div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="import-sessions-title">📁 Importazioni</div>
    ${importSessions.map(session=>`
      <div class="import-session">
        <div class="import-session-header">
          <div>
            <div class="import-session-title">📁 ${session.fileName || 'Importazione'}</div>
            <div class="import-session-meta">
              ${formatDateIT(session.time)} ${formatTimeIT(session.time)} · ${session.products.length} prodotti
            </div>
          </div>
          <div class="import-session-actions">
            <button class="session-open" onclick="toggleImportSession('${session.id}')">Apri / Chiudi</button>
            <button class="session-delete" onclick="deleteWholeImportSession('${session.id}')">Elimina importazione</button>
          </div>
        </div>

        <div class="import-session-body" id="body-${session.id}">
          <div class="import-selected-actions">
            <button onclick="selectImportProducts('${session.id}')">Seleziona tutti</button>
            <button onclick="deselectImportProducts('${session.id}')">Deseleziona</button>
            <button class="danger" onclick="deleteSelectedImportProducts('${session.id}')">Elimina selezionati</button>
          </div>

          <table class="import-products-table">
            <thead>
              <tr>
                <th></th>
                <th>Barcode</th>
                <th>Prodotto</th>
                <th>Fornitore</th>
                <th>Acquisto</th>
                <th>Vendita</th>
              </tr>
            </thead>
            <tbody>
              ${session.products.map(p=>`
                <tr>
                  <td><input type="checkbox" class="import-check-${session.id}" data-barcode="${p.barcode}"></td>
                  <td>${p.barcode || ''}</td>
                  <td>${p.name || ''}</td>
                  <td>${p.supplier || ''}</td>
                  <td>${p.buyPrice || ''}</td>
                  <td>${p.sellPrice || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('')}
  `;
}

function toggleImportSession(id){
  const body = document.getElementById('body-' + id);
  if(!body) return;
  body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

function selectImportProducts(id){
  document.querySelectorAll('.import-check-' + id).forEach(cb=>cb.checked=true);
}

function deselectImportProducts(id){
  document.querySelectorAll('.import-check-' + id).forEach(cb=>cb.checked=false);
}

function deleteProductsByBarcodes(barcodes){
  const set = new Set(barcodes.map(b=>String(b)));
  products = products.filter(p => !set.has(String(getBarcode(p))));
  saveStorage();
}

function deleteWholeImportSession(id){
  const session = importSessions.find(s=>s.id===id);
  if(!session) return;

  if(confirm('Eliminare TUTTI i prodotti di questa importazione?')){
    deleteProductsByBarcodes(session.products.map(p=>p.barcode));
    importSessions = importSessions.filter(s=>s.id!==id);
    saveImportSessions();
    renderImportSessions();
    if(currentView === 'products') renderProducts();
  }
}

function deleteSelectedImportProducts(id){
  const selected = [];
  document.querySelectorAll('.import-check-' + id).forEach(cb=>{
    if(cb.checked) selected.push(cb.dataset.barcode);
  });

  if(selected.length === 0){
    alert('Nessun prodotto selezionato');
    return;
  }

  if(confirm('Eliminare i prodotti selezionati da questa importazione?')){
    deleteProductsByBarcodes(selected);

    const session = importSessions.find(s=>s.id===id);
    if(session){
      const selectedSet = new Set(selected.map(String));
      session.products = session.products.filter(p=>!selectedSet.has(String(p.barcode)));
      if(session.products.length === 0){
        importSessions = importSessions.filter(s=>s.id!==id);
      }
      saveImportSessions();
    }

    renderImportSessions();
  }
}

/* Override cronologia: mostra SOLO le importazioni divise */
const previousShowHistory = typeof showHistory === 'function' ? showHistory : null;
showHistory = function(){
  currentView = 'history';

  document.getElementById('menuProducts')?.classList.remove('active');
  document.getElementById('menuSuppliers')?.classList.remove('active');
  document.getElementById('menuHistory')?.classList.add('active');

  document.getElementById('pageTitle').innerText = 'Cronologia importazioni';
  document.getElementById('pageSubtitle').innerText = 'Importazioni suddivise per file / 导入记录';

  document.getElementById('productsPage')?.classList.add('hidden');
  document.getElementById('suppliersPage')?.classList.add('hidden');
  document.getElementById('historyPage')?.classList.remove('hidden');

  const historyList = document.getElementById('historyList');
  if(historyList) historyList.innerHTML = '';

  renderImportSessions();
};

/* Override import: ogni file crea una cartella importazione */
const previousImportExcel = importExcel;
importExcel = function(event){
  const file = event.target.files[0];
  if(!file) return;

  const beforeBarcodes = new Set(products.map(p => String(getBarcode(p))));
  const fileName = file.name || 'Importazione';

  const oldAlert = window.alert;

  window.alert = function(msg){
    window.alert = oldAlert;

    const importedNow = products.filter(p=>{
      const b = String(getBarcode(p));
      return b && !beforeBarcodes.has(b);
    });

    createImportSession(fileName, importedNow);

    oldAlert(msg);
  };

  previousImportExcel(event);
};
