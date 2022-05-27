export function load() {}

export function unload() {}

/** 场景事件放在此处 */
export const methods = {
	event_template(event_: number): number {
		console.log("场景脚本事件", event_);
		return event_ + 1;
	},
};
