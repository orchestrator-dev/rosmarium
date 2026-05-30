import { pino } from "pino";
import { config } from "../config.js";
import { trace } from "@opentelemetry/api";

const isDevelopment = config.NODE_ENV === "development";

export const logger = pino({
    level: isDevelopment ? "debug" : "info",
    mixin() {
        const span = trace.getActiveSpan();
        return {
            traceId: span?.spanContext().traceId,
        };
    },
    ...(isDevelopment && {
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "HH:MM:ss Z",
                ignore: "pid,hostname",
            },
        },
    }),
});
