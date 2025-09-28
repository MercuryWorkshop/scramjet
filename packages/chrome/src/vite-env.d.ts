/// <reference types="vite/client" />
/// <reference types="@mercuryworkshop/scramjet" />

interface ImportMetaEnv {
	readonly VITE_LOCAL: boolean;
	readonly VITE_ISOLATION_ORIGIN: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare const puter: any;
