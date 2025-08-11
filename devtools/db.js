// https://gist.github.com/enjalot/6472041
var indexedDB = window.indexedDB
var open = indexedDB.open('MyDatabase', 1)
open.onupgradeneeded = function () {
  var db = open.result
  var store = db.createObjectStore('MyObjectStore', { keyPath: 'id' })
  var index = store.createIndex('NameIndex', ['name.last', 'name.first'])
}
open.onsuccess = function () {
  var db = open.result
  var tx = db.transaction('MyObjectStore', 'readwrite')
  var store = tx.objectStore('MyObjectStore')
  var index = store.index('NameIndex')

  store.put({ id: 12345, name: { first: 'John', last: 'Doe' }, age: 42 })
  store.put({ id: 67890, name: { first: 'Bob', last: 'Smith' }, age: 35 })

  var getJohn = store.get(12345)
  var getBob = index.get(['Smith', 'Bob'])

  getJohn.onsuccess = function () {
    console.log(getJohn.result.name.first) // => "John"
  }

  getBob.onsuccess = function () {
    console.log(getBob.result.name.first) // => "Bob"
  }

  tx.oncomplete = function () {
    db.close()
  }
}
