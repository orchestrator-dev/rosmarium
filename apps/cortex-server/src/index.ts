import { buildApp } from "./app.js";
import { config } from "./config.js";

const start = async () => {
    const app = await buildApp();

    try {
        await app.listen({ port: config.PORT, host: config.HOST });
        app.log.info({ port: config.PORT, env: config.NODE_ENV }, "Server successfully started.");
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
