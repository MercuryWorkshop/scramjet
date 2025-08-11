import connector from './lib/connector'
import noop from 'licia/noop'
import uuid from 'licia/uuid'
import each from 'licia/each'
import Emitter from 'licia/Emitter'
import { ErrorWithCode } from './lib/util'
import types from 'licia/types'

type OnMessage = (message: string) => void
type DomainMethod = (...args: any[]) => any

export default class Chobitsu {
  private onMessage: OnMessage
  private resolves: Map<string, (value?: any) => void> = new Map()
  private domains: Map<string, { [index: string]: DomainMethod }> = new Map()
  constructor() {
    this.onMessage = noop
    connector.on('message', (message: any) => {
      const parsedMessage = JSON.parse(message)

      const resolve = this.resolves.get(parsedMessage.id)
      if (resolve) {
        resolve(parsedMessage.result)
      }

      if (!parsedMessage.id) {
        const [name, method] = parsedMessage.method.split('.')
        const domain = this.domains.get(name)
        if (domain) {
          domain.emit(method, parsedMessage.params)
        }
      }

      this.onMessage(message)
    })
  }
  domain(name: string) {
    return this.domains.get(name)
  }
  setOnMessage(onMessage: OnMessage) {
    this.onMessage = onMessage
  }
  sendMessage(method: string, params: any = {}) {
    const id = uuid()

    this.sendRawMessage(
      JSON.stringify({
        id,
        method,
        params,
      })
    )

    return new Promise(resolve => {
      this.resolves.set(id, resolve)
    })
  }
  async sendRawMessage(message: string) {
    const parsedMessage = JSON.parse(message)

    const { method, params, id } = parsedMessage

    const resultMsg: any = {
      id,
    }

    try {
      resultMsg.result = await this.callMethod(method, params)
    } catch (e) {
      if (e instanceof ErrorWithCode) {
        resultMsg.error = {
          message: e.message,
          code: e.code,
        }
      } else if (e instanceof Error) {
        resultMsg.error = {
          message: e.message,
        }
      }
    }

    connector.emit('message', JSON.stringify(resultMsg))
  }
  register(name: string, methods: types.PlainObj<types.AnyFn>) {
    const domains = this.domains

    /* eslint-disable-next-line */
    let domain = domains.get(name)!
    if (!domain) {
      domain = {}
      Emitter.mixin(domain)
    }
    each(methods, (fn: any, method: string) => {
      domain[method] = fn
    })
    domains.set(name, domain)
  }
  private async callMethod(method: string, params: any) {
    const [domainName, methodName] = method.split('.')
    const domain = this.domain(domainName)
    if (domain) {
      if (domain[methodName]) {
        return domain[methodName](params) || {}
      }
    }

    throw Error(`${method} unimplemented`)
  }
}
