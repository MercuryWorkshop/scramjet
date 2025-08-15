/// <reference types="vite/client" />
/// <reference types="@mercuryworkshop/scramjet" />

interface ImportMetaEnv {
	readonly VITE_LOCAL: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
