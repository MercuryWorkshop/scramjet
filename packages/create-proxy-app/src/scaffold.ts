import chalk from "chalk";
import fs from "fs-extra";
import { downloadTemplate } from "giget";
import sortPackageJson from "sort-package-json";
import path from "path";
import { fileURLToPath } from "url";

interface options {
	projectName: string;
	scaffoldType: string;
}

async function template(template: string, projectName: string) {
	try {
		await downloadTemplate(
			`github:MercuryWorkshop/scramjet/packages/create-proxy-app/templates/${template}`,
			{
				force: false,
				provider: "github",
				cwd: projectName,
				dir: ".",
			}
		);
	} catch (err: any) {
		//remove the dir if it's likely to be created by the CLI
		if (
			projectName !== "." &&
			projectName !== "./" &&
			projectName.startsWith("../")
		) {
			try {
				fs.rmdirSync(projectName);
			} catch (_) {}
		}
		if (err.message.includes("404")) {
			throw new Error(
				"It looks like we were not able to get the template. \n Please try again later"
			);
		} else {
			throw new Error(err.message);
		}
	}
	//doublecheck the folder to make sure it's not empty
	if (fs.readdirSync(projectName).length === 0) {
		throw new Error(
			"It looks like the folder is empty. \n Please try again later"
		);
	}
}

async function scaffold(opts: options) {
	await template("default", opts.projectName);
}

export { scaffold };
