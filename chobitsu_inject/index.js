import chobitsu from "chobitsu";
window.$sendToChobitsu = (message) => chobitsu.sendRawMessage(message);
chobitsu.setOnMessage(window.$onChobitsuMessage);
