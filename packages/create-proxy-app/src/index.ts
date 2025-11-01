#! /usr/bin/env node
import chalk from "chalk";
import { cli } from "./cli";
cli().catch((err) => {
	console.error(chalk.red("\n" + err));
	process.exit(0);
});
