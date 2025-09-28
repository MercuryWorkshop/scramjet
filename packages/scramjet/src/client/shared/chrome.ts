// delete all chrome specific apis, or apis that are not supported by any browser other than chrome
// these are not worth emulating and typically cause issues

import { isemulatedsw, iswindow } from "@client/entry";
import { ScramjetClient } from "@client/index";

// type self as any here, most of these are not defined in the types
export default function (client: ScramjetClient, self: any) {
	const del = (name: string) => {
		const split = name.split(".");
		const prop = split.pop();
		const target = split.reduce((a, b) => a?.[b], self);
		if (!target) return;
		if (prop && prop in target) {
			delete target[prop];
		} else {
		}
	};

	// obviously
	// del("chrome");

	// ShapeDetector https://developer.chrome.com/docs/capabilities/shape-detection
	del("BarcodeDetector");
	del("FaceDetector");
	del("TextDetector");

	// background synchronization api
	if (iswindow) {
		del("ServiceWorkerRegistration.prototype.sync");
	}
	if (isemulatedsw) {
		del("SyncManager");
		del("SyncEvent");
	}

	// trustedtypes
	del("TrustedHTML");
	del("TrustedScript");
	del("TrustedScriptURL");
	del("TrustedTypePolicy");
	del("TrustedTypePolicyFactory");
	self.__defineGetter__("trustedTypes", () => undefined);

	// whatever this is
	del("Navigator.prototype.joinAdInterestGroup");

	if (!iswindow) return;
	// DOM specific ones below here

	del("MediaDevices.prototype.setCaptureHandleConfig");

	// web bluetooth api
	del("Navigator.prototype.bluetooth");
	del("Bluetooth");
	del("BluetoothDevice");
	del("BluetoothRemoteGATTServer");
	del("BluetoothRemoteGATTCharacteristic");
	del("BluetoothRemoteGATTDescriptor");
	del("BluetoothUUID");

	// contact picker api
	del("Navigator.prototype.contacts");
	del("ContactAddress");
	del("ContactManager");

	// Idle Detection API
	del("IdleDetector");

	// Presentation API
	del("Navigator.prototype.presentation");
	del("Presentation");
	del("PresentationConnection");
	del("PresentationReceiver");
	del("PresentationRequest");
	del("PresentationAvailability");
	del("PresentationConnectionAvailableEvent");
	del("PresentationConnectionCloseEvent");
	del("PresentationConnectionList");

	// Window Controls Overlay API
	del("WindowControlsOverlay");
	del("WindowControlsOverlayGeometryChangeEvent");
	del("Navigator.prototype.windowControlsOverlay");

	// WebHID API
	del("Navigator.prototype.hid");
	del("HID");
	del("HIDDevice");
	del("HIDConnectionEvent");
	del("HIDInputReportEvent");

	// Navigation API (not chrome only but it's really annoying to implement)
	del("navigation");
	del("NavigateEvent");
	del("NavigationActivation");
	del("NavigationCurrentEntryChangeEvent");
	del("NavigationDestination");
	del("NavigationHistoryEntry");
	del("NavigationTransition");
}
