export function errorTemplate(trace: string, fetchedURL: string) {
	// turn script into a data URI so we don"t have to escape any HTML values
	const script = `
                errorTrace.value = ${JSON.stringify(trace)};
                fetchedURL.textContent = ${JSON.stringify(fetchedURL)};
                for (const node of document.querySelectorAll("#hostname")) node.textContent = ${JSON.stringify(location.hostname)};
                reload.addEventListener("click", () => location.reload());
                version.textContent = ${JSON.stringify(VERSION)};
                build.textContent = ${JSON.stringify(COMMITHASH)};
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

        body {
            --doomfire-mult: 1;
            --doomfire-pixel-size: 3;
            background-image: paint(doomfire);
            animation: mult 0.03s infinite;
        }

        @keyframes mult {
            0% {
                --doomfire-mult: 1.1;
            }
            50% {
                --doomfire-mult: 1.2;
            }
            100% {
                --doomfire-mult: 1.1;
            }
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
        <script>
        CSS.paintWorklet.addModule(\`data:application/javascript;charset=utf8,${encodeURIComponent(`
        const HTML_COLOR_SCALE = [
          '#080202', '#1f0707', '#2f0f07',
          '#470f07', '#571707', '#671f07',
          '#771f07', '#8f2707', '#9f2f07',
          '#af3f07', '#bf4707', '#c74707',
          '#DF4F07', '#DF5707', '#DF5707',
          '#D75F07', '#D7670F', '#cf6f0f',
          '#cf770f', '#cf7f0f', '#CF8717',
          '#C78717', '#C78F17', '#C7971F',
          '#BF9F1F', '#BF9F1F', '#BFA727',
          '#BFA727', '#BFAF2F', '#B7AF2F',
          '#B7B72F', '#B7B737', '#CFCF6F',
          '#DFDF9F', '#EFEFC7', '#FFFFFF',
        ];

        const PROPERTY_PIXEL_SIZE = '--doomfire-pixel-size';
        const PROPERTY_MULT = '--doomfire-mult';

        class DoomFire {
          static get inputProperties() {
            return [
              PROPERTY_PIXEL_SIZE,
              PROPERTY_MULT
            ];
          }

          paint(ctx, geom, properties) {
            const size = Math.max(parseInt(properties.get(PROPERTY_PIXEL_SIZE) * properties.get(PROPERTY_MULT)), 1);
            const num_rows = Math.trunc(geom.height / size);
            const num_cols = Math.trunc(geom.width / size);
            const num_pixels = num_rows * num_cols;
            let flames = [];

            for (let i = 0; i < num_pixels; i++) {
              flames[i] = 0;
            }

            ctx.fillStyle = HTML_COLOR_SCALE[HTML_COLOR_SCALE.length - 1];
            const bottom_row = (num_rows - 1) * num_cols;
            for (let x = 0; x < num_cols; x++) {
              flames[bottom_row + x] = HTML_COLOR_SCALE.length - 1;
              ctx.fillRect(x * size, bottom_row * size, size + 1, size + 1);
            }

            for (let y = num_rows - 2; y > 0; y--) {
              const row_start = y * num_cols;
              const previous_row_start = (y + 1) * num_cols;
              for (let x = 0; x < num_cols; x++) {
                const rand = Math.trunc(Math.random() * 3);
                const src_x = Math.min(Math.max(x + rand - 1, 0), num_cols - 1);
                const src_color = flames[previous_row_start + src_x];
                const dst_color = Math.max(src_color - (rand & 1), 0);
                flames[row_start + x] = dst_color;
                ctx.fillStyle = HTML_COLOR_SCALE[dst_color];
                ctx.fillRect(x * size, y * size, size + 1, size + 1);
              }
            }
          }
        }
        registerPaint('doomfire', DoomFire);
        console.log("done");
        `)}\`)
        </script>
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
