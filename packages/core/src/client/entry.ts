// entrypoint for scramjet.client.js

import { AkContext, AkInterface } from "@/shared/index";
import { AKCLIENT } from "@/symbols";
import { AkClient } from "@client/index";
import { AkConfig } from "@/types";

export const iswindow = "window" in globalThis && window instanceof Window;
export const isworker = "WorkerGlobalScope" in globalThis;
export const issw = "ServiceWorkerGlobalScope" in globalThis;
export const isdedicated = "DedicatedWorkerGlobalScope" in globalThis;
export const isshared = "SharedWorkerGlobalScope" in globalThis;
