import * as fs from "fs";
import * as vue from "vue";
import * as container from "./container";
import element_ui from "element-plus";

const weak_map = new WeakMap<any, vue.App>();

const option = {
	listeners: {
		show() {
			console.log("show");
		},
		hide() {
			console.log("hide");
		},
	},
	template: `<div id="app"> <container></container> </div>`,
	style: fs.readFileSync(`${__dirname}/container.css`, "utf-8"),
	$: {
		app: "#app",
	},
	methods: {},
	ready() {
		if (this.$.app) {
			const app = vue.createApp({});
			app.config.compilerOptions.isCustomElement = (tag_s) => tag_s.startsWith("ui-");
			app.use(element_ui);
			app.component("container", container);
			app.mount(this.$.app);
			weak_map.set(this, app);
		}
	},
	beforeClose() {},
	close() {
		const app = weak_map.get(this);
		if (app) {
			app.unmount();
		}
	},
};

export = Editor.Panel.define(option);
