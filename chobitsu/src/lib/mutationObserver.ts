import Emitter from 'licia/Emitter'
import each from 'licia/each'

class Observer extends Emitter {
  private observer: MutationObserver
  constructor() {
    super()
    this.observer = new MutationObserver(mutations => {
      each(mutations, mutation => this.handleMutation(mutation))
    })
  }
  observe(node: Node) {
    this.observer.observe(node, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    })
  }
  disconnect() {
    this.observer.disconnect()
  }
  private handleMutation(mutation: MutationRecord) {
    if (mutation.type === 'attributes') {
      this.emit('attributes', mutation.target, mutation.attributeName)
    } else if (mutation.type === 'childList') {
      this.emit(
        'childList',
        mutation.target,
        mutation.addedNodes,
        mutation.removedNodes
      )
    } else if (mutation.type === 'characterData') {
      this.emit('characterData', mutation.target)
    }
  }
}

export default new Observer()
