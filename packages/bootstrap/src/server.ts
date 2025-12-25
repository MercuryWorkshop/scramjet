import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import http from "http";
import { extract } from "tar";
import { Readable } from "stream";
import fs from "fs/promises";
import {
	defaultConfig,
	EPOXY_TRANSPORT_PACKAGE_NAME,
	EPOXY_TRANSPORT_PINNED_MAJOR_VERSION,
	LIBCURL_TRANSPORT_PACKAGE_NAME,
	LIBCURL_TRANSPORT_PINNED_MAJOR_VERSION,
	REGISTRY_URL,
	SCRAMJET_CONTROLLER_PACKAGE_NAME,
	SCRAMJET_CONTROLLER_PINNED_MAJOR_VERSION,
	SCRAMJET_PACKAGE_NAME,
	BootstrapOptions,
} from "./common";

type ServerBootstrapOptions = BootstrapOptions & {
	downloadedFilesDir: string;
};

let config: ServerBootstrapOptions;

async function sendFile(
	res: http.ServerResponse,
	filePath: string,
	contentType: string
) {
	const data = await fs.readFile(filePath);
	res.writeHead(200, { "Content-Type": contentType });
	res.end(data);
}
const clientdata = await fs.readFile(
	import.meta.dirname + "/bootstrap-client.js"
);
function routeRequest(
	req: http.IncomingMessage,
	res: http.ServerResponse
): boolean {
	if (!req.url) return false;

	if (req.url === config.swPath) {
		res.writeHead(200, { "Content-Type": "application/javascript" });
		res.end(`importScripts("${config.scramjetControllerSwPath}");
addEventListener("fetch", (e) => {
	if ($scramjetController.shouldRoute(e)) {
		e.respondWith($scramjetController.route(e));
	}
});
`);

		return true;
	} else if (req.url === config.bootstrapInitPath) {
		res.writeHead(200, { "Content-Type": "application/javascript" });
		res.end(`async function initBootstrap() {
	const { init } = await import("data:text/javascript;base64,${Buffer.from(clientdata).toString("base64")}");
	return init(${JSON.stringify({ config })});
}`);

		return true;
	}

	const pathsToFiles = {
		[config.scramjetControllerApiPath]:
			config.downloadedFilesDir + "controller/package/dist/controller.api.js",
		[config.scramjetControllerInjectPath]:
			config.downloadedFilesDir +
			"controller/package/dist/controller.inject.js",
		[config.scramjetControllerSwPath]:
			config.downloadedFilesDir + "controller/package/dist/controller.sw.js",
		[config.scramjetBundlePath]:
			config.downloadedFilesDir + "scramjet/package/dist/scramjet.js",
		[config.scramjetWasmPath]:
			config.downloadedFilesDir + "scramjet/package/dist/scramjet.wasm",

		[config.libcurlClientPath]:
			config.downloadedFilesDir + "libcurl-transport/package/dist/index.js",
	};
	if (req.url in pathsToFiles) {
		const filePath = pathsToFiles[req.url as keyof typeof pathsToFiles];
		const contentType = req.url.endsWith(".wasm")
			? "application/wasm"
			: "application/javascript";
		sendFile(res, filePath, contentType);
		return true;
	}

	return false;
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
		await fs.rm(packagedir, { recursive: true, force: true });
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
	const packagedir = `${config.downloadedFilesDir}controller`;
	console.log(packagedir);
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

export async function findLatestVersionOfPackage(
	packageName: string,
	majorVersion: string
): Promise<NodePackageMeta> {
	const packageRes = await fetch(`${REGISTRY_URL}${packageName}`);
	const packageMeta = await packageRes.json();
	const versions = Object.keys(packageMeta.versions).filter((v) =>
		v.startsWith(`${majorVersion}.`)
	);
	const sortedVersions = versions.sort((a, b) => {
		const aParts = a.split(".").map(Number);
		const bParts = b.split(".").map(Number);
		for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
			const aVal = aParts[i] || 0;
			const bVal = bParts[i] || 0;
			if (aVal !== bVal) return bVal - aVal;
		}
		return 0;
	});
	if (sortedVersions.length === 0) {
		throw new Error(
			`No versions found for package ${packageName} with major version ${majorVersion}`
		);
	}
	const latestVersion = sortedVersions[0];

	const latestRes = await fetch(
		`${REGISTRY_URL}${packageName}/${latestVersion}`
	);
	const latestMeta = await latestRes.json();
	return latestMeta;
}

type NodePackageMeta = {
	name: string;
	version: string;
	dist: {
		tarball: string;
	};
	dependencies: { [key: string]: string };
};

export async function bootstrap(
	cfg: Partial<ServerBootstrapOptions> = {}
): Promise<{
	routeRequest: typeof routeRequest;
	routeUpgrade: typeof routeUpgrade;
}> {
	config = {
		...defaultConfig,
		...cfg,
		downloadedFilesDir: import.meta.dirname + "/.downloads/",
	} as ServerBootstrapOptions;

	const downloadedControllerVersion = await getDownloadedControllerVersion();
	if (downloadedControllerVersion) {
		console.log(
			`Found downloaded Scramjet Controller version: ${downloadedControllerVersion}`
		);
	}

	if (config.transport === "epoxy") {
		const epoxyMeta = await findLatestVersionOfPackage(
			EPOXY_TRANSPORT_PACKAGE_NAME,
			EPOXY_TRANSPORT_PINNED_MAJOR_VERSION
		);
		await unpack(epoxyMeta.dist.tarball, "epoxy-transport");
		console.log(`Using Epoxy Transport version: ${epoxyMeta.version}`);
	} else if (config.transport === "libcurl") {
		const libcurlMeta = await findLatestVersionOfPackage(
			LIBCURL_TRANSPORT_PACKAGE_NAME,
			LIBCURL_TRANSPORT_PINNED_MAJOR_VERSION
		);
		await unpack(libcurlMeta.dist.tarball, "libcurl-transport");
		console.log(`Using libcurl Transport version: ${libcurlMeta.version}`);
	} else {
		throw new Error(`Unknown transport option: ${config.transport}`);
	}

	const controllerMeta = await findLatestVersionOfPackage(
		SCRAMJET_CONTROLLER_PACKAGE_NAME,
		SCRAMJET_CONTROLLER_PINNED_MAJOR_VERSION
	);

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
