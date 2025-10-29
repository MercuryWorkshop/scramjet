import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import http from "http";
import { extract } from "tar";
import { Readable } from "stream";
import fs from "fs/promises";

const REGISTRY_URL = "https://registry.npmjs.org/";
const SCRAMJET_PACKAGE_NAME = "@mercuryworkshop/scramjet";
const SCRAMJET_CONTROLLER_PACKAGE_NAME = "@mercuryworkshop/scramjet-controller";

export type TransportOptions = "epoxy" | "libcurl" | "bare";

export type ScramjetBootstrapOptions = {
	transport: TransportOptions;
	swPath: string;

	wispPath: string;

	scramjetBundlePath: string;
	scramjetWasmPath: string;

	epoxyClientPath: string;
	libcurlClientPath: string;
	bareClientPath: string;

	scramjetVersionPin: string;
	scramjetControllerVersionPin: string;

	downloadedFilesDir: string;
};

const defaultConfig: Partial<ScramjetBootstrapOptions> = {
	transport: "libcurl",
	swPath: "/bootstrap-sw.js",
	wispPath: "/wisp/",

	epoxyClientPath: "/clients/epoxy-client.js",
	libcurlClientPath: "/clients/libcurl-client.js",
	bareClientPath: "/clients/bare-client.js",

	scramjetBundlePath: "/scram/scramjet.js",
	scramjetWasmPath: "/scram/scramjet.wasm",

	downloadedFilesDir: import.meta.dirname + "/.downloads/",
};

let config: ScramjetBootstrapOptions;

function routeRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse
): boolean {
	if (!req.url) return false;

	if (req.url === config.swPath) {
		res.writeHead(200, { "Content-Type": "application/javascript" });
	}

	return true;
}

function routeUpgrade(
	req: http.IncomingMessage,
	socket: any,
	head: Buffer
): boolean {
	if (!req.url) return false;
	if (!req.url.startsWith("/wisp/")) return false;

	wisp.routeRequest(req, socket, head);
	return true;
}

export async function unpack(tarball: string, name: string) {
	if (!name) throw new Error("no package name!");
	const response = await fetch(tarball);
	if (!response.ok) {
		throw new Error(`Failed to download tarball: ${response.statusText}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	await fs.mkdir(config.downloadedFilesDir, { recursive: true });
	const file = `${config.downloadedFilesDir}${name}.tgz`;
	await fs.writeFile(file, buffer);

	const packagedir = `${config.downloadedFilesDir}/${name}`;

	if (await fs.stat(packagedir).catch(() => false)) {
		await fs.rmdir(packagedir, { recursive: true });
	}
	await fs.mkdir(packagedir, { recursive: true });

	try {
		await extract({
			f: file,
			cwd: packagedir,
		});
		await fs.unlink(file);
	} catch (err) {
		console.error("Error extracting tarball:", err);
		await fs.unlink(file);
		throw err;
	}
}

async function getDownloadedControllerVersion(): Promise<string | null> {
	const packagedir = `${config.downloadedFilesDir}/controller`;
	try {
		const pkgJson = JSON.parse(
			(await fs.readFile(
				`${packagedir}/package/package.json`,
				"utf-8"
			)) as unknown as string
		);
		return pkgJson.version;
	} catch {
		return null;
	}
}

async function updateScramjet(controllerMeta: any) {
	const scramjetVersion =
		controllerMeta.dependencies["@mercuryworkshop/scramjet"];

	const scramjetRes = await fetch(
		`${REGISTRY_URL}${SCRAMJET_PACKAGE_NAME}/${scramjetVersion}`
	);
	const scramjetMeta = await scramjetRes.json();

	await unpack(scramjetMeta.dist.tarball, "scramjet");
	await unpack(controllerMeta.dist.tarball, "controller");
}

export async function bootstrap(
	cfg: Partial<ScramjetBootstrapOptions> = {}
): Promise<{
	routeRequest: typeof routeRequest;
	routeUpgrade: typeof routeUpgrade;
}> {
	config = { ...defaultConfig, ...cfg } as ScramjetBootstrapOptions;

	const downloadedControllerVersion = await getDownloadedControllerVersion();
	if (downloadedControllerVersion) {
		console.log(
			`Found downloaded Scramjet Controller version: ${downloadedControllerVersion}`
		);
	}

	const controllerRes = await fetch(
		`${REGISTRY_URL}${SCRAMJET_CONTROLLER_PACKAGE_NAME}/0.0.2`
	);
	const controllerMeta = await controllerRes.json();

	if (downloadedControllerVersion === controllerMeta.version) {
		console.log(
			`Scramjet Controller is up to date (version: ${downloadedControllerVersion}), skipping download.`
		);
	} else {
		await updateScramjet(controllerMeta);
		console.log(
			`Downloaded Scramjet Controller version: ${controllerMeta.version}`
		);
	}

	return {
		routeRequest,
		routeUpgrade,
	};
}
