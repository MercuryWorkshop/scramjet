export class NavigateEvent extends Event {
	constructor(public url: string) {
		super("navigate");
	}
}

export class UrlChangeEvent extends Event {
	constructor(public url: string) {
		super("urlchange");
	}
}

export class ScramjetContextEvent extends Event {
	constructor(public window: Self) {
		super("contextInit");
	}
}
