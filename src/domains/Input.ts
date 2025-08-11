import isUndef from 'licia/isUndef'
import toBool from 'licia/toBool'
import Protocol from 'devtools-protocol'
import Input = Protocol.Input

let isClick = false

export function emulateTouchFromMouseEvent(
  params: Input.EmulateTouchFromMouseEventRequest
) {
  const { type, x, y, deltaX, deltaY } = params

  const el = document.elementFromPoint(x, y) || document.documentElement

  switch (type) {
    case 'mousePressed':
      isClick = true
      triggerTouchEvent('touchstart', el, x, y)
      break
    case 'mouseMoved':
      isClick = false
      triggerTouchEvent('touchmove', el, x, y)
      break
    case 'mouseReleased':
      triggerTouchEvent('touchend', el, x, y)
      if (isClick) {
        triggerMouseEvent('click', el, x, y)
      }
      isClick = false
      break
    case 'mouseWheel':
      if (!isUndef(deltaX) && !isUndef(deltaY)) {
        triggerScroll(el, deltaX, deltaY)
      }
      break
  }
}

export function dispatchMouseEvent(params: Input.DispatchMouseEventRequest) {
  const { type, x, y, deltaX, deltaY } = params

  const el = document.elementFromPoint(x, y) || document.documentElement

  switch (type) {
    case 'mousePressed':
      isClick = true
      triggerMouseEvent('mousedown', el, x, y)
      break
    case 'mouseMoved':
      isClick = false
      triggerMouseEvent('mousemove', el, x, y)
      break
    case 'mouseReleased':
      triggerMouseEvent('mouseup', el, x, y)
      if (isClick) {
        triggerMouseEvent('click', el, x, y)
      }
      isClick = false
      break
    case 'mouseWheel':
      if (!isUndef(deltaX) && !isUndef(deltaY)) {
        triggerScroll(el, deltaX, deltaY)
      }
      break
  }
}

function triggerMouseEvent(type: string, el: Element, x: number, y: number) {
  el.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    })
  )
}

function triggerTouchEvent(type: string, el: Element, x: number, y: number) {
  const touch = new Touch({
    identifier: 0,
    target: el,
    clientX: x,
    clientY: y,
    force: 1,
  })

  el.dispatchEvent(
    new TouchEvent(type, {
      bubbles: true,
      touches: [touch],
      changedTouches: [touch],
      targetTouches: [touch],
    })
  )
}

function triggerScroll(el: Element, deltaX: number, deltaY: number) {
  el = findScrollableEl(el, deltaX, deltaY)
  el.scrollLeft -= deltaX
  el.scrollTop -= deltaY
}

function findScrollableEl(el: Element | null, deltaX: number, deltaY: number) {
  while (el) {
    if (toBool(deltaX) && isScrollable(el, 'x')) {
      return el
    }
    if (toBool(deltaY) && isScrollable(el, 'y')) {
      return el
    }

    el = el.parentElement
  }

  return el || document.documentElement
}

function isScrollable(el: Element, direction: 'x' | 'y') {
  const computedStyle = getComputedStyle(el)

  if (direction === 'x') {
    return (
      el.scrollWidth > el.clientWidth && computedStyle.overflowX !== 'hidden'
    )
  }

  return (
    el.scrollHeight > el.clientHeight && computedStyle.overflowY !== 'hidden'
  )
}
