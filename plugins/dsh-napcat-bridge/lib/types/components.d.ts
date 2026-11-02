export type ComponentType = 'Plain' | 'Image' | 'Record' | 'Video' | 'File' | 'Face' | 'At' | 'Node' | 'Nodes' | 'Poke' | 'Reply' | 'Forward' | 'RPS' | 'Dice' | 'Shake' | 'Share' | 'Contact' | 'Location' | 'Music' | 'Json' | 'Unknown';
export interface Component {
    type: ComponentType;
    [key: string]: any;
}
/** 构造组件：只取声明过的字段；必填字段（默认 undefined）缺失时抛错，相当于 pydantic 校验失败。 */
export declare function make(type: ComponentType, data?: Record<string, unknown>): Component;
export declare const Plain: (text: string) => Component;
export declare const At: (data: {
    qq: string | number;
    name?: string;
}) => Component;
/** Poke(poke_type=None, **_)：兼容旧签名 Poke(type="poke")，空/poke 时为 "126"。 */
export declare function Poke(data?: Record<string, unknown>): Component;
/** File(name, file="", url="") */
export declare const File: (data: {
    name: string;
    file?: string;
    url?: string;
}) => Component;
/** Json(data: str | dict) */
export declare function Json(data: Record<string, unknown>): Component;
/** OneBot 段类型 → 组件构造（AstrBot ComponentTypes）。 */
export declare const ComponentTypes: Record<string, (data: Record<string, any>) => Component>;
/** BaseMessageComponent.toDict 及各子类的覆盖。 */
export declare function toDict(comp: Component): Record<string, any>;
/** Image.convert_to_base64 / Record.convert_to_base64 */
export declare function convertToBase64(comp: Component): Promise<string>;
/** BaseMessageComponent.to_dict（异步版）及 File/Video/Node/Nodes 的覆盖。 */
export declare function toDictAsync(comp: Component): Promise<Record<string, any>>;
/** pathlib.Path(x).is_absolute() 且不含 :// 时转 file: URI（AiocqhttpMessageEvent._from_segment_to_dict）。 */
export declare function toFileUri(value: string): string;
/** MessageChain：AstrBot 的消息链只是组件列表。 */
export interface MessageChain {
    chain: Component[];
}
