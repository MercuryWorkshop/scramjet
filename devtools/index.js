const targetIframe = document.getElementById('target')
const devtoolsIframe = document.getElementById('devtools')

function resetHeight() {
  const targetHeight = Math.floor(window.innerHeight * 0.4)
  targetIframe.style.height = targetHeight + 'px'
  devtoolsIframe.style.height = window.innerHeight - targetHeight + 'px'
}

resetHeight()

window.addEventListener('resize', resetHeight)

targetIframe.onload = function () {
  targetIframe.contentWindow.devtoolsIframe = devtoolsIframe
}
window.addEventListener('message', event => {
  targetIframe.contentWindow.postMessage(event.data, event.origin)
})

const hostOrigin = location.protocol + '//' + location.host
devtoolsIframe.src = `devtools-frontend/out/Default/gen/front_end/chii_app.html#?embedded=${hostOrigin}`
