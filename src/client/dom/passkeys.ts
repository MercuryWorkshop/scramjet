import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: Self) {
	delete self.CredentialsContainer;
	delete self.AuthenticatorAssertionResponse;
	delete self.AuthenticatorAttestationResponse;
	delete self.AuthenticatorResponse;
	delete self.PublicKeyCredential;
	Reflect.deleteProperty(Navigator.prototype, "credentials");
}
