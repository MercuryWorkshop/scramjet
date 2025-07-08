import type { Component } from "dreamland/core";
import { Icon } from "./ui/Icon";
import type { IconifyIcon } from "@iconify/types";
import iconBack from "@ktibow/iconset-material-symbols/arrow-back";
import iconForwards from "@ktibow/iconset-material-symbols/arrow-forward";
import iconRefresh from "@ktibow/iconset-material-symbols/refresh";
import iconExtension from "@ktibow/iconset-material-symbols/extension";

export const Spacer: Component = function (cx) {
	cx.css = `
    :scope {
      width: 2em;
    }
  `;
	return <div></div>;
};

export const UrlInput: Component = function (cx) {
	cx.css = `
    :scope {
      flex: 1;
      display: flex;
      padding: 0.25em;
    }
    input {
      width: 100%;
      height: 100%;
      border: none;
      outline: none;
      border-radius: 4px;
    }
  `;
	return (
		<div>
			<input></input>
		</div>
	);
};

export const IconButton: Component<{ icon: IconifyIcon }> = function (cx) {
	cx.css = `
    :scope {
      padding: 0.4em;
      display: flex;
      outline: none;
      border: none;
      font-size: 1.25em;
      background: inerhit
      # background: var(--aboutbrowser-toolbar-bg);
      cursor: pointer;
    }
  `;
	return (
		<button>
			<Icon icon={this.icon} />
		</button>
	);
};

export const Omnibox: Component<{}> = function (cx) {
	cx.css = `
	  :scope {
     	background: var(--aboutbrowser-omnibox-bg);
      display: flex;
      padding: 0px 7px 0px 7px;
    }
	`;

	return (
		<div>
			<IconButton icon={iconBack}></IconButton>
			<IconButton icon={iconForwards}></IconButton>
			<IconButton icon={iconRefresh}></IconButton>
			<Spacer></Spacer>
			<UrlInput></UrlInput>
			<Spacer></Spacer>
			<IconButton icon={iconExtension}></IconButton>
		</div>
	);
};
