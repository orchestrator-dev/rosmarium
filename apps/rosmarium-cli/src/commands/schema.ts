import { Command } from "commander";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { fetchApi } from "../api.js";

const SCHEMAS_DIR = path.join(process.cwd(), "schemas");

export function registerSchemaCommands(program: Command) {
    const schemaCmd = program.command("schema").description("Manage content type schemas");

    schemaCmd
        .command("pull")
        .description("Export content type schemas to ./schemas/")
        .action(async () => {
            console.log(chalk.blue("Pulling schemas from server..."));
            const files: { filename: string; content: string }[] = await fetchApi("/api/admin/schema/export");
            
            await fs.mkdir(SCHEMAS_DIR, { recursive: true });
            
            for (const file of files) {
                const filePath = path.join(SCHEMAS_DIR, file.filename);
                await fs.writeFile(filePath, file.content, "utf-8");
                console.log(chalk.green(`✓ Wrote ${file.filename}`));
            }
            console.log(chalk.blue.bold(`Successfully pulled ${files.length} schemas.`));
        });

    schemaCmd
        .command("diff")
        .description("Show differences between local schema files and the database")
        .action(async () => {
            console.log(chalk.blue("Comparing local schemas to database..."));
            const files = await readLocalSchemas();
            
            const diff = await fetchApi("/api/admin/schema/diff", {
                method: "POST",
                body: JSON.stringify({ files }),
            });

            printDiff(diff);
        });

    schemaCmd
        .command("push")
        .description("Push local schema files to the database")
        .action(async () => {
            console.log(chalk.blue("Pushing schemas to server..."));
            const files = await readLocalSchemas();
            
            const result = await fetchApi("/api/admin/schema/sync", {
                method: "POST",
                body: JSON.stringify({ files }),
            });

            console.log(chalk.green.bold("✓ Schema sync successful."));
            printDiff(result.applied);
        });
}

async function readLocalSchemas() {
    const files: { filename: string; content: string }[] = [];
    try {
        const dirents = await fs.readdir(SCHEMAS_DIR, { withFileTypes: true });
        for (const dirent of dirents) {
            if (dirent.isFile() && (dirent.name.endsWith(".yml") || dirent.name.endsWith(".yaml"))) {
                const content = await fs.readFile(path.join(SCHEMAS_DIR, dirent.name), "utf-8");
                files.push({ filename: dirent.name, content });
            }
        }
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === "ENOENT") {
            console.log(chalk.yellow("No local schemas directory found."));
            return [];
        }
        throw err;
    }
    return files;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printDiff(diff: any) {
    if (diff.added.length === 0 && diff.removed.length === 0 && diff.updated.length === 0) {
        console.log(chalk.gray("No changes detected."));
        return;
    }

    if (diff.added.length > 0) {
        console.log(chalk.green.bold("\nAdded:"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        diff.added.forEach((a: any) => console.log(chalk.green(`  + ${a.name}`)));
    }

    if (diff.removed.length > 0) {
        console.log(chalk.red.bold("\nRemoved:"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        diff.removed.forEach((r: any) => console.log(chalk.red(`  - ${r.name}`)));
    }

    if (diff.updated.length > 0) {
        console.log(chalk.yellow.bold("\nUpdated:"));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        diff.updated.forEach((u: any) => {
            console.log(chalk.yellow(`  ~ ${u.incoming.name}`));
            u.changes.forEach((c: string) => console.log(chalk.gray(`      ${c}`)));
        });
    }
    console.log();
}
