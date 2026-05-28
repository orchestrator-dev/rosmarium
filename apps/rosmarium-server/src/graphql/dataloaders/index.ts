import { createContentTypeLoader, createContentEntryLoader } from "./content-entry.js";

/** Creates fresh DataLoader instances for a single GraphQL request. Never share across requests. */
export function createDataloaders() {
    return {
        contentType: createContentTypeLoader(),
        contentEntry: createContentEntryLoader(),
    };
}
