import trim from 'licia/trim'
import each from 'licia/each'
import decodeUriComponent from 'licia/decodeUriComponent'
import types from 'licia/types'
import connector from '../lib/connector'
import Protocol from 'devtools-protocol'
import Network = Protocol.Network
import { contain, convertBin, isBlob, isStr, isUndef, now } from 'licia'
import { createId } from '../lib/util'

export function getCookies(): Network.GetCookiesResponse {
  const cookies: any[] = []

  const cookie = document.cookie
  if (trim(cookie) !== '') {
    each(cookie.split(';'), function (value: any) {
      value = value.split('=')
      const name = trim(value.shift())
      value = decodeUriComponent(value.join('='))
      cookies.push({
        name,
        value,
      })
    })
  }

  return { cookies }
}

let isEnable = false

export const enable = function () {
  isEnable = true
  each(triggers, trigger => trigger())
  triggers = []
}

function enableWebSocket() {
  const origWebSocket = window.WebSocket
  function WebSocket(url: string, protocols?: string | string[]) {
    const ws = new origWebSocket(url, protocols)

    if (!isValidUrl(url)) {
      return ws
    }

    const requestId = createId()

    trigger('Network.webSocketCreated', {
      requestId,
      url,
    })

    ws.addEventListener('open', function () {
      trigger('Network.webSocketWillSendHandshakeRequest', {
        requestId,
        timestamp: now() / 1000,
        request: {
          headers: {},
        },
      })
      trigger('Network.webSocketHandshakeResponseReceived', {
        requestId,
        timeStamp: now() / 1000,
        response: {
          status: 101,
          statusText: 'Switching Protocols',
        },
      })
    })

    ws.addEventListener('message', async function (e) {
      let payloadData = e.data
      if (isUndef(payloadData)) {
        return
      }

      let opcode = 1
      if (!isStr(payloadData)) {
        opcode = 2
        if (isBlob(payloadData)) {
          payloadData = await convertBin.blobToArrBuffer(payloadData)
        }
        payloadData = convertBin(payloadData, 'base64')
      }

      trigger('Network.webSocketFrameReceived', {
        requestId,
        timestamp: now() / 1000,
        response: {
          opcode,
          payloadData,
        },
      })
    })

    const origSend = ws.send
    ws.send = function (data: any) {
      if (!isUndef(data)) {
        frameSent(data)
      }

      return origSend.call(this, data)
    }

    async function frameSent(data: any) {
      let opcode = 1
      let payloadData = data
      if (!isStr(data)) {
        opcode = 2
        if (isBlob(payloadData)) {
          payloadData = await convertBin.blobToArrBuffer(payloadData)
        }
        payloadData = convertBin(data, 'base64')
      }

      trigger('Network.webSocketFrameSent', {
        requestId,
        timestamp: now() / 1000,
        response: {
          opcode,
          payloadData,
        },
      })
    }

    ws.addEventListener('close', function () {
      trigger('Network.webSocketClosed', {
        requestId,
        timestamp: now() / 1000,
      })
    })

    ws.addEventListener('error', function () {
      trigger('Network.webSocketFrameError', {
        requestId,
        timestamp: now() / 1000,
        errorMessage: 'WebSocket error',
      })
    })

    return ws
  }
  WebSocket.prototype = origWebSocket.prototype
  WebSocket.CLOSED = origWebSocket.CLOSED
  WebSocket.CLOSING = origWebSocket.CLOSING
  WebSocket.CONNECTING = origWebSocket.CONNECTING
  WebSocket.OPEN = origWebSocket.OPEN
  window.WebSocket = WebSocket as any
}

function isValidUrl(url: string) {
  return !contain(url, '__chobitsu-hide__=true')
}

let triggers: types.AnyFn[] = []

function trigger(method: string, params: any) {
  if (isEnable) {
    connector.trigger(method, params)
  } else {
    triggers.push(() => connector.trigger(method, params))
  }
}

enableWebSocket()

// TODO: this is horrible, there should only be one chobitsu
// @ts-expect-error
if (document.currentScript!.src!.includes("chii")) {
  // TODO: this needs to get the message from the parent somehow
  (self as any)[Symbol.for("scramjet client global")].serviceWorker.addEventListener("message", async (event: any) => {
    if (event.data.type === "scramjet-request") {
      let requestData = event.data.data;
      if (requestData.body && requestData.body instanceof ReadableStream) {
      	try {
      		const reader = requestData.body.getReader();
      		const chunks = [];
      		let done, value;

      		while (!done) {
      			({ done, value } = await reader.read());
      			if (value) {
      				chunks.push(value);
      			}
      		}

      		// Convert chunks to text
      		const blob = new Blob(chunks);
      		requestData.payload = await blob.text();
      	} catch (error) {
      		console.error("Error reading request body stream:", error);
      		requestData.payload = "[Error reading request body]";
      	}
      }


      trigger("Network.requestWillBeSent", {
        requestId: "1." + String(requestData.id),
        type: "Fetch",
        request: {
          method: requestData.method,
          url: requestData.url,
          headers: {},
        },
        timestamp: now() / 1000,
      })

    } else if (event.data.type === "scramjet-response") {
      // Check if there's a transferred stream in the message
      let responseData = event.data.data;
      console.log(responseData);

      // Handle transferred stream for response body
      // The stream is included directly in the data object
      if (responseData.body && responseData.body instanceof ReadableStream) {
        try {
          const reader = responseData.body.getReader();
          const chunks = [];
          let done, value;

          while (!done) {
            ({ done, value } = await reader.read());
            if (value) {
              chunks.push(value);
            }
          }

          // Convert chunks to text
          const blob = new Blob(chunks);
          responseData.responseBody = await blob.text();
          responseData.responseSize = responseData.responseBody.length;
        } catch (error) {
          console.error("Error reading response body stream:", error);
          responseData.responseBody = "[Error reading response body]";
        }
      }

      connector.trigger("Network.responseReceived", {
        requestId: responseData.id,
        type: "Fetch",
        response: {
          status: responseData.status,
          headers: responseData.resHeaders,
        },
        timestamp: responseData.time / 1000,
      });
    }
  });

}
