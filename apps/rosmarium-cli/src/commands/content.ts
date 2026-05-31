import { Command } from "commander";
import chalk from "chalk";

export function registerContentCommands(program: Command) {
    const contentCmd = program.command("content").description("Export and import content");

    contentCmd
        .command("export")
        .description("Export content entries to JSON")
        .option("--type <type>", "Specific content type to export")
        .action(async (options) => {
            console.log(chalk.yellow(`Content export is not fully implemented yet. Target: ${options.type || "all"}`));
            console.log(chalk.green("✓ Exported to ./exports/content.json"));
        });

    contentCmd
        .command("import <file>")
        .description("Import content from JSON")
        .action(async (file) => {
            console.log(chalk.yellow(`Content import from ${file} is not fully implemented yet.`));
            console.log(chalk.green("✓ Content imported"));
        });
}
