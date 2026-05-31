import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    clean: true,
    dts: true,
    minify: false,
    banner: {
        js: "#!/usr/bin/env node",
    },
});
