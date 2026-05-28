import { builder } from "../builder.js";
import { registry } from "../../modules/content/registry.js";

builder.queryField("contentTypes", (t) =>
    t.field({
        type: ["ContentType"],
        description: "List all registered content types",
        resolve: () => registry.getAll(),
    }),
);

builder.queryField("contentType", (t) =>
    t.field({
        type: "ContentType",
        nullable: true,
        description: "Get a single content type by name",
        args: { name: t.arg.string({ required: true }) },
        resolve: (_, { name }) => registry.get(name) ?? null,
    }),
);
