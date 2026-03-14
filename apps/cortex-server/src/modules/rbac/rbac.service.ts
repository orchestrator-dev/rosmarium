import { PERMISSIONS, ROLE_PERMISSIONS } from "./permissions.js";
import type { Permission } from "./permissions.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import type { ApiKey } from "../../db/schema/index.js";

export type ContentEntry = {
    id: string;
    createdBy: string | null;
    [key: string]: unknown;
};

export type ContentTypeWithSettings = {
    name: string;
    settings?: {
        fieldPermissions?: Record<
            string,
            { read?: string[]; write?: string[] }
        >;
        [key: string]: unknown;
    };
};

export class ForbiddenError extends Error {
    public readonly code = "FORBIDDEN";
    public readonly statusCode = 403;

    constructor(message = "Insufficient permissions") {
        super(message);
        this.name = "ForbiddenError";
    }
}

export const rbacService = {
    /**
     * Check if a user's role grants a given permission.
     */
    can(user: AuthenticatedUser, permission: Permission): boolean {
        const rolePerms = ROLE_PERMISSIONS[user.role];
        return rolePerms.includes(permission);
    },

    /**
     * Like can(), but throws ForbiddenError instead of returning false.
     */
    canOrThrow(user: AuthenticatedUser, permission: Permission): void {
        if (!rbacService.can(user, permission)) {
            throw new ForbiddenError(
                `Role '${user.role}' is not allowed to '${permission}'`
            );
        }
    },

    /**
     * Evaluate whether a user can perform an action on a content entry,
     * taking own vs any scope into account.
     */
    canAccessEntry(
        user: AuthenticatedUser,
        entry: ContentEntry,
        action: "read" | "update" | "delete"
    ): boolean {
        const anyPerm = `content:${action}:any` as Permission;
        const ownPerm = `content:${action}:own` as Permission;

        if (rbacService.can(user, anyPerm)) return true;

        if (rbacService.can(user, ownPerm) && entry.createdBy === user.id) {
            return true;
        }

        return false;
    },

    /**
     * Strip fields from a content entry that the user's role cannot read.
     * Field permissions are stored as:
     *   contentType.settings.fieldPermissions[fieldName].read = [role, ...]
     * If a field has no restriction, it is included for everyone.
     */
    filterFields(
        user: AuthenticatedUser,
        contentType: ContentTypeWithSettings,
        data: Record<string, unknown>
    ): Record<string, unknown> {
        const fieldPermissions = contentType.settings?.fieldPermissions ?? {};
        const result: Record<string, unknown> = {};

        for (const [fieldName, value] of Object.entries(data)) {
            const restriction = fieldPermissions[fieldName];
            // No restriction defined, OR empty read array = open to all
            if (!restriction?.read || restriction.read.length === 0 || restriction.read.includes(user.role)) {
                result[fieldName] = value;
            }
        }

        return result;
    },

    /**
     * Check if a user can write to a specific field of a content type.
     */
    canWriteField(
        user: AuthenticatedUser,
        contentType: ContentTypeWithSettings,
        fieldName: string
    ): boolean {
        const restriction =
            contentType.settings?.fieldPermissions?.[fieldName];
        if (!restriction?.write) return true; // no restriction → anyone can write
        return restriction.write.includes(user.role);
    },

    /**
     * Check if an API key includes the required permission in its scopes array.
     */
    scopeApiKey(apiKey: ApiKey, permission: Permission): boolean {
        return apiKey.scopes.includes(permission);
    },
};
