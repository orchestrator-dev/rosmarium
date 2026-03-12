import { GraphQLScalarType, Kind } from "graphql";
import { builder } from "./builder.js";

/** ISO-8601 string ↔ JavaScript Date */
export const DateTimeScalar = new GraphQLScalarType({
    name: "DateTime",
    description: "ISO-8601 datetime scalar",
    serialize(value: unknown): string {
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "string") return value;
        throw new Error(`DateTimeScalar cannot serialize ${typeof value}`);
    },
    parseValue(value: unknown): Date {
        if (typeof value === "string") return new Date(value);
        throw new Error("DateTimeScalar only accepts string input");
    },
    parseLiteral(ast): Date {
        if (ast.kind === Kind.STRING) return new Date(ast.value);
        throw new Error("DateTimeScalar only accepts string literals");
    },
});

/** Pass-through scalar for arbitrary JSON values */
export const JSONScalar = new GraphQLScalarType({
    name: "JSON",
    description: "Arbitrary JSON value",
    serialize: (v) => v,
    parseValue: (v) => v,
    parseLiteral(ast) {
        if (ast.kind === Kind.STRING) {
            try { return JSON.parse(ast.value) as unknown; } catch { return ast.value; }
        }
        return null;
    },
});

builder.addScalarType("DateTime", DateTimeScalar, {});
builder.addScalarType("JSON", JSONScalar, {});
