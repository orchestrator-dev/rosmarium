import SchemaBuilder from "@pothos/core";
import RelayPlugin from "@pothos/plugin-relay";
import ValidationPlugin from "@pothos/plugin-validation";
import WithInputPlugin from "@pothos/plugin-with-input";
import type { GraphQLContext } from "./context.js";
import type { ParsedContentType } from "../modules/content/registry.js";
import type { ContentEntry } from "../db/schema/index.js";

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type EntryEdge = { node: ContentEntry; cursor: string };
type EntryConnection = { edges: EntryEdge[]; pageInfo: PageInfo; totalCount: number };
type DeletionPayload = { id: string; contentType: string };

export const builder = new SchemaBuilder<{
    Context: GraphQLContext;
    Objects: {
        ContentType: ParsedContentType;
        ContentEntry: ContentEntry;
        EntryEdge: EntryEdge;
        EntryConnection: EntryConnection;
        PageInfo: PageInfo;
        DeletionPayload: DeletionPayload;
    };
    Scalars: {
        DateTime: { Input: Date; Output: Date };
        JSON: { Input: unknown; Output: unknown };
    };
}>({
    plugins: [RelayPlugin, ValidationPlugin, WithInputPlugin],
    relay: {},
});

builder.queryType({});
builder.mutationType({});
builder.subscriptionType({});
