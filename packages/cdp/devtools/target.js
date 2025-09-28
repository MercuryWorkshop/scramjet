import './db.js'
import './network.js'

const targetOrigin = location.protocol + '//' + location.host
function sendToDevtools(message) {
  devtoolsIframe.contentWindow.postMessage(
    JSON.stringify(message),
    targetOrigin
  )
}
let id = 1
function sendToChobitsu(message) {
  message.id = 'tmp' + id++
  chobitsu.sendRawMessage(JSON.stringify(message))
}
chobitsu.setOnMessage(message => {
  if (message.indexOf('"id":"tmp') > -1) {
    return
  }
  devtoolsIframe.contentWindow.postMessage(message, targetOrigin)
})
window.addEventListener('message', event => {
  if (event.origin !== targetOrigin) {
    return
  }
  if (event.data && typeof event.data === 'string') {
    chobitsu.sendRawMessage(event.data)
  }
})
window.onload = function () {
  setTimeout(function () {
    if (
      typeof devtoolsIframe !== 'undefined' &&
      devtoolsIframe.contentWindow.runtime
    ) {
      resetDevtools()
    }
  }, 0)
}
function resetDevtools() {
  const window = devtoolsIframe.contentWindow
  setTimeout(() => {
    window.runtime.loadLegacyModule('core/sdk/sdk.js').then(SDKModule => {
      for (const resourceTreeModel of SDKModule.TargetManager.TargetManager.instance().models(
        SDKModule.ResourceTreeModel.ResourceTreeModel
      )) {
        resourceTreeModel.dispatchEventToListeners(
          SDKModule.ResourceTreeModel.Events.WillReloadPage,
          resourceTreeModel
        )
      }
      sendToDevtools({
        method: 'Page.frameNavigated',
        params: {
          frame: {
            id: '1',
            mimeType: 'text/html',
            securityOrigin: location.origin,
            url: location.href,
          },
          type: 'Navigation',
        },
      })
      sendToChobitsu({ method: 'Network.enable' })
      sendToDevtools({ method: 'Runtime.executionContextsCleared' })
      sendToChobitsu({ method: 'Runtime.enable' })
      sendToChobitsu({ method: 'Debugger.enable' })
      sendToChobitsu({ method: 'DOMStorage.enable' })
      sendToChobitsu({ method: 'DOM.enable' })
      sendToChobitsu({ method: 'CSS.enable' })
      sendToChobitsu({ method: 'Overlay.enable' })
      sendToDevtools({ method: 'DOM.documentUpdated' })
      sendToChobitsu({ method: 'Page.enable' })
      sendToDevtools({ method: 'Page.loadEventFired' })
    })
  }, 0)
}
