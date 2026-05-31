import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";
import path from "path";

export function registerInitCommand(program: Command) {
    program
        .command("init [dir]")
        .description("Scaffold new rosmarium project")
        .action(async (dir) => {
            const targetDir = dir || process.cwd();
            console.log(chalk.blue(`Initializing new Rosmarium project in ${targetDir}...`));

            const answers = await inquirer.prompt([
                {
                    type: "input",
                    name: "projectName",
                    message: "Project name:",
                    default: path.basename(targetDir),
                },
                {
                    type: "list",
                    name: "db",
                    message: "Select database:",
                    choices: ["PostgreSQL"],
                    default: "PostgreSQL",
                }
            ]);

            // Simulate scaffolding
            console.log(chalk.gray(`Creating package.json for ${answers.projectName}...`));
            console.log(chalk.gray(`Setting up ${answers.db} configuration...`));
            
            console.log(chalk.green(`\n✓ Project ${answers.projectName} successfully created.`));
            console.log(`\nNext steps:\n  cd ${dir || "."}\n  pnpm install\n  rosmarium dev\n`);
        });
}
