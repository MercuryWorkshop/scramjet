"use strict";

const { resolve } = require("node:path");

const controllerPath = resolve(__dirname, "..", "dist");

exports.controllerPath = controllerPath;
