import { ScramjetClient } from "../client";

export default function (client: ScramjetClient, self: Self) {
	//@ts-expect-error chrome only untyped api
	delete self.Navigator.prototype.joinAdInterestGroup;
}
