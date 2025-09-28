import each from 'licia/each'
import map from 'licia/map'
import isStr from 'licia/isStr'
import isArr from 'licia/isArr'
import * as objManager from '../lib/objManager'
import Protocol from 'devtools-protocol'
import IndexedDB = Protocol.IndexedDB

const indexedDB = window.indexedDB

let databaseVersions: any = {}

export async function requestDatabaseNames(): Promise<IndexedDB.RequestDatabaseNamesResponse> {
  const databases = await indexedDB.databases()
  const databaseNames: string[] = []

  databaseVersions = {}
  each(databases, database => {
    if (!database.name) {
      return
    }
    databaseVersions[database.name] = database.version
    databaseNames.push(database.name)
  })

  return {
    databaseNames,
  }
}

export async function requestDatabase(
  params: IndexedDB.RequestDatabaseRequest
): Promise<IndexedDB.RequestDatabaseResponse> {
  const { databaseName } = params
  const version = databaseVersions[databaseName]
  const objectStores: any[] = []

  const db = await promisify(indexedDB.open(databaseName))
  if (db.objectStoreNames.length) {
    const storeList = map(db.objectStoreNames, name => {
      return db.transaction(name, 'readonly').objectStore(name)
    })
    each(storeList, store => {
      const indexes: any[] = []
      each(store.indexNames, indexName => {
        const index = store.index(indexName)
        indexes.push({
          name: index.name,
          multiEntry: index.multiEntry,
          keyPath: formatKeyPath(index.keyPath),
          unique: index.unique,
        })
      })
      objectStores.push({
        name: store.name,
        indexes,
        keyPath: formatKeyPath(store.keyPath),
        autoIncrement: store.autoIncrement,
      })
    })
  }

  return {
    databaseWithObjectStores: {
      name: databaseName,
      objectStores,
      version,
    },
  }
}

export async function requestData(
  params: IndexedDB.RequestDataRequest
): Promise<IndexedDB.RequestDataResponse> {
  const { databaseName, objectStoreName, indexName, pageSize, skipCount } =
    params

  const db = await promisify(indexedDB.open(databaseName))
  const objectStore = db
    .transaction(objectStoreName, 'readonly')
    .objectStore(objectStoreName)
  const count = await promisify(objectStore.count())

  let currentIdx = 0
  let cursorRequest: IDBRequest<IDBCursorWithValue | null>
  if (indexName) {
    const index = objectStore.index(indexName)
    cursorRequest = index.openCursor()
  } else {
    cursorRequest = objectStore.openCursor()
  }
  return new Promise((resolve, reject) => {
    const objectStoreDataEntries: any[] = []
    cursorRequest.addEventListener('success', () => {
      const cursor = cursorRequest.result
      if (cursor && currentIdx < pageSize + skipCount) {
        if (currentIdx >= skipCount) {
          objectStoreDataEntries.push({
            key: objManager.wrap(cursor.key, {
              generatePreview: true,
            }),
            primaryKey: objManager.wrap(cursor.primaryKey),
            value: objManager.wrap(cursor.value, {
              generatePreview: true,
            }),
          })
        }
        cursor.continue()
        currentIdx++
      } else {
        resolve({
          hasMore: currentIdx < count,
          objectStoreDataEntries,
        })
      }
    })
    cursorRequest.addEventListener('error', reject)
  })
}

export async function getMetadata(
  params: IndexedDB.GetMetadataRequest
): Promise<IndexedDB.GetMetadataResponse> {
  const { databaseName, objectStoreName } = params

  const objectStore = await getObjectStore(databaseName, objectStoreName)

  return {
    entriesCount: await promisify(objectStore.count()),
    keyGeneratorValue: 1,
  }
}

export async function deleteObjectStoreEntries(
  params: IndexedDB.DeleteObjectStoreEntriesRequest
) {
  const { databaseName, objectStoreName, keyRange } = params

  const objectStore = await getObjectStore(databaseName, objectStoreName)
  await promisify(
    objectStore.delete(
      IDBKeyRange.bound(
        getKeyRangeBound(keyRange.lower),
        getKeyRangeBound(keyRange.upper),
        keyRange.lowerOpen,
        keyRange.upperOpen
      )
    )
  )
}

export async function clearObjectStore(
  params: IndexedDB.ClearObjectStoreRequest
) {
  const { databaseName, objectStoreName } = params

  const objectStore = await getObjectStore(databaseName, objectStoreName)
  await promisify(objectStore.clear())
}

export async function deleteDatabase(params: IndexedDB.DeleteDatabaseRequest) {
  await promisify(indexedDB.deleteDatabase(params.databaseName))
}

function getKeyRangeBound(key: any) {
  return key.number || key.string || key.date || key.array || key
}

async function getObjectStore(databaseName: string, objectStoreName: string) {
  const db = await promisify(indexedDB.open(databaseName))
  const objectStore = db
    .transaction(objectStoreName, 'readwrite')
    .objectStore(objectStoreName)

  return objectStore
}

function formatKeyPath(keyPath: any) {
  if (isStr(keyPath)) {
    return {
      type: 'string',
      string: keyPath,
    }
  }

  if (isArr(keyPath)) {
    return {
      type: 'array',
      array: keyPath,
    }
  }

  return {
    type: 'null',
  }
}

function promisify<T = any>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.addEventListener('success', () => {
      resolve(req.result)
    })
    req.addEventListener('error', () => {
      reject()
    })
  })
}
