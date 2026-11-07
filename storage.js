(function(root){
  'use strict';

  function createInventoryStorage(options = {}){
    const local = options.localStorage || root.localStorage;
    const indexedDB = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
    const values = new Map();
    const pending = new Map();
    const marker = 'inventory_database_v1';
    const fallbackKey = 'inventory_state_v1';
    let database = null;
    let running = null;
    let timer = 0;
    let lastError = null;
    let initialized = false;
    let onError = () => {};
    let onSaved = () => {};
    let onQuota = () => {};

    function quotaError(error){
      return error?.name === 'QuotaExceededError' || error?.code === 22 || error?.code === 1014;
    }

    function readLocal(key){
      try{ return local.getItem(key); }catch(error){ return null; }
    }

    function removeLocal(key){
      try{ local.removeItem(key); }catch(error){ /* The durable copy remains in IndexedDB. */ }
    }

    function releaseHistory(batch){
      removeLocal('importSessions');
      values.set('importSessions', '[]');
      pending.set('importSessions', '[]');
      batch.set('importSessions', '[]');
      onQuota();
    }

    function openDatabase(){
      return new Promise((resolve, reject) => {
        if(!indexedDB){ reject(new Error('IndexedDB non disponibile')); return; }
        const request = indexedDB.open('inventory_manager_v60', 1);
        let finished = false;
        const timeout = setTimeout(() => {
          finished = true;
          reject(new Error('Apertura archivio locale scaduta'));
        }, 4000);
        request.onupgradeneeded = () => request.result.createObjectStore('state', { keyPath: 'key' });
        request.onerror = () => { clearTimeout(timeout); reject(request.error); };
        request.onsuccess = () => {
          clearTimeout(timeout);
          if(finished){ request.result.close(); return; }
          resolve(request.result);
        };
      });
    }

    async function initialize(){
      if(initialized) return;
      const fallback = readLocal(fallbackKey);
      if(fallback){
        try{
          const saved = JSON.parse(fallback);
          if(!saved || Array.isArray(saved) || typeof saved !== 'object') throw new Error('Archivio locale non valido');
          Object.entries(saved).forEach(([key, value]) => values.set(key, value));
        }catch(error){
          lastError = error;
          onError(error);
          throw error;
        }
      }
      try{
        database = await openDatabase();
        const records = await new Promise((resolve, reject) => {
          const transaction = database.transaction('state', 'readonly');
          const request = transaction.objectStore('state').getAll();
          transaction.oncomplete = () => resolve(request.result);
          transaction.onabort = () => reject(transaction.error || request.error);
          transaction.onerror = () => {};
        });
        records.forEach(record => values.set(record.key, record.value));
        if(fallback) values.forEach((value, key) => pending.set(key, value));
        database.onversionchange = () => database.close();
      }catch(error){
        database?.close();
        database = null;
        // Once migrated, an unreadable database must never become an empty inventory.
        if(readLocal(marker) === '1'){
          lastError = error;
          onError(error);
          throw error;
        }
      }
      initialized = true;
    }

    function writeDatabase(batch){
      return new Promise((resolve, reject) => {
        const transaction = database.transaction('state', 'readwrite');
        const store = transaction.objectStore('state');
        batch.forEach((value, key) => store.put({ key, value }));
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error || new Error('Salvataggio locale interrotto'));
        transaction.onerror = () => {};
      });
    }

    function writeLocal(batch){
      // A single atomic replacement keeps quantities, sales and cart consistent.
      const snapshot = new Map(values);
      batch.forEach((value, key) => snapshot.set(key, value));
      local.setItem(fallbackKey, JSON.stringify(Object.fromEntries(snapshot)));
      snapshot.forEach((value, key) => removeLocal(key));
    }

    async function commit(batch){
      try{
        if(database) await writeDatabase(batch);
        else writeLocal(batch);
      }catch(error){
        if(!quotaError(error)) throw error;
        releaseHistory(batch);
        if(database) await writeDatabase(batch);
        else writeLocal(batch);
      }
      if(database){
        // Delete legacy copies only after the whole transaction has committed.
        batch.forEach((value, key) => removeLocal(key));
        removeLocal(fallbackKey);
        if(batch.has('productsPackedV2')) removeLocal('products');
        try{ local.setItem(marker, '1'); }catch(error){ /* Retry on the next commit. */ }
      }else if(batch.has('productsPackedV2')){
        removeLocal('products');
      }
    }

    function flush(){
      clearTimeout(timer);
      timer = 0;
      if(running) return running;
      if(!pending.size) return Promise.resolve();
      running = (async () => {
        try{
          while(pending.size){
            const batch = new Map(pending);
            await commit(batch);
            batch.forEach((value, key) => {
              if(pending.get(key) === value) pending.delete(key);
            });
          }
          lastError = null;
          onSaved();
        }catch(error){
          lastError = error;
          onError(error);
          throw error;
        }
      })().finally(() => { running = null; });
      return running;
    }

    function queue(key, value){
      values.set(key, value);
      pending.set(key, value);
      if(!timer) timer = setTimeout(() => { timer = 0; flush().catch(() => {}); }, 0);
    }

    return {
      initialize,
      flush,
      getItem(key){ return values.has(key) ? values.get(key) : readLocal(key); },
      setItem(key, value){ queue(key, String(value)); },
      removeItem(key){ queue(key, null); },
      hasPending(){ return pending.size > 0 || Boolean(running); },
      getError(){ return lastError; },
      configure(handlers){
        onError = handlers.onError || onError;
        onSaved = handlers.onSaved || onSaved;
        onQuota = handlers.onQuota || onQuota;
      }
    };
  }

  root.createInventoryStorage = createInventoryStorage;
  root.inventoryStorage = createInventoryStorage();
})(typeof window === 'undefined' ? globalThis : window);
