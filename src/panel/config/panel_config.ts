import * as fs from "fs";
import path from "path";
import * as vue from "vue";
import lib_css from "../../../../@libs/lib_css";
import config from "../../config";

const component: vue.Component = {
	template: fs.readFileSync(`${__dirname}/panel_config.html`, "utf-8"),
	methods: {},
	data() {
		return {};
	},
	watch: {},
	created() {},
	mounted() {
		// 加载 css
		lib_css.load([
			{
				parent: this.$el,
				url_s: path.join(config.path_s, "src/panel", "config", "panel_config.css"),
			},
		]);
	},
};

export = component;
