const STORAGE_PRODUCTS_KEY = 'products';
const STORAGE_IMPORTS_KEY = 'importSessions';
const LAST_MODIFIED_KEY = 'inventory_lastModified';
const DROPBOX_TOKEN_KEY = 'inventory_dropbox_token';
const DROPBOX_PATH_KEY = 'inventory_dropbox_path';
const DEFAULT_DROPBOX_PATH = '/inventory_manager_snapshot.json';
const itemsPerPage = 100;

let products = normalizeProductList(readJson(STORAGE_PRODUCTS_KEY, []));
let importSessions = normalizeImportSessions(readJson(STORAGE_IMPORTS_KEY, []));
let currentPage = 1;
let allSelected = false;
let editingIndex = null;
let currentView = 'products';
let cloudLoading = false;
let __barcodeLastValue = '';

function readJson(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch(e){
    console.error('Storage non leggibile:', key, e);
    return fallback;
  }
}

function textValue(value){
  if(value === undefined || value === null) return '';
  return String(value).trim();
}

function valueOf(p, keys){
  for(const k of keys){
    if(p && p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k];
  }
  return '';
}

function getBarcode(p){ return textValue(valueOf(p, ['barcode','Barcode','codice','Codice','EAN','条码'])); }
function getName(p){ return textValue(valueOf(p, ['name','prodotto','Prodotto','Nome','Product','商品'])); }
function getSupplier(p){ return textValue(valueOf(p, ['supplier','fornitore','Fornitore','Supplier','Nome Fornitore','供应商'])); }
function getCategory(p){ return textValue(valueOf(p, ['category','categoria','Categoria','Category','类别'])); }
function getBuy(p){ return textValue(valueOf(p, ['buyPrice','buy_price','acquisto','Acquisto','Prezzo Acquisto','BuyPrice','进价'])); }
function getSell(p){ return textValue(valueOf(p, ['sellPrice','sell_price','vendita','Vendita','Prezzo Vendita','SellPrice','售价'])); }

function canonicalProduct(p){
  const barcode = getBarcode(p);
  const name = getName(p);
  const supplier = getSupplier(p);
  const category = getCategory(p);
  const buyPrice = getBuy(p);
  const sellPrice = getSell(p);
  return {
    barcode,
    name,
    supplier,
    category,
    buyPrice,
    sellPrice,
    prodotto: name,
    fornitore: supplier,
    categoria: category,
    acquisto: buyPrice,
    vendita: sellPrice
  };
}

function normalizeProductList(list){
  return Array.isArray(list) ? list.map(canonicalProduct).filter(p => p.barcode || p.name) : [];
}

function importSessionProduct(p){
  const product = canonicalProduct(p);
  return {
    barcode: product.barcode,
    name: product.name,
    supplier: product.supplier,
    category: product.category,
    buyPrice: product.buyPrice,
    sellPrice: product.sellPrice
  };
}

function normalizeImportSessions(list){
  if(!Array.isArray(list)) return [];
  return list.map((session, index) => ({
    id: textValue(session?.id || session?.session_id || `imp_${Date.now()}_${index}`),
    fileName: textValue(session?.fileName || session?.file_name || 'Importazione'),
    time: textValue(session?.time || session?.created_at || new Date().toISOString()),
    products: Array.isArray(session?.products) ? session.products.map(importSessionProduct) : []
  })).filter(session => session.id);
}

function escapeHTML(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function escapeAttr(value){
  return escapeHTML(value).replace(/`/g, '&#96;');
}

function setLocalModified(value = Date.now()){
  localStorage.setItem(LAST_MODIFIED_KEY, String(Number(value) || Date.now()));
}

function getLocalModified(){
  return Number(localStorage.getItem(LAST_MODIFIED_KEY) || '0') || 0;
}

function persistProducts(touch = true){
  products = normalizeProductList(products);
  localStorage.setItem(STORAGE_PRODUCTS_KEY, JSON.stringify(products));
  if(touch) setLocalModified();
}

function persistImportSessions(touch = true){
  importSessions = normalizeImportSessions(importSessions);
  localStorage.setItem(STORAGE_IMPORTS_KEY, JSON.stringify(importSessions));
  if(touch) setLocalModified();
}

function persistAll(touch = true){
  persistProducts(false);
  persistImportSessions(false);
  if(touch) setLocalModified();
}

function ensureLocalModified(){
  if(!getLocalModified() && (products.length || importSessions.length)) setLocalModified();
}

function setCloudStatus(text, type = ''){
  const el = document.getElementById('cloudStatus');
  if(!el) return;
  el.className = 'cloud-status ' + type;
  el.innerText = text;
}

function getDropboxToken(){
  return textValue(localStorage.getItem(DROPBOX_TOKEN_KEY));
}

function getDropboxPath(){
  const path = textValue(localStorage.getItem(DROPBOX_PATH_KEY)) || DEFAULT_DROPBOX_PATH;
  return path.startsWith('/') ? path : '/' + path;
}

function setDropboxPath(path){
  const cleanPath = textValue(path) || DEFAULT_DROPBOX_PATH;
  localStorage.setItem(DROPBOX_PATH_KEY, cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath);
}

function buildSnapshot(timestamp = Date.now()){
  return {
    version: 60,
    lastModified: timestamp,
    products: normalizeProductList(products),
    importSessions: normalizeImportSessions(importSessions)
  };
}

async function dropboxDownloadSnapshot(){
  const token = getDropboxToken();
  if(!token) throw new Error('NO_DROPBOX_TOKEN');

  const response = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path: getDropboxPath() })
    }
  });

  if(response.status === 409) return null;
  if(response.status === 401) throw new Error('DROPBOX_AUTH');
  if(!response.ok) throw new Error('DROPBOX_DOWNLOAD_' + response.status);

  const text = await response.text();
  if(!text.trim()) return null;

  let data;
  try{
    data = JSON.parse(text);
  }catch(e){
    throw new Error('DROPBOX_BAD_JSON');
  }

  let meta = {};
  try{
    meta = JSON.parse(response.headers.get('dropbox-api-result') || '{}');
  }catch(e){
    meta = {};
  }

  const serverModified = Date.parse(meta.server_modified || '');
  data.lastModified = Number(data.lastModified || 0) || serverModified || 0;
  data.products = normalizeProductList(data.products);
  data.importSessions = normalizeImportSessions(data.importSessions);
  return data;
}

async function dropboxUploadSnapshot(){
  const token = getDropboxToken();
  if(!token) throw new Error('NO_DROPBOX_TOKEN');

  const timestamp = Date.now();
  const snapshot = buildSnapshot(timestamp);
  const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: getDropboxPath(),
        mode: 'overwrite',
        autorename: false,
        mute: true,
        strict_conflict: false
      })
    },
    body: JSON.stringify(snapshot)
  });

  if(response.status === 401) throw new Error('DROPBOX_AUTH');
  if(!response.ok) throw new Error('DROPBOX_UPLOAD_' + response.status);

  products = snapshot.products;
  importSessions = snapshot.importSessions;
  persistAll(false);
  setLocalModified(timestamp);
  return snapshot;
}

function dropboxErrorMessage(error){
  const code = String(error?.message || '');
  if(code === 'NO_DROPBOX_TOKEN') return 'Token Dropbox mancante';
  if(code === 'DROPBOX_AUTH') return 'Token Dropbox non valido';
  if(code === 'DROPBOX_BAD_JSON') return 'File Dropbox non leggibile';
  if(code.startsWith('DROPBOX_UPLOAD_')) return 'Errore upload Dropbox';
  if(code.startsWith('DROPBOX_DOWNLOAD_')) return 'Errore download Dropbox';
  return 'Errore Dropbox';
}

function handleDropboxError(error, showAlert = true){
  const message = dropboxErrorMessage(error);
  console.error(error);
  setCloudStatus('☁ ' + message, 'err');
  if(showAlert) alert(message + '. Controlla token, file e connessione.');
}

async function saveCloudAfterChange(label){
  if(!getDropboxToken()){
    setCloudStatus('☁ ' + label + ' locale', 'ok');
    return false;
  }
  try{
    await dropboxUploadSnapshot();
    setCloudStatus('☁ ' + label + ' su Dropbox', 'ok');
    return true;
  }catch(error){
    handleDropboxError(error, false);
    alert(label + ' salvato in locale, ma Dropbox non è aggiornato.');
    return false;
  }
}

async function syncNow(options = {}){
  if(cloudLoading) return;

  if(!getDropboxToken()){
    setCloudStatus('☁ Token Dropbox mancante', 'err');
    if(!options.silentMissingToken){
      showSettings();
      alert('Inserisci il token Dropbox in Impostazioni.');
    }
    return;
  }

  cloudLoading = true;
  setCloudStatus('☁ Sincronizzo Dropbox...', '');

  try{
    const remote = await dropboxDownloadSnapshot();
    const localTime = getLocalModified();
    const remoteTime = remote ? Number(remote.lastModified || 0) : 0;
    const localProducts = products.length;
    const remoteProducts = remote ? remote.products.length : 0;

    if(!remote){
      await dropboxUploadSnapshot();
      setCloudStatus('☁ Dropbox creato: ' + products.length + ' prodotti', 'ok');
    }else if(localProducts === 0 && remoteProducts > 0){
      products = remote.products;
      importSessions = remote.importSessions;
      persistAll(false);
      setLocalModified(remoteTime || Date.now());
      setCloudStatus('☁ Database scaricato da Dropbox', 'ok');
    }else if(remoteTime > localTime){
      products = remote.products;
      importSessions = remote.importSessions;
      persistAll(false);
      setLocalModified(remoteTime);
      setCloudStatus('☁ Scaricato da Dropbox: ' + products.length + ' prodotti', 'ok');
    }else{
      await dropboxUploadSnapshot();
      setCloudStatus('☁ Caricato su Dropbox: ' + products.length + ' prodotti', 'ok');
    }

    renderCurrentView();
  }catch(error){
    handleDropboxError(error, !options.silentMissingToken);
  }finally{
    cloudLoading = false;
  }
}

function setActive(view){
  document.getElementById('menuProducts')?.classList.toggle('active', view === 'products');
  document.getElementById('menuSuppliers')?.classList.toggle('active', view === 'suppliers');
  document.getElementById('menuHistory')?.classList.toggle('active', view === 'history');
  document.getElementById('menuCategories')?.classList.toggle('active', view === 'categories');
  document.getElementById('menuSettings')?.classList.toggle('active', view === 'settings');
}

function setPageVisibility(view){
  const pages = {
    products: 'productsPage',
    suppliers: 'suppliersPage',
    history: 'historyPage',
    categories: 'categoriesPage',
    settings: 'settingsPage'
  };
  Object.entries(pages).forEach(([key, id]) => {
    document.getElementById(id)?.classList.toggle('hidden', key !== view);
  });
}

function setTitle(title, subtitle){
  document.getElementById('pageTitle').innerText = title;
  document.getElementById('pageSubtitle').innerText = subtitle;
}

function showProducts(){
  currentView = 'products';
  setActive('products');
  setPageVisibility('products');
  setTitle('Gestione Prodotti', 'Gestionale Magazzino / 库存管理');
  renderProducts();
}

function showSuppliers(){
  currentView = 'suppliers';
  setActive('suppliers');
  setPageVisibility('suppliers');
  setTitle('Fornitori', 'Cartelle fornitori / 供应商文件夹');
  renderSupplierFolders();
}

function showHistory(){
  currentView = 'history';
  setActive('history');
  setPageVisibility('history');
  setTitle('Cronologia importazioni', 'Importazioni suddivise per file / 导入记录');
  renderImportSessions();
}

function showCategories(){
  currentView = 'categories';
  setActive('categories');
  setPageVisibility('categories');
  setTitle('Categorie', 'Prodotti per categoria / 产品类别');
  renderCategoryFolders();
}

function showSettings(){
  currentView = 'settings';
  setActive('settings');
  setPageVisibility('settings');
  setTitle('Impostazioni', 'Dropbox / 云端设置');
  const tokenInput = document.getElementById('dropboxToken');
  const pathInput = document.getElementById('dropboxPath');
  if(tokenInput) tokenInput.value = getDropboxToken();
  if(pathInput) pathInput.value = getDropboxPath();
}

function renderCurrentView(){
  if(currentView === 'suppliers') renderSupplierFolders();
  else if(currentView === 'history') renderImportSessions();
  else if(currentView === 'categories') renderCategoryFolders();
  else if(currentView === 'settings') showSettings();
  else renderProducts();
}

function productMatchesSearch(p, search){
  return [getBarcode(p), getName(p), getSupplier(p), getCategory(p)]
    .some(value => String(value).toLowerCase().includes(search));
}

function renderProducts(){
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  const table = document.getElementById('productTable');
  if(!table) return;

  const matches = [];
  products.forEach((p, idx) => {
    if(productMatchesSearch(p, search)) matches.push(idx);
  });

  const totalPages = Math.max(1, Math.ceil(matches.length / itemsPerPage));
  if(currentPage > totalPages) currentPage = totalPages;
  if(currentPage < 1) currentPage = 1;

  const visibleIndexes = matches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  if(!visibleIndexes.length){
    table.innerHTML = '<tr><td colspan="8" class="empty-row">Nessun prodotto trovato</td></tr>';
  }else{
    table.innerHTML = visibleIndexes.map(realIndex => {
      const p = products[realIndex];
      return `<tr>
        <td><input type="checkbox" class="product-checkbox" data-index="${realIndex}" ${allSelected ? 'checked' : ''}></td>
        <td>${escapeHTML(getBarcode(p))}</td>
        <td>${escapeHTML(getName(p))}</td>
        <td>${escapeHTML(getSupplier(p) || '-')}</td>
        <td>${escapeHTML(getCategory(p) || '-')}</td>
        <td>${escapeHTML(getBuy(p))}</td>
        <td>${escapeHTML(getSell(p))}</td>
        <td><div class="action-buttons"><button class="edit-btn" onclick="openEditModal(${realIndex})">✎</button><button class="delete-btn" onclick="deleteProduct(${realIndex})">🗑</button></div></td>
      </tr>`;
    }).join('');
  }

  document.getElementById('pageInfo').innerText = `Pagina ${currentPage} di ${totalPages}`;
  setTimeout(__installBarcodeInputLogic, 0);
  setTimeout(__focusBarcodeIfAllowed, 50);
}

function supplierNameOf(p){
  return getSupplier(p) || 'Senza fornitore';
}

function categoryNameOf(p){
  return getCategory(p) || 'Senza categoria';
}

function groupProductsBy(getGroupName){
  const groups = {};
  products.forEach((p, index) => {
    const name = getGroupName(p);
    if(!groups[name]) groups[name] = [];
    groups[name].push({ product: p, index });
  });
  return groups;
}

function renderFolderCards(containerId, groups, kind, emptyText){
  const container = document.getElementById(containerId);
  if(!container) return;
  const searchId = kind === 'supplier' ? 'supplierSearch' : 'categorySearch';
  const search = (document.getElementById(searchId)?.value || '').toLowerCase();
  const names = Object.keys(groups).filter(n => n.toLowerCase().includes(search)).sort((a,b) => a.localeCompare(b));
  if(!names.length){
    container.innerHTML = `<p>${escapeHTML(emptyText)}</p>`;
    return;
  }
  const dataName = kind === 'supplier' ? 'data-supplier-folder' : 'data-category-folder';
  container.innerHTML = names.map(name => `<button class="folder-card" ${dataName}="${escapeAttr(name)}">
    <div class="folder-icon">${kind === 'supplier' ? '📁' : '▤'}</div>
    <div class="folder-name">${escapeHTML(name)}</div>
    <div class="folder-count">${groups[name].length} prodotti</div>
  </button>`).join('');
}

function renderSupplierFolders(){
  const groups = groupProductsBy(supplierNameOf);
  document.getElementById('supplierStats').innerHTML = `<div class="stat-box">Fornitori totali: ${Object.keys(groups).length}</div><div class="stat-box">Prodotti totali: ${products.length}</div>`;
  document.getElementById('supplierDetail').classList.add('hidden');
  document.getElementById('supplierFolders').classList.remove('hidden');
  renderFolderCards('supplierFolders', groups, 'supplier', 'Nessun fornitore trovato.');
}

function renderCategoryFolders(){
  const groups = groupProductsBy(categoryNameOf);
  document.getElementById('categoryStats').innerHTML = `<div class="stat-box">Categorie totali: ${Object.keys(groups).length}</div><div class="stat-box">Prodotti totali: ${products.length}</div>`;
  document.getElementById('categoryDetail').classList.add('hidden');
  document.getElementById('categoryFolders').classList.remove('hidden');
  renderFolderCards('categoryFolders', groups, 'category', 'Nessuna categoria trovata.');
}

function productRowsForDetail(items, mode){
  const checkboxClass = mode === 'supplier' ? 'supplier-product-checkbox' : 'category-product-checkbox';
  return items.map(item => {
    const p = item.product;
    return `<tr>
      <td><input type="checkbox" class="${checkboxClass}" data-index="${item.index}"></td>
      <td>${escapeHTML(getBarcode(p))}</td>
      <td>${escapeHTML(getName(p))}</td>
      <td>${escapeHTML(getSupplier(p) || '-')}</td>
      <td>${escapeHTML(getCategory(p) || '-')}</td>
      <td>${escapeHTML(getBuy(p))}</td>
      <td>${escapeHTML(getSell(p))}</td>
      <td><button class="edit-btn" onclick="openEditModal(${item.index})">Modifica</button><button class="delete-btn" onclick="deleteProduct(${item.index})">Elimina</button></td>
    </tr>`;
  }).join('');
}

function renderDetail(name, items, options){
  const rows = productRowsForDetail(items, options.mode);
  const detail = document.getElementById(options.detailId);
  document.getElementById(options.folderId).classList.add('hidden');
  detail.classList.remove('hidden');
  detail.innerHTML = `<div class="supplier-detail-header">
      <h2>${escapeHTML(options.icon + ' ' + name)}</h2>
      <div class="supplier-detail-actions">
        <button onclick="${options.selectAllFn}()">Seleziona tutti</button>
        <button onclick="${options.deselectAllFn}()">Deseleziona</button>
        <button class="danger" onclick="${options.deleteSelectedFn}()">Elimina selezionati</button>
        <button class="back-folder" onclick="${options.backFn}()">Torna alle cartelle</button>
      </div>
    </div>
    <div class="table-card"><table><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Fornitore</th><th>Categoria</th><th>Acquisto</th><th>Vendita</th><th>Azioni</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function openSupplierFolder(name){
  const items = groupProductsBy(supplierNameOf)[String(name)] || [];
  renderDetail(String(name), items, {
    mode: 'supplier',
    icon: '📁',
    detailId: 'supplierDetail',
    folderId: 'supplierFolders',
    selectAllFn: 'selectAllSupplierProducts',
    deselectAllFn: 'deselectAllSupplierProducts',
    deleteSelectedFn: 'deleteSelectedSupplierProducts',
    backFn: 'renderSupplierFolders'
  });
}

function openCategoryFolder(name){
  const items = groupProductsBy(categoryNameOf)[String(name)] || [];
  renderDetail(String(name), items, {
    mode: 'category',
    icon: '▤',
    detailId: 'categoryDetail',
    folderId: 'categoryFolders',
    selectAllFn: 'selectAllCategoryProducts',
    deselectAllFn: 'deselectAllCategoryProducts',
    deleteSelectedFn: 'deleteSelectedCategoryProducts',
    backFn: 'renderCategoryFolders'
  });
}

function selectAllSupplierProducts(){ document.querySelectorAll('.supplier-product-checkbox').forEach(cb => cb.checked = true); }
function deselectAllSupplierProducts(){ document.querySelectorAll('.supplier-product-checkbox').forEach(cb => cb.checked = false); }
function selectAllCategoryProducts(){ document.querySelectorAll('.category-product-checkbox').forEach(cb => cb.checked = true); }
function deselectAllCategoryProducts(){ document.querySelectorAll('.category-product-checkbox').forEach(cb => cb.checked = false); }

function selectedIndexes(selector){
  return Array.from(document.querySelectorAll(selector))
    .filter(cb => cb.checked)
    .map(cb => Number(cb.dataset.index))
    .filter(index => Number.isInteger(index) && index >= 0 && index < products.length);
}

async function deleteIndexes(indexes, label){
  if(!indexes.length){
    alert('Nessun prodotto selezionato');
    return;
  }
  if(!confirm('Eliminare i prodotti selezionati?')) return;
  indexes.sort((a,b) => b - a).forEach(index => products.splice(index, 1));
  persistProducts(true);
  await saveCloudAfterChange(label);
  renderCurrentView();
}

async function deleteSelectedSupplierProducts(){
  await deleteIndexes(selectedIndexes('.supplier-product-checkbox'), 'Eliminati');
}

async function deleteSelectedCategoryProducts(){
  await deleteIndexes(selectedIndexes('.category-product-checkbox'), 'Eliminati');
}

function renderImportSessions(){
  const search = (document.getElementById('historySearch')?.value || '').toLowerCase();
  const box = document.getElementById('importSessionsList');
  const sessions = importSessions.filter(s => String(s.fileName || '').toLowerCase().includes(search));

  if(!sessions.length){
    box.innerHTML = '<div class="import-session"><div class="import-session-header"><div><div class="import-session-title">Nessuna importazione salvata</div><div class="import-session-meta">Le prossime importazioni compariranno qui.</div></div></div></div>';
    return;
  }

  box.innerHTML = sessions.map(session => `<div class="import-session">
    <div class="import-session-header">
      <div>
        <div class="import-session-title">📁 ${escapeHTML(session.fileName || 'Importazione')}</div>
        <div class="import-session-meta">${escapeHTML(formatDate(session.time))} · ${session.products.length} prodotti</div>
      </div>
      <div class="import-session-actions">
        <button class="session-open" data-history-action="toggle" data-session-id="${escapeAttr(session.id)}">Apri / Chiudi</button>
        <button class="session-delete" data-history-action="delete-all" data-session-id="${escapeAttr(session.id)}">Elimina importazione</button>
      </div>
    </div>
    <div class="import-session-body" data-session-id="${escapeAttr(session.id)}">
      <div class="import-selected-actions">
        <button data-history-action="select-all" data-session-id="${escapeAttr(session.id)}">Seleziona tutti</button>
        <button data-history-action="deselect-all" data-session-id="${escapeAttr(session.id)}">Deseleziona</button>
        <button class="danger" data-history-action="delete-selected" data-session-id="${escapeAttr(session.id)}">Elimina selezionati</button>
      </div>
      <table class="import-products-table"><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Fornitore</th><th>Categoria</th><th>Acquisto</th><th>Vendita</th></tr></thead><tbody>
        ${session.products.map(p => `<tr>
          <td><input type="checkbox" class="import-product-checkbox" data-session-id="${escapeAttr(session.id)}" data-barcode="${escapeAttr(p.barcode)}"></td>
          <td>${escapeHTML(p.barcode || '')}</td>
          <td>${escapeHTML(p.name || '')}</td>
          <td>${escapeHTML(p.supplier || '')}</td>
          <td>${escapeHTML(p.category || '')}</td>
          <td>${escapeHTML(p.buyPrice || '')}</td>
          <td>${escapeHTML(p.sellPrice || '')}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`).join('');
}

function formatDate(value){
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('it-IT');
}

function importBodyFor(id){
  return Array.from(document.querySelectorAll('.import-session-body')).find(el => el.dataset.sessionId === String(id));
}

function importCheckboxesFor(id){
  return Array.from(document.querySelectorAll('.import-product-checkbox')).filter(cb => cb.dataset.sessionId === String(id));
}

function toggleImportSession(id){
  const body = importBodyFor(id);
  if(body) body.style.display = body.style.display === 'block' ? 'none' : 'block';
}

function selectImportProducts(id){
  importCheckboxesFor(id).forEach(cb => cb.checked = true);
}

function deselectImportProducts(id){
  importCheckboxesFor(id).forEach(cb => cb.checked = false);
}

function deleteProductsByBarcodes(barcodes){
  const set = new Set(barcodes.map(String));
  products = products.filter(p => !set.has(String(getBarcode(p))));
  persistProducts(false);
}

async function deleteWholeImportSession(id){
  const session = importSessions.find(s => s.id === String(id));
  if(!session) return;
  if(!confirm('Eliminare TUTTI i prodotti di questa importazione?')) return;
  const barcodes = session.products.map(p => p.barcode);
  deleteProductsByBarcodes(barcodes);
  importSessions = importSessions.filter(s => s.id !== String(id));
  persistAll(true);
  await saveCloudAfterChange('Importazione eliminata');
  renderImportSessions();
}

async function deleteSelectedImportProducts(id){
  const selected = importCheckboxesFor(id).filter(cb => cb.checked).map(cb => cb.dataset.barcode);
  if(!selected.length){
    alert('Nessun prodotto selezionato');
    return;
  }
  if(!confirm('Eliminare i prodotti selezionati?')) return;

  deleteProductsByBarcodes(selected);
  const session = importSessions.find(s => s.id === String(id));
  if(session){
    const set = new Set(selected.map(String));
    session.products = session.products.filter(p => !set.has(String(p.barcode)));
    if(!session.products.length) importSessions = importSessions.filter(s => s.id !== String(id));
  }
  persistAll(true);
  await saveCloudAfterChange('Prodotti eliminati');
  renderImportSessions();
}

async function clearImportSessions(){
  if(!confirm('Svuotare cronologia importazioni?')) return;
  importSessions = [];
  persistAll(true);
  await saveCloudAfterChange('Cronologia svuotata');
  renderImportSessions();
}

function openEditModal(index){
  if(index < 0 || index >= products.length) return;
  editingIndex = index;
  const p = products[index];
  document.getElementById('editBarcode').value = getBarcode(p);
  document.getElementById('editName').value = getName(p);
  document.getElementById('editSupplier').value = getSupplier(p);
  document.getElementById('editCategory').value = getCategory(p);
  document.getElementById('editBuy').value = getBuy(p);
  document.getElementById('editSell').value = getSell(p);
  document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal(){
  document.getElementById('editModal').style.display = 'none';
  editingIndex = null;
}

function productFromForm(prefix){
  return canonicalProduct({
    barcode: document.getElementById(prefix + 'Barcode').value,
    name: document.getElementById(prefix + 'Name').value,
    supplier: document.getElementById(prefix + 'Supplier').value,
    category: document.getElementById(prefix + 'Category').value,
    buyPrice: document.getElementById(prefix + 'Buy').value,
    sellPrice: document.getElementById(prefix + 'Sell').value
  });
}

function validateProduct(product, ignoreIndex = -1){
  if(!product.barcode || !product.name){
    alert('Inserisci barcode e nome prodotto');
    return false;
  }
  const duplicateIndex = products.findIndex((p, index) => index !== ignoreIndex && String(getBarcode(p)) === String(product.barcode));
  if(duplicateIndex >= 0){
    alert('Barcode già presente');
    return false;
  }
  return true;
}

async function saveEditProduct(){
  if(editingIndex === null) return;
  const product = productFromForm('edit');
  if(!validateProduct(product, editingIndex)) return;
  products[editingIndex] = product;
  persistProducts(true);
  closeEditModal();
  await saveCloudAfterChange('Salvato');
  renderCurrentView();
}

function openNewProductModal(){
  ['newBarcode','newName','newSupplier','newCategory','newBuy','newSell'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newProductModal').style.display = 'flex';
  setTimeout(() => document.getElementById('newBarcode').focus(), 100);
}

function closeNewProductModal(){
  document.getElementById('newProductModal').style.display = 'none';
}

async function saveNewProduct(){
  const product = productFromForm('new');
  if(!product.barcode || !product.name){
    alert('Inserisci barcode e nome prodotto');
    return;
  }

  const existing = products.findIndex(p => String(getBarcode(p)) === String(product.barcode));
  if(existing >= 0) products[existing] = product;
  else products.unshift(product);

  persistProducts(true);
  closeNewProductModal();
  currentPage = 1;
  await saveCloudAfterChange('Salvato');
  renderCurrentView();
}

async function deleteProduct(index){
  if(index < 0 || index >= products.length) return;
  if(!confirm('Eliminare prodotto?')) return;
  products.splice(index, 1);
  persistProducts(true);
  await saveCloudAfterChange('Eliminato');
  renderCurrentView();
}

function toggleSelectProducts(){
  allSelected = !allSelected;
  document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = allSelected);
  document.getElementById('toggleSelectBtn').innerText = allSelected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

async function deleteSelectedProducts(){
  await deleteIndexes(selectedIndexes('.product-checkbox'), 'Eliminati');
  allSelected = false;
  document.getElementById('toggleSelectBtn').innerText = 'Seleziona prodotti';
}

function nextPage(){
  currentPage++;
  renderProducts();
}

function prevPage(){
  if(currentPage > 1) currentPage--;
  renderProducts();
}

function exportExcel(){
  if(!window.XLSX){
    alert('Libreria Excel non disponibile');
    return;
  }
  const rows = products.map(p => ({
    Barcode: getBarcode(p),
    Prodotto: getName(p),
    Fornitore: getSupplier(p),
    Categoria: getCategory(p),
    Acquisto: getBuy(p),
    Vendita: getSell(p)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prodotti');
  XLSX.writeFile(wb, 'prodotti.xlsx');
}

function normalizeKey(key){
  return String(key || '').trim().toLowerCase().replace(/\s+/g, '');
}

function getValue(row, keys){
  const map = {};
  Object.keys(row).forEach(k => map[normalizeKey(k)] = row[k]);
  for(const k of keys){
    const v = map[normalizeKey(k)];
    if(v !== undefined) return v;
  }
  return '';
}

async function importExcel(event){
  const file = event.target.files[0];
  if(!file) return;
  if(!window.XLSX){
    alert('Libreria Excel non disponibile');
    event.target.value = '';
    return;
  }

  const before = new Set(products.map(p => String(getBarcode(p))));
  const reader = new FileReader();
  const fileName = file.name.toLowerCase();

  reader.onload = async function(e){
    try{
      const wb = fileName.endsWith('.csv')
        ? XLSX.read(e.target.result, { type: 'string' })
        : XLSX.read(new Uint8Array(e.target.result), { type: 'array', raw: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      let imported = 0;
      let updated = 0;

      for(const row of rows){
        const product = canonicalProduct({
          barcode: getValue(row, ['Barcode','Codice','EAN','条码']),
          name: getValue(row, ['Prodotto','Nome','Product','商品']),
          supplier: getValue(row, ['Fornitore','Supplier','Nome Fornitore','供应商']),
          category: getValue(row, ['Categoria','Category','类别']),
          buyPrice: getValue(row, ['Acquisto','Prezzo Acquisto','BuyPrice','进价']),
          sellPrice: getValue(row, ['Vendita','Prezzo Vendita','SellPrice','售价'])
        });
        if(!product.barcode) continue;
        const existing = products.findIndex(p => String(getBarcode(p)) === String(product.barcode));
        if(existing >= 0){
          products[existing] = product;
          updated++;
        }else{
          products.push(product);
          imported++;
        }
      }

      persistProducts(true);
      const importedNow = products.filter(p => {
        const b = String(getBarcode(p));
        return b && !before.has(b);
      });

      if(importedNow.length){
        importSessions.unshift({
          id: 'imp_' + Date.now(),
          fileName: file.name,
          time: new Date().toISOString(),
          products: importedNow.map(importSessionProduct)
        });
        persistImportSessions(true);
      }

      currentPage = 1;
      renderProducts();
      event.target.value = '';
      await saveCloudAfterChange('Import salvato');
      alert(`Import completato!\nNuovi: ${imported}\nAggiornati: ${updated}`);
    }catch(err){
      console.error(err);
      setCloudStatus('☁ Errore import', 'err');
      alert('Errore importazione');
    }
  };

  if(fileName.endsWith('.csv')) reader.readAsText(file, 'UTF-8');
  else reader.readAsArrayBuffer(file);
}

function saveDropboxSettings(){
  const token = textValue(document.getElementById('dropboxToken')?.value);
  const path = textValue(document.getElementById('dropboxPath')?.value);
  if(token) localStorage.setItem(DROPBOX_TOKEN_KEY, token);
  else localStorage.removeItem(DROPBOX_TOKEN_KEY);
  setDropboxPath(path);
  setCloudStatus(token ? '☁ Token Dropbox salvato' : '☁ Token Dropbox rimosso', token ? 'ok' : 'err');
}

function clearDropboxToken(){
  localStorage.removeItem(DROPBOX_TOKEN_KEY);
  const tokenInput = document.getElementById('dropboxToken');
  if(tokenInput) tokenInput.value = '';
  setCloudStatus('☁ Token Dropbox rimosso', 'err');
}

function logoutUser(){
  clearDropboxToken();
  showSettings();
}

function clearSearchField(){
  const s = document.getElementById('search');
  if(!s) return;
  if(s.value){
    s.value = '';
    currentPage = 1;
    renderProducts();
  }
  __barcodeLastValue = '';
}

function __modalOpen(){
  const editModal = document.getElementById('editModal');
  const newModal = document.getElementById('newProductModal');
  return (editModal && editModal.style.display === 'flex') ||
         (newModal && newModal.style.display === 'flex');
}

function __hasSelection(){
  try{
    return window.getSelection && window.getSelection().toString().length > 0;
  }catch(e){
    return false;
  }
}

function __barcodeOnlyDigits(str){
  return /^\d+$/.test(String(str || ''));
}

function __focusBarcodeIfAllowed(){
  const s = document.getElementById('search');
  const productsPage = document.getElementById('productsPage');
  if(!s || !productsPage || currentView !== 'products' || productsPage.classList.contains('hidden') || __modalOpen() || __hasSelection()) return;

  const ae = document.activeElement;
  const userTypingElsewhere =
    ae && ae !== s && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);

  if(userTypingElsewhere) return;
  if(document.activeElement !== s) s.focus({ preventScroll: true });
}

function __installBarcodeInputLogic(){
  const s = document.getElementById('search');
  if(!s || s.dataset.barcodeLogic === '1') return;
  s.dataset.barcodeLogic = '1';
  __barcodeLastValue = s.value || '';

  s.addEventListener('beforeinput', function(e){
    if(!e.data || !__barcodeOnlyDigits(e.data)) return;
    if(s.value && s.selectionStart === s.selectionEnd){
      s.value = '';
      __barcodeLastValue = '';
    }
  }, true);

  s.addEventListener('input', function(){
    const cur = s.value || '';
    if(cur.length <= __barcodeLastValue.length){
      __barcodeLastValue = cur;
      return;
    }

    let inserted = cur;
    if(__barcodeLastValue && cur.startsWith(__barcodeLastValue)){
      inserted = cur.slice(__barcodeLastValue.length);
    }

    if(__barcodeLastValue && inserted && __barcodeOnlyDigits(inserted)){
      s.value = inserted;
      currentPage = 1;
      renderProducts();
    }

    __barcodeLastValue = s.value || '';
  }, true);

  s.addEventListener('focus', function(){
    __barcodeLastValue = s.value || '';
  });

  s.addEventListener('touchstart', clearSearchField, true);
  s.addEventListener('pointerdown', clearSearchField, true);
}

function installClearSearchOnScan(){
  const s = document.getElementById('search');
  if(!s || s.dataset.clearScan === '1') return;
  s.dataset.clearScan = '1';

  let lastKey = 0;
  s.addEventListener('keydown', function(e){
    const now = Date.now();
    const isChar = e && typeof e.key === 'string' && e.key.length === 1;
    if(!isChar){
      lastKey = now;
      return;
    }
    if(s.value && now - lastKey > 1200){
      s.value = '';
      currentPage = 1;
      renderProducts();
    }
    lastKey = now;
  }, true);
}

document.addEventListener('keydown', function(e){
  const s = document.getElementById('search');
  if(!s || __modalOpen()) return;

  const ae = document.activeElement;
  const inOtherInput = ae && ae !== s && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
  if(inOtherInput) return;

  if(e.key && e.key.length === 1 && __barcodeOnlyDigits(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey){
    if(document.activeElement !== s && currentView === 'products'){
      e.preventDefault();
      s.value = '';
      s.focus({ preventScroll: true });
      s.value = e.key;
      __barcodeLastValue = s.value;
      currentPage = 1;
      renderProducts();
    }
  }
}, true);

document.addEventListener('click', function(event){
  const supplierFolder = event.target.closest('[data-supplier-folder]');
  if(supplierFolder){
    openSupplierFolder(supplierFolder.dataset.supplierFolder);
    return;
  }

  const categoryFolder = event.target.closest('[data-category-folder]');
  if(categoryFolder){
    openCategoryFolder(categoryFolder.dataset.categoryFolder);
    return;
  }

  const historyAction = event.target.closest('[data-history-action]');
  if(historyAction){
    const id = historyAction.dataset.sessionId;
    const action = historyAction.dataset.historyAction;
    if(action === 'toggle') toggleImportSession(id);
    else if(action === 'delete-all') deleteWholeImportSession(id);
    else if(action === 'select-all') selectImportProducts(id);
    else if(action === 'deselect-all') deselectImportProducts(id);
    else if(action === 'delete-selected') deleteSelectedImportProducts(id);
  }
});

window.onload = function(){
  ensureLocalModified();
  persistAll(false);
  if(!localStorage.getItem(DROPBOX_PATH_KEY)) setDropboxPath(DEFAULT_DROPBOX_PATH);
  showProducts();
  __installBarcodeInputLogic();
  installClearSearchOnScan();
  setInterval(__focusBarcodeIfAllowed, 1200);
  setTimeout(() => syncNow({ silentMissingToken: true }), 200);
};
