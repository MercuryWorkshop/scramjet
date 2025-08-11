import each from 'licia/each'
import strHash from 'licia/strHash'
import toStr from 'licia/toStr'
import { getAbsoluteUrl, getTextContent } from './util'
import * as resources from './resources'

const scripts = new Map()
scripts.set('1', {
  scriptId: '1',
  startColumn: 0,
  startLine: 0,
  endColumn: 100000,
  endLine: 100000,
  scriptLanguage: 'JavaScript',
  url: '',
})
const sources = new Map()
sources.set('1', '')

export function getScript(scriptId: string) {
  return scripts.get(scriptId)
}

export async function getScriptSource(scriptId: string, proxy = '') {
  if (sources.get(scriptId)) {
    return sources.get(scriptId)
  }
  const script = getScript(scriptId)
  const source = await getTextContent(script.url, proxy)
  sources.set(scriptId, source)

  return sources.get(scriptId)
}

export function getScripts() {
  const ret: any[] = []

  const srcs = resources.getScripts()

  each(srcs, src => {
    const url = getAbsoluteUrl(src)
    const scriptId = getScriptId(url)
    if (!scripts.get(scriptId)) {
      scripts.set(scriptId, {
        scriptId,
        startColumn: 0,
        startLine: 0,
        endColumn: 100000,
        endLine: 100000,
        scriptLanguage: 'JavaScript',
        url,
      })
    }
    ret.push(scripts.get(scriptId))
  })

  return ret
}

function getScriptId(url: string) {
  return toStr(strHash(url))
}
