Remember web proxies? They were a really cool bit of tech for a quasi-vpn alternative. Instead of hooking your entire system network to a vpn, you would just go to a single website that acted as a tunnel and allowed you to access any other resource.

The first major proxy was [phproxy](https://github.com/PHProxy/phproxy), with Glype and .....

All of these services used the same extremely simple mechanism. The user navigates to `https://proxy.com/example.com/`

When the server recieves the response, instead of serving a normal static page, it will make a request to `https://example.com/` and fetch the contents, recieving some HTML that looks something like this

```
<html>
	<head>
		<title>Example</title>
		<link rel=”stylesheet” href=”https://example.com/index.css” />
	</head>
	<body>
		<h1>Example Domain</h1>
		<a href=”https://example.com/more”>more information</a>
	</body>
</html>
```

The server performs a simple transform, rewriting all URLs found in the html:

```
<html>
	<head>
		<title>Example</title>
		<link rel=”stylesheet” href=”https://proxy.com/example.com/index.css” />
	</head>
	<body>
		<h1>Example Domain</h1>
		<a href=”https://proxy.com/example.com/more”>more information</a>
	</body>
</html>
```

And then will send it back to the user as the page they requested. Image resources are fetched and served back verbatim, and POST requests from form submissions are forwarded to the original server as well.

Back when CGIProxy was first written in 1998, these worked great, you could have a complete anonymized browsing experience without having to set up a full vpn. So what happened?

# Javascript

If you look back at the simple HTML example from earlier, it’s possible to understand exactly what it will do at runtime without ever having to load the page. It will request exactly the resources it lists, no more, no less. It cannot self-modify its own behavior, hide its functionality, or change page content based on a random number generator. This is why proxies worked so well across most of the web!

Javascript breaks this guarantee entirely. Anything that can be considered a programming language is basically completely immune to static analysis. As soon as the site loads a script, it’s impossible to tell ahead of time what resources it will attempt to load.

To give you an idea of just how hard this problem is: can you tell what the following snippet of code does?

```
[][(![]+[])[+!+[]]+(!![]+[])[+[]]][([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[])[+!+[]]+([][[]]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+(!![]+[])[+!+[]]]((![]+[])[+!+[]]+(![]+[])[!+[]+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+!+[]]+(!![]+[])[+[]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[+!+[]+[+!+[]]]+(![]+[])[!+[]+!+[]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][(![]+[])[+!+[]]+(!![]+[])[+[]]]+[])[!+[]+!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[+[]]+([![]]+[][[]])[+!+[]+[+[]]]+(!![]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[+[]]]+([][[]]+[])[+!+[]]+([]+[]+[][(![]+[])[+!+[]]+(!![]+[])[+[]]])[+!+[]+[!+[]+!+[]]])()
```

You won’t be able to find out until you run it, which will use `fetch` to load a resource from example.com, potentially deanonymizing the user. In addition to deanonymizing the user, this will often times break the site completely, especially when CORS restrictions are involved

There was a point where you could simply just disable javascript on the browser. Many sites were only using javascript for progressive enhancement anyway. But as the web grew, more and more responsibilities got moved to javascript. Before long, most modern websites were rendering the entire page content entirely within javascript.

# Modern Proxies

In [browser.js](https://github.com/HeyPuter/browser.js) we set out to build a modern web proxy that could handle the complexity of modern web applications.

The first step of making a modern proxy was leveraging Service Workers: A relatively obscure feature to most web developers, it allows the page to deploy a small bit of persistent javascript that runs in the background, independently from the main window. Importantly, a page’s service worker has **the capability to intercept and handle network traffic made by the page**.

Instead of the page making requests to the backend, it would make it to itself. The service worker can then route requests through a small minimal cors proxy on the backend.

Moving processing away from the server makes the proxy scalable.

We needed to completely rethink the way proxies worked. We would basically be building a hypervisor for the browser

// put some diagram here?

What can we handle by monkeypatching page content, and what can’t we?

The most important thing is window.location

This exposes the real origin of the site. We need to make it _think_ that it’s executing on the original origin. However, this cannot be monkeypatched. The “location” property descriptor of Window is “frozen”, so it can’t be overwritten like others can.

So javascript can’t be statically analyzed, and this property can’t be changed at runtime

However, what we can do is insert hooks _during static analysis_ that allow us to change runtime behavior
is this thunking?

```
let url = location.href
console.assert(url == “https://example.com”, “we’re not running on the expected page?”)
```

After parsing the AST, we can look for the `Identifier` tags that hold “location” and start replacing them.

This can be rewritten to

```
let url = $proxyWrap(location).href
console.assert(url == “https://example.com”, “we’re not running on the expected page?”)
```

The smart thing about this is that proxyWrap knows the original value and can still pass it through if needed. If a variable named `location` happened to be shadowing the real location, the wrap would know not to replace it.

Property access needs to be handled similarly:

```
let href = window[“loca” + “tion”].href
```

Gets rewritten to

```
let href = window[$proxyProp(“loca” + “tion”)].href
```

The instrumentation allows us to change it at runtime

The only issue with this approach is that AST parsing is expensive. Modern sites can load javascript bundles in excess of 5MB!!

Here’s where Rust and WebAssembly step in: with the amazing oxc project and clever optimizations, we were able to reduce the time it takes to rewrite by >10x, making the overhead almost unnoticable for most webpages.

# Privacy

The other major issue with traditional web proxies is the lack of data protection.
Since the backend needs to rewrite web content, it’s also able to log or modify any data that passes through it.

The service-worker based approach makes it better, but all traffic will still eventually go through a server that can see everything in plain HTTP.

For a web proxy to be truly private, it needs to be end-to-end encrypted between the browser and the target server. This means only encrypted data would ever be sent through the server.

There's a unique challenge here though. We can't just invent some new encryption scheme, because the target server needs to understand it. It's end-to-end, and the server end only speaks HTTPS/TLS over TCP.

Sending TCP is easy, the [Wisp Protocol](https://github.com/MercuryWorkshop/wisp-protocol) allows our web page to speak raw TCP over a websocket forwarded to the server, but the TLS part is tricky.

The browser already ships with a full cryptography stack, including TLS, but other than the severely limited WebCrypto API, it's not exposed to javascript. This ultimately means that we're going to implement our own TLS stack at the javascript layer.

Fortunately, this isn't as hard as it sounds, and leveraging Rust's WebAssembly toolchain again, we were able to run rustls in the browser with surprisingly low overhead, with requests coming close to native speed.

Our stack now looks like this:

Request comes from the browser
https://proxy.com/example.com/secure_data.txt

# Why

Selenium

Puter integrates

[0]
[1] https://www.jmarshall.com/tools/cgiproxy/
[3]
[4]
