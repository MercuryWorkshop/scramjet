/// <reference types="@rspack/core/module" />

declare const dbg: {
	log: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
	error: (message: string, ...args: any[]) => void;
	debug: (message: string, ...args: any[]) => void;
	time: (meta: URLMeta, before: number, type: string) => void;
};

declare const COMMITHASH: string;
declare const VERSION: string;

declare type Self = Window & typeof globalThis;
