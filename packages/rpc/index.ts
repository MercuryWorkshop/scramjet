type Serverbound = {
	method1: [{ paramA: string; paramB: number }, boolean];
	method2: [string, number];
};

type Clientbound = {
	method1: [number];
	method2: [boolean, string];
};

export type RpcDescription = {
	[method: string]: [args: any, returnType: any] | [args: any] | [];
};

export type MethodsDefinition<Description extends RpcDescription> = {
	[Method in keyof Description]: (
		...args: Description[Method] extends [infer A, ...any[]] ? [A] : []
	) => Description[Method] extends [any, infer R]
		? Promise<[R, Transferable[]]>
		: Promise<void>;
};

export class RpcHelper<
	Local extends RpcDescription,
	Remote extends RpcDescription,
> {
	counter: number = 0;
	promiseCallbacks: Map<
		number,
		{ resolve: (value: any) => void; reject: (reason?: any) => void }
	> = new Map();
	constructor(
		private methods: MethodsDefinition<Local>,
		private id: string,
		private sendRaw: (data: any, transfer: Transferable[]) => void
	) {}

	recieve(data: any) {
		if (data === undefined || data === null || typeof data !== "object") return;
		const dt = data[this.id];
		if (dt === undefined || dt === null || typeof dt !== "object") return;

		const type = dt.$type;

		if (type === "response") {
			const token = dt.$token;
			const data = dt.$data;
			const error = dt.$error;
			const cb = this.promiseCallbacks.get(token);
			if (!cb) return;
			this.promiseCallbacks.delete(token);
			if (error !== undefined) {
				cb.reject(new Error(error));
			} else {
				cb.resolve(data);
			}
		} else if (type === "request") {
			const method = dt.$method as keyof Local;
			const args = dt.$args as Local[typeof method][0];
			(this.methods[method] as any)(args)
				.then(([res, transfer]) => {
					this.sendRaw(
						{
							[this.id]: {
								$type: "response",
								$token: dt.$token,
								$data: res,
							},
						},
						transfer
					);
				})
				.catch((err: any) => {
					this.sendRaw(
						{
							[this.id]: {
								$type: "response",
								$token: dt.$token,
								$error: err?.toString() || "Unknown error",
							},
						},
						[]
					);
				});
		}
	}

	call<Method extends keyof Remote>(
		method: Method,
		args: Remote[Method][0],
		transfer: Transferable[] = []
	): Promise<Remote[Method][1]> {
		let token = this.counter++;
		return new Promise((resolve, reject) => {
			this.promiseCallbacks.set(token, { resolve, reject });
			this.sendRaw(
				{
					[this.id]: {
						$type: "request",
						$method: method,
						$args: args,
						$token: token,
					},
				},
				transfer
			);
		});
	}
}
