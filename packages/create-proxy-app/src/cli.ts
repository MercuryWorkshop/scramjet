import * as prompt from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import { scaffold } from "./scaffold";

interface CliFlags {
	git: boolean;
	install: boolean;
	default: boolean;
}

interface CliResults {
	dir: string;
	flags: CliFlags;
}

const defaultOpts: CliResults = {
	dir: "proxy-app",
	flags: {
		git: false,
		install: false,
		default: false,
	},
};

async function project() {
	const cliResults = defaultOpts;
	const program = new Command();
	program.name("Create Proxy");
	program.description(
		"A CLI to easily get started with creating a Scramjet or Ultraviolet Proxy"
	);
	program.argument(
		"[dir]",
		"The name of the program, and the directory to create"
	);
	program.option("--git", "Tell the CLI to create a Git repository", false);
	program.option("--install", "Tell the CLI to install dependencies", false);
	program.option(
		"-y, --default",
		"Skip any questions a bootstrap with default options"
	);
	program.parse(process.argv);
	const providedName = program.args[0];
	if (providedName) {
		cliResults.dir = providedName;
	}
	cliResults.flags = program.opts();
	if (cliResults.flags.default) {
		const defaultOptSpinner = prompt.spinner();
		defaultOptSpinner.start();
		defaultOptSpinner.message(
			chalk.yellow("Scaffolding using ALL default options")
		);
		await scaffold({
			projectName: providedName ?? "proxy-app",
			scaffoldType: "tsx/jsx",
			tsScaffold: true,
		});
		defaultOptSpinner.stop(chalk.green.bold("Scaffold complete!"));
		return prompt.note(
			`cd ${providedName ?? "proxy-app"} \nnpm run dev`,
			chalk.bold.magenta("Done creating. Now run:")
		);
	}
	if (process.env.TERM_PROGRAM?.toLowerCase().includes("mintty")) {
		console.log(
			chalk.yellow(
				"WARNING: It looks like you are using MinTTY which is not interactive. This is most likely because you are using Git Bash. \nIf you are using Git Bash, please use it from another terminal like Windows Terminal. "
			)
		);
		throw new Error("Terminal session is Non-Interactive");
	}
	const inital = await prompt.group(
		{
			...(!providedName && {
				path: () =>
					prompt.text({
						message: chalk.green(
							"Where would you like to create your project?"
						),
						placeholder: "project-name",
					}),
			}),
			type: () =>
				prompt.select({
					message: chalk.magenta(`How would you like to set up this proxy?`),
					initialValue: "dedicated",
					maxItems: 2,
					options: [
						{ value: "dedicated", label: "Dedicated Server" },
						{
							value: "static",
							label:
								"Static (can be deployed anywhere, but requires an external Wisp server)",
						},
					],
				}),
		},
		{
			onCancel: () => {
				prompt.cancel(chalk.bold.red("Operation canceled"));
				process.exit(0);
			},
		}
	);

	const initGit = await prompt.group(
		{
			...(!cliResults.flags.git && {
				init: () =>
					prompt.confirm({
						message: chalk.green("Do you want a Git repository initalized?"),
						initialValue: false,
					}),
			}),
		},
		{
			onCancel: () => {
				prompt.cancel(chalk.bold.red("Operation canceled"));
				process.exit(0);
			},
		}
	);

	const installDeps = await prompt.group(
		{
			...(!cliResults.flags.install && {
				install: () =>
					prompt.confirm({
						message: chalk.red("Do you want to install dependencies?"),
						initialValue: false,
					}),
			}),
		},
		{
			onCancel: () => {
				prompt.cancel(chalk.bold.red("Operation canceled"));
				process.exit(0);
			},
		}
	);

	let packageManager = "npm";
	if (installDeps.install === true || cliResults.flags.install === true) {
		const pm = await prompt.group(
			{
				manager: () =>
					prompt.select({
						message: chalk.green("Select your package manager"),
						initialValue: "npm",
						maxItems: 3,
						options: [
							{ value: "npm", label: "npm" },
							{ value: "pnpm", label: "pnpm" },
							{ value: "yarn", label: "yarn" },
							{ value: "bun", label: "bun" },
						],
					}),
			},
			{
				onCancel: () => {
					prompt.cancel(chalk.bold.red("Operation canceled"));
					process.exit(0);
				},
			}
		);
		packageManager = pm.manager;
	}

	const scaffoldSpinner = prompt.spinner();
	scaffoldSpinner.start();
	scaffoldSpinner.message(chalk.yellow("Scaffolding..."));
	await scaffold({
		projectName: inital.path ?? cliResults.dir,
		scaffoldType: inital.type,
	});
	scaffoldSpinner.stop(chalk.bold.green("Scaffold complete!"));
	if (initGit.init === true || cliResults.flags.git === true) {
		const gitSpinner = prompt.spinner();
		gitSpinner.start();
		gitSpinner.message(chalk.yellow("Initalizing a Git repo"));
		try {
			await execa("git", ["init"], { cwd: inital.path });
			await execa("git", ["add", "-A"], { cwd: inital.path });
			await execa(
				"git",
				[
					"commit",
					"-m",
					"Inital Commit from Create Proxy App",
					'--author="create-proxy-app[bot] <example@example.com>"',
				],
				{ cwd: inital.path }
			);
		} catch (err: any) {}
		gitSpinner.stop(chalk.bold.green("Git repo successfully intitalized!"));
	}
	if (installDeps.install === true || cliResults.flags.install === true) {
		const pmSpinner = prompt.spinner();
		pmSpinner.start();
		pmSpinner.message(chalk.yellow("Installing dependencies..."));
		try {
			await execa(packageManager, ["install"], { cwd: inital.path });
		} catch (err: any) {
			console.log(
				chalk.yellow.bold(
					`\n${packageManager} has failed to install dependencies. Defaulting to npm`
				)
			);
			packageManager = "npm";
			await execa("npm", ["install"], { cwd: inital.path });
		}
		pmSpinner.stop(chalk.bold.green("Dependencies installed!"));
	}
	switch (installDeps.install || cliResults.flags.install) {
		case true:
			prompt.note(
				`cd ${inital.path ?? providedName} \n${packageManager} run dev`,
				chalk.bold.magenta("Done creating. Now run:")
			);
			break;
		case false:
			prompt.note(
				`cd ${
					inital.path ?? providedName
				} \n${packageManager} install \n${packageManager} run dev`,
				chalk.bold.magenta("Done creating. Now run:")
			);
			break;
	}
	if (inital.type === "basic") {
		const spinner = prompt.spinner();
		spinner.start();
		spinner.message(chalk.yellow("Scaffolding project..."));
		await scaffold({
			projectName: inital.path ?? providedName,
			scaffoldType: inital.type,
		});
		spinner.stop(chalk.bold.green("Scaffold complete!"));
		prompt.note(
			`cd ${inital.path} \nAnd get to work!`,
			chalk.bold.magenta("Done. Now Do:")
		);
	}
}

async function cli() {
	prompt.intro(
		chalk.magenta("Welcome to Create Proxy App CLI! Let's get started")
	);
	await project();
}

export { cli };
