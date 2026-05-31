export interface HookContext {
    entry: Record<string, unknown>;
    contentType: string;
    action: string;
    user?: string;
    // Context may be mutated by plugins
    [key: string]: unknown;
}

export interface WorkflowHookContext {
    entry: Record<string, unknown>;
    fromState: string;
    toState: string;
    user?: string;
    [key: string]: unknown;
}

export interface AuthHookContext {
    user: Record<string, unknown>;
    tenantId?: string;
    [key: string]: unknown;
}

export interface MediaHookContext {
    file: Record<string, unknown>;
    metadata: Record<string, unknown>;
    [key: string]: unknown;
}

export interface CustomFieldType {
    name: string;
    type: string;
    component: string;
    validate?: (value: unknown) => boolean;
}

export interface AdminPage {
    name: string;
    path: string;
    component: string; // Dynamic import path
    icon?: string;
}

export interface DashboardWidget {
    name: string;
    component: string;
    gridSize?: number;
}

export interface RosmariumPlugin {
    name: string;
    version: string;
    description?: string;

    // Server-side hooks
    hooks?: {
        // Content lifecycle
        'content:beforeCreate'?: (ctx: HookContext) => Promise<void> | void;
        'content:afterCreate'?: (ctx: HookContext) => Promise<void> | void;
        'content:beforeUpdate'?: (ctx: HookContext) => Promise<void> | void;
        'content:afterUpdate'?: (ctx: HookContext) => Promise<void> | void;
        'content:beforeDelete'?: (ctx: HookContext) => Promise<void> | void;
        'content:afterDelete'?: (ctx: HookContext) => Promise<void> | void;
        'content:beforePublish'?: (ctx: HookContext) => Promise<void> | void;
        'content:afterPublish'?: (ctx: HookContext) => Promise<void> | void;

        // Workflow hooks
        'workflow:beforeTransition'?: (ctx: WorkflowHookContext) => Promise<void> | void;
        'workflow:afterTransition'?: (ctx: WorkflowHookContext) => Promise<void> | void;

        // Auth hooks
        'auth:afterLogin'?: (ctx: AuthHookContext) => Promise<void> | void;
        'auth:afterRegister'?: (ctx: AuthHookContext) => Promise<void> | void;

        // Media hooks
        'media:beforeUpload'?: (ctx: MediaHookContext) => Promise<void> | void;
        'media:afterUpload'?: (ctx: MediaHookContext) => Promise<void> | void;
    };

    // Custom REST routes (FastifyInstance type is complex, using any here to avoid coupling types package to Fastify)
    routes?: (fastify: any) => void;

    // Custom field types
    fieldTypes?: CustomFieldType[];

    // Custom GraphQL extensions (using any for Pothos builder)
    graphql?: {
        types?: (builder: any) => void;
        queries?: (builder: any) => void;
        mutations?: (builder: any) => void;
    };

    // Admin UI extensions
    adminUI?: {
        pages?: AdminPage[];
        widgets?: DashboardWidget[];
        fieldEditors?: Record<string, string>; // fieldType → component path
    };
}
