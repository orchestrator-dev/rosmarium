import { RenameTypes, RenameRootFields } from "@graphql-tools/wrap";

export function createSourceTransforms(sourceName: string) {
    return [
        new RenameTypes((name) => `${sourceName}_${name}`),
        new RenameRootFields((operation, name) => `${sourceName}_${name}`),
    ];
}
