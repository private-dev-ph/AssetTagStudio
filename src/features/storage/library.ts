export type LibraryStore = 'templates' | 'printers';
export type LibraryEntry = { id: string; name: string; json: string };

const DATABASE_NAME = 'assettag-studio-library';
const DATABASE_VERSION = 1;
const MAX_ENTRIES = 100;
const MAX_DOCUMENT_BYTES = 128 * 1024;

function validateStore(store: LibraryStore): LibraryStore {
  if (store !== 'templates' && store !== 'printers') throw new Error('Choose a supported library.');
  return store;
}

function validateEntry(entry: LibraryEntry) {
  if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > 200) throw new Error('Library entry has an invalid id.');
  if (typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100) throw new Error('Library entry name must contain 1 to 100 characters.');
  if (typeof entry.json !== 'string' || new TextEncoder().encode(entry.json).byteLength > MAX_DOCUMENT_BYTES) throw new Error('Library document must be 128 KiB or smaller.');
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Browser storage is unavailable in this environment.'));
  return new Promise((resolve, reject) => {
    let request!: IDBOpenDBRequest;
    try { request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
    catch { reject(new Error('Browser storage could not be opened. Check this browser’s storage settings.')); return; }
    let settled = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('templates')) database.createObjectStore('templates', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('printers')) database.createObjectStore('printers', { keyPath: 'id' });
    };
    request.onblocked = () => {
      if (!settled) { settled = true; reject(new Error('Browser storage upgrade is blocked. Close another AssetTag Studio tab and retry.')); }
    };
    request.onerror = () => {
      if (!settled) { settled = true; reject(new Error('Browser storage could not be opened. Check this browser’s storage settings.')); }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (!settled) { settled = true; resolve(database); }
      else database.close();
    };
  });
}

function transactionError(error: unknown, fallback: string): Error {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return new Error('Browser storage is full. Delete saved items or free space, then retry.');
  if (error instanceof DOMException && error.name === 'ConstraintError') return new Error('An item with this id already exists. Refresh the library and retry.');
  if (error instanceof Error && error.message) return new Error(error.message);
  return new Error(fallback);
}

function runTransaction<T>(store: LibraryStore, mode: IDBTransactionMode, operation: (objectStore: IDBObjectStore, transaction: IDBTransaction) => IDBRequest<T> | void, fallback: string): Promise<T | undefined> {
  return openDatabase().then((database) => new Promise<T | undefined>((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = database.transaction(validateStore(store), mode); }
    catch (error) { database.close(); reject(transactionError(error, fallback)); return; }
    let result: T | undefined;
    let requestError: unknown;
    let finished = false;
    let request: IDBRequest<T> | void = undefined;
    try { request = operation(transaction.objectStore(store), transaction); }
    catch (error) { transaction.abort(); requestError = error; }
    if (request) {
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { requestError = request?.error; };
    }
    transaction.oncomplete = () => {
      if (finished) return;
      finished = true; database.close(); resolve(result);
    };
    transaction.onabort = () => {
      if (finished) return;
      finished = true; database.close(); reject(transactionError(requestError ?? transaction.error, fallback));
    };
    transaction.onerror = () => { requestError = requestError ?? transaction.error; };
  }));
}

export async function listEntries(store: LibraryStore): Promise<LibraryEntry[]> {
  // Fetch only enough rows to distinguish an allowed library from an over-capacity one.
  const result = await runTransaction<unknown[]>(store, 'readonly', (objectStore) => objectStore.getAll(undefined, MAX_ENTRIES + 1), 'Saved items could not be read from browser storage.');
  if (!Array.isArray(result)) throw new Error('Saved library data is corrupted. Remove the damaged item and retry.');
  if (result.length > MAX_ENTRIES) throw new Error('Saved library contains more than 100 items. Delete extras before continuing.');
  return result.map((candidate) => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Saved library data is corrupted. Remove the damaged item and retry.');
    const entry = candidate as Partial<LibraryEntry>;
    try { validateEntry(entry as LibraryEntry); } catch { throw new Error('Saved library data is corrupted. Remove the damaged item and retry.'); }
    return { id: entry.id!, name: entry.name!, json: entry.json! };
  });
}

export async function putEntry(store: LibraryStore, entry: LibraryEntry): Promise<void> {
  validateStore(store); validateEntry(entry);
  let capacityError: Error | undefined;
  await runTransaction(store, 'readwrite', (objectStore, transaction) => {
    const countRequest = objectStore.count();
    countRequest.onsuccess = () => {
      const existing = objectStore.get(entry.id);
      existing.onsuccess = () => {
        if (!existing.result && countRequest.result >= MAX_ENTRIES) {
          capacityError = new Error('This library already contains 100 items. Delete an item before saving another.');
          try { transaction.abort(); } catch { /* Already aborting. */ }
          return;
        }
        objectStore.put({ ...entry });
      };
    };
    return;
  }, 'Saved item could not be written to browser storage.').catch((error: unknown) => { throw capacityError ?? error; });
}

export async function deleteEntry(store: LibraryStore, id: string): Promise<void> {
  validateStore(store);
  if (typeof id !== 'string' || !id) throw new Error('Choose a saved item to delete.');
  await runTransaction(store, 'readwrite', (objectStore) => objectStore.delete(id), 'Saved item could not be deleted from browser storage.');
}

export async function clearEntries(store: LibraryStore): Promise<void> {
  validateStore(store);
  await runTransaction(store, 'readwrite', (objectStore) => objectStore.clear(), 'Saved library could not be cleared from browser storage.');
}
