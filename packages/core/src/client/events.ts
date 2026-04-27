export type LifecycleHooks = {
	navigate: {
		context: {
			type: "location" | "history" | "hashchange";
		};
		props: {
			url: string;
		};
	};
};
