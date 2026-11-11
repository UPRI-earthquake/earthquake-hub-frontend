type EventMap = Record<string, any>;

export class TypedEventTarget<Events extends EventMap> {
    private target: EventTarget = new EventTarget();

    addEventListener<K extends keyof Events>(
        type: K,
        listener: (event: Events[K]) => void,
        options?: boolean | AddEventListenerOptions
    ) {
        this.target.addEventListener(type as string, listener as EventListener, options);
    }

    removeEventListener<K extends keyof Events>(
        type: K,
        listener: (event: Events[K]) => void,
    ) {
        this.target.removeEventListener(type as string, listener as EventListener);
    }

    emit<K extends keyof Events>(event: Events[K]) {
        return this.target.dispatchEvent(event);
    }
}