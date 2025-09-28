import map from 'licia/map'
import filter from 'licia/filter'
import compact from 'licia/compact'
import contain from 'licia/contain'
import endWith from 'licia/endWith'

let isPerformanceSupported = false
const performance = (window as any).webkitPerformance || window.performance
if (performance && performance.getEntries) {
  isPerformanceSupported = true
}

export function getScripts(): string[] {
  if (isPerformanceSupported) {
    return getResources('script')
  }

  const elements = document.querySelectorAll('script')

  return compact(map(elements, element => element.src))
}

export function getImages(): string[] {
  if (isPerformanceSupported) {
    return getResources('img')
  }

  const elements = document.querySelectorAll('img')

  return compact(map(elements, element => element.src))
}

export function isImage(url: string) {
  return contain(getImages(), url)
}

function getResources(type: string) {
  return map(
    filter(performance.getEntries(), (entry: any) => {
      if (entry.entryType !== 'resource') {
        return false
      }

      if (entry.initiatorType === type) {
        return true
      } else if (entry.initiatorType === 'other') {
        // preload
        if (type === 'script') {
          if (endWith(entry.name, '.js')) {
            return true
          }
        }
      }

      return false
    }),
    entry => entry.name
  )
}
