# Hosting Scramjet on Render for free

This guide walks you through deploying this repo to [Render](https://render.com)
on the **free** plan, end to end.

## What you're actually deploying

Scramjet isn't a database-backed CRUD app — it's a proxy, and it has two parts:

1. **A static frontend** — the demo in `packages/demo`. It's plain HTML/JS plus
   a service worker and a Rust-compiled-to-WASM URL rewriter. All the proxying
   logic runs *in the visitor's browser*.
2. **A Wisp server** — a small WebSocket backend. The browser can't open raw TCP
   sockets to other websites, so it tunnels them through Wisp. This is the only
   part that needs a running server.

The files in this repo set both up as **one Render web service** on a single
origin:

- `render-server.mjs` — serves the built demo *and* answers Wisp WebSocket
  connections at `/wisp/`.
- `render-build.sh` — installs the Rust/WASM toolchain, builds the rewriter,
  the bundles, and the static demo.
- `render.yaml` — a Render "Blueprint" so the whole thing deploys in one click.

Putting the frontend and Wisp on the same origin means the demo connects to
`wss://<your-app>.onrender.com/wisp/` with no CORS and no separate URL to
configure — the build bakes that address in automatically from Render's
`RENDER_EXTERNAL_HOSTNAME`.

## Prerequisites

- A GitHub account with **this repository pushed to your own fork/repo**
  (Render deploys from your GitHub, not from a local folder).
- A free [Render account](https://dashboard.render.com/register) — sign up with
  GitHub so it can see your repos.

## Option A — Blueprint deploy (recommended)

1. Make sure `render.yaml`, `render-build.sh`, and `render-server.mjs` are
   committed and pushed to your repo. Edit `render.yaml` and set `branch:` to
   the branch you want to deploy (it defaults to `main`).
2. In the Render dashboard: **New ➜ Blueprint**.
3. Pick your Scramjet repository. Render reads `render.yaml`, shows a service
   named `scramjet` on the **Free** plan, and asks you to **Apply**.
4. Click **Apply / Create**. The first build takes a while (see
   [Build time](#build-time-and-the-rust-toolchain) below) because it compiles
   the Rust rewriter to WebAssembly.
5. When the build finishes, open the URL Render gives you
   (`https://scramjet-xxxx.onrender.com`). The demo loads and is already pointed
   at its own `/wisp/` endpoint.

## Option B — Manual web service

If you'd rather not use the blueprint:

1. **New ➜ Web Service**, connect your repo, pick your branch.
2. Set:
   - **Runtime:** Node
   - **Build Command:** `bash render-build.sh`
   - **Start Command:** `node render-server.mjs`
   - **Instance Type:** Free
3. Under **Environment**, add:
   - `NODE_VERSION` = `22.22.2`
   - `PNPM_VERSION` = `10.12.1`
4. Create the service. Same first-build caveat applies.

`RENDER_EXTERNAL_HOSTNAME` is provided by Render automatically, so you don't
need to set the Wisp URL yourself.

## Build time and the Rust toolchain

The rewriter is compiled from Rust to WASM, so the build installs a Rust
nightly toolchain, `wasm-bindgen`, `wasm-opt`, and a `wasm-snip` fork, then
compiles. **Expect the first build to take roughly 10–20 minutes.** Subsequent
builds are faster where Render can reuse caches.

To keep builds inside a comfortable window, `render-build.sh` deliberately
**skips the aggressive `wasm-opt` release pass** (it does not set `RELEASE=1`).
The resulting `.wasm` is larger but behaves identically — perfectly fine for a
demo. If you want the smallest possible WASM and don't mind a much longer build,
edit `render-build.sh` and run the rewriter build with `RELEASE=1`.

## What "free" actually gets you

Render's free plan is real but has limits worth knowing up front:

- **Spin-down.** A free web service sleeps after ~15 minutes with no traffic.
  The next visitor triggers a cold start (roughly 30–60s) before the page — and
  the proxy — respond. There's no way around this on the free tier; upgrading to
  a paid instance keeps it always-on.
- **Monthly hours.** Free web services share a pool of 750 instance-hours/month,
  which is enough to run one service continuously.
- **Bandwidth.** Free includes 100 GB/month of egress. A proxy relays *all* the
  traffic of every site your users open, so heavy use can burn through this fast.

## Optional: custom domain

Free web services support custom domains. In the service's **Settings ➜ Custom
Domains**, add your domain and follow the DNS instructions. Because the Wisp URL
is derived from `RENDER_EXTERNAL_HOSTNAME` (the `onrender.com` host) at build
time, it keeps working on your custom domain too — the demo also lets you
override the Wisp URL from its in-app **Settings** page if you ever need to.

## Troubleshooting

- **Page loads but nothing proxies / "Wisp URL is required".** The demo needs
  `VITE_WISP_URL` baked in at build time. On Render this comes from
  `RENDER_EXTERNAL_HOSTNAME` automatically. If you build elsewhere, set
  `VITE_WISP_URL=wss://your-host/wisp/` before running the build.
- **Mixed-content errors in the console.** The Wisp URL must be `wss://` (secure)
  on an HTTPS site. The build produces `wss://` automatically; only manual
  overrides risk getting this wrong.
- **Build times out or runs out of memory.** The Rust build is the culprit.
  Confirm you're not passing `RELEASE=1`, and retry — toolchain downloads
  sometimes hiccup. If it keeps failing, the two-service split below moves the
  build off the critical path.
- **First request after idle is slow.** That's the free-tier cold start, not a
  bug. Keep-alive pingers exist but effectively defeat the point of the free
  tier's sleep.

## Alternative: two services (static site + Wisp)

The single-service setup here is the simplest. If you'd rather have a frontend
that never sleeps, you can instead split it:

- Host `packages/demo/dist` as a **Render Static Site** (free, on a CDN, no
  spin-down).
- Run the Wisp server as a separate free **Web Service**.

The trade-offs: the Wisp service still spins down (so the proxy still cold-starts
even if the page loads instantly), you'll deploy the Wisp service first to learn
its URL, then build the static site with `VITE_WISP_URL=wss://<wisp-host>/wisp/`,
and the two origins differ so the Wisp server must send permissive CORS. For most
people the single service in this guide is the better default.

## A note on acceptable use

Scramjet is designed to bypass network restrictions and relay arbitrary web
traffic. Make sure whatever you deploy complies with Render's
[Acceptable Use Policy](https://render.com/acceptable-use-policy) and any rules
that apply to you. You're responsible for how your instance is used.
