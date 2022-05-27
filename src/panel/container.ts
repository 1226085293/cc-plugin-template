import * as fs from "fs";
import * as vue from "vue";
import config from "../config";

interface css_info {
	/** css 路径 */
	url_s: string;
	/** 挂载节点 */
	parent: ParentNode;
}

const option: vue.Component = {
	template: fs.readFileSync(`${__dirname}/container.html`, "utf-8"),
	methods: {
		/** 动态加载 css */
		load_css(info_as_: css_info[]): void {
			info_as_.forEach((v) => {
				let css = document.createElement("link");
				css.rel = "stylesheet";
				css.href = v.url_s;
				v.parent.appendChild.call(v.parent, css);
			});
		},

		async click_scene_script(): Promise<void> {
			const result = await Editor.Message.request("scene", "execute-scene-script", {
				name: config.name_s,
				method: "event_template",
				args: [1],
			});
			console.log("场景脚本返回", result);
		},
	},
	data() {
		return {};
	},
	watch: {},
	created() {},
	mounted() {
		this.load_css([
			{
				parent: document.head,
				url_s: config.path_s + "/node_modules/element-plus/dist/index.css",
			},
			{
				parent: this.$el,
				url_s: config.path_s + "/node_modules/element-plus/dist/index.css",
			},
		]);
	},
};

export = option;
