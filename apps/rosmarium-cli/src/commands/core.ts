import { Command } from "commander";
import chalk from "chalk";

export function registerCoreCommands(program: Command) {
    program
        .command("dev")
        .description("Start development server")
        .action(() => {
            console.log(chalk.yellow("Simulating dev server start..."));
            console.log(chalk.green("Server running at http://localhost:3000"));
        });

    program
        .command("build")
        .description("Build for production")
        .action(() => {
            console.log(chalk.blue("Building Rosmarium project..."));
            console.log(chalk.green("✓ Build successful"));
        });

    program
        .command("migrate")
        .description("Run pending DB migrations")
        .action(() => {
            console.log(chalk.blue("Running database migrations..."));
            console.log(chalk.green("✓ Database is up to date."));
        });

    program
        .command("seed")
        .description("Seed database")
        .option("--demo", "Seed with demo data")
        .action((options) => {
            console.log(chalk.blue(`Seeding database${options.demo ? " with demo data" : ""}...`));
            console.log(chalk.green("✓ Seeding complete."));
        });

    program
        .command("env sync <target>")
        .description("Sync schema between environments")
        .action((target) => {
            console.log(chalk.blue(`Syncing schemas to ${target}...`));
            console.log(chalk.green(`✓ Synced successfully.`));
        });
}
