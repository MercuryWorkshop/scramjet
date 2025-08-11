import Protocol from 'devtools-protocol'
import CacheStorage = Protocol.CacheStorage

export function requestCacheNames(): CacheStorage.RequestCacheNamesResponse {
  return {
    caches: [],
  }
}
