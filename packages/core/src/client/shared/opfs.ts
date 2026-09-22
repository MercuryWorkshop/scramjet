import { ScramjetClient } from "@client/index";
import { encodeURIComponent } from "@/shared/snapshot";
import { Arguments, Returns, Type } from "@client/webidl";

export const enabled = (client: ScramjetClient, self: Self) =>
	"StorageManager" in self && "FileSystemHandle" in self;

export default function (client: ScramjetClient) {
	const scopeName = () => encodeURIComponent(client.scopeOrigin);

	client.Intercept(class extends StorageManager {
		@Arguments()
		@Returns("Promise<FileSystemDirectoryHandle>")
		async getDirectory(): Promise<FileSystemDirectoryHandle> {
			const root = await super.getDirectory();
			// through the native rather than off the handle. `FileSystemDirectory
			// Handle.prototype.getDirectoryHandle` is page-writable, and it is
			// the only thing between the page and the *unscoped* root it was
			// just handed: replacing it with `function () { return this; }` made
			// `getDirectory()` resolve to the real origin root, and from there
			// every other proxied site's tree is a `for await` away
			const directory = await new client.native.FileSystemDirectoryHandle(
				root
			).getDirectoryHandle(scopeName(), { create: true });
			client.box.scopedOpfsRoots.add(directory);

			return directory;
		}
	});

	client.Intercept(class extends FileSystemHandle {
		@Type("USVString")
		// eslint-disable-next-line scramjet-core/intercept-brand-check -- membership is itself the brand check: impossible to forge
		get name(): string {
			// the scoped directory stands in for the origin's root, and a root's
			// name is the empty string.
			if (client.box.scopedOpfsRoots.has(this)) return "";

			return super.name;
		}
	});
}
