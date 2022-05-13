import * as fs from "fs";
import path from "path";
import * as vue from "vue";
import config from "../config";
const image_decode = require("image-decode");
const image_encode = require("image-encode");

/** 页签 */
enum tab {
	/** 纹理生成 */
	texture_generate,
	/** 生成配置 */
	generate_config,
	/** 联系作者 */
	contact_author,
}

const option: vue.Component = {
	template: fs.readFileSync(`${__dirname}/container.html`, "utf-8"),
	methods: {
		/** 一键生成 */
		async button_generate(this): Promise<void> {
			let texture_ss: string[] = this.texture_ss;
			let folder_ss: string[] = this.folder_ss;
			/** 图片路径列表 */
			const image_path_list_ss: string[] = [];

			// 剔除无效值
			{
				texture_ss = texture_ss.filter((v_s) => v_s);
				folder_ss = folder_ss.filter((v_s) => v_s);
			}
			// 添加图片路径
			image_path_list_ss.push(
				...(
					await Promise.all(
						texture_ss.map(async (v_s) =>
							v_s
								? (await Editor.Message.request("asset-db", "query-path", v_s))!
								: ""
						)
					)
				).filter((v_s) => v_s)
			);
			// 添加文件夹内图片路径
			{
				/** 遍历文件夹 */
				let traverse_folder_f = async (v_s: string): Promise<void> => {
					let files: string[] = fs.readdirSync(v_s);
					for (let file of files) {
						let file_path_s = `${v_s}/${file}`;
						let stat = fs.statSync(file_path_s);
						if (stat.isFile()) {
							if (file.endsWith(".png") || file.endsWith(".jpg")) {
								image_path_list_ss.push(file_path_s);
							}
						} else if (stat.isDirectory()) {
							traverse_folder_f(file_path_s);
						}
					}
				};
				for (let v_s of folder_ss) {
					await traverse_folder_f(v_s);
				}
			}
			if (!image_path_list_ss.length) {
				console.warn("无资源可供生成");
				return;
			}
			console.log("开始生成");
			this.generate_progress_n = 0;
			this.generate_state_b = true;
			// 开始生成
			try {
				/** RGBA 通道下标，用于去除背景色 */
				const channel = 3;
				/** 截止参数，字形内1和外0的SDF平衡 */
				let cutoff = 0;
				/**	SDF的最大长度，即截止点周围 SDF 的大小 */
				let radius = this.sdf_radius_n;

				const INF = 1e20;

				// 2D Euclidean distance transform by Felzenszwalb & Huttenlocher https://cs.brown.edu/~pff/dt/
				let edt = function (
					data: any,
					width: any,
					height: any,
					f: any,
					d: any,
					v: any,
					z: any
				) {
					for (var x = 0; x < width; x++) {
						for (var y = 0; y < height; y++) {
							f[y] = data[y * width + x];
						}
						edt1d(f, d, v, z, height);
						for (y = 0; y < height; y++) {
							data[y * width + x] = d[y];
						}
					}
					for (y = 0; y < height; y++) {
						for (x = 0; x < width; x++) {
							f[x] = data[y * width + x];
						}
						edt1d(f, d, v, z, width);
						for (x = 0; x < width; x++) {
							data[y * width + x] = Math.sqrt(d[x]);
						}
					}
				};

				// 1D squared distance transform
				let edt1d = function (f: any, d: any, v: any, z: any, n: any) {
					v[0] = 0;
					z[0] = -INF;
					z[1] = +INF;

					for (var q = 1, k = 0; q < n; q++) {
						var s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
						while (s <= z[k]) {
							k--;
							s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
						}
						k++;
						v[k] = q;
						z[k] = s;
						z[k + 1] = +INF;
					}

					for (q = 0, k = 0; q < n; q++) {
						while (z[k + 1] < q) k++;
						d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
					}
				};
				image_path_list_ss.forEach((v_s) => {
					let { data, width, height } = image_decode(fs.readFileSync(v_s));
					// 初始化数据
					let stride = Math.floor(data.length / width / height);
					let w = width + this.extend_radius_n * 2;
					let h = height + this.extend_radius_n * 2;
					let size = Math.max(w, h);

					// 将整型数据转换为浮点数
					let initData = data;
					data = Array(w * h);
					Array.prototype.fill.call(data, 0);
					// for (let k_n = 0, length_n = data.length; k_n < length_n; k_n++) {
					// 	data[k_n] = initData[k_n * stride + channel] / 255;
					// }

					/** 空白块大小 */
					let blank_block_size_n =
						(this.extend_radius_n * 2 + width) * this.extend_radius_n;
					/** 拷贝数据下标 */
					let copy_index_n = 0;
					let temp_n = width + this.extend_radius_n;
					for (
						let k_n = blank_block_size_n, length_n = data.length - blank_block_size_n;
						k_n < length_n;

					) {
						for (let k2_n = 0; k2_n < this.extend_radius_n * 2 + width; k_n++, k2_n++) {
							data[k_n] =
								k2_n < this.extend_radius_n || k2_n >= temp_n
									? 0
									: initData[copy_index_n++ * stride + channel] / 255;
						}
					}

					// 用于距离变换的临时数组
					let gridOuter = Array(w * h);
					let gridInner = Array(w * h);
					let f = Array(size);
					let d = Array(size);
					let z = Array(size + 1);
					let v = Array(size);

					for (let k_n = 0, length_n = w * h; k_n < length_n; k_n++) {
						let a = data[k_n];
						gridOuter[k_n] =
							a === 1 ? 0 : a === 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
						gridInner[k_n] =
							a === 1 ? INF : a === 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
					}

					edt(gridOuter, w, h, f, d, v, z);
					edt(gridInner, w, h, f, d, v, z);

					let dist = window.Float32Array ? new Float32Array(w * h) : new Array(w * h);
					for (let k_n = 0, length_n = w * h; k_n < length_n; k_n++) {
						dist[k_n] = Math.min(
							Math.max(1 - ((gridOuter[k_n] - gridInner[k_n]) / radius + cutoff), 0),
							1
						);
					}

					// 还原图形
					for (let k_n = 0; k_n < w; k_n++) {
						for (let k2_n = 0; k2_n < h; k2_n++) {
							data[k2_n * w * 4 + k_n * 4] = dist[k2_n * w + k_n] * 255;
							data[k2_n * w * 4 + k_n * 4 + 1] = dist[k2_n * w + k_n] * 255;
							data[k2_n * w * 4 + k_n * 4 + 2] = dist[k2_n * w + k_n] * 255;
							data[k2_n * w * 4 + k_n * 4 + 3] = 255;
						}
					}

					// 写入文件
					let extname_s = path.extname(v_s);
					let file_name_s =
						v_s.slice(0, v_s.length - extname_s.length) + "_sdf" + extname_s;
					fs.writeFileSync(
						file_name_s,
						Buffer.from(image_encode(data, [w, h], extname_s.slice(1)))
					);
				});
			} catch (e) {
				this.generate_state_b = false;
				return;
			}

			// 生成完成
			this.generate_state_b = false;

			console.log("生成完成，共", image_path_list_ss.length, "个资源");
		},
	},
	data: function () {
		return {
			/** 页签 */
			tab: tab.texture_generate,
			/** 纹理生成 */
			get texture_generate() {
				return this.tab === tab.texture_generate;
			},
			/** 生成配置 */
			get generate_config() {
				return this.tab === tab.generate_config;
			},
			/** 联系作者 */
			get contact_author() {
				return this.tab === tab.contact_author;
			},
			/** 生成状态 */
			generate_state_b: false,
			/** 生成进度 */
			generate_progress_n: 0,
			/** 图片列表 */
			texture_ss: [""],
			/** 文件夹列表 */
			folder_ss: [""],
			/** sdf 范围 */
			sdf_radius_n: 0,
			/** 扩充半径 */
			extend_radius_n: 0,
		};
	},
	watch: {
		sdf_radius_n: function (v_n) {
			Editor.Profile.setProject(config.name_s, "sdf_radius_n", v_n);
		},
		extend_radius_n: function (v_n) {
			Editor.Profile.setProject(config.name_s, "extend_radius_n", v_n);
		},
	},
	created: async function () {
		this.sdf_radius_n =
			(await Editor.Profile.getProject(config.name_s, "sdf_radius_n")) ?? this.sdf_radius_n;
		this.extend_radius_n =
			(await Editor.Profile.getProject(config.name_s, "extend_radius_n")) ??
			this.extend_radius_n;
	},
	beforeClose: function () {},
	close: function () {},
};

module.exports = option;
