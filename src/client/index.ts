import "./location";
import "./storage";

declare global {
    interface Window {
        __location: Location;
    }
}