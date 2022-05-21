import * as fs from "fs";
import * as vue from "vue";
import config from "../config";

const option: vue.Component = {
	template: fs.readFileSync(`${__dirname}/container.html`, "utf-8"),
	methods: {},
	data: function () {
		return {};
	},
	watch: {},
	created: async function () {},
	beforeClose: function () {},
	close: function () {},
};

export = option;
