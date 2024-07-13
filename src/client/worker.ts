import { encodeUrl } from "../bundle";
const RealWorker = Worker
Worker = new Proxy(Worker, {
    construct(_target, args) {
        return new RealWorker(encodeUrl(args[0]), args[1])
    }
})