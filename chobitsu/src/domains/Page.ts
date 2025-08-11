import $ from 'licia/$'
import contain from 'licia/contain'
import fetch from 'licia/fetch'
import now from 'licia/now'
import Readiness from 'licia/Readiness'
import map from 'licia/map'
import { fullUrl } from '../lib/request'
import { MAIN_FRAME_ID } from '../lib/constants'
import {
  getBase64Content,
  getTextContent,
  getOrigin,
  getUrl,
} from '../lib/util'
import connector from '../lib/connector'
import { isValidNode } from '../lib/nodeManager'
import html2canvas, { Options as html2canvasOptions } from 'html2canvas'
import * as resources from '../lib/resources'
import Protocol from 'devtools-protocol'
import Page = Protocol.Page

let proxy = ''

export function setProxy(params: any) {
  proxy = params.proxy
}

export function enable() {
  stopScreencast()
}

export function reload() {
  location.reload()
}

export function navigate(params: Page.NavigateRequest): Page.NavigateResponse {
  location.href = params.url

  return {
    frameId: MAIN_FRAME_ID,
  }
}

export function getNavigationHistory() {
  return {
    currentIndex: 0,
    entries: [
      {
        id: 0,
        url: getUrl(),
        userTypedURL: getUrl(),
        title: document.title,
        transitionType: 'link',
      },
    ],
  }
}

export async function getAppManifest() {
  const $links = $('link')
  const ret: any = {
    errors: [],
  }

  let url = ''
  $links.each(function (this: Element) {
    const $this = $(this)

    if ($this.attr('rel') === 'manifest') {
      url = fullUrl($this.attr('href'))
    }
  })
  ret.url = url

  if (url) {
    const res = await fetch(url)
    ret.data = await res.text()
  }

  return ret
}

export function getResourceTree() {
  const images = map(resources.getImages(), url => {
    let mimeType = 'image/jpg'
    if (contain(url, 'png')) {
      mimeType = 'image/png'
    } else if (contain(url, 'gif')) {
      mimeType = 'image/gif'
    }

    return {
      url,
      mimeType,
      type: 'Image',
    }
  })

  return {
    frameTree: {
      frame: {
        id: MAIN_FRAME_ID,
        mimeType: 'text/html',
        securityOrigin: getOrigin(),
        url: getUrl(),
      },
      resources: [...images],
    },
  }
}

export async function getResourceContent(
  params: Page.GetResourceContentRequest
): Promise<Page.GetResourceContentResponse> {
  const { frameId, url } = params
  let base64Encoded = false

  if (frameId === MAIN_FRAME_ID) {
    let content = ''

    if (url === location.href) {
      content = await getTextContent(url)
      if (!content) {
        content = document.documentElement.outerHTML
      }
    } else if (resources.isImage(url)) {
      content = await getBase64Content(url, proxy)
      base64Encoded = true
    }

    return {
      base64Encoded,
      content,
    }
  }

  return {
    base64Encoded,
    content: '',
  }
}

let screenshotTimer: any
let ack: Readiness
let screencastInterval = 2000
let isCapturingScreenshot = false

export function screencastFrameAck() {
  if (ack) {
    ack.signal('ack')
  }
}

export function startScreencast() {
  if (isCapturingScreenshot) {
    return
  }
  stopScreencast()
  captureScreenshot()
}

export function stopScreencast() {
  if (screenshotTimer) {
    clearTimeout(screenshotTimer)
    screenshotTimer = null
    if (ack) {
      ack.signal('ack')
    }
  }
}

async function captureScreenshot() {
  if (document.hidden) {
    screenshotTimer = setTimeout(captureScreenshot, screencastInterval)
    return
  }

  isCapturingScreenshot = true

  const $body = $(document.body)
  const deviceWidth = window.innerWidth
  let deviceHeight = window.innerHeight
  let offsetTop = -window.scrollY
  const overflowY = $body.css('overflow-y')
  if (contain(['auto', 'scroll'], overflowY)) {
    deviceHeight = $body.offset().height
    offsetTop = -document.body.scrollTop
  }
  let width = $body.offset().width
  if (width < deviceWidth) {
    width = deviceWidth
  }

  const options: Partial<html2canvasOptions> = {
    imageTimeout: 5000,
    scale: 1,
    width,
    logging: false,
    ignoreElements(node) {
      return !isValidNode(node)
    },
  }

  if (proxy) {
    options.proxy = proxy
  } else {
    options.foreignObjectRendering = true
    options.useCORS = true
  }

  const time = now()
  const canvas = await html2canvas(document.body, options)
  const duration = now() - time
  screencastInterval = 2000
  if (duration * 5 > screencastInterval) {
    screencastInterval = duration * 5
  }

  const data = canvas
    .toDataURL('image/jpeg')
    .replace(/^data:image\/jpeg;base64,/, '')

  if (ack) {
    await ack.ready('ack')
  }
  ack = new Readiness()
  connector.trigger('Page.screencastFrame', {
    data,
    sessionId: 1,
    metadata: {
      deviceWidth,
      deviceHeight,
      pageScaleFactor: 1,
      offsetTop,
      scrollOffsetX: 0,
      scrollOffsetY: 0,
      timestamp: now(),
    },
  })

  screenshotTimer = setTimeout(captureScreenshot, screencastInterval)

  isCapturingScreenshot = false
}
