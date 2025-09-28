setTimeout(function () {
  fetch(location.href)
}, 1000)

function testFetch() {
  fetch('/index.js')
  fetch('https://domainnotexist.com').catch(err => {
    console.error(err)
  })
}

function testXhr() {
  let xhr = new XMLHttpRequest()
  xhr.open('GET', '/index.js', true)
  xhr.send()

  xhr = new XMLHttpRequest()
  xhr.open('GET', 'https://domainnotexist.com', true)
  xhr.send()
}

function testWs() {
  const text = 'This is the text used for testing!'

  const enc = new TextEncoder()
  const ws = new WebSocket('wss://echo.websocket.org')

  ws.onopen = function () {
    ws.send(text)
    ws.send(enc.encode(text))
  }
  setTimeout(() => {
    ws.close()
  }, 1000)

  const wsIgnore = new WebSocket(
    'wss://echo.websocket.org?__chobitsu-hide__=true'
  )

  wsIgnore.onopen = function () {
    wsIgnore.send(text)
    wsIgnore.send(enc.encode(text))
  }
  setTimeout(() => {
    wsIgnore.close()
  }, 1000)
}

testFetch()
testXhr()
testWs()
