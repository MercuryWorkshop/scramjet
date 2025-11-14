// entrypoint for scramjet.client.js

import { ScramjetContext, ScramjetInterface } from "@/shared/index";
import { SCRAMJETCLIENT } from "@/symbols";
import { ScramjetClient } from "@client/index";
import { ScramjetContextEvent, UrlChangeEvent } from "@client/events";
import { ScramjetConfig } from "@/types";
import { BareTransport } from "@mercuryworkshop/bare-mux-custom";

export const iswindow = "window" in globalThis && window instanceof Window;
export const isworker = "WorkerGlobalScope" in globalThis;
export const issw = "ServiceWorkerGlobalScope" in globalThis;
export const isdedicated = "DedicatedWorkerGlobalScope" in globalThis;
export const isshared = "SharedWorkerGlobalScope" in globalThis;
