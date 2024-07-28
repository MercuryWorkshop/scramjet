declare const dbg: {
	log: (message: string, ...args: any[]) => void;
	warn: (message: string, ...args: any[]) => void;
	error: (message: string, ...args: any[]) => void;
	debug: (message: string, ...args: any[]) => void;
};

declare type Self = Window & typeof globalThis;
