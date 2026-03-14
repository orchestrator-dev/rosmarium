import type { UserRole } from "../auth/auth.service.js";

// ─── Permission strings: {resource}:{action}:{scope} ─────────────────────────

export const PERMISSIONS = {
    // Content
    CONTENT_CREATE: "content:create:any",
    CONTENT_READ_ANY: "content:read:any",
    CONTENT_READ_OWN: "content:read:own",
    CONTENT_UPDATE_ANY: "content:update:any",
    CONTENT_UPDATE_OWN: "content:update:own",
    CONTENT_DELETE_ANY: "content:delete:any",
    CONTENT_DELETE_OWN: "content:delete:own",
    CONTENT_PUBLISH: "content:publish:any",

    // Content Types
    CONTENT_TYPE_CREATE: "content_type:create:any",
    CONTENT_TYPE_UPDATE: "content_type:update:any",
    CONTENT_TYPE_DELETE: "content_type:delete:any",

    // Assets
    ASSET_UPLOAD: "asset:create:any",
    ASSET_DELETE_ANY: "asset:delete:any",
    ASSET_DELETE_OWN: "asset:delete:own",

    // Users
    USER_CREATE: "user:create:any",
    USER_UPDATE_ANY: "user:update:any",
    USER_UPDATE_OWN: "user:update:own",
    USER_DELETE: "user:delete:any",

    // System
    WEBHOOK_MANAGE: "webhook:create:any",
    SETTINGS_UPDATE: "settings:update:any",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Role → Permission mappings ───────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    super_admin: Object.values(PERMISSIONS) as Permission[],

    admin: [
        PERMISSIONS.CONTENT_CREATE,
        PERMISSIONS.CONTENT_READ_ANY,
        PERMISSIONS.CONTENT_UPDATE_ANY,
        PERMISSIONS.CONTENT_DELETE_ANY,
        PERMISSIONS.CONTENT_PUBLISH,
        PERMISSIONS.CONTENT_TYPE_CREATE,
        PERMISSIONS.CONTENT_TYPE_UPDATE,
        PERMISSIONS.ASSET_UPLOAD,
        PERMISSIONS.ASSET_DELETE_ANY,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_UPDATE_ANY,
        PERMISSIONS.WEBHOOK_MANAGE,
    ],

    editor: [
        PERMISSIONS.CONTENT_CREATE,
        PERMISSIONS.CONTENT_READ_ANY,
        PERMISSIONS.CONTENT_UPDATE_ANY,
        PERMISSIONS.CONTENT_DELETE_OWN,
        PERMISSIONS.CONTENT_PUBLISH,
        PERMISSIONS.ASSET_UPLOAD,
        PERMISSIONS.ASSET_DELETE_OWN,
    ],

    author: [
        PERMISSIONS.CONTENT_CREATE,
        PERMISSIONS.CONTENT_READ_ANY,
        PERMISSIONS.CONTENT_UPDATE_OWN,
        PERMISSIONS.CONTENT_DELETE_OWN,
        PERMISSIONS.ASSET_UPLOAD,
        PERMISSIONS.ASSET_DELETE_OWN,
    ],

    viewer: [PERMISSIONS.CONTENT_READ_ANY],
};
