import { encodeUrl, decodeUrl } from "./shared/rewriters/url"
import { rewriteCss } from "./shared/rewriters/css"
import { rewriteHtml, rewriteSrcset } from "./shared/rewriters/html"
import { rewriteJs } from "./shared/rewriters/js"
import { rewriteHeaders } from "./shared/rewriters/headers"
import { rewriteWorkers } from "./shared/rewriters/worker"
import { isScramjetFile } from "./shared/rewriters/html"
import type { Codec } from "./codecs"
import { BareClient } from "@mercuryworkshop/bare-mux"

declare global {
	interface Window {
		$scramjet: {
			shared: {
				url: {
					encodeUrl: typeof encodeUrl
					decodeUrl: typeof decodeUrl
				}
				rewrite: {
					rewriteCss: typeof rewriteCss
					rewriteHtml: typeof rewriteHtml
					rewriteSrcset: typeof rewriteSrcset
					rewriteJs: typeof rewriteJs
					rewriteHeaders: typeof rewriteHeaders
					rewriteWorkers: typeof rewriteWorkers
				}
				util: {
					BareClient: typeof BareClient
					isScramjetFile: typeof isScramjetFile
				}
			}
			config: {
				prefix: string
				codec: Codec
				config: string
				shared: string
				worker: string
				client: string
				codecs: string
			}
			codecs: {
				none: Codec
				plain: Codec
				base64: Codec
				xor: Codec
			}
		}
	}
}
