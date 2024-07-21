import { client } from ".";

// goodybye spyware~
client.Proxy("navigator.sendBeacon", {
	apply(ctx) {
		ctx.return(null);
	},
});
