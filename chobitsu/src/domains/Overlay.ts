import { getNode, getNodeId, isValidNode } from '../lib/nodeManager'
import { pushNodesToFrontend } from './DOM'
import $ from 'licia/$'
import h from 'licia/h'
import evalCss from 'licia/evalCss'
import defaults from 'licia/defaults'
import extend from 'licia/extend'
import connector from '../lib/connector'
import root from 'licia/root'
import toBool from 'licia/toBool'
import cssSupports from 'licia/cssSupports'
import LunaDomHighlighter from 'luna-dom-highlighter'
import * as objManager from '../lib/objManager'
import Protocol from 'devtools-protocol'
import Overlay = Protocol.Overlay

let domHighlighter: LunaDomHighlighter
let isCssLoaded = false
let $container: $.$
let isEnable = false
const showInfo = cssSupports(
  'clip-path',
  'polygon(50% 0px, 0px 100%, 100% 100%)'
)
const hasTouchSupport = 'ontouchstart' in root

const css = require('luna-dom-highlighter/luna-dom-highlighter.css').replace(
  '/*# sourceMappingURL=luna-dom-highlighter.css.map*/',
  ''
)

export function enable() {
  if (isEnable) {
    return
  }

  const container = h('div', {
    class: '__chobitsu-hide__',
    style: {
      all: 'initial',
    },
  })
  $container = $(container)
  document.documentElement.appendChild(container)

  let domHighlighterContainer: HTMLDivElement | null = null
  let shadowRoot: ShadowRoot | null = null
  if (container.attachShadow) {
    shadowRoot = container.attachShadow({ mode: 'open' })
  } else if ((container as any).createShadowRoot) {
    shadowRoot = (container as any).createShadowRoot()
  }
  if (shadowRoot) {
    const style = document.createElement('style')
    style.textContent = css
    style.type = 'text/css'
    shadowRoot.appendChild(style)
    domHighlighterContainer = document.createElement('div')
    shadowRoot.appendChild(domHighlighterContainer)
  } else {
    domHighlighterContainer = document.createElement('div')
    container.appendChild(domHighlighterContainer)
    if (!isCssLoaded) {
      evalCss(css)
      isCssLoaded = true
    }
  }

  domHighlighter = new LunaDomHighlighter(domHighlighterContainer, {
    monitorResize: toBool(root.ResizeObserver),
    showInfo,
  })

  window.addEventListener('resize', resizeHandler)

  isEnable = true
}

export function disable() {
  domHighlighter.destroy()
  $container.remove()
  window.removeEventListener('resize', resizeHandler)

  isEnable = false
}

export function highlightNode(params: Overlay.HighlightNodeRequest) {
  const { nodeId, highlightConfig, objectId } = params

  let node: any
  if (nodeId) {
    node = getNode(nodeId)
  }
  if (objectId) {
    node = objManager.getObj(objectId)
  }

  if (node.nodeType !== 1 && node.nodeType !== 3) return

  defaults(highlightConfig, {
    contentColor: 'transparent',
    paddingColor: 'transparent',
    borderColor: 'transparent',
    marginColor: 'transparent',
  })
  if (!showInfo) {
    extend(highlightConfig, {
      showInfo: false,
    })
  }
  domHighlighter.highlight(node, highlightConfig as any)
}

export function hideHighlight() {
  domHighlighter.hide()
}

let showViewportSizeOnResize = false
export function setShowViewportSizeOnResize(
  params: Overlay.SetShowViewportSizeOnResizeRequest
) {
  showViewportSizeOnResize = params.show
}

let highlightConfig: any = {}
let inspectMode = 'none'
export function setInspectMode(params: Overlay.SetInspectModeRequest) {
  highlightConfig = params.highlightConfig
  inspectMode = params.mode
}

function getElementFromPoint(e: any) {
  if (hasTouchSupport) {
    const touch = e.touches[0] || e.changedTouches[0]
    return document.elementFromPoint(touch.clientX, touch.clientY)
  }

  return document.elementFromPoint(e.clientX, e.clientY)
}

let lastNodeId = -1

function moveListener(e: any) {
  if (inspectMode === 'none') return

  const node = getElementFromPoint(e)
  if (!node || !isValidNode(node)) {
    return
  }
  let nodeId = getNodeId(node)

  if (!nodeId) {
    nodeId = pushNodesToFrontend(node)
  }

  highlightNode({
    nodeId,
    highlightConfig,
  })
  if (nodeId !== lastNodeId) {
    connector.trigger('Overlay.nodeHighlightRequested', {
      nodeId,
    })
    lastNodeId = nodeId
  }
}

function outListener() {
  if (inspectMode === 'none') return

  hideHighlight()
}

function clickListener(e: any) {
  if (inspectMode === 'none') return

  e.preventDefault()
  e.stopImmediatePropagation()

  const node = getElementFromPoint(e)
  connector.trigger('Overlay.inspectNodeRequested', {
    backendNodeId: getNodeId(node),
  })

  lastNodeId = -1
  hideHighlight()
}

function addEvent(type: string, listener: any) {
  document.documentElement.addEventListener(type, listener, true)
}
if (hasTouchSupport) {
  addEvent('touchstart', moveListener)
  addEvent('touchmove', moveListener)
  addEvent('touchend', clickListener)
} else {
  addEvent('mousemove', moveListener)
  addEvent('mouseout', outListener)
  addEvent('click', clickListener)
}

const viewportSize = h('div', {
  class: '__chobitsu-hide__',
  style: {
    position: 'fixed',
    right: 0,
    top: 0,
    background: '#fff',
    fontSize: 13,
    opacity: 0.5,
    padding: '4px 6px',
  },
})

function resizeHandler() {
  if (!showViewportSizeOnResize) return

  $viewportSize.text(`${window.innerWidth}px × ${window.innerHeight}px`)
  if (viewportSizeTimer) {
    clearTimeout(viewportSizeTimer)
  } else {
    document.documentElement.appendChild(viewportSize)
  }
  viewportSizeTimer = setTimeout(() => {
    $viewportSize.remove()
    viewportSizeTimer = null
  }, 1000)
}
const $viewportSize: any = $(viewportSize)
let viewportSizeTimer: any
