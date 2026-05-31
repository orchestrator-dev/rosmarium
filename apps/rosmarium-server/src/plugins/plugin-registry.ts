import type { RosmariumPlugin } from "@orchestrator.dev/types";
import { hookEngine } from "./hook-engine.js";

export class PluginRegistry {
    private plugins: Map<string, RosmariumPlugin> = new Map();

    register(plugin: RosmariumPlugin) {
        if (this.plugins.has(plugin.name)) {
            console.warn(`[PluginRegistry] Plugin '${plugin.name}' is already registered.`);
            return;
        }

        // Validate basic plugin structure
        if (!plugin.name || !plugin.version) {
            throw new Error("[PluginRegistry] Plugin missing required 'name' or 'version' properties.");
        }

        this.plugins.set(plugin.name, plugin);

        // Register hooks
        if (plugin.hooks) {
            for (const [hookName, handler] of Object.entries(plugin.hooks)) {
                if (handler) {
                    hookEngine.register(plugin.name, hookName as keyof NonNullable<RosmariumPlugin['hooks']>, handler);
                }
            }
        }

        console.log(`[PluginRegistry] Registered plugin '${plugin.name}@${plugin.version}'`);
    }

    get(name: string): RosmariumPlugin | undefined {
        return this.plugins.get(name);
    }

    getAll(): RosmariumPlugin[] {
        return Array.from(this.plugins.values());
    }

    clear() {
        this.plugins.clear();
        hookEngine.clear();
    }
}

export const pluginRegistry = new PluginRegistry();
