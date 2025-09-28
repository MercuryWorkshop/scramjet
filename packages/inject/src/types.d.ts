export type FrameboundMethods = {
	[K in keyof Framebound]: (arg: Framebound[K][0]) => Promise<Framebound[K][1]>;
};

export type Chromebound = {
	contextmenu: [
		{
			x: number;
			y: number;
		},
	];
	titlechange: [
		{
			title?: string;
			icon?: string;
		},
	];
};

export type Framebound = {
	navigate: [
		{
			url: string;
		},
		string,
	];
};
