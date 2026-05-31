import type { RosmariumPlugin } from "@orchestrator.dev/types";

type HookName = keyof NonNullable<RosmariumPlugin['hooks']>;
type HookFunction<T extends HookName> = NonNullable<NonNullable<RosmariumPlugin['hooks']>[T]>;

interface HookRegistration<T extends HookName> {
    pluginName: string;
    priority: number;
    handler: HookFunction<T>;
}

export class HookEngine {
    private hooks: Map<HookName, HookRegistration<any>[]> = new Map();

    register<T extends HookName>(pluginName: string, hookName: T, handler: HookFunction<T>, priority = 50) {
        if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, []);
        }
        
        const registrations = this.hooks.get(hookName)!;
        registrations.push({ pluginName, priority, handler });
        
        // Sort by priority (higher priority runs first, so lower number runs first depending on convention, let's use lower number = higher priority like 0 is highest)
        registrations.sort((a, b) => a.priority - b.priority);
    }

    async execute<T extends HookName>(hookName: T, ...args: Parameters<HookFunction<T>>): Promise<void> {
        const registrations = this.hooks.get(hookName);
        if (!registrations) return;

        for (const reg of registrations) {
            try {
                // @ts-ignore - complex union spread
                await reg.handler(...args);
            } catch (error) {
                console.error(`[HookEngine] Error in plugin '${reg.pluginName}' executing hook '${String(hookName)}':`, error);
                // We swallow the error to provide error isolation
            }
        }
    }

    clear() {
        this.hooks.clear();
    }
}

export const hookEngine = new HookEngine();
