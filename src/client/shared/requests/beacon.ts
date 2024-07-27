export default function (client, self) {
	// goodybye spyware~
	client.Proxy("navigator.sendBeacon", {
		apply(ctx) {
			ctx.return(null);
		},
	});
}
