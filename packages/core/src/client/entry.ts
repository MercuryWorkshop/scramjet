// entrypoint for scramjet.client.js

// these run once, when the client bundle loads and before any page code, to
// ask which kind of global this is - there is no wrapper to go through yet
/* eslint-disable scramjet-core/no-globals, scramjet-core/no-instanceof */
export const iswindow = "window" in globalThis && window instanceof Window;
export const isworker = "WorkerGlobalScope" in globalThis;
export const issw = "ServiceWorkerGlobalScope" in globalThis;
export const isdedicated = "DedicatedWorkerGlobalScope" in globalThis;
export const isshared = "SharedWorkerGlobalScope" in globalThis;
