let products = JSON.parse(localStorage.getItem('products') || '[]');

const itemsPerPage = 100;
let currentPage = 1;
let allSelected = false;
let editingIndex = null;
let currentFilteredIndexes = [];

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

function saveStorage(){
  localStorage.setItem('products', JSON.stringify(products));
}

function renderProducts(){
  const search = (document.getElementById('search')?.value || '').toLowerCase();
  const table = document.getElementById('productTable');
  table.innerHTML = '';

  const matches = [];
  products.forEach((p, idx) => {
    const ok =
      String(getBarcode(p)).toLowerCase().includes(search) ||
      String(getName(p)).toLowerCase().includes(search) ||
      String(getSupplier(p)).toLowerCase().includes(search);
    if(ok) matches.push(idx);
  });

  const totalPages = Math.max(1, Math.ceil(matches.length / itemsPerPage));
  if(currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const pageIndexes = matches.slice(start, start + itemsPerPage);
  currentFilteredIndexes = pageIndexes;

  pageIndexes.forEach((realIndex) => {
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
            <button class="edit-btn" onclick="openEditModal(${realIndex})">Modifica</button>
            <button class="delete-btn" onclick="deleteProduct(${realIndex})">Elimina</button>
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

  document.getElementById('editModal').style.display = 'flex';
  setTimeout(()=>document.getElementById('editName').focus(),100);
}

function closeEditModal(){
  document.getElementById('editModal').style.display = 'none';
  editingIndex = null;
}

function saveEditProduct(){
  if(editingIndex === null) return;

  products[editingIndex] = {
    ...products[editingIndex],
    barcode: document.getElementById('editBarcode').value.trim(),
    name: document.getElementById('editName').value.trim(),
    supplier: document.getElementById('editSupplier').value.trim(),
    buyPrice: document.getElementById('editBuy').value.trim(),
    sellPrice: document.getElementById('editSell').value.trim(),
    // mantengo anche chiavi vecchie per compatibilità
    acquisto: document.getElementById('editBuy').value.trim(),
    vendita: document.getElementById('editSell').value.trim(),
    fornitore: document.getElementById('editSupplier').value.trim(),
    prodotto: document.getElementById('editName').value.trim()
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
  document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = allSelected);
  document.getElementById('toggleSelectBtn').innerText = allSelected ? 'Deseleziona prodotti' : 'Seleziona prodotti';
}

function deleteSelectedProducts(){
  const selected = [];
  document.querySelectorAll('.product-checkbox').forEach(cb=>{
    if(cb.checked) selected.push(parseInt(cb.dataset.index));
  });
  if(selected.length === 0){ alert('Nessun prodotto selezionato'); return; }
  if(confirm('Eliminare prodotti selezionati?')){
    selected.sort((a,b)=>b-a).forEach(i=>products.splice(i,1));
    saveStorage();
    renderProducts();
  }
}

function nextPage(){
  currentPage++;
  renderProducts();
}

function prevPage(){
  if(currentPage > 1) currentPage--;
  renderProducts();
}

function exportCSV(){
  let csv = "\ufeffBarcode,Prodotto,Fornitore,Acquisto,Vendita\n";
  products.forEach(p=>{
    csv += `"${getBarcode(p)}","${getName(p)}","${getSupplier(p)}","${getBuy(p)}","${getSell(p)}"\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prodotti.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeKey(key){
  return String(key || '').trim().toLowerCase().replace(/\s+/g,'');
}
function getValue(row, possibleKeys){
  const map = {};
  Object.keys(row).forEach(k => map[normalizeKey(k)] = row[k]);
  for(const k of possibleKeys){
    const v = map[normalizeKey(k)];
    if(v !== undefined) return v;
  }
  return '';
}

function importExcel(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();
  const fileName = file.name.toLowerCase();

  reader.onload = function(e){
    try{
      let workbook;
      if(fileName.endsWith('.csv')){
        workbook = XLSX.read(e.target.result,{type:'string'});
      }else{
        workbook = XLSX.read(new Uint8Array(e.target.result),{type:'array'});
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet,{defval:''});
      let imported = 0, updated = 0;

      rows.forEach(row=>{
        const product = {
          barcode: getValue(row,['Barcode','Codice','EAN','条码']),
          name: getValue(row,['Prodotto','Nome','Product','商品']),
          supplier: getValue(row,['Fornitore','Supplier','Nome Fornitore','供应商']),
          buyPrice: getValue(row,['Acquisto','Prezzo Acquisto','BuyPrice','进价']),
          sellPrice: getValue(row,['Vendita','Prezzo Vendita','SellPrice','售价'])
        };
        if(!product.barcode) return;

        const existing = products.findIndex(p => String(getBarcode(p)) === String(product.barcode));
        if(existing >= 0){
          products[existing] = {...products[existing], ...product};
          updated++;
        }else{
          products.push(product);
          imported++;
        }
      });

      saveStorage();
      renderProducts();
      alert(`Import completato!\nNuovi: ${imported}\nAggiornati: ${updated}`);
    }catch(err){
      console.error(err);
      alert('Errore importazione file');
    }
  };

  if(fileName.endsWith('.csv')) reader.readAsText(file,'UTF-8');
  else reader.readAsArrayBuffer(file);
}

window.onload = function(){
  renderProducts();
  const search = document.getElementById('search');
  if(search) search.focus();
};
