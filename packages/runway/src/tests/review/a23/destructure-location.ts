// rv23: `{location: alias}` destructuring patterns (Transcend airgap.js consent manager on notion.com)
import { htmlTest } from "../../../testcommon.ts";

const cases: Record<string, string> = {
	// the airgap.js shape: var-declared object pattern with a `location:` key, then a later object pattern
	"var-key-alias": `var S=self,{parent:a,location:b,navigator:c}=S,{childNodes:d}=document;window.__r=[typeof b.href];`,
	"var-single": `var {location:b}=self; window.__r=[typeof b.href];`,
	"var-two-decls": `var a=1,{location:b}=self; window.__r=[typeof b.href];`,
	"var-in-function": `(function(){var {location:b}=self; window.__r=[typeof b.href];})();`,
	"let-key-alias": `let {location:b}=self; window.__r=[typeof b.href];`,
	"const-key-alias-strict": `"use strict"; const {location:b, top:t}=self; window.__r=[typeof b.href];`,
	"param-key-alias": `(function({location:b}){window.__r=[typeof b.href]})(self);`,
};

export default Object.entries(cases).map(([k, code]) =>
	htmlTest({
		name: `rv23-destructure-location-${k}`,
		html: `<script>window.onerror=(m)=>{fail("${k}: "+m)};</script><script>${code}</script><script>
			if (window.__r) pass(); else fail("script did not run");
		</script>`,
	})
);
