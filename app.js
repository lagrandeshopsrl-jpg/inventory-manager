
/* ===== SUPABASE CLOUD CONFIG ===== */
const SUPABASE_URL = "https://kvxslzlpvzmwlqgirsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_JzG8DuX-hscXifyCUz9jFA_fmOOkFJ1";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let cloudReady = false;
let cloudLoading = false;

function setCloudStatus(text, type=''){
  const el = document.getElementById('cloudStatus');
  if(!el) return;
  el.className = 'cloud-status ' + type;
  el.innerText = text;
}


let products = JSON.parse(localStorage.getItem('products') || '[]');
let importSessions = JSON.parse(localStorage.getItem('importSessions') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;
let editingIndex = null;
let currentView = 'products';

function valueOf(p, keys){ for(const k of keys){ if(p && p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k]; } return ''; }
function getBarcode(p){ return valueOf(p,['barcode','Barcode','codice','EAN','条码']); }
function getName(p){ return valueOf(p,['name','prodotto','Prodotto','Nome','商品']); }
function getSupplier(p){ return valueOf(p,['supplier','fornitore','Fornitore','Supplier','供应商']); }
function getBuy(p){ return valueOf(p,['buyPrice','acquisto','Acquisto','Prezzo Acquisto','进价']); }
function getSell(p){ return valueOf(p,['sellPrice','vendita','Vendita','Prezzo Vendita','售价']); }
function saveStorage(){ localStorage.setItem('products', JSON.stringify(products)); }
function saveImportSessions(){ localStorage.setItem('importSessions', JSON.stringify(importSessions)); }

function setActive(view){
  document.getElementById('menuProducts')?.classList.toggle('active',view==='products');
  document.getElementById('menuSuppliers')?.classList.toggle('active',view==='suppliers');
  document.getElementById('menuHistory')?.classList.toggle('active',view==='history');
}

function showProducts(){
  currentView='products'; setActive('products');
  document.getElementById('pageTitle').innerText='Gestione Prodotti';
  document.getElementById('pageSubtitle').innerText='Gestionale Magazzino / 库存管理';
  document.getElementById('productsPage').classList.remove('hidden');
  document.getElementById('suppliersPage').classList.add('hidden');
  document.getElementById('historyPage').classList.add('hidden');
  renderProducts();
}

function showSuppliers(){
  currentView='suppliers'; setActive('suppliers');
  document.getElementById('pageTitle').innerText='Fornitori';
  document.getElementById('pageSubtitle').innerText='Cartelle fornitori / 供应商文件夹';
  document.getElementById('productsPage').classList.add('hidden');
  document.getElementById('suppliersPage').classList.remove('hidden');
  document.getElementById('historyPage').classList.add('hidden');
  renderSupplierFolders();
}

function showHistory(){
  currentView='history'; setActive('history');
  document.getElementById('pageTitle').innerText='Cronologia importazioni';
  document.getElementById('pageSubtitle').innerText='Importazioni suddivise per file / 导入记录';
  document.getElementById('productsPage').classList.add('hidden');
  document.getElementById('suppliersPage').classList.add('hidden');
  document.getElementById('historyPage').classList.remove('hidden');
  renderImportSessions();
}

function renderProducts(){
  const search=(document.getElementById('search')?.value||'').toLowerCase();
  const table=document.getElementById('productTable'); table.innerHTML='';
  const matches=[];
  products.forEach((p,idx)=>{ if(String(getBarcode(p)).toLowerCase().includes(search)||String(getName(p)).toLowerCase().includes(search)||String(getSupplier(p)).toLowerCase().includes(search)) matches.push(idx); });
  const totalPages=Math.max(1,Math.ceil(matches.length/itemsPerPage)); if(currentPage>totalPages) currentPage=totalPages;
  matches.slice((currentPage-1)*itemsPerPage,currentPage*itemsPerPage).forEach(realIndex=>{
    const p=products[realIndex];
    table.innerHTML+=`<tr><td><input type="checkbox" class="product-checkbox" data-index="${realIndex}"></td><td>${getBarcode(p)}</td><td>${getName(p)}</td><td>${getSupplier(p)||'-'}</td><td>${getBuy(p)}</td><td>${getSell(p)}</td><td><div class="action-buttons"><button class="edit-btn" onclick="openEditModal(${realIndex})">✎</button><button class="delete-btn" onclick="deleteProduct(${realIndex})">🗑</button></div></td></tr>`;
  });
  document.getElementById('pageInfo').innerText=`Pagina ${currentPage} di ${totalPages}`;
}

function supplierNameOf(p){ const s=String(getSupplier(p)||'').trim(); return s||'Senza fornitore'; }
function groupBySuppliers(){ const groups={}; products.forEach((p,index)=>{ const s=supplierNameOf(p); if(!groups[s]) groups[s]=[]; groups[s].push({product:p,index}); }); return groups; }
function renderSupplierFolders(){
  const groups=groupBySuppliers(), search=(document.getElementById('supplierSearch')?.value||'').toLowerCase();
  const names=Object.keys(groups).filter(n=>n.toLowerCase().includes(search)).sort((a,b)=>a.localeCompare(b));
  document.getElementById('supplierStats').innerHTML=`<div class="stat-box">Fornitori totali: ${Object.keys(groups).length}</div><div class="stat-box">Prodotti totali: ${products.length}</div>`;
  document.getElementById('supplierDetail').classList.add('hidden'); document.getElementById('supplierFolders').classList.remove('hidden');
  document.getElementById('supplierFolders').innerHTML = names.length ? names.map(name=>`<div class="folder-card" onclick="openSupplierFolder('${encodeURIComponent(name)}')"><div class="folder-icon">📁</div><div class="folder-name">${name}</div><div class="folder-count">${groups[name].length} prodotti</div></div>`).join('') : '<p>Nessun fornitore trovato.</p>';
}
function openSupplierFolder(encodedName){
  const name=decodeURIComponent(encodedName), groups=groupBySuppliers(), items=groups[name]||[];
  document.getElementById('supplierFolders').classList.add('hidden'); document.getElementById('supplierDetail').classList.remove('hidden');
  const rows=items.map(item=>{const p=item.product; return `<tr><td><input type="checkbox" class="supplier-product-checkbox" data-index="${item.index}"></td><td>${getBarcode(p)}</td><td>${getName(p)}</td><td>${getBuy(p)}</td><td>${getSell(p)}</td><td><button class="edit-btn" onclick="openEditModal(${item.index})">Modifica</button><button class="delete-btn" onclick="deleteProduct(${item.index})">Elimina</button></td></tr>`}).join('');
  document.getElementById('supplierDetail').innerHTML=`<div class="supplier-detail-header"><h2>📁 ${name}</h2><div class="supplier-detail-actions"><button onclick="selectAllSupplierProducts()">Seleziona tutti</button><button onclick="deselectAllSupplierProducts()">Deseleziona</button><button class="danger" onclick="deleteSelectedSupplierProducts()">Elimina selezionati</button><button class="back-folder" onclick="renderSupplierFolders()">Torna alle cartelle</button></div></div><div class="table-card"><table><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Acquisto</th><th>Vendita</th><th>Azioni</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function selectAllSupplierProducts(){document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>cb.checked=true);}
function deselectAllSupplierProducts(){document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>cb.checked=false);}
function deleteSelectedSupplierProducts(){const selected=[];document.querySelectorAll('.supplier-product-checkbox').forEach(cb=>{if(cb.checked)selected.push(parseInt(cb.dataset.index));}); if(!selected.length){alert('Nessun prodotto selezionato');return;} if(confirm('Eliminare i prodotti selezionati?')){selected.sort((a,b)=>b-a).forEach(i=>products.splice(i,1));saveStorage();renderSupplierFolders();}}

function renderImportSessions(){
  const search=(document.getElementById('historySearch')?.value||'').toLowerCase();
  const box=document.getElementById('importSessionsList');
  const sessions=importSessions.filter(s=>String(s.fileName||'').toLowerCase().includes(search));
  if(!sessions.length){box.innerHTML='<div class="import-session"><div class="import-session-header"><div><div class="import-session-title">Nessuna importazione salvata</div><div class="import-session-meta">Le prossime importazioni compariranno qui.</div></div></div></div>';return;}
  box.innerHTML=sessions.map(session=>`<div class="import-session"><div class="import-session-header"><div><div class="import-session-title">📁 ${session.fileName||'Importazione'}</div><div class="import-session-meta">${new Date(session.time).toLocaleString('it-IT')} · ${session.products.length} prodotti</div></div><div class="import-session-actions"><button class="session-open" onclick="toggleImportSession('${session.id}')">Apri / Chiudi</button><button class="session-delete" onclick="deleteWholeImportSession('${session.id}')">Elimina importazione</button></div></div><div class="import-session-body" id="body-${session.id}"><div class="import-selected-actions"><button onclick="selectImportProducts('${session.id}')">Seleziona tutti</button><button onclick="deselectImportProducts('${session.id}')">Deseleziona</button><button class="danger" onclick="deleteSelectedImportProducts('${session.id}')">Elimina selezionati</button></div><table class="import-products-table"><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Fornitore</th><th>Acquisto</th><th>Vendita</th></tr></thead><tbody>${session.products.map(p=>`<tr><td><input type="checkbox" class="import-check-${session.id}" data-barcode="${p.barcode}"></td><td>${p.barcode||''}</td><td>${p.name||''}</td><td>${p.supplier||''}</td><td>${p.buyPrice||''}</td><td>${p.sellPrice||''}</td></tr>`).join('')}</tbody></table></div></div>`).join('');
}
function toggleImportSession(id){const body=document.getElementById('body-'+id); if(body) body.style.display=body.style.display==='block'?'none':'block';}
function selectImportProducts(id){document.querySelectorAll('.import-check-'+id).forEach(cb=>cb.checked=true);}
function deselectImportProducts(id){document.querySelectorAll('.import-check-'+id).forEach(cb=>cb.checked=false);}
function deleteProductsByBarcodes(barcodes){const set=new Set(barcodes.map(String)); products=products.filter(p=>!set.has(String(getBarcode(p)))); saveStorage();}
function deleteWholeImportSession(id){const session=importSessions.find(s=>s.id===id); if(!session)return; if(confirm('Eliminare TUTTI i prodotti di questa importazione?')){deleteProductsByBarcodes(session.products.map(p=>p.barcode)); importSessions=importSessions.filter(s=>s.id!==id); saveImportSessions(); renderImportSessions();}}
function deleteSelectedImportProducts(id){const selected=[]; document.querySelectorAll('.import-check-'+id).forEach(cb=>{if(cb.checked)selected.push(cb.dataset.barcode);}); if(!selected.length){alert('Nessun prodotto selezionato');return;} if(confirm('Eliminare i prodotti selezionati?')){deleteProductsByBarcodes(selected); const session=importSessions.find(s=>s.id===id); if(session){const set=new Set(selected.map(String)); session.products=session.products.filter(p=>!set.has(String(p.barcode))); if(!session.products.length) importSessions=importSessions.filter(s=>s.id!==id); saveImportSessions();} renderImportSessions();}}
function clearImportSessions(){if(confirm('Svuotare cronologia importazioni?')){importSessions=[];saveImportSessions();renderImportSessions();}}

function openEditModal(index){editingIndex=index;const p=products[index];document.getElementById('editBarcode').value=getBarcode(p);document.getElementById('editName').value=getName(p);document.getElementById('editSupplier').value=getSupplier(p);document.getElementById('editBuy').value=getBuy(p);document.getElementById('editSell').value=getSell(p);document.getElementById('editModal').style.display='flex';}
function closeEditModal(){document.getElementById('editModal').style.display='none';editingIndex=null;}
function saveEditProduct(){if(editingIndex===null)return; const barcode=document.getElementById('editBarcode').value.trim(),name=document.getElementById('editName').value.trim(),supplier=document.getElementById('editSupplier').value.trim(),buyPrice=document.getElementById('editBuy').value.trim(),sellPrice=document.getElementById('editSell').value.trim(); products[editingIndex]={...products[editingIndex],barcode,name,supplier,buyPrice,sellPrice,prodotto:name,fornitore:supplier,acquisto:buyPrice,vendita:sellPrice}; saveStorage();closeEditModal(); currentView==='suppliers'?renderSupplierFolders():renderProducts();}
function openNewProductModal(){['newBarcode','newName','newSupplier','newBuy','newSell'].forEach(id=>document.getElementById(id).value='');document.getElementById('newProductModal').style.display='flex';setTimeout(()=>document.getElementById('newBarcode').focus(),100);}
function closeNewProductModal(){document.getElementById('newProductModal').style.display='none';}
function saveNewProduct(){const product={barcode:document.getElementById('newBarcode').value.trim(),name:document.getElementById('newName').value.trim(),supplier:document.getElementById('newSupplier').value.trim(),buyPrice:document.getElementById('newBuy').value.trim(),sellPrice:document.getElementById('newSell').value.trim()}; if(!product.barcode||!product.name){alert('Inserisci barcode e nome prodotto');return;} products.unshift({...product,prodotto:product.name,fornitore:product.supplier,acquisto:product.buyPrice,vendita:product.sellPrice}); saveStorage();closeNewProductModal();renderProducts();}
function deleteProduct(index){if(confirm('Eliminare prodotto?')){products.splice(index,1);saveStorage(); currentView==='suppliers'?renderSupplierFolders():renderProducts();}}
function toggleSelectProducts(){allSelected=!allSelected;document.querySelectorAll('.product-checkbox').forEach(cb=>cb.checked=allSelected);document.getElementById('toggleSelectBtn').innerText=allSelected?'Deseleziona prodotti':'Seleziona prodotti';}
function deleteSelectedProducts(){const selected=[];document.querySelectorAll('.product-checkbox').forEach(cb=>{if(cb.checked)selected.push(parseInt(cb.dataset.index));}); if(!selected.length){alert('Nessun prodotto selezionato');return;} if(confirm('Eliminare prodotti selezionati?')){selected.sort((a,b)=>b-a).forEach(i=>products.splice(i,1));saveStorage();renderProducts();}}
function nextPage(){currentPage++;renderProducts();} function prevPage(){if(currentPage>1)currentPage--;renderProducts();}
function exportExcel(){const rows=products.map(p=>({Barcode:getBarcode(p),Prodotto:getName(p),Fornitore:getSupplier(p),Acquisto:getBuy(p),Vendita:getSell(p)}));const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Prodotti');XLSX.writeFile(wb,'prodotti.xlsx');}
function normalizeKey(key){return String(key||'').trim().toLowerCase().replace(/\s+/g,'');}
function getValue(row,keys){const map={};Object.keys(row).forEach(k=>map[normalizeKey(k)]=row[k]);for(const k of keys){const v=map[normalizeKey(k)];if(v!==undefined)return v;}return '';}
function importExcel(event){
  const file=event.target.files[0]; if(!file)return;
  const before=new Set(products.map(p=>String(getBarcode(p))));
  const reader=new FileReader(); const fileName=file.name.toLowerCase();
  reader.onload=function(e){
    try{
      const wb=fileName.endsWith('.csv')?XLSX.read(e.target.result,{type:'string'}):XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      const sheet=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
      let imported=0,updated=0; 
      rows.forEach(row=>{
        const product={barcode:getValue(row,['Barcode','Codice','EAN','条码']),name:getValue(row,['Prodotto','Nome','Product','商品']),supplier:getValue(row,['Fornitore','Supplier','Nome Fornitore','供应商']),buyPrice:getValue(row,['Acquisto','Prezzo Acquisto','BuyPrice','进价']),sellPrice:getValue(row,['Vendita','Prezzo Vendita','SellPrice','售价'])};
        if(!product.barcode)return;
        const existing=products.findIndex(p=>String(getBarcode(p))===String(product.barcode));
        if(existing>=0){products[existing]={...products[existing],...product,prodotto:product.name,fornitore:product.supplier,acquisto:product.buyPrice,vendita:product.sellPrice};updated++;}
        else{products.push({...product,prodotto:product.name,fornitore:product.supplier,acquisto:product.buyPrice,vendita:product.sellPrice});imported++;}
      });
      saveStorage();
      const importedNow=products.filter(p=>{const b=String(getBarcode(p));return b&&!before.has(b);});
      if(importedNow.length){importSessions.unshift({id:'imp_'+Date.now(),fileName:file.name,time:new Date().toISOString(),products:importedNow.map(p=>({barcode:getBarcode(p),name:getName(p),supplier:getSupplier(p),buyPrice:getBuy(p),sellPrice:getSell(p)}))});saveImportSessions();}
      currentPage=1;renderProducts();event.target.value='';
      alert(`Import completato!\nNuovi: ${imported}\nAggiornati: ${updated}`);
    }catch(err){console.error(err);alert('Errore importazione file');}
  };
  if(fileName.endsWith('.csv'))reader.readAsText(file,'UTF-8'); else reader.readAsArrayBuffer(file);
}







/* ===== LOGIN PIN 4 CIFRE ===== */
const APP_PIN = "0101";

function showApp(){
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  localStorage.setItem('inventory_logged', '1');
  showProducts();
  syncNow();
}

function checkPinLogin(){
  if(localStorage.getItem('inventory_logged') === '1'){
    showApp();
  }else{
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';
  }
}

function loginWithPin(){
  const pin = document.getElementById('pinCode').value.trim();
  const errorBox = document.getElementById('loginError');

  if(pin === APP_PIN){
    errorBox.innerText = '';
    showApp();
  }else{
    errorBox.innerText = 'Codice errato';
  }
}

function logoutUser(){
  localStorage.removeItem('inventory_logged');
  document.getElementById('pinCode').value = '';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}

window.onload = function(){
  checkPinLogin();
};
