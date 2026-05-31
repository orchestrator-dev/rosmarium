import { Command } from "commander";
import chalk from "chalk";
import { registerSchemaCommands } from "./commands/schema.js";
import { registerContentCommands } from "./commands/content.js";
import { registerPluginCommands } from "./commands/plugin.js";
import { registerInitCommand } from "./commands/init.js";
import { registerCoreCommands } from "./commands/core.js";

const program = new Command();

program
    .name("rosmarium")
    .description("CLI for Rosmarium Headless COS")
    .version("1.0.0");

// Register subcommands
registerInitCommand(program);
registerCoreCommands(program);
registerSchemaCommands(program);
registerContentCommands(program);
registerPluginCommands(program);

program.showHelpAfterError();

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red(`\nError: ${err.message}`));
    process.exit(1);
});
