import connector from '../lib/connector'
import * as nodeManager from '../lib/nodeManager'
import { getNode, getNodeId } from '../lib/nodeManager'
import * as objManager from '../lib/objManager'
import mutationObserver from '../lib/mutationObserver'
import $ from 'licia/$'
import isNull from 'licia/isNull'
import isEmpty from 'licia/isEmpty'
import html from 'licia/html'
import map from 'licia/map'
import unique from 'licia/unique'
import types from 'licia/types'
import contain from 'licia/contain'
import lowerCase from 'licia/lowerCase'
import each from 'licia/each'
import toArr from 'licia/toArr'
import xpath from 'licia/xpath'
import concat from 'licia/concat'
import { setGlobal } from '../lib/evaluate'
import { createId } from '../lib/util'
import Protocol from 'devtools-protocol'
import DOM = Protocol.DOM

export function collectClassNamesFromSubtree(
  params: DOM.CollectClassNamesFromSubtreeRequest
): DOM.CollectClassNamesFromSubtreeResponse {
  const node = getNode(params.nodeId)

  const classNames: string[] = []

  traverseNode(node, (node: any) => {
    if (node.nodeType !== 1) return
    const className = node.getAttribute('class')
    if (className) {
      const names = className.split(/\s+/)
      for (const name of names) classNames.push(name)
    }
  })

  return {
    classNames: unique(classNames),
  }
}

export function copyTo(params: DOM.CopyToRequest): DOM.CopyToResponse {
  const { nodeId, targetNodeId } = params

  const node = getNode(nodeId)
  const targetNode = getNode(targetNodeId)

  const cloneNode = node.cloneNode(true)
  targetNode.appendChild(cloneNode)

  return {
    nodeId: getNodeId(cloneNode),
  }
}

let isEnable = false

export function enable() {
  isEnable = true

  mutationObserver.disconnect()
  mutationObserver.observe(document.documentElement)
  nodeManager.clear()
}

function hookAttachShadow() {
  const origAttachShadow = Element.prototype.attachShadow
  if (origAttachShadow) {
    Element.prototype.attachShadow = function (init) {
      const shadowRoot = origAttachShadow.apply(this, [init])
      if (!nodeManager.isValidNode(this)) {
        return shadowRoot
      }

      ;(this as any).chobitsuShadowRoot = shadowRoot
      if (isEnable) {
        mutationObserver.observe(shadowRoot)
        const hostId = getNodeId(this)
        if (hostId) {
          connector.trigger('DOM.shadowRootPushed', {
            hostId,
            root: nodeManager.wrap(shadowRoot, { depth: 1 }),
          })
        }
      }
      return shadowRoot
    }
  }
}

hookAttachShadow()

export function getDocument() {
  return {
    root: nodeManager.wrap(document, {
      depth: 2,
    }),
  }
}

export function getOuterHTML(
  params: DOM.GetOuterHTMLRequest
): DOM.GetOuterHTMLResponse {
  let outerHTML = ''

  if (params.nodeId) {
    const node = getNode(params.nodeId)
    outerHTML = node.outerHTML
  }

  return {
    outerHTML,
  }
}

export function moveTo(params: DOM.MoveToRequest): DOM.MoveToResponse {
  const { nodeId, targetNodeId } = params

  const node = getNode(nodeId)
  const targetNode = getNode(targetNodeId)

  targetNode.appendChild(node)

  return {
    nodeId: getNodeId(node),
  }
}

const searchResults = new Map()

export function performSearch(
  params: DOM.PerformSearchRequest
): DOM.PerformSearchResponse {
  const query = lowerCase(params.query)
  let result: any[] = []

  try {
    result = concat(result, toArr(document.querySelectorAll(query)))
  } catch (e) {
    /* tslint:disable-next-line */
  }
  try {
    result = concat(result, xpath(query))
  } catch (e) {
    /* tslint:disable-next-line */
  }
  traverseNode(document, (node: any) => {
    const { nodeType } = node
    if (nodeType === 1) {
      const localName = node.localName
      if (
        contain(`<${localName} `, query) ||
        contain(`</${localName}>`, query)
      ) {
        result.push(node)
        return
      }

      const attributes: string[] = []
      each(node.attributes, ({ name, value }) => attributes.push(name, value))
      for (let i = 0, len = attributes.length; i < len; i++) {
        if (contain(lowerCase(attributes[i]), query)) {
          result.push(node)
          break
        }
      }
    } else if (nodeType === 3) {
      if (contain(lowerCase(node.nodeValue), query)) {
        result.push(node)
      }
    }
  })

  const searchId = createId()
  searchResults.set(searchId, result)

  return {
    searchId,
    resultCount: result.length,
  }
}

export function getSearchResults(
  params: DOM.GetSearchResultsRequest
): DOM.GetSearchResultsResponse {
  const { searchId, fromIndex, toIndex } = params

  const searchResult = searchResults.get(searchId)
  const result = searchResult.slice(fromIndex, toIndex)
  const nodeIds = map(result, (node: any) => {
    const nodeId = getNodeId(node)

    if (!nodeId) {
      return pushNodesToFrontend(node)
    }

    return nodeId
  })

  return {
    nodeIds,
  }
}

// Make sure all parent nodes has been retrieved.
export function pushNodesToFrontend(node: any) {
  const nodes = [node]
  let parentNode = node.parentNode
  while (parentNode) {
    nodes.push(parentNode)
    const nodeId = getNodeId(parentNode)
    if (nodeId) {
      break
    } else {
      parentNode = parentNode.parentNode
    }
  }
  while (nodes.length) {
    const node = nodes.pop()
    const nodeId = getNodeId(node)
    connector.trigger('DOM.setChildNodes', {
      parentId: nodeId,
      nodes: nodeManager.getChildNodes(node, 1),
    })
  }

  return getNodeId(node)
}

export function discardSearchResults(params: DOM.DiscardSearchResultsRequest) {
  searchResults.delete(params.searchId)
}

export function pushNodesByBackendIdsToFrontend(
  params: DOM.PushNodesByBackendIdsToFrontendRequest
): DOM.PushNodesByBackendIdsToFrontendResponse {
  return {
    nodeIds: params.backendNodeIds,
  }
}

export function removeNode(params: DOM.RemoveNodeRequest) {
  const node = getNode(params.nodeId)

  $(node).remove()
}

export function requestChildNodes(params: DOM.RequestChildNodesRequest) {
  const { nodeId, depth = 1 } = params
  const node = getNode(nodeId)

  connector.trigger('DOM.setChildNodes', {
    parentId: nodeId,
    nodes: nodeManager.getChildNodes(node, depth),
  })
}

export function requestNode(
  params: DOM.RequestNodeRequest
): DOM.RequestNodeResponse {
  const node = objManager.getObj(params.objectId)

  return {
    nodeId: getNodeId(node),
  }
}

export function resolveNode(
  params: DOM.ResolveNodeRequest
): DOM.ResolveNodeResponse {
  const node = getNode(params.nodeId as number)

  return {
    object: objManager.wrap(node),
  }
}

export function setAttributesAsText(params: DOM.SetAttributesAsTextRequest) {
  const { name, text, nodeId } = params

  const node = getNode(nodeId)
  if (name) {
    node.removeAttribute(name)
  }
  $(node).attr(parseAttributes(text))
}

export function setAttributeValue(params: DOM.SetAttributeValueRequest) {
  const { nodeId, name, value } = params
  const node = getNode(nodeId)
  node.setAttribute(name, value)
}

const history: any[] = []

export function setInspectedNode(params: DOM.SetInspectedNodeRequest) {
  const node = getNode(params.nodeId)
  history.unshift(node)
  if (history.length > 5) history.pop()
  for (let i = 0; i < 5; i++) {
    setGlobal(`$${i}`, history[i])
  }
}

export function setNodeValue(params: DOM.SetNodeValueRequest) {
  const { nodeId, value } = params
  const node = getNode(nodeId)
  node.nodeValue = value
}

export function setOuterHTML(params: DOM.SetOuterHTMLRequest) {
  const { nodeId, outerHTML } = params

  const node = getNode(nodeId)
  node.outerHTML = outerHTML
}

export function getDOMNodeId(params: any) {
  const { node } = params
  return {
    nodeId: nodeManager.getOrCreateNodeId(node),
  }
}

export function getDOMNode(params: any) {
  const { nodeId } = params

  return {
    node: getNode(nodeId),
  }
}

export function getTopLayerElements(): DOM.GetTopLayerElementsResponse {
  return {
    nodeIds: [],
  }
}

export function getNodesForSubtreeByStyle(): DOM.GetNodesForSubtreeByStyleResponse {
  return {
    nodeIds: [],
  }
}

function parseAttributes(str: string) {
  str = `<div ${str}></div>`

  return html.parse(str)[0].attrs
}

function traverseNode(node: any, cb: types.AnyFn) {
  const childNodes = nodeManager.filterNodes(node.childNodes)
  for (let i = 0, len = childNodes.length; i < len; i++) {
    const child = childNodes[i]
    cb(child)
    traverseNode(child, cb)
  }
}

mutationObserver.on('attributes', (target: any, name: string) => {
  const nodeId = getNodeId(target)
  if (!nodeId) return

  const value = target.getAttribute(name)

  if (isNull(value)) {
    connector.trigger('DOM.attributeRemoved', {
      nodeId,
      name,
    })
  } else {
    connector.trigger('DOM.attributeModified', {
      nodeId,
      name,
      value,
    })
  }
})

mutationObserver.on(
  'childList',
  (target: Node, addedNodes: NodeList, removedNodes: NodeList) => {
    const parentNodeId = getNodeId(target)
    if (!parentNodeId) return

    addedNodes = nodeManager.filterNodes(addedNodes)
    removedNodes = nodeManager.filterNodes(removedNodes)

    function childNodeCountUpdated() {
      connector.trigger('DOM.childNodeCountUpdated', {
        childNodeCount: nodeManager.wrap(target, {
          depth: 0,
        }).childNodeCount,
        nodeId: parentNodeId,
      })
    }

    if (!isEmpty(addedNodes)) {
      childNodeCountUpdated()
      for (let i = 0, len = addedNodes.length; i < len; i++) {
        const node = addedNodes[i]
        const previousNode = nodeManager.getPreviousNode(node)
        const previousNodeId = previousNode ? getNodeId(previousNode) : 0
        const params: any = {
          node: nodeManager.wrap(node, {
            depth: 0,
          }),
          parentNodeId,
          previousNodeId,
        }

        connector.trigger('DOM.childNodeInserted', params)
      }
    }

    if (!isEmpty(removedNodes)) {
      for (let i = 0, len = removedNodes.length; i < len; i++) {
        const node = removedNodes[i]
        const nodeId = getNodeId(node)
        if (!nodeId) {
          childNodeCountUpdated()
          break
        }
        connector.trigger('DOM.childNodeRemoved', {
          nodeId: getNodeId(node),
          parentNodeId,
        })
      }
    }
  }
)

mutationObserver.on('characterData', (target: Node) => {
  const nodeId = getNodeId(target)
  if (!nodeId) return

  connector.trigger('DOM.characterDataModified', {
    characterData: target.nodeValue,
    nodeId,
  })
})
