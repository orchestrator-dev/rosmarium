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
    redact: {
        paths: ["password", "req.body", "body", "apiKey", "headers.authorization", "req.headers.authorization"],
        censor: "***"
    }
});
