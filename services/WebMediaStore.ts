const DATABASE = 'lector-media'
const STORE = 'audio'
export const MEDIA_PREFIX = 'lector-media:'

async function database(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE, 1)
		request.onupgradeneeded = () => request.result.createObjectStore(STORE)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error || new Error('Browser audio storage could not open.'))
		request.onblocked = () => reject(new Error('Close other Lector windows, then try importing again.'))
	})
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await database()
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(STORE, mode)
		const request = action(transaction.objectStore(STORE))
		let result: T
		request.onsuccess = () => { result = request.result }
		transaction.oncomplete = () => { db.close(); resolve(result) }
		transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || request.error || new Error('Browser audio storage failed.')) }
	})
}

export async function storeAudio(file: Blob): Promise<string> {
	const id = crypto.randomUUID()
	await transact('readwrite', (store) => store.put(file, id))
	return MEDIA_PREFIX + id
}

export async function readAudio(uri: string): Promise<Blob> {
	if (!uri.startsWith(MEDIA_PREFIX)) throw new Error('This audio source is not stored in this browser.')
	const blob = await transact<Blob | undefined>('readonly', (store) => store.get(uri.slice(MEDIA_PREFIX.length)))
	if (!blob) throw new Error('The browser copy is missing. Import the original audio file again.')
	return blob
}

export async function removeAudio(uri: string): Promise<void> {
	if (uri.startsWith(MEDIA_PREFIX)) await transact('readwrite', (store) => store.delete(uri.slice(MEDIA_PREFIX.length)))
}
