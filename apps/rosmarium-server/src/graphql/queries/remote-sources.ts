import { builder } from "../builder.js";
import { sourceService } from "../../modules/federation/source.service.js";

builder.queryField("remoteSources", (t) =>
    t.field({
        type: ["RemoteSource"],
        description: "List all registered remote data sources",
        resolve: () => sourceService.listSources(),
    }),
);

builder.queryField("remoteSource", (t) =>
    t.field({
        type: "RemoteSource",
        nullable: true,
        description: "Get a single remote data source by ID",
        args: { id: t.arg.string({ required: true }) },
        resolve: async (_, { id }) => {
            const source = await sourceService.getSource(id);
            return source ?? null;
        },
    }),
);
