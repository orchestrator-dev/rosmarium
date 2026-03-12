import { pino } from "pino";
import { config } from "../config.js";

const isDevelopment = config.NODE_ENV === "development";

export const logger = pino({
    level: isDevelopment ? "debug" : "info",
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
