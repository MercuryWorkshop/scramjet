declare const dbg: {
	log: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
	error: (message: string, ...args: any[]) => void;
	debug: (message: string, ...args: any[]) => void;
};

declare const COMMITHASH: string;
declare const VERSION: string;

declare type Self = Window & typeof globalThis;
