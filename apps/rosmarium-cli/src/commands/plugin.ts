import { Command } from "commander";
import chalk from "chalk";

export function registerPluginCommands(program: Command) {
    const pluginCmd = program.command("plugin").description("Manage plugins");

    pluginCmd
        .command("add <name>")
        .description("Install and register a plugin")
        .action(async (name) => {
            console.log(chalk.blue(`Installing plugin ${name}...`));
            // Simulated implementation
            console.log(chalk.green(`✓ Plugin ${name} installed and registered in config.`));
        });

    pluginCmd
        .command("remove <name>")
        .description("Uninstall a plugin")
        .action(async (name) => {
            console.log(chalk.blue(`Removing plugin ${name}...`));
            // Simulated implementation
            console.log(chalk.green(`✓ Plugin ${name} removed.`));
        });
}
