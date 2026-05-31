/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
import { type ParsedContentType, type CreateContentTypeInput } from "./registry.js";
import { type FieldDefinition } from "./field-types.js";

export interface SchemaDiffResult {
    added: CreateContentTypeInput[];
    removed: ParsedContentType[];
    updated: {
        original: ParsedContentType;
        incoming: CreateContentTypeInput;
        changes: string[];
    }[];
}

/**
 * Compare an array of currently registered schemas against an array of incoming
 * parsed YAML schemas to determine what was added, removed, or updated.
 */
export function diffSchemas(
    currentSchemas: ParsedContentType[],
    incomingSchemas: CreateContentTypeInput[]
): SchemaDiffResult {
    const added: CreateContentTypeInput[] = [];
    const removed: ParsedContentType[] = [];
    const updated: SchemaDiffResult["updated"] = [];

    const currentMap = new Map(currentSchemas.map(s => [s.name, s]));
    const incomingMap = new Map(incomingSchemas.map(s => [s.name, s]));

    // Detect Adds and Updates
    for (const incoming of incomingSchemas) {
        const current = currentMap.get(incoming.name);
        if (!current) {
            added.push(incoming);
        } else {
            const changes = diffContentType(current, incoming);
            if (changes.length > 0) {
                updated.push({
                    original: current,
                    incoming,
                    changes,
                });
            }
        }
    }

    // Detect Removes
    for (const current of currentSchemas) {
        // System content types shouldn't be considered for removal via config-as-code
        if (current.isSystem) continue;

        if (!incomingMap.has(current.name)) {
            removed.push(current);
        }
    }

    return { added, removed, updated };
}

/**
 * Return a list of human-readable changes between the current and incoming content types.
 */
function diffContentType(current: ParsedContentType, incoming: CreateContentTypeInput): string[] {
    const changes: string[] = [];

    if (current.displayName !== incoming.displayName) {
        changes.push(`Display name changed from "${current.displayName}" to "${incoming.displayName}"`);
    }

    if (current.description !== incoming.description) {
        changes.push(`Description updated`);
    }

    if (current.isComponent !== (incoming.isComponent ?? false)) {
        changes.push(`isComponent changed to ${incoming.isComponent ?? false}`);
    }

    // Compare Settings
    const currentSettingsStr = JSON.stringify(current.settings);
    const incomingSettingsStr = JSON.stringify(incoming.settings ?? {});
    if (currentSettingsStr !== incomingSettingsStr) {
        changes.push(`Settings modified`);
    }

    // Compare Fields
    const currentFieldsMap = new Map(current.fields.map(f => [f.name, f]));
    const incomingFieldsMap = new Map(incoming.fields.map(f => [f.name, f]));

    for (const incomingField of incoming.fields) {
        const currentField = currentFieldsMap.get(incomingField.name);
        if (!currentField) {
            changes.push(`Added field: ${incomingField.name} (${incomingField.type})`);
        } else {
            // Rough comparison of field definition
            const cFieldStr = JSON.stringify(currentField);
            const iFieldStr = JSON.stringify(incomingField);
            if (cFieldStr !== iFieldStr) {
                changes.push(`Modified field: ${incomingField.name}`);
            }
        }
    }

    for (const currentField of current.fields) {
        if (!incomingFieldsMap.has(currentField.name)) {
            changes.push(`Removed field: ${currentField.name}`);
        }
    }

    return changes;
}
