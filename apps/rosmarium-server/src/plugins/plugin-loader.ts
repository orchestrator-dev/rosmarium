import { pluginRegistry } from "./plugin-registry.js";
import { config } from "../config.js";
import path from "node:path";

export async function loadPlugins() {
    const pluginPaths = config.PLUGINS || [];

    for (const pluginPath of pluginPaths) {
        try {
            // Check if it's a local path or npm package
            let importPath = pluginPath;
            if (pluginPath.startsWith(".") || pluginPath.startsWith("/")) {
                // Resolve relative to process.cwd() or root
                const root = process.cwd();
                importPath = path.resolve(root, pluginPath);
            }

            const module = await import(importPath);
            const plugin = module.default || module.plugin;
            
            if (!plugin) {
                console.error(`[PluginLoader] Could not find default export or 'plugin' export in ${pluginPath}`);
                continue;
            }

            pluginRegistry.register(plugin);
        } catch (error) {
            console.error(`[PluginLoader] Error loading plugin '${pluginPath}':`, error);
        }
    }
}
