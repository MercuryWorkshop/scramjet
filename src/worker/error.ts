import { $scramjet } from "../scramjet";

export function errorTemplate(trace: string, fetchedURL: string) {
	// turn script into a data URI so we don"t have to escape any HTML values
	const script = `
                errorTrace.value = ${JSON.stringify(trace)};
                fetchedURL.textContent = ${JSON.stringify(fetchedURL)};
                for (const node of document.querySelectorAll("#hostname")) node.textContent = ${JSON.stringify(location.hostname)};
                reload.addEventListener("click", () => location.reload());
                version.textContent = ${JSON.stringify($scramjet.version.version)};
                build.textContent = ${JSON.stringify($scramjet.version.build)};
        `;

	return `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8" />
        <title>Scramjet</title>
        <style>
        :root {
            --deep: #080602;
            --shallow: #181412;
            --beach: #f1e8e1;
            --shore: #b1a8a1;
            --accent: #ffa938;
            --font-sans: -apple-system, system-ui, BlinkMacSystemFont, sans-serif;
            --font-monospace: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }

        *:not(div,p,span,ul,li,i,span) {
            background-color: var(--deep);
            color: var(--beach);
            font-family: var(--font-sans);
        }

        textarea,
        button {
            background-color: var(--shallow);
            border-radius: 0.6em;
            padding: 0.6em;
            border: none;
            appearance: none;
            font-family: var(--font-sans);
            color: var(--beach);
        }

        button.primary {
            background-color: var(--accent);
            color: var(--deep);
            font-weight: bold;
        }

        textarea {
            resize: none;
            height: 20em;
            text-align: left;
            font-family: var(--font-monospace);
        }

        body {
            width: 100vw;
            height: 100vh;
            justify-content: center;
            align-items: center;
        }

        body,
        html,
        #inner {
            display: flex;
            align-items: center;
            flex-direction: column;
            gap: 0.5em;
            overflow: hidden;
        }

        #inner {
            z-index: 100;
        }

        #cover {
            position: absolute;
            width: 100%;
            height: 100%;
            background-color: color-mix(in srgb, var(--deep) 70%, transparent);
            z-index: 99;
        }

        #info {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 1em;
        }

        #version-wrapper {
            width: 100%;
            text-align: center;
            position: absolute;
            bottom: 0.2rem;
            font-size: 0.8rem;
            color: var(--shore)!important;
            i {
                background-color: color-mix(in srgb, var(--deep), transparent 50%);
                border-radius: 9999px;
                padding: 0.2em 0.5em;
            }
            z-index: 101;
        }
        </style>
    </head>
    <body>
        <div id="cover"></div>
        <div id="inner">
            <h1 id="errorTitle">Uh oh!</h1>
            <p>There was an error loading <b id="fetchedURL"></b></p>
            <!-- <p id="errorMessage">Internal Server Error</p> -->

            <div id="info">
                <textarea id="errorTrace" cols="40" rows="10" readonly>
                </textarea>
                <div id="troubleshooting">
                    <p>Try:</p>
                    <ul>
                        <li>Checking your internet connection</li>
                        <li>Verifying you entered the correct address</li>
                        <li>Clearing the site data</li>
                        <li>Contacting <b id="hostname"></b>'s administrator</li>
                        <li>Verify the server isn't censored</li>
                    </ul>
                    <p>If you're the administrator of <b id="hostname"></b>, try:</p>
                        <ul>
                        <li>Restarting your server</li>
                        <li>Updating Scramjet</li>
                        <li>Troubleshooting the error on the <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank">GitHub repository</a></li>
                    </ul>
                </div>
            </div>
            <br>
            <button id="reload" class="primary">Reload</button>
        </div>
        <p id="version-wrapper"><i>Scramjet v<span id="version"></span> (build <span id="build"></span>)</i></p>
        <script src="${"data:application/javascript," + encodeURIComponent(script)}"></script>
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
