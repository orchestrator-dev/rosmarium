import yaml from "yaml";
import { type ParsedContentType, type CreateContentTypeInput } from "./registry.js";

/**
 * Serialize a ParsedContentType from the DB into a clean YAML string
 * suitable for checking into version control.
 */
export function exportSchemaToYaml(contentType: ParsedContentType): string {
    const exportData = {
        name: contentType.name,
        displayName: contentType.displayName,
        description: contentType.description || undefined,
        isComponent: contentType.isComponent,
        settings: Object.keys(contentType.settings).length > 0 ? contentType.settings : undefined,
        fields: contentType.fields,
    };

    // Remove undefined values cleanly before stringifying
    const cleanData = JSON.parse(JSON.stringify(exportData));
    
    return yaml.stringify(cleanData, {
        indent: 2,
        lineWidth: 100,
        sortMapEntries: false,
    });
}

/**
 * Parse a YAML string back into a CreateContentTypeInput, 
 * ready for validation and insertion/update by the registry.
 */
export function parseYamlToSchema(yamlStr: string): CreateContentTypeInput {
    const parsed = yaml.parse(yamlStr);
    
    if (!parsed.name || !parsed.displayName || !Array.isArray(parsed.fields)) {
        throw new Error("Invalid schema YAML: missing name, displayName, or fields array");
    }

    return {
        name: parsed.name,
        displayName: parsed.displayName,
        description: parsed.description,
        isComponent: parsed.isComponent ?? false,
        settings: parsed.settings ?? {},
        fields: parsed.fields,
    };
}
