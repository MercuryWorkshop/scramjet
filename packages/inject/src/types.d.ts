export type FrameboundMethods = {
	[K in keyof Framebound]: (arg: Framebound[K][0]) => Promise<Framebound[K][1]>;
};

export type Chromebound = {
	contextmenu: [
		{
			x: number;
			y: number;
			selection?: string;
			image?: {
				src: string;
				width: number;
				height: number;
			};
			anchor?: {
				href: string;
			};
			video?: {
				src: string;
				width: number;
				height: number;
			};
		},
	];
	titlechange: [
		{
			title?: string;
			icon?: string;
		},
	];
	load: [
		{
			url: string;
		},
	];
	history_pushState: [
		{
			state: any;
			title: string;
			url: string;
		},
	];
	history_replaceState: [
		{
			state: any;
			title: string;
			url: string;
		},
	];
	history_go: [{ delta: number }];
};

export type Framebound = {
	navigate: [
		{
			url: string;
		},
	];
	history_go: [{ delta: number }, void];
};
