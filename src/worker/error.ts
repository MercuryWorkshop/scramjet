
export function errorTemplate(trace: string, fetchedURL: string) {
  // turn script into a data URI so we don"t have to escape any HTML values
  const script = `
        errorTrace.value = ${JSON.stringify(trace)};
        fetchedURL.textContent = ${JSON.stringify(fetchedURL)};
        for (const node of document.querySelectorAll("#hostname")) node.textContent = ${JSON.stringify(
    location.hostname
  )};
        reload.addEventListener("click", () => location.reload());
        version.textContent = "0.0.1";
    `;

  return `<!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8" />
        <title>Error</title>
        <style>
        * { background-color: white }
        </style>
        </head>
        <body>
        <h1 id="errorTitle">Error processing your request</h1>
        <hr />
        <p>Failed to load <b id="fetchedURL"></b></p>
        <p id="errorMessage">Internal Server Error</p>
        <textarea id="errorTrace" cols="40" rows="10" readonly></textarea>
        <p>Try:</p>
        <ul>
        <li>Checking your internet connection</li>
        <li>Verifying you entered the correct address</li>
        <li>Clearing the site data</li>
        <li>Contacting <b id="hostname"></b>"s administrator</li>
        <li>Verify the server isn"t censored</li>
        </ul>
        <p>If you"re the administrator of <b id="hostname"></b>, try:</p>
        <ul>
        <li>Restarting your server</li>
        <li>Updating Scramjet</li>
        <li>Troubleshooting the error on the <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank">GitHub repository</a></li>
        </ul>
        <button id="reload">Reload</button>
        <hr />
        <p><i>Scramjet v<span id="version"></span></i></p>
        <script src="${"data:application/javascript," + encodeURIComponent(script)
    }"></script>
        </body>
        </html>
        `;
}

export function renderError(err: unknown, fetchedURL: string) {
  const headers = {
    "content-type": "text/html",
  };
  if (crossOriginIsolated) {
    headers["Cross-Origin-Embedder-Policy"] = "require-corp";
  }

  return new Response(errorTemplate(String(err), fetchedURL), {
    status: 500,
    headers: headers,
  });
}

