import fs from "fs-extra";
import { downloadTemplate } from "giget";
import path from "path";
import { fileURLToPath } from "url";

interface options {
	projectName: string;
	scaffoldType: string;
}

const packageRoot = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	".."
);

function localTemplateDir(template: string) {
	return path.join(packageRoot, "templates", template);
}

async function copyLocalTemplate(template: string, projectName: string) {
	const source = localTemplateDir(template);
	await fs.copy(source, projectName);
}

async function template(template: string, projectName: string) {
	try {
		if (await fs.pathExists(localTemplateDir(template))) {
			await copyLocalTemplate(template, projectName);
		} else {
			await downloadTemplate(
				`github:MercuryWorkshop/scramjet/packages/create-proxy-app/templates/${template}`,
				{
					force: false,
					provider: "github",
					cwd: projectName,
					dir: ".",
				}
			);
		}
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
