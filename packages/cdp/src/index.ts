import 'core-js/stable/object/assign'
import 'core-js/stable/promise'
import 'core-js/modules/es.map'
import Chobitsu from './Chobitsu'
import noop from 'licia/noop'
import * as Runtime from './domains/Runtime'
import * as Page from './domains/Page'
import * as DOM from './domains/DOM'
import * as CSS from './domains/CSS'
import * as DOMStorage from './domains/DOMStorage'
import * as Network from './domains/Network'
import * as Overlay from './domains/Overlay'
import * as DOMDebugger from './domains/DOMDebugger'
import * as Debugger from './domains/Debugger'
import * as Storage from './domains/Storage'
import * as CacheStorage from './domains/CacheStorage'
import * as IndexedDB from './domains/IndexedDB'
import * as Input from './domains/Input'

const chobitsu = new Chobitsu()
chobitsu.register('Network', {
  ...Network,
  setAttachDebugStack: noop,
  clearAcceptedEncodingsOverride: noop,
})
chobitsu.register('Page', {
  ...Page,
  getManifestIcons: noop,
  bringToFront: noop,
  getInstallabilityErrors: noop,
  setAdBlockingEnabled: noop,
  getAppId: noop,
})
chobitsu.register('Runtime', {
  ...Runtime,
  getExceptionDetails: noop,
  compileScript: noop,
  discardConsoleEntries: noop,
  getHeapUsage: noop,
  getIsolateId: noop,
  releaseObject: noop,
  releaseObjectGroup: noop,
  runIfWaitingForDebugger: noop,
})
chobitsu.register('DOM', {
  ...DOM,
  pushNodeByPathToFrontend: noop,
  getNodeId: DOM.getDOMNodeId,
  getNode: DOM.getDOMNode,
  markUndoableState: noop,
  undo: noop,
  getBoxModel: noop,
})
chobitsu.register('CSS', {
  ...CSS,
  getPlatformFontsForNode: noop,
  trackComputedStyleUpdates: noop,
  takeComputedStyleUpdates: noop,
})
chobitsu.register('Debugger', {
  ...Debugger,
  getPossibleBreakpoints: noop,
  setBreakpointByUrl: noop,
  setBreakpointsActive: noop,
  setAsyncCallStackDepth: noop,
  setBlackboxPatterns: noop,
  setPauseOnExceptions: noop,
})
chobitsu.register('Overlay', {
  ...Overlay,
  setPausedInDebuggerMessage: noop,
  highlightFrame: noop,
  setShowGridOverlays: noop,
  setShowFlexOverlays: noop,
  setShowScrollSnapOverlays: noop,
  setShowContainerQueryOverlays: noop,
  setShowIsolatedElements: noop,
})
chobitsu.register('Profiler', {
  enable: noop,
})
chobitsu.register('Log', {
  clear: noop,
  enable: noop,
  startViolationsReport: noop,
})
chobitsu.register('Emulation', {
  setEmulatedMedia: noop,
  setAutoDarkModeOverride: noop,
  setEmulatedVisionDeficiency: noop,
  setFocusEmulationEnabled: noop,
  setTouchEmulationEnabled: noop,
  setEmitTouchEventsForMouse: noop,
})
chobitsu.register('Audits', {
  enable: noop,
})
chobitsu.register('ServiceWorker', {
  enable: noop,
})
chobitsu.register('Inspector', {
  enable: noop,
})
chobitsu.register('Target', {
  setAutoAttach: noop,
  setDiscoverTargets: noop,
  setRemoteLocations: noop,
})
chobitsu.register('DOMDebugger', {
  ...DOMDebugger,
  setBreakOnCSPViolation: noop,
})
chobitsu.register('Database', {
  enable: noop,
})
chobitsu.register('CacheStorage', {
  ...CacheStorage,
})
chobitsu.register('Storage', {
  ...Storage,
  setInterestGroupTracking: noop,
  setSharedStorageTracking: noop,
  trackIndexedDBForStorageKey: noop,
  untrackCacheStorageForOrigin: noop,
  untrackIndexedDBForOrigin: noop,
  trackCacheStorageForOrigin: noop,
  trackIndexedDBForOrigin: noop,
})
chobitsu.register('DOMStorage', {
  ...DOMStorage,
})
chobitsu.register('IndexedDB', {
  enable: noop,
  ...IndexedDB,
})
chobitsu.register('ApplicationCache', {
  enable: noop,
  getFramesWithManifests: noop,
})
chobitsu.register('BackgroundService', {
  startObserving: noop,
})
chobitsu.register('HeapProfiler', {
  enable: noop,
})
chobitsu.register('Input', {
  ...Input,
})
chobitsu.register('Autofill', {
  enable: noop,
})

export default chobitsu
