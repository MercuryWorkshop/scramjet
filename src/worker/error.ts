export function errorTemplate(trace: string, fetchedURL: string) {
    // turn script into a data URI so we don"t have to escape any HTML values
    const script = `
    errorTrace.value = ${JSON.stringify(trace)};
    fetchedURL.textContent = ${JSON.stringify(fetchedURL)};
    for (const node of document.querySelectorAll("#hostname")) node.textContent = ${JSON.stringify(location.hostname)};
    reload.addEventListener("click", () => location.reload());
    version.textContent = ${JSON.stringify(globalThis.$scramjetVersion?.version || "unknown")};
    build.textContent = ${JSON.stringify(globalThis.$scramjetVersion?.build || "unknown")};
    document.getElementById('copy-button').addEventListener('click', async () => {
        const text = document.getElementById('errorTrace').value;
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('copy-button');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
    });
`;
    return `<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scramjet - Error</title>
        <style>
        :root {
            --bg-primary: #0a0a0a;
            --bg-secondary: #141414;
            --bg-tertiary: #1e1e1e;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
            --text-tertiary: #707070;
            --border-color: #2a2a2a;
            --accent: #ffffff;
            --accent-hover: #e0e0e0;
            --error: #ff4444;
            --font-sans: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --font-mono: ui-monospace, "SF Mono", "Cascadia Code", "Source Code Pro", Menlo, Consolas, "Liberation Mono", monospace;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        body {
            background: linear-gradient(135deg, var(--bg-primary) 0%, #0d0d0d 100%);
            color: var(--text-primary);
            font-family: var(--font-sans);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            line-height: 1.6;
        }
        /* 背景装饰网格 */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                linear-gradient(var(--border-color) 1px, transparent 1px),
                linear-gradient(90deg, var(--border-color) 1px, transparent 1px);
            background-size: 50px 50px;
            opacity: 0.1;
            z-index: 0;
        }
        #container {
            position: relative;
            z-index: 10;
            width: 90%;
            max-width: 900px;
            max-height: 90vh;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
            animation: slideUp 0.4s ease-out;
        }
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        /* 头部区域 */
        #header {
            padding: 2rem 2.5rem;
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-tertiary);
        }
        #errorTitle {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        #errorTitle::before {
            content: '⚠';
            font-size: 2rem;
            color: var(--error);
        }
        #errorDescription {
            color: var(--text-secondary);
            font-size: 1rem;
        }
        #fetchedURL {
            color: var(--accent);
            font-weight: 600;
            word-break: break-all;
        }
        /* 主内容区域 */
        #content {
            padding: 2rem 2.5rem;
            overflow-y: auto;
            max-height: calc(90vh - 240px);
        }
        #content::-webkit-scrollbar {
            width: 8px;
        }
        #content::-webkit-scrollbar-track {
            background: var(--bg-secondary);
        }
        #content::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 4px;
        }
        #content::-webkit-scrollbar-thumb:hover {
            background: var(--text-tertiary);
        }
        /* 错误堆栈区域 */
        #errorTrace-wrapper {
            position: relative;
            margin-bottom: 2rem;
        }
        #errorTrace-label {
            display: block;
            color: var(--text-secondary);
            font-size: 0.875rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        #errorTrace {
            width: 100%;
            min-height: 150px;
            max-height: 200px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1rem;
            color: var(--text-primary);
            font-family: var(--font-mono);
            font-size: 0.813rem;
            line-height: 1.5;
            resize: vertical;
            outline: none;
            transition: border-color 0.2s;
        }
        #errorTrace:focus {
            border-color: var(--accent);
        }
        #copy-button {
            position: absolute;
            top: 2rem;
            right: 0.5rem;
            background: var(--accent);
            color: var(--bg-primary);
            border: none;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            opacity: 0;
            pointer-events: none;
        }
        #errorTrace-wrapper:hover #copy-button {
            opacity: 1;
            pointer-events: all;
        }
        #copy-button:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }
        #copy-button:active {
            transform: translateY(0);
        }
        /* 故障排除区域 */
        .troubleshooting-section {
            margin-bottom: 2rem;
        }
        .troubleshooting-section h3 {
            color: var(--text-primary);
            font-size: 1rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .troubleshooting-section h3::before {
            content: '▸';
            color: var(--accent);
        }
        ul {
            list-style: none;
            padding-left: 1.5rem;
        }
        li {
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            position: relative;
            padding-left: 1.25rem;
            font-size: 0.938rem;
        }
        li::before {
            content: '•';
            position: absolute;
            left: 0;
            color: var(--text-tertiary);
        }
        li b,
        #hostname {
            color: var(--accent);
            font-weight: 600;
        }
        a {
            color: var(--accent);
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s;
        }
        a:hover {
            border-bottom-color: var(--accent);
        }
        /* 按钮区域 */
        #actions {
            padding: 1.5rem 2.5rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: center;
            background: var(--bg-tertiary);
        }
        #reload {
            background: var(--accent);
            color: var(--bg-primary);
            border: none;
            border-radius: 8px;
            padding: 0.75rem 2rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
        }
        #reload:hover {
            background: var(--accent-hover);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 255, 255, 0.15);
        }
        #reload:active {
            transform: translateY(0);
        }
        /* 版本信息 */
        #version-wrapper {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            color: var(--text-tertiary);
            font-size: 0.75rem;
            font-family: var(--font-mono);
            z-index: 100;
            background: var(--bg-tertiary);
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            border: 1px solid var(--border-color);
        }
        /* 响应式设计 */
        @media (max-width: 768px) {
            #container {
                width: 95%;
                max-height: 95vh;
                border-radius: 12px;
            }
            #header,
            #content,
            #actions {
                padding: 1.5rem;
            }
            #errorTitle {
                font-size: 1.5rem;
            }
            #errorTrace {
                font-size: 0.75rem;
                min-height: 120px;
            }
            #copy-button {
                position: static;
                opacity: 1;
                pointer-events: all;
                width: 100%;
                margin-top: 0.5rem;
            }
            #version-wrapper {
                bottom: 0.5rem;
                right: 0.5rem;
                font-size: 0.688rem;
            }
        }
        </style>
    </head>
    <body>
        <div id="container">
            <div id="header">
                <h1 id="errorTitle">Error Occurred</h1>
                <p id="errorDescription">Failed to load <span id="fetchedURL"></span></p>
            </div>
            <div id="content">
                <div id="errorTrace-wrapper">
                    <label id="errorTrace-label">Error Details</label>
                    <textarea id="errorTrace" readonly></textarea>
                    <button id="copy-button">Copy</button>
                </div>
                <div class="troubleshooting-section">
                    <h3>Quick Fixes</h3>
                    <ul>
                        <li>Check your internet connection</li>
                        <li>Verify the URL is correct</li>
                        <li>Clear site data and cache</li>
                        <li>Contact <b id="hostname"></b>'s administrator</li>
                        <li>Check if the server is censored or blocked</li>
                    </ul>
                </div>
                <div class="troubleshooting-section">
                    <h3>For Administrators of <b id="hostname"></b></h3>
                    <ul>
                        <li>Restart your server</li>
                        <li>Update Scramjet to the latest version</li>
                        <li>Check server logs for detailed errors</li>
                        <li>Report issues on the <a href="https://github.com/MercuryWorkshop/scramjet" target="_blank">GitHub repository</a></li>
                    </ul>
                </div>
            </div>
            <div id="actions">
                <button id="reload">Reload Page</button>
            </div>
        </div>
        <div id="version-wrapper">
            Scramjet v<span id="version"></span> (build <span id="build"></span>)
        </div>
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
