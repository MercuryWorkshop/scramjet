import connector from '../lib/connector'
import * as scriptMananger from '../lib/scriptMananger'
import each from 'licia/each'
import Protocol from 'devtools-protocol'
import Debugger = Protocol.Debugger

let proxy = ''

export function setProxy(params: any) {
  proxy = params.proxy
}

export function enable() {
  each(scriptMananger.getScripts(), script => {
    connector.trigger('Debugger.scriptParsed', script)
  })
}

export async function getScriptSource(
  params: Debugger.GetScriptSourceRequest
): Promise<Debugger.GetScriptSourceResponse> {
  return {
    scriptSource: await scriptMananger.getScriptSource(params.scriptId, proxy),
  }
}
