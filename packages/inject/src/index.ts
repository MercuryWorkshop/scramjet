import chobitsu from "chobitsu";
import * as h2 from "html-to-image";
window.h2 = h2;
window.$sendToChobitsu = (message) => chobitsu.sendRawMessage(message);
chobitsu.setOnMessage(window.$onChobitsuMessage);
window.$onChobitsuInit();
