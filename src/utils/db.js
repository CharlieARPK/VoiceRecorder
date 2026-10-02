// Keep the existing database/store so previously saved recordings remain available.

const DB_NAME = 'PixelMusicStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

async function runTransaction(mode, action) {
  const db = await initDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('保存処理が中断されました'));
      tx.onerror = () => reject(tx.error || new Error('端末の保存領域を利用できません'));
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export const saveRecordingToDB = recording => {
  const stored = { ...recording };
  delete stored.url;
  return runTransaction('readwrite', store => store.put(stored));
};

export const getAllRecordingsFromDB = async () => {
  const records = await runTransaction('readonly', store => store.getAll());
  return (records || []).sort((a, b) => b.id - a.id);
};

export const deleteRecordingFromDB = id =>
  runTransaction('readwrite', store => store.delete(id));
