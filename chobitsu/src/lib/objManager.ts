import toStr from 'licia/toStr'
import isNull from 'licia/isNull'
import isArr from 'licia/isArr'
import isFn from 'licia/isFn'
import isEl from 'licia/isEl'
import isErr from 'licia/isErr'
import isMap from 'licia/isMap'
import isSet from 'licia/isSet'
import isRegExp from 'licia/isRegExp'
import getKeys from 'licia/keys'
import toSrc from 'licia/toSrc'
import allKeys from 'licia/allKeys'
import isNative from 'licia/isNative'
import getProto from 'licia/getProto'
import isSymbol from 'licia/isSymbol'
import { getType, has } from './util'

const objects = new Map()
const objectIds = new Map()
const selfs = new Map()
const entries = new Map()
let id = 1

function getOrCreateObjId(obj: any, self: any) {
  let objId = objectIds.get(obj)
  if (objId) return objId

  objId = JSON.stringify({
    injectedScriptId: 0,
    id: id++,
  })
  objectIds.set(obj, objId)
  objects.set(objId, obj)
  selfs.set(objId, self)

  return objId
}

export function clear() {
  objects.clear()
  objectIds.clear()
  selfs.clear()
}

export function wrap(
  value: any,
  { generatePreview = false, self = value } = {}
): any {
  const ret = basic(value)
  const { type, subtype } = ret

  if (type === 'undefined') {
    return ret
  }

  if (type === 'string' || type === 'boolean' || subtype === 'null') {
    ret.value = value
    return ret
  }

  ret.description = getDescription(value, self)
  if (type === 'number') {
    ret.value = value
    return ret
  }

  if (type === 'symbol') {
    ret.objectId = getOrCreateObjId(value, self)
    return ret
  }

  if (type === 'function') {
    ret.className = 'Function'
  } else if (subtype === 'array') {
    ret.className = 'Array'
  } else if (subtype === 'map') {
    ret.className = 'Map'
  } else if (subtype === 'set') {
    ret.className = 'Set'
  } else if (subtype === 'regexp') {
    ret.className = 'RegExp'
  } else if (subtype === 'error') {
    ret.className = value.name
  } else {
    ret.className = getType(value, false)
  }

  if (generatePreview) {
    ret.preview = getPreview(value, self)
  }

  ret.objectId = getOrCreateObjId(value, self)

  return ret
}

export function getObj(objectId: string) {
  return objects.get(objectId)
}

export function releaseObj(objectId: string) {
  const object = getObj(objectId)
  objectIds.delete(object)
  selfs.delete(objectId)
  objects.delete(objectId)
}

export function getProperties(params: any) {
  const { accessorPropertiesOnly, objectId, ownProperties, generatePreview } =
    params
  const properties = []

  const options = {
    prototype: !ownProperties,
    unenumerable: true,
    symbol: !accessorPropertiesOnly,
  }

  const obj = objects.get(objectId)
  const self = selfs.get(objectId)
  const keys = allKeys(obj, options)
  const proto = getProto(obj)
  for (let i = 0, len = keys.length; i < len; i++) {
    const name = keys[i]
    let propVal
    try {
      propVal = self[name]
    } catch (e) {
      /* tslint:disable-next-line */
    }

    const property: any = {
      name: toStr(name),
      isOwn: has(self, name),
    }

    let descriptor = Object.getOwnPropertyDescriptor(obj, name)
    if (!descriptor && proto) {
      descriptor = Object.getOwnPropertyDescriptor(proto, name)
    }
    if (descriptor) {
      if (accessorPropertiesOnly) {
        if (!descriptor.get && !descriptor.set) {
          continue
        }
      }
      property.configurable = descriptor.configurable
      property.enumerable = descriptor.enumerable
      property.writable = descriptor.writable
      if (descriptor.get) {
        property.get = wrap(descriptor.get)
      }
      if (descriptor.set) {
        property.set = wrap(descriptor.set)
      }
    }

    if (proto && has(proto, name) && property.enumerable) {
      property.isOwn = true
    }

    let accessValue = true
    if (!property.isOwn && property.get) accessValue = false
    if (accessValue) {
      if (isSymbol(name)) {
        property.symbol = wrap(name)
        property.value = { type: 'undefined' }
      } else {
        property.value = wrap(propVal, {
          generatePreview,
        })
      }
    }

    if (accessorPropertiesOnly) {
      if (isFn(propVal) && isNative(propVal)) continue
    }

    properties.push(property)
  }
  if (proto && !ownProperties && !noPrototype(obj)) {
    properties.push({
      name: '__proto__',
      configurable: true,
      enumerable: false,
      isOwn: has(obj, '__proto__'),
      value: wrap(proto, {
        self,
      }),
      writable: false,
    })
  }

  if (accessorPropertiesOnly) {
    return {
      result: properties,
    }
  }

  const internalProperties = []
  if (proto && !noPrototype(obj)) {
    internalProperties.push({
      name: '[[Prototype]]',
      value: wrap(proto, {
        self,
      }),
    })
  }
  if (isMap(obj) || isSet(obj)) {
    const internalEntries = createInternalEntries(obj)
    internalProperties.push({
      name: '[[Entries]]',
      value: wrap(internalEntries),
    })
  }

  return {
    internalProperties,
    result: properties,
  }
}

const MAX_PREVIEW_LEN = 5

function getPreview(obj: any, self: any = obj) {
  const ret = basic(obj)
  ret.description = getDescription(obj, self)
  let overflow = false
  const properties = []

  const keys = getKeys(obj)
  let len = keys.length
  if (len > MAX_PREVIEW_LEN) {
    len = MAX_PREVIEW_LEN
    overflow = true
  }

  for (let i = 0; i < len; i++) {
    const name = keys[i]

    properties.push(getPropertyPreview(name, self[name]))
  }
  ret.properties = properties

  if (isMap(obj)) {
    const entries = []
    let i = 0
    const keys = obj.keys()
    let key = keys.next().value
    while (key) {
      if (i > MAX_PREVIEW_LEN) {
        overflow = true
        break
      }
      entries.push({
        key: getPreview(key),
        value: getPreview(obj.get(key)),
      })
      i++
      key = keys.next().value
    }

    ret.entries = entries
  } else if (isSet(obj)) {
    const entries = []
    let i = 0
    const keys = obj.keys()
    let key = keys.next().value
    while (key) {
      if (i > MAX_PREVIEW_LEN) {
        overflow = true
        break
      }
      entries.push({
        value: getPreview(key),
      })
      i++
      key = keys.next().value
    }

    ret.entries = entries
  }

  ret.overflow = overflow
  return ret
}

function getPropertyPreview(name: string, propVal: any) {
  const property: any = basic(propVal)
  property.name = name
  const { subtype, type } = property

  let value
  if (type === 'object') {
    if (subtype === 'null') {
      value = 'null'
    } else if (subtype === 'array') {
      value = `Array(${propVal.length})`
    } else if (subtype === 'map') {
      value = `Map(${propVal.size})`
    } else if (subtype === 'set') {
      value = `Set(${propVal.size})`
    } else {
      value = getType(propVal, false)
    }
  } else {
    value = toStr(propVal)
  }

  property.value = value

  return property
}

function getDescription(obj: any, self: any = obj) {
  let description = ''
  const { type, subtype } = basic(obj)

  if (type === 'string') {
    description = obj
  } else if (type === 'number') {
    description = toStr(obj)
  } else if (type === 'symbol') {
    description = toStr(obj)
  } else if (type === 'function') {
    description = toSrc(obj)
  } else if (subtype === 'array') {
    description = `Array(${obj.length})`
  } else if (subtype === 'map') {
    description = `Map(${self.size})`
  } else if (subtype === 'set') {
    description = `Set(${self.size})`
  } else if (subtype === 'regexp') {
    description = toStr(obj)
  } else if (subtype === 'error') {
    description = obj.stack
  } else if (subtype === 'internal#entry') {
    if (obj.name) {
      description = `{"${toStr(obj.name)}" => "${toStr(obj.value)}"}`
    } else {
      description = `"${toStr(obj.value)}"`
    }
  } else {
    description = getType(obj, false)
  }

  return description
}

function basic(value: any): any {
  const type = typeof value
  let subtype = 'object'

  if (value instanceof InternalEntry) {
    subtype = 'internal#entry'
  } else if (isNull(value)) {
    subtype = 'null'
  } else if (isArr(value)) {
    subtype = 'array'
  } else if (isRegExp(value)) {
    subtype = 'regexp'
  } else if (isErr(value)) {
    subtype = 'error'
  } else if (isMap(value)) {
    subtype = 'map'
  } else if (isSet(value)) {
    subtype = 'set'
  } else {
    try {
      // Accessing nodeType may throw exception
      if (isEl(value)) {
        subtype = 'node'
      }
    } catch (e) {
      /* tslint:disable-next-line */
    }
  }

  return {
    type,
    subtype,
  }
}

class InternalEntry {
  name: any
  value: any
  constructor(value: any, name?: any) {
    if (name) {
      this.name = name
    }
    this.value = value
  }
}

function noPrototype(obj: any) {
  if (obj instanceof InternalEntry) {
    return true
  }

  if (obj[0] && obj[0] instanceof InternalEntry) {
    return true
  }

  return false
}

function createInternalEntries(obj: any) {
  const entryId = entries.get(obj)
  const internalEntries: InternalEntry[] = entryId ? getObj(entryId) : []
  const objEntries = obj.entries()
  let entry = objEntries.next().value
  while (entry) {
    if (isMap(obj)) {
      internalEntries.push(new InternalEntry(entry[1], entry[0]))
    } else {
      internalEntries.push(new InternalEntry(entry[1]))
    }
    entry = objEntries.next().value
  }
  return internalEntries
}
