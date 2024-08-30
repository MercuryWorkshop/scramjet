export const nativeFunction = self.Function;
export const nativeGetOwnPropertyDescriptor =
	self.Object.getOwnPropertyDescriptor;

// descriptors
export const nativeDefaultViewGetter = nativeGetOwnPropertyDescriptor(
	Document.prototype,
	"defaultView"
)!.get!;
export const nativeContentDocumentGetter = nativeGetOwnPropertyDescriptor(
	HTMLIFrameElement.prototype,
	"contentDocument"
)!.get!;
export const nativeContentWindowGetter = nativeGetOwnPropertyDescriptor(
	HTMLIFrameElement.prototype,
	"contentWindow"
)!.get!;
