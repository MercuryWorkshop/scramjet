/// <reference types="vite/client" />
/// <reference types="@mercuryworkshop/scramjet" />

interface ImportMetaEnv {
	readonly LOCAL: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
