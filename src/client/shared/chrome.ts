// delete all chrome specific apis, or apis that are not supported by any browser other than chrome
// these are not worth emulating and typically cause issues

import { isemulatedsw } from "@client/entry";
import { ScramjetClient } from "@client/index";

// type self as any here, most of these are not defined in the types
export default function (client: ScramjetClient, self: any) {
	// obviously
	delete self.chrome;

	// ShapeDetector https://developer.chrome.com/docs/capabilities/shape-detection
	delete self.BarcodeDetector;
	delete self.FaceDetector;
	delete self.TextDetector;

	// background synchronization api
	if (window) {
		delete self.ServiceWorkerRegistration.prototype.sync;
	}
	if (isemulatedsw) {
		delete self.SyncManager;
		delete self.SyncEvent;
	}

	// trustedtypes
	delete self.TrustedHTML;
	delete self.TrustedScript;
	delete self.TrustedScriptURL;
	delete self.TrustedTypePolicy;
	delete self.TrustedTypePolicyFactory;
	self.__defineGetter__("trustedTypes", () => undefined);

	// whatever this is
	delete self.Navigator.prototype.joinAdInterestGroup;

	if (!window) return;
	// DOM specific ones below here

	delete self.MediaDevices.prototype.setCaptureHandleConfig;

	// web bluetooth api
	delete self.Navigator.prototype.bluetooth;
	delete self.Bluetooth;
	delete self.BluetoothDevice;
	delete self.BluetoothRemoteGATTServer;
	delete self.BluetoothRemoteGATTCharacteristic;
	delete self.BluetoothRemoteGATTDescriptor;
	delete self.BluetoothUUID;

	// contact picker api
	delete self.Navigator.prototype.contacts;
	delete self.ContactAddress;
	delete self.ContactManager;

	// Idle Detection API
	delete self.IdleDetector;

	// Presentation API
	delete self.Navigator.prototype.presentation;
	delete self.Presentation;
	delete self.PresentationConnection;
	delete self.PresentationReceiver;
	delete self.PresentationRequest;
	delete self.PresentationAvailability;
	delete self.PresentationConnectionAvailableEvent;
	delete self.PresentationConnectionCloseEvent;
	delete self.PresentationConnectionList;

	// Window Controls Overlay API
	delete self.WindowControlsOverlay;
	delete self.WindowControlsOverlayGeometryChangeEvent;
	delete self.Navigator.prototype.windowControlsOverlay;

	// WebHID API
	delete self.Navigator.prototype.hid;
	delete self.HID;
	delete self.HIDDevice;
	delete self.HIDConnectionEvent;
	delete self.HIDInputReportEvent;

	// Navigation API (not chrome only but it's really annoying to implement)
	delete self.navigation;
	delete self.NavigateEvent;
	delete self.NavigationActivation;
	delete self.NavigationCurrentEntryChangeEvent;
	delete self.NavigationDestination;
	delete self.NavigationHistoryEntry;
	delete self.NavigationTransition;
}
