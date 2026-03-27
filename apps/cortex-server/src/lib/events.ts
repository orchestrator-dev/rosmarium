import { EventEmitter } from "node:events";
import type { ContentEntry } from "../db/schema/index.js";

// biome-ignore lint/suspicious/noExplicitAny: required for EventEmitter generic typing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any[];

class TypedEventEmitter<T extends Record<string, AnyArgs>> extends EventEmitter {
    emit<K extends keyof T & string>(event: K, ...args: T[K]): boolean {
        return super.emit(event, ...args);
    }

    on<K extends keyof T & string>(
        event: K,
        listener: (...args: T[K]) => void,
    ): this {
        return super.on(event, listener);
        return this;
    }

    off<K extends keyof T & string>(
        event: K,
        listener: (...args: T[K]) => void,
    ): this {
        return super.off(event, listener);
    }

    once<K extends keyof T & string>(
        event: K,
        listener: (...args: T[K]) => void,
    ): this {
        return super.once(event, listener);
    }
}

type RosmariumEventMap = {
    "content.created": [entry: ContentEntry];
    "content.updated": [entry: ContentEntry];
    "content.deleted": [id: string, contentType: string];
    "content.published": [entry: ContentEntry];
    "content.unpublished": [entry: ContentEntry];
};

export const rosmariumEvents = new TypedEventEmitter<RosmariumEventMap>();
