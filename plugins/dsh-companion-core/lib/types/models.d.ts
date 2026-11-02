export type ModelKind = 'embedding' | 'stt' | 'chat';
export interface ModelList {
    ok: true;
    /** 按用途挑出来的模型 id（排好序） */
    models: string[];
    /** 没按用途挑出来时为 false（接口给的模型名看不出用途，返回了全部） */
    filtered: boolean;
    total: number;
}
/**
 * @param apiUrl - 接口地址，到 /v1 这一级
 * @param apiKey - Key；本机服务（Ollama 等）可以为空
 * @param query - 附在 /models 后面的查询串（例如硅基流动的 ?sub_type=embedding）
 */
export declare function listModels(apiUrl: string, apiKey: string, kind: ModelKind, query?: string, doFetch?: typeof fetch): Promise<ModelList | {
    ok: false;
    error: string;
}>;
