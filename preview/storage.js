/* Device-local autosave. No data leaves the browser. */
window.LabStorage=(()=>{
 let dbPromise;
 function open(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const req=indexedDB.open('teachable-labor-preview',1);req.onupgradeneeded=()=>req.result.createObjectStore('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(Error('Lokaler Speicher ist blockiert.'))});return dbPromise}
 async function read(key='project'){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readonly');const req=tx.objectStore('state').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
 async function write(value,key='project',expectedSavedAt){
  const db=await open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let conflict;
   if(expectedSavedAt!==undefined){const req=store.get(key);req.onsuccess=()=>{const actual=req.result?.savedAt??null;if(actual!==expectedSavedAt){conflict=Error('Projekt wurde in einer anderen Ansicht geändert.');conflict.name='ProjectConflict';tx.abort()}else store.put(value,key)}}else store.put(value,key);
   tx.oncomplete=()=>resolve();tx.onerror=()=>reject(conflict||tx.error);tx.onabort=()=>reject(conflict||tx.error||Error('Speichern abgebrochen.'));
  });
 }

 return {read,write};
})();
