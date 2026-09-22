import { ScramjetClient } from "@client/index";
import { Arguments, Returns } from "@client/webidl";

export default function (client: ScramjetClient) {
	client.Intercept(class extends Navigator {
		@Arguments("USVString", "optional BodyInit?")
		@Returns("boolean")
		sendBeacon(url: string, data?: BodyInit | null): boolean {
			return super.sendBeacon(client.rewriteUrl(url), data);
		}

		// protocol handlers will not work out of the box since there's no guarantee the service worker will be set up
		// or any other expectations that the user agent might need
		// sites can set this up themselves if they want to
		@Arguments("DOMString", "USVString")
		@Returns("undefined")
		registerProtocolHandler(_scheme: string, _url: string): void {
			// a body that does nothing still owes a bad receiver the native's
			// "Illegal invocation": `Navigator.prototype
			// .registerProtocolHandler.call({}, "web+x", "/?=%s")` is a
			// TypeError, not a silent no-op. Any attribute read brand-checks
			void super.userAgent;
		}

		@Arguments("DOMString", "USVString")
		@Returns("undefined")
		unregisterProtocolHandler(_scheme: string, _url: string): void {
			void super.userAgent;
		}
	});
}
