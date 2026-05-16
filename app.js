const STORAGE_PRODUCTS_KEY = 'products';
const STORAGE_IMPORTS_KEY = 'importSessions';
const STORAGE_SALES_KEY = 'salesRecords';
const STORAGE_SALE_CART_KEY = 'saleCart';
const LAST_MODIFIED_KEY = 'inventory_lastModified';
const DROPBOX_TOKEN_KEY = 'inventory_dropbox_token';
const DROPBOX_TOKEN_EXPIRES_KEY = 'inventory_dropbox_token_expires_at';
const DROPBOX_APP_KEY_KEY = 'inventory_dropbox_app_key';
const DROPBOX_REFRESH_TOKEN_KEY = 'inventory_dropbox_refresh_token';
const DROPBOX_PATH_KEY = 'inventory_dropbox_path';
const DROPBOX_BACKUP_FOLDER_KEY = 'inventory_dropbox_backup_folder';
const SYNC_FIX_VERSION_KEY = 'inventory_sync_fix_version';
const DROPBOX_OAUTH_STATE_KEY = 'inventory_dropbox_oauth_state';
const DROPBOX_OAUTH_VERIFIER_KEY = 'inventory_dropbox_oauth_verifier';
const DROPBOX_OAUTH_REDIRECT_KEY = 'inventory_dropbox_oauth_redirect';
const DEFAULT_DROPBOX_PATH = '/inventory_manager_snapshot.json';
const DEFAULT_DROPBOX_BACKUP_FOLDER = '/inventory_manager_backups';
const itemsPerPage = 100;
const importSessionPageSize = 200;

let products = normalizeProductList(readJson(STORAGE_PRODUCTS_KEY, []));
let importSessions = normalizeImportSessions(readJson(STORAGE_IMPORTS_KEY, []));
let salesRecords = normalizeSalesRecords(readJson(STORAGE_SALES_KEY, []));
let saleCart = normalizeSaleCart(readJson(STORAGE_SALE_CART_KEY, {}));
let currentPage = 1;
let allSelected = false;
let editingIndex = null;
let currentView = 'products';
let cloudLoading = false;
let __barcodeLastValue = '';
let dropboxFolderPickerPath = '';
let importSessionPages = {};
let currentSaleBarcode = '';
let saleCartAllSelected = false;
let salesStatsAllSelected = false;
let openSalesSupplierKey = '';

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

function randomOAuthString(length = 64){
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => chars[byte % chars.length]).join('');
}

function base64UrlFromBytes(bytes){
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(value){
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return base64UrlFromBytes(new Uint8Array(digest));
}

function getOAuthRedirectUri(){
  return window.location.href.split('#')[0].split('?')[0];
}

function updateDropboxRedirectHint(){
  const el = document.getElementById('dropboxRedirectUriText');
  if(!el) return;
  el.innerText = location.protocol === 'file:'
    ? 'Apri l\'app dal sito o da localhost'
    : getOAuthRedirectUri();
}

async function copyDropboxRedirectUri(){
  if(location.protocol === 'file:'){
    alert('Apri l\'app dal sito pubblicato o da localhost, poi copia l\'URI da questa riga.');
    return;
  }
  const uri = getOAuthRedirectUri();
  try{
    await navigator.clipboard.writeText(uri);
    setCloudStatus('☁ URI Dropbox copiato', 'ok');
  }catch(error){
    prompt('Copia questo URI nella console Dropbox:', uri);
  }
}

function valueOf(p, keys){
  for(const k of keys){
    if(p && p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k];
  }
  return '';
}

function getBarcode(p){ return Array.isArray(p) ? textValue(p[0]) : textValue(valueOf(p, ['barcode','Barcode','codice','Codice','EAN','条码','b'])); }
function getName(p){ return Array.isArray(p) ? textValue(p[1]) : textValue(valueOf(p, ['name','prodotto','Prodotto','Nome','Product','商品','n'])); }
function getSupplier(p){ return Array.isArray(p) ? textValue(p[2]) : textValue(valueOf(p, ['supplier','fornitore','Fornitore','Supplier','Nome Fornitore','供应商','s'])); }
function getCategory(p){ return Array.isArray(p) ? textValue(p[3]) : textValue(valueOf(p, ['category','categoria','Categoria','Category','类别','c'])); }
function getBuy(p){ return Array.isArray(p) ? textValue(p[4]) : textValue(valueOf(p, ['buyPrice','buy_price','acquisto','Acquisto','Prezzo Acquisto','BuyPrice','进价','a'])); }
function getSell(p){ return Array.isArray(p) ? textValue(p[5]) : textValue(valueOf(p, ['sellPrice','sell_price','vendita','Vendita','Prezzo Vendita','SellPrice','售价','v'])); }

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

function compactProduct(p){
  const product = canonicalProduct(p);
  return [
    product.barcode,
    product.name,
    product.supplier,
    product.category,
    product.buyPrice,
    product.sellPrice
  ];
}

function compactProductList(list){
  return normalizeProductList(list).map(compactProduct);
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

function sessionBarcodes(session){
  const fromBarcodes = Array.isArray(session?.barcodes) ? session.barcodes : (Array.isArray(session?.b) ? session.b : []);
  const fromProducts = Array.isArray(session?.products) ? session.products.map(p => p?.barcode || getBarcode(p)) : [];
  return Array.from(new Set([...fromBarcodes, ...fromProducts].map(textValue).filter(Boolean)));
}

function productByBarcode(barcode){
  const code = String(barcode);
  return products.find(p => String(getBarcode(p)) === code);
}

function displayProductForSession(session, barcode){
  const stored = Array.isArray(session?.products)
    ? session.products.find(p => String(p.barcode || getBarcode(p)) === String(barcode))
    : null;
  return importSessionProduct(productByBarcode(barcode) || stored || { barcode });
}

function normalizeImportSessions(list){
  if(!Array.isArray(list)) return [];
  return list.map((session, index) => {
    const sessionProducts = Array.isArray(session?.products) ? session.products.map(importSessionProduct) : [];
    const barcodes = sessionBarcodes({ ...session, products: sessionProducts });
    return {
      id: textValue(session?.id || session?.i || session?.session_id || `imp_${Date.now()}_${index}`),
      fileName: textValue(session?.fileName || session?.f || session?.file_name || 'Importazione'),
      time: textValue(session?.time || session?.t || session?.created_at || new Date().toISOString()),
      count: Number(session?.count || session?.c || session?.total || barcodes.length || sessionProducts.length) || 0,
      barcodes,
      products: sessionProducts.length <= importSessionPageSize ? sessionProducts : []
    };
  }).filter(session => session.id);
}

function compactImportSessions(list){
  return normalizeImportSessions(list).map(session => ({
    i: session.id,
    f: session.fileName,
    t: session.time,
    c: session.count || sessionBarcodes(session).length,
    b: sessionBarcodes(session)
  }));
}

function normalizeSaleItems(items){
  if(!Array.isArray(items)) return [];
  const totals = {};
  items.forEach(item => {
    const barcode = Array.isArray(item) ? textValue(item[0]) : textValue(item?.barcode || item?.b);
    const qty = Math.max(0, Number(Array.isArray(item) ? item[1] : (item?.qty || item?.q || 0)) || 0);
    if(barcode && qty > 0) totals[barcode] = (totals[barcode] || 0) + qty;
  });
  return Object.entries(totals).map(([barcode, qty]) => ({ barcode, qty }));
}

function normalizeSalesRecords(list){
  if(!Array.isArray(list)) return [];
  return list.map((record, index) => {
    const items = normalizeSaleItems(record?.items || record?.m || []);
    return {
      id: textValue(record?.id || record?.i || `sale_${Date.now()}_${index}`),
      time: textValue(record?.time || record?.t || new Date().toISOString()),
      items
    };
  }).filter(record => record.id && record.items.length);
}

function compactSalesRecords(list){
  return normalizeSalesRecords(list).map(record => ({
    i: record.id,
    t: record.time,
    m: record.items.map(item => [item.barcode, item.qty])
  }));
}

function normalizeSaleCart(cart){
  const totals = {};
  if(Array.isArray(cart)){
    normalizeSaleItems(cart).forEach(item => totals[item.barcode] = item.qty);
  }else if(cart && typeof cart === 'object'){
    Object.entries(cart).forEach(([barcode, qty]) => {
      const cleanBarcode = textValue(barcode);
      const cleanQty = Math.max(0, Number(qty) || 0);
      if(cleanBarcode && cleanQty > 0) totals[cleanBarcode] = cleanQty;
    });
  }
  return totals;
}

function compactSaleCart(cart){
  return normalizeSaleCart(cart);
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

function parseDropboxTime(value){
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isStorageQuotaError(error){
  return error?.name === 'QuotaExceededError'
    || error?.code === 22
    || String(error?.message || '').toLowerCase().includes('quota');
}

function safeSetStorage(key, value){
  try{
    localStorage.setItem(key, value);
  }catch(error){
    if(!isStorageQuotaError(error)) throw error;
    localStorage.removeItem(key);
    localStorage.setItem(key, value);
  }
}

function persistProducts(touch = true){
  products = normalizeProductList(products);
  try{
    safeSetStorage(STORAGE_PRODUCTS_KEY, JSON.stringify(compactProductList(products)));
  }catch(error){
    if(!isStorageQuotaError(error)) throw error;
    localStorage.removeItem(STORAGE_IMPORTS_KEY);
    importSessions = [];
    safeSetStorage(STORAGE_PRODUCTS_KEY, JSON.stringify(compactProductList(products)));
    setCloudStatus('☁ Memoria liberata: cronologia importazioni svuotata', 'err');
  }
  if(touch) setLocalModified();
}

function persistImportSessions(touch = true){
  importSessions = normalizeImportSessions(importSessions);
  try{
    safeSetStorage(STORAGE_IMPORTS_KEY, JSON.stringify(compactImportSessions(importSessions)));
  }catch(error){
    if(!isStorageQuotaError(error)) throw error;
    localStorage.removeItem(STORAGE_IMPORTS_KEY);
    importSessions = importSessions.slice(0, 10);
    safeSetStorage(STORAGE_IMPORTS_KEY, JSON.stringify(compactImportSessions(importSessions)));
    setCloudStatus('☁ Cronologia importazioni alleggerita', 'err');
  }
  if(touch) setLocalModified();
}

function persistSalesRecords(touch = true){
  salesRecords = normalizeSalesRecords(salesRecords);
  safeSetStorage(STORAGE_SALES_KEY, JSON.stringify(compactSalesRecords(salesRecords)));
  if(touch) setLocalModified();
}

function persistSaleCart(){
  safeSetStorage(STORAGE_SALE_CART_KEY, JSON.stringify(compactSaleCart(saleCart)));
}

function persistAll(touch = true){
  persistProducts(false);
  persistImportSessions(false);
  persistSalesRecords(false);
  if(touch) setLocalModified();
}

function ensureLocalModified(){
  if(!localStorage.getItem(LAST_MODIFIED_KEY)) {
    localStorage.setItem(LAST_MODIFIED_KEY, '0');
  }
}

function applySyncTimestampMigration(){
  if(localStorage.getItem(SYNC_FIX_VERSION_KEY) === 'remote_time_v2') return;
  localStorage.setItem(LAST_MODIFIED_KEY, '0');
  localStorage.setItem(SYNC_FIX_VERSION_KEY, 'remote_time_v2');
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

function getDropboxAppKey(){
  return textValue(localStorage.getItem(DROPBOX_APP_KEY_KEY));
}

function getDropboxRefreshToken(){
  return textValue(localStorage.getItem(DROPBOX_REFRESH_TOKEN_KEY));
}

function canRefreshDropboxToken(){
  return Boolean(getDropboxAppKey() && getDropboxRefreshToken());
}

function hasDropboxCredentials(){
  return Boolean(getDropboxToken() || canRefreshDropboxToken());
}

function tokenNeedsRefresh(){
  const expiresAt = Number(localStorage.getItem(DROPBOX_TOKEN_EXPIRES_KEY) || '0') || 0;
  return !getDropboxToken() || (expiresAt > 0 && Date.now() > expiresAt - 120000);
}

async function refreshDropboxAccessToken(){
  const appKey = getDropboxAppKey();
  const refreshToken = getDropboxRefreshToken();
  if(!appKey || !refreshToken) throw new Error('NO_DROPBOX_TOKEN');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: appKey
  });

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if(response.status === 400 || response.status === 401) throw new Error('DROPBOX_REFRESH_AUTH');
  if(!response.ok) throw new Error('DROPBOX_REFRESH_' + response.status);

  const data = await response.json();
  if(!data.access_token) throw new Error('DROPBOX_REFRESH_BAD_RESPONSE');

  localStorage.setItem(DROPBOX_TOKEN_KEY, data.access_token);
  if(data.expires_in){
    localStorage.setItem(DROPBOX_TOKEN_EXPIRES_KEY, String(Date.now() + Number(data.expires_in) * 1000));
  }else{
    localStorage.removeItem(DROPBOX_TOKEN_EXPIRES_KEY);
  }
  return data.access_token;
}

function setDropboxOAuthTokens(data){
  if(!data || !data.access_token) throw new Error('DROPBOX_REFRESH_BAD_RESPONSE');
  localStorage.setItem(DROPBOX_TOKEN_KEY, data.access_token);
  if(data.refresh_token) localStorage.setItem(DROPBOX_REFRESH_TOKEN_KEY, data.refresh_token);
  if(data.expires_in){
    localStorage.setItem(DROPBOX_TOKEN_EXPIRES_KEY, String(Date.now() + Number(data.expires_in) * 1000));
  }else{
    localStorage.removeItem(DROPBOX_TOKEN_EXPIRES_KEY);
  }
}

async function startDropboxOAuth(){
  saveDropboxSettings({ silent: true });
  const appKey = getDropboxAppKey();
  if(!appKey){
    setCloudStatus('☁ App Key Dropbox mancante', 'err');
    alert('Inserisci prima la App Key Dropbox.');
    return;
  }
  if(location.protocol === 'file:'){
    alert('Il collegamento diretto Dropbox non funziona da file locale. Apri l\'app da un indirizzo http/https, per esempio Vercel o localhost, e registra lo stesso URL come Redirect URI nella tua app Dropbox.');
    return;
  }

  const redirectUri = getOAuthRedirectUri();
  const state = randomOAuthString(32);
  const verifier = randomOAuthString(96);
  const challenge = await sha256Base64Url(verifier);
  localStorage.setItem(DROPBOX_OAUTH_STATE_KEY, state);
  localStorage.setItem(DROPBOX_OAUTH_VERIFIER_KEY, verifier);
  localStorage.setItem(DROPBOX_OAUTH_REDIRECT_KEY, redirectUri);

  const params = new URLSearchParams({
    client_id: appKey,
    response_type: 'code',
    token_access_type: 'offline',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state,
    scope: 'files.metadata.read files.content.read files.content.write'
  });
  window.location.href = 'https://www.dropbox.com/oauth2/authorize?' + params.toString();
}

async function finishDropboxOAuth(code){
  const appKey = getDropboxAppKey();
  const verifier = localStorage.getItem(DROPBOX_OAUTH_VERIFIER_KEY) || '';
  const redirectUri = localStorage.getItem(DROPBOX_OAUTH_REDIRECT_KEY) || getOAuthRedirectUri();
  if(!appKey || !verifier) throw new Error('DROPBOX_OAUTH_MISSING');

  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: appKey,
      code_verifier: verifier,
      redirect_uri: redirectUri
    })
  });

  if(response.status === 400 || response.status === 401) throw new Error('DROPBOX_OAUTH_AUTH');
  if(!response.ok) throw new Error('DROPBOX_OAUTH_' + response.status);
  const data = await response.json();
  setDropboxOAuthTokens(data);
}

async function handleDropboxOAuthRedirect(){
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  if(!code && !error) return;

  showSettings();
  if(error){
    setCloudStatus('☁ Collegamento Dropbox annullato', 'err');
    alert('Collegamento Dropbox annullato.');
    return;
  }

  const expectedState = localStorage.getItem(DROPBOX_OAUTH_STATE_KEY) || '';
  const state = params.get('state') || '';
  if(!expectedState || state !== expectedState){
    setCloudStatus('☁ Collegamento Dropbox non valido', 'err');
    alert('Collegamento Dropbox non valido. Riprova.');
    return;
  }

  try{
    setCloudStatus('☁ Collegamento Dropbox...', '');
    await finishDropboxOAuth(code);
    localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY);
    localStorage.removeItem(DROPBOX_OAUTH_VERIFIER_KEY);
    localStorage.removeItem(DROPBOX_OAUTH_REDIRECT_KEY);
    history.replaceState({}, document.title, getOAuthRedirectUri());
    showSettings();
    setCloudStatus('☁ Dropbox collegato', 'ok');
  }catch(error){
    handleDropboxError(error, true);
  }
}

async function getValidDropboxToken(forceRefresh = false){
  if((forceRefresh || tokenNeedsRefresh()) && canRefreshDropboxToken()){
    return refreshDropboxAccessToken();
  }
  const token = getDropboxToken();
  if(token) return token;
  throw new Error('NO_DROPBOX_TOKEN');
}

async function dropboxFetch(url, options, retry = true){
  const token = await getValidDropboxToken(false);
  let response;
  try{
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: 'Bearer ' + token
      }
    });
  }catch(error){
    throw new Error('DROPBOX_NETWORK');
  }

  if(response.status === 401 && retry && canRefreshDropboxToken()){
    const refreshedToken = await getValidDropboxToken(true);
    try{
      return await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: 'Bearer ' + refreshedToken
        }
      });
    }catch(error){
      throw new Error('DROPBOX_NETWORK');
    }
  }

  return response;
}

function getDropboxPath(){
  const path = textValue(localStorage.getItem(DROPBOX_PATH_KEY)) || DEFAULT_DROPBOX_PATH;
  return path.startsWith('/') ? path : '/' + path;
}

function setDropboxPath(path){
  const cleanPath = textValue(path) || DEFAULT_DROPBOX_PATH;
  localStorage.setItem(DROPBOX_PATH_KEY, cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath);
}

function getDropboxBackupFolder(){
  const folder = textValue(localStorage.getItem(DROPBOX_BACKUP_FOLDER_KEY)) || DEFAULT_DROPBOX_BACKUP_FOLDER;
  const cleanFolder = folder.startsWith('/') ? folder : '/' + folder;
  return cleanFolder.replace(/\/+$/g, '') || DEFAULT_DROPBOX_BACKUP_FOLDER;
}

function setDropboxBackupFolder(folder){
  const cleanFolder = textValue(folder) || DEFAULT_DROPBOX_BACKUP_FOLDER;
  localStorage.setItem(DROPBOX_BACKUP_FOLDER_KEY, cleanFolder.startsWith('/') ? cleanFolder : '/' + cleanFolder);
}

function normalizeDropboxFolderPath(path){
  const cleanPath = textValue(path);
  if(!cleanPath || cleanPath === '/') return '';
  return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
}

function displayDropboxFolderPath(path){
  return normalizeDropboxFolderPath(path) || '/';
}

function setFolderPickerCurrent(path){
  dropboxFolderPickerPath = normalizeDropboxFolderPath(path);
  const current = document.getElementById('dropboxFolderCurrent');
  if(current) current.innerText = 'Cartella aperta: ' + displayDropboxFolderPath(dropboxFolderPickerPath);
  const backButton = document.getElementById('dropboxFolderBackButton');
  if(backButton) backButton.classList.toggle('hidden', !dropboxFolderPickerPath);
}

function setFolderPickerOptions(folders, placeholder){
  const select = document.getElementById('dropboxFolderSelect');
  if(!select) return;
  const options = [`<option value="">${escapeHTML(placeholder || 'Seleziona cartella')}</option>`];
  folders.forEach(folder => {
    const path = folder.path_display || folder.path_lower || '';
    options.push(`<option value="${escapeAttr(path)}">${escapeHTML(folder.name)} - ${escapeHTML(path || '/')}</option>`);
  });
  select.innerHTML = options.join('');
  select.disabled = folders.length === 0;
}

function setFolderPickerStatus(text, type = ''){
  const status = document.getElementById('dropboxFolderPickerStatus');
  if(!status) return;
  status.className = 'folder-picker-status' + (type ? ' ' + type : '');
  status.innerText = text;
}

function backupTimestamp(date = new Date()){
  const pad = value => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const millisecond = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}_${hour}-${minute}-${second}-${millisecond}`;
}

function buildBackupPath(timestamp){
  return `${getDropboxBackupFolder()}/inventory_backup_${timestamp}.json`;
}

function buildSnapshot(timestamp = Date.now(), meta = {}){
  return {
    version: 60,
    lastModified: timestamp,
    backupCreatedAt: meta.backupCreatedAt || new Date(timestamp).toISOString(),
    backupLabel: meta.backupLabel || '',
    backupPath: meta.backupPath || '',
    products: compactProductList(products),
    importSessions: compactImportSessions(importSessions),
    salesRecords: compactSalesRecords(salesRecords)
  };
}

async function dropboxDownloadSnapshot(){
  const response = await dropboxFetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
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

  const snapshotModified = Number(data.lastModified || 0) || 0;
  const serverModified = parseDropboxTime(meta.server_modified);
  data.lastModified = Math.max(snapshotModified, serverModified);
  data.dropboxServerModified = serverModified;
  data.snapshotModified = snapshotModified;
  data.products = normalizeProductList(data.products);
  data.importSessions = normalizeImportSessions(data.importSessions);
  data.salesRecords = normalizeSalesRecords(data.salesRecords);
  return data;
}

async function dropboxListFolders(path = ''){
  const folders = [];
  let response = await dropboxFetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: normalizeDropboxFolderPath(path),
      recursive: false,
      include_deleted: false,
      include_mounted_folders: true
    })
  });

  if(response.status === 401) throw new Error('DROPBOX_AUTH');
  if(!response.ok) throw new Error('DROPBOX_LIST_' + response.status);

  let data = await response.json();
  folders.push(...data.entries.filter(entry => entry['.tag'] === 'folder'));

  while(data.has_more){
    response = await dropboxFetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor: data.cursor })
    });
    if(response.status === 401) throw new Error('DROPBOX_AUTH');
    if(!response.ok) throw new Error('DROPBOX_LIST_' + response.status);
    data = await response.json();
    folders.push(...data.entries.filter(entry => entry['.tag'] === 'folder'));
  }

  return folders.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function dropboxUploadJson(path, data, mode = 'overwrite'){
  const response = await dropboxFetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode,
        autorename: mode !== 'overwrite',
        mute: true,
        strict_conflict: false
      })
    },
    body: JSON.stringify(data, null, 2)
  });

  if(response.status === 401) throw new Error('DROPBOX_AUTH');
  if(!response.ok) throw new Error('DROPBOX_UPLOAD_' + response.status);

  let meta = {};
  try{
    meta = await response.json();
  }catch(e){
    meta = {};
  }
  return meta;
}

async function dropboxUploadSnapshot(){
  const timestamp = Date.now();
  const backupNameTime = backupTimestamp(new Date(timestamp));
  const backupPath = buildBackupPath(backupNameTime);
  const snapshot = buildSnapshot(timestamp, {
    backupCreatedAt: new Date(timestamp).toISOString(),
    backupLabel: backupNameTime,
    backupPath
  });

  const mainMeta = await dropboxUploadJson(getDropboxPath(), snapshot, 'overwrite');
  await dropboxUploadJson(backupPath, snapshot, 'add');

  const serverModified = parseDropboxTime(mainMeta.server_modified);
  const savedTime = Math.max(timestamp, serverModified);
  products = snapshot.products;
  importSessions = snapshot.importSessions;
  salesRecords = snapshot.salesRecords;
  persistAll(false);
  setLocalModified(savedTime);
  return snapshot;
}

function dropboxErrorMessage(error){
  const code = String(error?.message || '');
  if(error?.name === 'QuotaExceededError') return 'Memoria del browser piena';
  if(code === 'NO_DROPBOX_TOKEN') return 'Token Dropbox mancante';
  if(code === 'DROPBOX_AUTH') return 'Token Dropbox non valido';
  if(code === 'DROPBOX_REFRESH_AUTH') return 'Refresh token Dropbox non valido';
  if(code === 'DROPBOX_REFRESH_BAD_RESPONSE') return 'Risposta Dropbox non valida';
  if(code.startsWith('DROPBOX_REFRESH_')) return 'Errore rinnovo token Dropbox';
  if(code === 'DROPBOX_NETWORK') return 'Dropbox non raggiungibile';
  if(code === 'DROPBOX_OAUTH_AUTH') return 'Collegamento Dropbox non autorizzato';
  if(code === 'DROPBOX_OAUTH_MISSING') return 'Dati collegamento Dropbox mancanti';
  if(code.startsWith('DROPBOX_OAUTH_')) return 'Errore collegamento Dropbox';
  if(code === 'DROPBOX_BAD_JSON') return 'File Dropbox non leggibile';
  if(code.startsWith('DROPBOX_UPLOAD_')) return 'Errore upload Dropbox';
  if(code.startsWith('DROPBOX_DOWNLOAD_')) return 'Errore download Dropbox';
  if(code.startsWith('DROPBOX_LIST_')) return 'Errore lettura cartelle Dropbox';
  if(code.includes('Failed to fetch') || code.includes('NetworkError')) return 'Dropbox non raggiungibile';
  return 'Errore Dropbox';
}

function dropboxErrorAdvice(error){
  const code = String(error?.message || '');
  if(location.protocol === 'file:') return 'Stai usando l\'app come file locale: per Dropbox usa il sito online o localhost.';
  if(code === 'NO_DROPBOX_TOKEN') return 'Collega Dropbox dalle Impostazioni.';
  if(code === 'DROPBOX_AUTH') return 'Ricollega Dropbox: il token non e piu valido.';
  if(code === 'DROPBOX_REFRESH_AUTH') return 'Ricollega Dropbox: il rinnovo automatico non e piu valido.';
  if(code === 'DROPBOX_NETWORK') return 'Controlla internet e riprova Sincronizza dati.';
  if(code.startsWith('DROPBOX_UPLOAD_')) return 'I dati sono salvati sul dispositivo. Riprova Sincronizza dati tra poco.';
  if(error?.name === 'QuotaExceededError') return 'Riduci la cronologia importazioni o svuota dati vecchi.';
  return 'I dati restano salvati sul dispositivo; riprova Sincronizza dati.';
}

function dropboxAlertMessage(error){
  return dropboxErrorMessage(error) + '. ' + dropboxErrorAdvice(error);
}

function handleDropboxError(error, showAlert = true){
  const message = dropboxErrorMessage(error);
  console.error(error);
  setCloudStatus('☁ ' + message, 'err');
  if(showAlert) alert(dropboxAlertMessage(error));
}

async function saveCloudAfterChange(label, options = {}){
  if(!hasDropboxCredentials()){
    setCloudStatus('☁ ' + label + ' locale', 'ok');
    return { synced: false, skipped: true, message: 'Dropbox non collegato' };
  }
  try{
    await dropboxUploadSnapshot();
    setCloudStatus('☁ ' + label + ' su Dropbox + backup', 'ok');
    return { synced: true };
  }catch(error){
    handleDropboxError(error, false);
    if(!options.silentDropboxError){
      alert(label + ' salvato sul dispositivo.\nDropbox non aggiornato: ' + dropboxAlertMessage(error));
    }
    return { synced: false, error, message: dropboxAlertMessage(error) };
  }
}

async function syncNow(options = {}){
  if(cloudLoading) return;

  if(!hasDropboxCredentials()){
    setCloudStatus('☁ Token Dropbox mancante', 'err');
    if(!options.silentMissingToken){
      showSettings();
      alert('Inserisci in Impostazioni un access token Dropbox oppure App Key + Refresh Token.');
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
      setCloudStatus('☁ Dropbox creato + backup: ' + products.length + ' prodotti', 'ok');
    }else if(localProducts === 0 && remoteProducts > 0){
      products = remote.products;
      importSessions = remote.importSessions;
      salesRecords = remote.salesRecords || [];
      persistAll(false);
      setLocalModified(remoteTime || Date.now());
      setCloudStatus('☁ Database scaricato da Dropbox', 'ok');
    }else if(localTime === 0 && remoteProducts > 0){
      products = remote.products;
      importSessions = remote.importSessions;
      salesRecords = remote.salesRecords || [];
      persistAll(false);
      setLocalModified(remoteTime || Date.now());
      setCloudStatus('☁ Ultimo file Dropbox scaricato: ' + products.length + ' prodotti', 'ok');
    }else if(localTime === 0 && localProducts > 0 && remoteProducts === 0){
      await dropboxUploadSnapshot();
      setCloudStatus('☁ Locale caricato + backup: ' + products.length + ' prodotti', 'ok');
    }else if(remoteTime > localTime){
      products = remote.products;
      importSessions = remote.importSessions;
      salesRecords = remote.salesRecords || [];
      persistAll(false);
      setLocalModified(remoteTime);
      setCloudStatus('☁ Scaricato da Dropbox: ' + products.length + ' prodotti', 'ok');
    }else{
      await dropboxUploadSnapshot();
      setCloudStatus('☁ Caricato su Dropbox + backup: ' + products.length + ' prodotti', 'ok');
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
  document.getElementById('menuSales')?.classList.toggle('active', view === 'sales');
  document.getElementById('menuTopSales')?.classList.toggle('active', view === 'topSales');
  document.getElementById('menuHistory')?.classList.toggle('active', view === 'history');
  document.getElementById('menuCategories')?.classList.toggle('active', view === 'categories');
  document.getElementById('menuSettings')?.classList.toggle('active', view === 'settings');
}

function setPageVisibility(view){
  const pages = {
    products: 'productsPage',
    suppliers: 'suppliersPage',
    sales: 'salesPage',
    topSales: 'topSalesPage',
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
  const search = document.getElementById('search');
  if(search) search.placeholder = 'SCANSIONA / CERCA BARCODE QUI';
  renderProducts();
}

function showSuppliers(){
  currentView = 'suppliers';
  setActive('suppliers');
  setPageVisibility('suppliers');
  setTitle('Fornitori', 'Cartelle fornitori / 供应商文件夹');
  renderSupplierFolders();
}

function showSales(){
  currentView = 'sales';
  setActive('sales');
  setPageVisibility('sales');
  setTitle('Vendite', 'Scansiona prodotti e conferma la vendita');
  const search = document.getElementById('search');
  if(search) search.placeholder = 'SCANSIONA BARCODE PER VENDITA';
  renderSaleCart();
  renderSaleSearchResults();
  if(currentSaleBarcode && productForBarcode(currentSaleBarcode)){
    renderSaleCurrentProduct(productForBarcode(currentSaleBarcode), currentSaleBarcode);
  }else{
    clearSaleCurrentProduct();
  }
}

function showTopSales(){
  currentView = 'topSales';
  setActive('topSales');
  setPageVisibility('topSales');
  setTitle('Più venduti', 'Classifica prodotti e fornitori venduti');
  const search = document.getElementById('search');
  if(search) search.placeholder = 'SCANSIONA / CERCA BARCODE QUI';
  setupSalesDefaultDates();
  renderSalesStats();
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
  const appKeyInput = document.getElementById('dropboxAppKey');
  const refreshInput = document.getElementById('dropboxRefreshToken');
  const tokenInput = document.getElementById('dropboxToken');
  const pathInput = document.getElementById('dropboxPath');
  const backupFolderInput = document.getElementById('dropboxBackupFolder');
  const accountStatus = document.getElementById('dropboxAccountStatus');
  if(appKeyInput) appKeyInput.value = getDropboxAppKey();
  if(refreshInput) refreshInput.value = getDropboxRefreshToken();
  if(tokenInput) tokenInput.value = getDropboxToken();
  if(pathInput) pathInput.value = getDropboxPath();
  if(backupFolderInput) backupFolderInput.value = getDropboxBackupFolder();
  if(accountStatus){
    const connected = hasDropboxCredentials();
    accountStatus.innerText = connected ? 'Dropbox collegato' : 'Dropbox non collegato';
    accountStatus.classList.toggle('ok', connected);
  }
  updateDropboxRedirectHint();
  setFolderPickerCurrent(getDropboxBackupFolder());
  setFolderPickerStatus(
    hasDropboxCredentials()
      ? 'Mostra le cartelle, entra in quella che vuoi usare, poi premi Salva questa cartella.'
      : 'Collega account Dropbox, poi mostra le cartelle.'
  );
}

function renderCurrentView(){
  if(currentView === 'suppliers') renderSupplierFolders();
  else if(currentView === 'sales') showSales();
  else if(currentView === 'topSales') showTopSales();
  else if(currentView === 'history') renderImportSessions();
  else if(currentView === 'categories') renderCategoryFolders();
  else if(currentView === 'settings') showSettings();
  else renderProducts();
}

function productMatchesSearch(p, search){
  return [getBarcode(p), getName(p), getSupplier(p), getCategory(p)]
    .some(value => String(value).toLowerCase().includes(search));
}

function productIndexByBarcode(barcode){
  const code = String(barcode || '');
  return products.findIndex(p => String(getBarcode(p)) === code);
}

function productForBarcode(barcode){
  const index = productIndexByBarcode(barcode);
  return index >= 0 ? products[index] : null;
}

function setSaleStatus(text, type = ''){
  const el = document.getElementById('saleStatus');
  if(!el) return;
  el.className = 'sale-status' + (type ? ' ' + type : '');
  el.innerText = text;
}

function clearSaleAddedStatusIfCartEmpty(){
  const el = document.getElementById('saleStatus');
  if(!el || saleCartTotal()) return;
  const currentText = textValue(el.innerText);
  if(currentText.startsWith('Aggiunto al carrello:')){
    setSaleStatus('Carrello vendita vuoto.');
  }
}

function clearSaleCurrentProduct(){
  const box = document.getElementById('saleCurrentProduct');
  currentSaleBarcode = '';
  if(!box) return;
  box.innerHTML = '';
  box.classList.add('hidden');
}

function renderSaleCurrentProduct(product, barcode){
  const box = document.getElementById('saleCurrentProduct');
  if(!box || !product) return;
  const code = textValue(barcode || getBarcode(product));
  const buyPrice = getBuy(product) || '-';
  const sellPrice = getSell(product) || '-';
  const cartQty = Number(saleCart[code] || 0);
  currentSaleBarcode = code;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="sale-current-label">Ultimo prodotto scansionato</div>
    <div class="sale-current-main">
      <div>
        <div class="sale-current-name">${escapeHTML(getName(product) || 'Prodotto senza nome')}</div>
        <div class="sale-current-barcode">${escapeHTML(code)}</div>
        <div class="sale-current-actions">
          <button class="edit-btn" data-sale-edit-barcode="${escapeAttr(code)}">Modifica</button>
        </div>
      </div>
      <div class="sale-current-prices">
        <div><span>Acquisto</span><strong>${escapeHTML(buyPrice)}</strong></div>
        <div><span>Vendita</span><strong>${escapeHTML(sellPrice)}</strong></div>
        <div><span>Nel carrello</span><strong>${cartQty}</strong></div>
      </div>
    </div>`;
}

function saleCartTotal(){
  return Object.values(saleCart).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

function salePriceNumber(value){
  const raw = textValue(value).replace(/[^\d,.-]/g, '');
  if(!raw) return 0;
  let normalized = raw;
  const commaIndex = raw.lastIndexOf(',');
  const dotIndex = raw.lastIndexOf('.');
  if(commaIndex >= 0 && dotIndex >= 0){
    normalized = commaIndex > dotIndex
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  }else if(commaIndex >= 0){
    normalized = raw.replace(',', '.');
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function saleMoney(value){
  return '€ ' + Number(value || 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function updateSaleBottomTotal(total = 0){
  const amount = document.getElementById('saleBottomTotalAmount');
  if(amount) amount.innerText = saleMoney(total);
}

function saleCartSellTotal(items){
  return items.reduce((sum, item) => {
    const sellPrice = item.product ? salePriceNumber(getSell(item.product)) : 0;
    return sum + (sellPrice * item.qty);
  }, 0);
}

function addProductIndexToSaleCart(index, qty = 1){
  if(index < 0 || index >= products.length) return false;
  return addBarcodeToSaleCart(getBarcode(products[index]), qty);
}

function editSaleProductByBarcode(barcode){
  const code = textValue(barcode);
  const index = productIndexByBarcode(code);
  if(index < 0){
    setSaleStatus('Prodotto non trovato per modifica: ' + code, 'err');
    return;
  }
  openEditModal(index);
}

function addBarcodeToSaleCart(barcode, qty = 1){
  const code = textValue(barcode);
  if(!code) return false;
  const product = productForBarcode(code);
  if(!product){
    setSaleStatus('Prodotto non trovato: ' + code, 'err');
    clearSaleCurrentProduct();
    return false;
  }
  saleCart[code] = Math.max(0, Number(saleCart[code] || 0) + Number(qty || 1));
  persistSaleCart();
  renderSaleCart();
  renderSalesStats();
  renderSaleCurrentProduct(product, code);
  setSaleStatus('Aggiunto al carrello: ' + (getName(product) || code), 'ok');
  return true;
}

function changeSaleCartQty(barcode, delta){
  const code = textValue(barcode);
  if(!code || !saleCart[code]) return;
  saleCart[code] = Math.max(0, Number(saleCart[code] || 0) + delta);
  if(saleCart[code] <= 0) delete saleCart[code];
  persistSaleCart();
  renderSaleCart();
  const product = productForBarcode(code);
  if(product && saleCart[code]) renderSaleCurrentProduct(product, code);
  else clearSaleCurrentProduct();
}

function removeSaleCartItem(barcode){
  const code = textValue(barcode);
  if(!code) return;
  delete saleCart[code];
  persistSaleCart();
  renderSaleCart();
  clearSaleCurrentProduct();
}

function selectedSaleCartBarcodes(){
  return Array.from(document.querySelectorAll('.sale-cart-checkbox:checked'))
    .map(cb => cb.dataset.barcode)
    .filter(Boolean);
}

function toggleSaleCartSelection(){
  saleCartAllSelected = !saleCartAllSelected;
  document.querySelectorAll('.sale-cart-checkbox').forEach(cb => cb.checked = saleCartAllSelected);
  const btn = document.getElementById('toggleSaleCartSelectBtn');
  if(btn) btn.innerText = saleCartAllSelected ? 'Deseleziona carrello' : 'Seleziona carrello';
}

function deleteSelectedSaleCartItems(){
  const selected = selectedSaleCartBarcodes();
  if(!selected.length){
    setSaleStatus('Seleziona almeno un prodotto da eliminare.', 'err');
    return;
  }
  selected.forEach(barcode => delete saleCart[barcode]);
  saleCartAllSelected = false;
  persistSaleCart();
  renderSaleCart();
  clearSaleCurrentProduct();
  setSaleStatus('Prodotti selezionati eliminati dal carrello.', 'ok');
}

function clearSaleCart(){
  if(!saleCartTotal()){
    setSaleStatus('Carrello gia vuoto.');
    return;
  }
  saleCartAllSelected = false;
  saleCart = {};
  persistSaleCart();
  renderSaleCart();
  clearSaleCurrentProduct();
  setSaleStatus('Carrello svuotato.', 'ok');
}

async function confirmSaleCart(){
  const items = Object.entries(saleCart)
    .map(([barcode, qty]) => ({ barcode, qty: Number(qty) || 0 }))
    .filter(item => item.barcode && item.qty > 0);
  if(!items.length){
    setSaleStatus('Aggiungi almeno un prodotto prima di confermare.', 'err');
    return;
  }

  const total = items.reduce((sum, item) => sum + item.qty, 0);

  salesRecords.unshift({
    id: 'sale_' + Date.now(),
    time: new Date().toISOString(),
    items
  });
  saleCartAllSelected = false;
  saleCart = {};
  persistSalesRecords(true);
  persistSaleCart();
  renderSaleCart();
  clearSaleCurrentProduct();
  renderSalesStats();
  const cloudResult = await saveCloudAfterChange('Vendita salvata', { silentDropboxError: true });
  setSaleStatus(cloudResult.synced ? 'Vendita confermata e sincronizzata.' : 'Vendita confermata sul dispositivo.', cloudResult.synced ? 'ok' : '');
}

function saleSearchMatches(query){
  const search = String(query || '').toLowerCase();
  if(!search) return [];
  const matches = [];
  products.forEach((product, index) => {
    if(productMatchesSearch(product, search)) matches.push({ product, index });
  });
  return matches.slice(0, 25);
}

function renderSaleSearchResults(query = null){
  const box = document.getElementById('saleSearchResults');
  if(!box) return;
  const inputValue = document.getElementById('saleProductSearch')?.value || '';
  const search = query === null ? inputValue : query;
  const matches = saleSearchMatches(search);
  if(!String(search || '').trim()){
    box.innerHTML = '';
    return;
  }
  if(!matches.length){
    box.innerHTML = '<div class="sale-status err">Nessun prodotto trovato.</div>';
    return;
  }
  box.innerHTML = `<div class="table-card"><table><thead><tr><th>Barcode</th><th>Prodotto</th><th>Fornitore</th><th>Vendita</th><th>Azioni</th></tr></thead><tbody>
    ${matches.map(item => {
      const p = item.product;
      const barcode = getBarcode(p);
      return `<tr>
        <td>${escapeHTML(barcode)}</td>
        <td>${escapeHTML(getName(p))}</td>
        <td>${escapeHTML(getSupplier(p) || '-')}</td>
        <td>${escapeHTML(getSell(p) || '-')}</td>
        <td><div class="action-buttons">
          <button class="edit-btn" data-sale-add-index="${item.index}">Aggiungi</button>
          <button class="edit-btn" data-sale-edit-barcode="${escapeAttr(barcode)}">Modifica</button>
        </div></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function clearSaleSearchResults(clearInput = false){
  const box = document.getElementById('saleSearchResults');
  if(box) box.innerHTML = '';
  if(clearInput){
    const input = document.getElementById('saleProductSearch');
    if(input) input.value = '';
  }
}

function addFirstSaleSearchResult(){
  const query = document.getElementById('saleProductSearch')?.value || '';
  const first = saleSearchMatches(query)[0];
  if(!first){
    setSaleStatus('Cerca un prodotto prima di aggiungere.', 'err');
    return;
  }
  addProductIndexToSaleCart(first.index);
}

function renderSaleCart(){
  const count = document.getElementById('saleCartCount');
  if(count) count.innerText = saleCartTotal() + ' pezzi';
  const selectBtn = document.getElementById('toggleSaleCartSelectBtn');
  if(selectBtn) selectBtn.innerText = saleCartAllSelected ? 'Deseleziona carrello' : 'Seleziona carrello';
  const box = document.getElementById('saleCartBox');
  if(!box) return;
  const items = Object.entries(saleCart)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([barcode, qty]) => ({ barcode, qty: Number(qty), product: productForBarcode(barcode) }));
  const totalSell = saleCartSellTotal(items);
  updateSaleBottomTotal(totalSell);
  if(!items.length){
    saleCartAllSelected = false;
    if(selectBtn) selectBtn.innerText = 'Seleziona carrello';
    clearSaleCurrentProduct();
    clearSaleAddedStatusIfCartEmpty();
    box.innerHTML = '<div class="empty-row">Carrello vendita vuoto</div>';
    return;
  }
  box.innerHTML = `<div class="table-card"><table><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Acquisto</th><th>Vendita</th><th>Qta</th><th>Azioni</th></tr></thead><tbody>
    ${items.map(item => {
      const buyPrice = item.product ? (getBuy(item.product) || '-') : '-';
      const sellPrice = item.product ? (getSell(item.product) || '-') : '-';
      return `<tr>
        <td><input type="checkbox" class="sale-cart-checkbox" data-barcode="${escapeAttr(item.barcode)}" ${saleCartAllSelected ? 'checked' : ''}></td>
        <td>${escapeHTML(item.barcode)}</td>
        <td>${escapeHTML(item.product ? getName(item.product) : 'Prodotto non trovato')}</td>
        <td>${escapeHTML(buyPrice)}</td>
        <td>${escapeHTML(sellPrice)}</td>
        <td>${item.qty}</td>
        <td><div class="action-buttons">
          <button class="edit-btn" data-sale-cart-action="minus" data-barcode="${escapeAttr(item.barcode)}">-</button>
          <button class="edit-btn" data-sale-cart-action="plus" data-barcode="${escapeAttr(item.barcode)}">+</button>
          <button class="edit-btn" data-sale-edit-barcode="${escapeAttr(item.barcode)}">Modifica</button>
          <button class="delete-btn" data-sale-cart-action="remove" data-barcode="${escapeAttr(item.barcode)}">Rimuovi</button>
        </div></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function dateInputValue(date){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date){
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date){
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function setupSalesDefaultDates(){
  const from = document.getElementById('salesDateFrom');
  const to = document.getElementById('salesDateTo');
  const quick = document.getElementById('salesQuickRange');
  if(from && to && quick && !from.value && !to.value){
    quick.value = 'today';
    applySalesQuickRange(false);
  }
}

function applySalesQuickRange(render = true){
  const quick = document.getElementById('salesQuickRange');
  const from = document.getElementById('salesDateFrom');
  const to = document.getElementById('salesDateTo');
  if(!quick || !from || !to) return;
  const now = new Date();
  let start = null;
  let end = now;
  if(quick.value === 'today'){
    start = startOfDay(now);
  }else if(quick.value === 'week'){
    start = startOfDay(new Date(now));
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }else if(quick.value === 'month'){
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }else if(quick.value === 'year'){
    start = new Date(now.getFullYear(), 0, 1);
  }else if(quick.value === 'all'){
    from.value = '';
    to.value = '';
    if(render) renderSalesStats();
    return;
  }else{
    if(render) renderSalesStats();
    return;
  }
  from.value = dateInputValue(start);
  to.value = dateInputValue(end);
  if(render) renderSalesStats();
}

function setSalesCustomRange(){
  const quick = document.getElementById('salesQuickRange');
  if(quick) quick.value = 'custom';
  renderSalesStats();
}

function setSalesStatsStatus(text, type = ''){
  const el = document.getElementById('salesStatsActionStatus');
  if(!el) return;
  el.className = 'sale-status' + (type ? ' ' + type : '');
  el.classList.toggle('hidden', !text);
  el.innerText = text || '';
}

function salesStatsCheckboxes(){
  return Array.from(document.querySelectorAll('.sales-stat-checkbox'));
}

function updateSalesStatsSelectButton(){
  const btn = document.getElementById('toggleSalesStatsSelectBtn');
  if(btn) btn.innerText = salesStatsAllSelected ? 'Deseleziona lista' : 'Seleziona lista';
}

function toggleSalesSupplierProducts(supplier){
  const key = textValue(supplier);
  if(!key) return;
  openSalesSupplierKey = openSalesSupplierKey === key ? '' : key;
  renderSalesStats();
}

function toggleSalesStatsSelection(){
  salesStatsAllSelected = !salesStatsAllSelected;
  salesStatsCheckboxes().forEach(cb => cb.checked = salesStatsAllSelected);
  updateSalesStatsSelectButton();
}

function selectedSalesStatsTargets(){
  return salesStatsCheckboxes()
    .filter(cb => cb.checked)
    .map(cb => ({ type: cb.dataset.statType, key: cb.dataset.statKey }))
    .filter(item => item.type && item.key);
}

function saleItemMatchesStatsTarget(item, target){
  if(target.type === 'product') return String(item.barcode) === String(target.key);
  if(target.type === 'supplier'){
    const p = productForBarcode(item.barcode);
    const supplier = p ? supplierNameOf(p) : 'Senza fornitore';
    return String(supplier) === String(target.key);
  }
  return false;
}

async function deleteSelectedSalesStats(){
  const selected = selectedSalesStatsTargets();
  if(!selected.length){
    setSalesStatsStatus('Seleziona almeno una riga da eliminare.', 'err');
    return;
  }
  if(!confirm('Eliminare le righe selezionate dalla classifica nel periodo scelto? I prodotti restano nel magazzino.')) return;

  const range = salesDateRange();
  const targets = new Set(selected.map(item => item.type + '::' + item.key));
  let removedPieces = 0;
  salesRecords = salesRecords.map(record => {
    if(!saleRecordInRange(record, range)) return record;
    const keptItems = record.items.filter(item => {
      const shouldRemove = selected.some(target => saleItemMatchesStatsTarget(item, target));
      if(shouldRemove) removedPieces += Number(item.qty) || 0;
      return !shouldRemove;
    });
    return { ...record, items: keptItems };
  }).filter(record => record.items.length);

  salesStatsAllSelected = false;
  persistSalesRecords(true);
  renderSalesStats();
  setSalesStatsStatus('Eliminate ' + targets.size + ' righe dalla classifica (' + removedPieces + ' pezzi).', 'ok');
  await saveCloudAfterChange('Classifica aggiornata', { silentDropboxError: true });
}

function salesStatsTargetQuantity(target, range){
  return salesRecords.reduce((sum, record) => {
    if(!saleRecordInRange(record, range)) return sum;
    return sum + record.items.reduce((itemSum, item) => {
      return itemSum + (saleItemMatchesStatsTarget(item, target) ? (Number(item.qty) || 0) : 0);
    }, 0);
  }, 0);
}

function salesAdjustmentTime(range){
  const now = new Date();
  if(range.from && now < range.from) return range.from.toISOString();
  if(range.to && now > range.to) return range.to.toISOString();
  return now.toISOString();
}

function reduceSalesStatsQuantity(target, range, amount){
  let remaining = amount;
  salesRecords = salesRecords.map(record => {
    if(!saleRecordInRange(record, range) || remaining <= 0) return record;
    const items = [];
    record.items.forEach(item => {
      if(remaining > 0 && saleItemMatchesStatsTarget(item, target)){
        const qty = Number(item.qty) || 0;
        const removeQty = Math.min(qty, remaining);
        remaining -= removeQty;
        const keptQty = qty - removeQty;
        if(keptQty > 0) items.push({ ...item, qty: keptQty });
      }else{
        items.push(item);
      }
    });
    return { ...record, items };
  }).filter(record => record.items.length);
}

async function editSalesStatsQuantity(type, key, addBarcode = ''){
  const target = { type: textValue(type), key: textValue(key) };
  if(!target.type || !target.key) return;
  const range = salesDateRange();
  const currentQty = salesStatsTargetQuantity(target, range);
  const answer = prompt('Nuova quantità venduta:', String(currentQty));
  if(answer === null) return;
  const newQty = Math.round(Number(String(answer).replace(',', '.')));
  if(!Number.isFinite(newQty) || newQty < 0){
    setSalesStatsStatus('Quantità non valida.', 'err');
    return;
  }
  if(newQty === currentQty){
    setSalesStatsStatus('Quantità già uguale: ' + currentQty + '.', 'ok');
    return;
  }

  if(newQty < currentQty){
    reduceSalesStatsQuantity(target, range, currentQty - newQty);
  }else{
    const barcode = target.type === 'product' ? target.key : textValue(addBarcode);
    if(!barcode){
      setSalesStatsStatus('Non trovo un prodotto su cui aggiungere quantità.', 'err');
      return;
    }
    salesRecords.unshift({
      id: 'sale_adjust_' + Date.now(),
      time: salesAdjustmentTime(range),
      items: [{ barcode, qty: newQty - currentQty }]
    });
  }

  salesStatsAllSelected = false;
  persistSalesRecords(true);
  renderSalesStats();
  setSalesStatsStatus('Quantità aggiornata da ' + currentQty + ' a ' + newQty + '.', 'ok');
  await saveCloudAfterChange('Quantità venduta aggiornata', { silentDropboxError: true });
}

function salesDateRange(){
  const fromValue = document.getElementById('salesDateFrom')?.value || '';
  const toValue = document.getElementById('salesDateTo')?.value || '';
  return {
    from: fromValue ? startOfDay(new Date(fromValue + 'T00:00:00')) : null,
    to: toValue ? endOfDay(new Date(toValue + 'T00:00:00')) : null
  };
}

function saleRecordInRange(record, range){
  const time = new Date(record.time);
  if(Number.isNaN(time.getTime())) return false;
  if(range.from && time < range.from) return false;
  if(range.to && time > range.to) return false;
  return true;
}

function renderSalesStats(){
  const box = document.getElementById('salesStatsBox');
  if(!box) return;
  updateSalesStatsSelectButton();
  const view = document.getElementById('salesStatsView')?.value || 'products';
  if(view !== 'suppliers') openSalesSupplierKey = '';
  const range = salesDateRange();
  const filtered = salesRecords.filter(record => saleRecordInRange(record, range));
  const totalPieces = filtered.reduce((sum, record) => sum + record.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);
  const count = document.getElementById('salesStatsCount');
  if(count) count.innerText = totalPieces + ' pezzi';

  if(!filtered.length){
    salesStatsAllSelected = false;
    updateSalesStatsSelectButton();
    box.innerHTML = '<div class="empty-row">Nessuna vendita nel periodo selezionato</div>';
    return;
  }

  if(view === 'suppliers') renderSupplierSalesStats(box, filtered);
  else renderProductSalesStats(box, filtered);
}

function renderProductSalesStats(box, records){
  const totals = {};
  records.forEach(record => {
    record.items.forEach(item => {
      if(!totals[item.barcode]) totals[item.barcode] = { qty: 0, last: '' };
      totals[item.barcode].qty += item.qty;
      if(!totals[item.barcode].last || record.time > totals[item.barcode].last) totals[item.barcode].last = record.time;
    });
  });
  const rows = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty);
  box.innerHTML = `<div class="table-card"><table><thead><tr><th></th><th>#</th><th>Prodotto</th><th>Barcode</th><th>Fornitore</th><th>Categoria</th><th>Acquisto</th><th>Vendita</th><th>Qta</th><th>Ultima vendita</th><th>Azioni</th></tr></thead><tbody>
    ${rows.map(([barcode, data], index) => {
      const p = productForBarcode(barcode);
      return `<tr>
        <td><input type="checkbox" class="sales-stat-checkbox" data-stat-type="product" data-stat-key="${escapeAttr(barcode)}" ${salesStatsAllSelected ? 'checked' : ''}></td>
        <td>${index + 1}</td>
        <td>${escapeHTML(p ? getName(p) : 'Prodotto non trovato')}</td>
        <td>${escapeHTML(barcode)}</td>
        <td>${escapeHTML(p ? (getSupplier(p) || '-') : '-')}</td>
        <td>${escapeHTML(p ? (getCategory(p) || '-') : '-')}</td>
        <td>${escapeHTML(p ? (getBuy(p) || '-') : '-')}</td>
        <td>${escapeHTML(p ? (getSell(p) || '-') : '-')}</td>
        <td><strong>${data.qty}</strong></td>
        <td>${escapeHTML(formatDate(data.last))}</td>
        <td><button class="edit-btn" data-sales-qty-type="product" data-sales-qty-key="${escapeAttr(barcode)}" data-sales-qty-add-barcode="${escapeAttr(barcode)}">Modifica</button></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}

function renderSupplierSalesStats(box, records){
  const totals = {};
  records.forEach(record => {
    record.items.forEach(item => {
      const p = productForBarcode(item.barcode);
      const supplier = p ? supplierNameOf(p) : 'Senza fornitore';
      if(!totals[supplier]) totals[supplier] = { qty: 0, products: {}, productLast: {}, last: '' };
      totals[supplier].qty += item.qty;
      totals[supplier].products[item.barcode] = (totals[supplier].products[item.barcode] || 0) + item.qty;
      if(!totals[supplier].productLast[item.barcode] || record.time > totals[supplier].productLast[item.barcode]){
        totals[supplier].productLast[item.barcode] = record.time;
      }
      if(!totals[supplier].last || record.time > totals[supplier].last) totals[supplier].last = record.time;
    });
  });
  const rows = Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty);
  box.innerHTML = `<div class="table-card"><table><thead><tr><th></th><th>#</th><th>Fornitore</th><th>Pezzi venduti</th><th>Prodotti diversi</th><th>Prodotto migliore</th><th>Acquisto</th><th>Vendita</th><th>Ultima vendita</th><th>Azioni</th></tr></thead><tbody>
    ${rows.map(([supplier, data], index) => {
      const top = Object.entries(data.products).sort((a, b) => b[1] - a[1])[0];
      const p = top ? productForBarcode(top[0]) : null;
      const topName = top ? `${p ? getName(p) : top[0]} (${top[1]})` : '-';
      const isOpen = openSalesSupplierKey === supplier;
      return `<tr>
        <td><input type="checkbox" class="sales-stat-checkbox" data-stat-type="supplier" data-stat-key="${escapeAttr(supplier)}" ${salesStatsAllSelected ? 'checked' : ''}></td>
        <td>${index + 1}</td>
        <td><button class="supplier-sales-name" data-sales-supplier-details="${escapeAttr(supplier)}">${escapeHTML(supplier)} <span>${isOpen ? '▲' : '▼'}</span></button></td>
        <td><strong>${data.qty}</strong></td>
        <td>${Object.keys(data.products).length}</td>
        <td>${escapeHTML(topName)}</td>
        <td>${escapeHTML(p ? (getBuy(p) || '-') : '-')}</td>
        <td>${escapeHTML(p ? (getSell(p) || '-') : '-')}</td>
        <td>${escapeHTML(formatDate(data.last))}</td>
        <td><span class="supplier-sales-open-note">Apri fornitore</span></td>
      </tr>${isOpen ? renderSupplierSalesProductDetail(supplier, data) : ''}`;
    }).join('')}
  </tbody></table></div>`;
}

function renderSupplierSalesProductDetail(supplier, data){
  const productsRows = Object.entries(data.products).sort((a, b) => b[1] - a[1]);
  if(!productsRows.length) return '';
  return `<tr class="supplier-sales-detail-row">
    <td colspan="10">
      <div class="supplier-sales-detail">
        <div class="supplier-sales-detail-title">Prodotti venduti di ${escapeHTML(supplier)}: ${productsRows.length}</div>
        <div class="table-card supplier-sales-products">
          <table>
            <thead><tr><th>#</th><th>Prodotto</th><th>Barcode</th><th>Acquisto</th><th>Vendita</th><th>Qta venduta</th><th>Ultima vendita</th><th>Azioni</th></tr></thead>
            <tbody>
              ${productsRows.map(([barcode, qty], index) => {
                const p = productForBarcode(barcode);
                return `<tr>
                  <td>${index + 1}</td>
                  <td>${escapeHTML(p ? getName(p) : 'Prodotto non trovato')}</td>
                  <td>${escapeHTML(barcode)}</td>
                  <td>${escapeHTML(p ? (getBuy(p) || '-') : '-')}</td>
                  <td>${escapeHTML(p ? (getSell(p) || '-') : '-')}</td>
                  <td><strong>${qty}</strong></td>
                  <td>${escapeHTML(formatDate(data.productLast[barcode] || data.last))}</td>
                  <td><button class="edit-btn" data-sales-qty-type="product" data-sales-qty-key="${escapeAttr(barcode)}" data-sales-qty-add-barcode="${escapeAttr(barcode)}">Modifica</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </td>
  </tr>`;
}

function handleScannerInput(){
  const search = document.getElementById('search');
  if(currentView === 'sales'){
    const value = textValue(search?.value);
    if(!value){
      renderSaleSearchResults();
      return;
    }
    const exactIndex = productIndexByBarcode(value);
    if(exactIndex >= 0){
      addProductIndexToSaleCart(exactIndex);
      clearSaleSearchResults(true);
      if(search) search.value = '';
      return;
    }
    renderSaleSearchResults(value);
    return;
  }
  if(currentView === 'products'){
    currentPage = 1;
    renderProducts();
  }
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

  box.innerHTML = sessions.map(session => {
    const barcodes = sessionBarcodes(session);
    const sessionCount = session.count || barcodes.length;
    return `<div class="import-session">
    <div class="import-session-header">
      <div>
        <div class="import-session-title">📁 ${escapeHTML(session.fileName || 'Importazione')}</div>
        <div class="import-session-meta">${escapeHTML(formatDate(session.time))} · ${sessionCount} prodotti</div>
      </div>
      <div class="import-session-actions">
        <button class="session-open" data-history-action="toggle" data-session-id="${escapeAttr(session.id)}">Apri / Chiudi</button>
        <button class="session-delete" data-history-action="delete-all" data-session-id="${escapeAttr(session.id)}">Elimina importazione</button>
      </div>
    </div>
    <div class="import-session-body" data-session-id="${escapeAttr(session.id)}">
      <div class="import-session-page-info">Apri questa importazione per vedere i prodotti a pagine.</div>
    </div>
  </div>`;
  }).join('');
}

function importSessionPageFor(id){
  return Math.max(1, Number(importSessionPages[id] || 1) || 1);
}

function renderImportSessionBody(id){
  const session = importSessions.find(s => s.id === String(id));
  const body = importBodyFor(id);
  if(!session || !body) return;

  const barcodes = sessionBarcodes(session);
  const total = barcodes.length;
  const totalPages = Math.max(1, Math.ceil(total / importSessionPageSize));
  const page = Math.min(importSessionPageFor(id), totalPages);
  importSessionPages[id] = page;
  const start = (page - 1) * importSessionPageSize;
  const visibleBarcodes = barcodes.slice(start, start + importSessionPageSize);
  const from = total ? start + 1 : 0;
  const to = start + visibleBarcodes.length;

  body.innerHTML = `
      <div class="import-selected-actions">
        <button data-history-action="select-all" data-session-id="${escapeAttr(session.id)}">Seleziona pagina</button>
        <button data-history-action="deselect-all" data-session-id="${escapeAttr(session.id)}">Deseleziona pagina</button>
        <button class="danger" data-history-action="delete-selected" data-session-id="${escapeAttr(session.id)}">Elimina selezionati</button>
        <button data-history-action="prev-page" data-session-id="${escapeAttr(session.id)}" ${page <= 1 ? 'disabled' : ''}>Precedenti</button>
        <button data-history-action="next-page" data-session-id="${escapeAttr(session.id)}" ${page >= totalPages ? 'disabled' : ''}>Successivi</button>
      </div>
      <div class="import-session-page-info">Prodotti ${from}-${to} di ${total} · Pagina ${page} di ${totalPages}</div>
      <table class="import-products-table"><thead><tr><th></th><th>Barcode</th><th>Prodotto</th><th>Fornitore</th><th>Categoria</th><th>Acquisto</th><th>Vendita</th></tr></thead><tbody>
        ${visibleBarcodes.map(barcode => {
          const p = displayProductForSession(session, barcode);
          return `<tr>
          <td><input type="checkbox" class="import-product-checkbox" data-session-id="${escapeAttr(session.id)}" data-barcode="${escapeAttr(p.barcode)}"></td>
          <td>${escapeHTML(p.barcode || '')}</td>
          <td>${escapeHTML(p.name || '')}</td>
          <td>${escapeHTML(p.supplier || '')}</td>
          <td>${escapeHTML(p.category || '')}</td>
          <td>${escapeHTML(p.buyPrice || '')}</td>
          <td>${escapeHTML(p.sellPrice || '')}</td>
        </tr>`;
        }).join('')}
      </tbody></table>`;
  body.dataset.loaded = '1';
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
  if(!body) return;
  const opening = body.style.display !== 'block';
  body.style.display = opening ? 'block' : 'none';
  if(opening && body.dataset.loaded !== '1') renderImportSessionBody(id);
}

function changeImportSessionPage(id, direction){
  const session = importSessions.find(s => s.id === String(id));
  if(!session) return;
  const totalPages = Math.max(1, Math.ceil(sessionBarcodes(session).length / importSessionPageSize));
  importSessionPages[id] = Math.min(totalPages, Math.max(1, importSessionPageFor(id) + direction));
  renderImportSessionBody(id);
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
  const barcodes = sessionBarcodes(session);
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
    session.barcodes = sessionBarcodes(session).filter(barcode => !set.has(String(barcode)));
    session.products = session.products.filter(p => !set.has(String(p.barcode)));
    session.count = session.barcodes.length;
    if(!session.barcodes.length) importSessions = importSessions.filter(s => s.id !== String(id));
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

function freeBrowserMemory(){
  if(!confirm('Liberare memoria? Verrà svuotata solo la cronologia importazioni. I prodotti restano salvati.')) return;
  importSessions = [];
  importSessionPages = {};
  localStorage.removeItem(STORAGE_IMPORTS_KEY);
  persistProducts(true);
  setCloudStatus('☁ Memoria liberata', 'ok');
  if(currentView === 'history') renderImportSessions();
  alert('Memoria liberata. I prodotti sono rimasti salvati; la cronologia importazioni è stata svuotata.');
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
  const oldBarcode = getBarcode(products[editingIndex]);
  const product = productFromForm('edit');
  if(!validateProduct(product, editingIndex)) return;
  products[editingIndex] = product;
  if(oldBarcode && oldBarcode !== product.barcode && saleCart[oldBarcode]){
    saleCart[product.barcode] = Number(saleCart[product.barcode] || 0) + Number(saleCart[oldBarcode] || 0);
    delete saleCart[oldBarcode];
    currentSaleBarcode = product.barcode;
    persistSaleCart();
  }else if(currentSaleBarcode === oldBarcode){
    currentSaleBarcode = product.barcode;
  }
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
          count: importedNow.length,
          barcodes: importedNow.map(p => p.barcode)
        });
        persistImportSessions(true);
      }

      currentPage = 1;
      renderProducts();
      event.target.value = '';
      const cloudResult = await saveCloudAfterChange('Import salvato', { silentDropboxError: true });
      const syncMessage = cloudResult.synced
        ? 'Dropbox aggiornato.'
        : 'Salvato sul dispositivo. Dropbox non aggiornato: ' + (cloudResult.message || 'riprova Sincronizza dati.');
      alert(`Import completato!\nNuovi: ${imported}\nAggiornati: ${updated}\n${syncMessage}`);
    }catch(err){
      console.error(err);
      if(isStorageQuotaError(err)){
        setCloudStatus('☁ Memoria del browser piena', 'err');
        alert('Memoria del browser piena. Ho alleggerito il salvataggio, ma questo import e troppo grande per questa memoria locale. Usa il sito online, oppure svuota la cronologia importazioni e riprova.');
      }else{
        setCloudStatus('☁ Errore import', 'err');
        alert('Errore importazione');
      }
    }
  };

  if(fileName.endsWith('.csv')) reader.readAsText(file, 'UTF-8');
  else reader.readAsArrayBuffer(file);
}

function saveDropboxSettings(options = {}){
  const appKey = textValue(document.getElementById('dropboxAppKey')?.value);
  const refreshToken = textValue(document.getElementById('dropboxRefreshToken')?.value);
  const token = textValue(document.getElementById('dropboxToken')?.value);
  const path = textValue(document.getElementById('dropboxPath')?.value);
  const backupFolder = textValue(document.getElementById('dropboxBackupFolder')?.value);
  if(appKey) localStorage.setItem(DROPBOX_APP_KEY_KEY, appKey);
  else localStorage.removeItem(DROPBOX_APP_KEY_KEY);
  if(refreshToken) localStorage.setItem(DROPBOX_REFRESH_TOKEN_KEY, refreshToken);
  else localStorage.removeItem(DROPBOX_REFRESH_TOKEN_KEY);
  if(token) localStorage.setItem(DROPBOX_TOKEN_KEY, token);
  else localStorage.removeItem(DROPBOX_TOKEN_KEY);
  localStorage.removeItem(DROPBOX_TOKEN_EXPIRES_KEY);
  setDropboxPath(path);
  setDropboxBackupFolder(backupFolder);
  if(!options.silent){
    setCloudStatus(hasDropboxCredentials() ? '☁ Dropbox salvato' : '☁ Token Dropbox rimosso', hasDropboxCredentials() ? 'ok' : 'err');
    setFolderPickerStatus(
      hasDropboxCredentials()
        ? 'Impostazioni salvate. Ora puoi mostrare le cartelle.'
        : 'Dropbox non collegato: collega account Dropbox.',
      hasDropboxCredentials() ? 'ok' : 'err'
    );
  }
  const accountStatus = document.getElementById('dropboxAccountStatus');
  if(accountStatus){
    const connected = hasDropboxCredentials();
    accountStatus.innerText = connected ? 'Dropbox collegato' : 'Dropbox non collegato';
    accountStatus.classList.toggle('ok', connected);
  }
}

async function loadDropboxFolderPicker(path = dropboxFolderPickerPath){
  saveDropboxSettings({ silent: true });
  if(!hasDropboxCredentials()){
    setFolderPickerStatus('Dropbox non collegato: collega account Dropbox prima di scegliere la cartella.', 'err');
    setCloudStatus('☁ Token Dropbox mancante', 'err');
    return;
  }

  try{
    setFolderPickerStatus('Cerco le cartelle Dropbox...');
    setCloudStatus('☁ Cerco cartelle Dropbox...', '');
    const cleanPath = normalizeDropboxFolderPath(path);
    const folders = await dropboxListFolders(cleanPath);
    setFolderPickerCurrent(cleanPath);
    setFolderPickerOptions(folders, folders.length ? 'Scegli una cartella' : 'Nessuna cartella dentro');
    setFolderPickerStatus(
      folders.length
        ? `Ho trovato ${folders.length} cartelle. Scegline una e premi Entra, oppure salva la cartella aperta.`
        : 'Questa cartella non contiene altre cartelle. Puoi premere Salva questa cartella.',
      'ok'
    );
    setCloudStatus('☁ Cartelle trovate', 'ok');
  }catch(error){
    const message = dropboxErrorMessage(error);
    const fileHint = location.protocol === 'file:' ? ' Se stai usando il collegamento diretto Dropbox, apri l\'app da localhost o da un sito http/https.' : '';
    setFolderPickerStatus(message + '.' + fileHint, 'err');
    handleDropboxError(error, false);
  }
}

async function openSelectedDropboxFolder(){
  const selected = textValue(document.getElementById('dropboxFolderSelect')?.value);
  if(!selected){
    setFolderPickerStatus('Scegli una cartella dalla lista, poi premi Entra.', 'err');
    return;
  }
  await loadDropboxFolderPicker(selected);
}

function useSelectedDropboxFolder(){
  const selected = textValue(document.getElementById('dropboxFolderSelect')?.value) || dropboxFolderPickerPath;
  const folder = displayDropboxFolderPath(selected);
  const input = document.getElementById('dropboxBackupFolder');
  if(input) input.value = folder;
  setDropboxBackupFolder(folder);
  setFolderPickerCurrent(folder);
  setFolderPickerStatus('Cartella backup salvata: ' + folder, 'ok');
  setCloudStatus('☁ Cartella backup selezionata', 'ok');
}

async function goUpDropboxFolder(){
  const current = normalizeDropboxFolderPath(dropboxFolderPickerPath);
  if(!current){
    setFolderPickerStatus('Sei gia nella cartella principale Dropbox.', 'ok');
    await loadDropboxFolderPicker('');
    return;
  }
  const parent = current.split('/').slice(0, -1).join('/');
  await loadDropboxFolderPicker(parent);
}

function clearDropboxToken(){
  localStorage.removeItem(DROPBOX_TOKEN_KEY);
  localStorage.removeItem(DROPBOX_TOKEN_EXPIRES_KEY);
  localStorage.removeItem(DROPBOX_APP_KEY_KEY);
  localStorage.removeItem(DROPBOX_REFRESH_TOKEN_KEY);
  const appKeyInput = document.getElementById('dropboxAppKey');
  const refreshInput = document.getElementById('dropboxRefreshToken');
  const tokenInput = document.getElementById('dropboxToken');
  const accountStatus = document.getElementById('dropboxAccountStatus');
  if(appKeyInput) appKeyInput.value = '';
  if(refreshInput) refreshInput.value = '';
  if(tokenInput) tokenInput.value = '';
  if(accountStatus){
    accountStatus.innerText = 'Dropbox non collegato';
    accountStatus.classList.remove('ok');
  }
  setFolderPickerStatus('Dropbox scollegato. Collega account Dropbox per scegliere le cartelle.', 'err');
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
    handleScannerInput();
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
  const activePage = currentView === 'sales'
    ? document.getElementById('salesPage')
    : document.getElementById('productsPage');
  if(!s || !activePage || !['products', 'sales'].includes(currentView) || activePage.classList.contains('hidden') || __modalOpen() || __hasSelection()) return;

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

  s.addEventListener('input', function(){
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
      handleScannerInput();
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
    if(document.activeElement !== s && ['products', 'sales'].includes(currentView)){
      e.preventDefault();
      s.value = '';
      s.focus({ preventScroll: true });
      s.value = e.key;
      __barcodeLastValue = s.value;
      currentPage = 1;
      handleScannerInput();
    }
  }
}, true);

document.addEventListener('click', function(event){
  const supplierDetails = event.target.closest('[data-sales-supplier-details]');
  if(supplierDetails){
    toggleSalesSupplierProducts(supplierDetails.dataset.salesSupplierDetails);
    return;
  }

  const salesQtyEdit = event.target.closest('[data-sales-qty-type]');
  if(salesQtyEdit){
    editSalesStatsQuantity(
      salesQtyEdit.dataset.salesQtyType,
      salesQtyEdit.dataset.salesQtyKey,
      salesQtyEdit.dataset.salesQtyAddBarcode
    );
    return;
  }

  const saleEdit = event.target.closest('[data-sale-edit-barcode]');
  if(saleEdit){
    editSaleProductByBarcode(saleEdit.dataset.saleEditBarcode);
    return;
  }

  const saleAdd = event.target.closest('[data-sale-add-index]');
  if(saleAdd){
    addProductIndexToSaleCart(Number(saleAdd.dataset.saleAddIndex));
    return;
  }

  const saleAction = event.target.closest('[data-sale-cart-action]');
  if(saleAction){
    const barcode = saleAction.dataset.barcode;
    const action = saleAction.dataset.saleCartAction;
    if(action === 'plus') changeSaleCartQty(barcode, 1);
    else if(action === 'minus') changeSaleCartQty(barcode, -1);
    else if(action === 'remove') removeSaleCartItem(barcode);
    return;
  }

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
    else if(action === 'prev-page') changeImportSessionPage(id, -1);
    else if(action === 'next-page') changeImportSessionPage(id, 1);
  }
});

window.onload = async function(){
  ensureLocalModified();
  applySyncTimestampMigration();
  try{
    persistAll(false);
  }catch(error){
    if(isStorageQuotaError(error)){
      importSessions = [];
      localStorage.removeItem(STORAGE_IMPORTS_KEY);
      persistProducts(false);
      setCloudStatus('☁ Memoria liberata: cronologia svuotata', 'err');
    }else{
      throw error;
    }
  }
  if(!localStorage.getItem(DROPBOX_PATH_KEY)) setDropboxPath(DEFAULT_DROPBOX_PATH);
  showSales();
  __installBarcodeInputLogic();
  installClearSearchOnScan();
  setInterval(__focusBarcodeIfAllowed, 1200);
  await handleDropboxOAuthRedirect();
  setTimeout(() => syncNow({ silentMissingToken: true }), 200);
};
