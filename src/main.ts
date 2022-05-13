import config from "./config";

// export function load() {}
// export function unload() {}

export const methods = {
	/**打开面板 */
	open() {
		Editor.Panel.open(config.name_s);
	},
};
