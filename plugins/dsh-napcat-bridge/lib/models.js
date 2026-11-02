// 设置页「获取模型列表」：用填的 Key 去 OpenAI 兼容接口的 GET /models 拉这个账号能用的模型，再按用途（向量 / 语音转文字）挑出来。
// 拉不到（接口不支持 /models、Key 不对、连不上）时返回错误，设置页退回到预设里写好的常用模型。
// 这个文件在 dsh-napcat-bridge 和 dsh-companion-core 里各有一份，内容一样，改的时候两边一起改。
const PATTERNS = {
    embedding: /embed|bge|bce-|m3e|gte-|\be5-|e5-|nomic|jina-emb|text-embedding/i,
    stt: /whisper|asr|transcri|sensevoice|speech|voxtral|paraformer|telespeech/i,
    // 聊天模型：名字看不出用途的都算，排除明显是别的用途的
    chat: /^(?!.*(embed|rerank|bge|bce-|m3e|whisper|asr|transcri|sensevoice|tts|speech|voice|audio|image|flux|stable-diffusion|sdxl|kolors|video|wan2|moderation|dall-e|ocr)).*$/i,
};
const TIMEOUT_MS = 20_000;
/**
 * @param apiUrl - 接口地址，到 /v1 这一级
 * @param apiKey - Key；本机服务（Ollama 等）可以为空
 * @param query - 附在 /models 后面的查询串（例如硅基流动的 ?sub_type=embedding）
 */
export async function listModels(apiUrl, apiKey, kind, query = '', doFetch = fetch) {
    const base = apiUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base))
        return { ok: false, error: '接口地址要以 http:// 或 https:// 开头' };
    try {
        const res = await doFetch(base + '/models' + (query.startsWith('?') || query === '' ? query : '?' + query), {
            headers: apiKey.trim() ? { authorization: 'Bearer ' + apiKey.trim() } : {},
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
            let detail = '';
            try {
                detail = (await res.text()).slice(0, 200);
            }
            catch { /* 读不到就算了 */ }
            return { ok: false, error: '接口返回 HTTP ' + res.status + (res.status === 401 || res.status === 403 ? '（Key 不对或没有权限）' : res.status === 404 ? '（这家不支持列出模型）' : '') + (detail ? '：' + detail : '') };
        }
        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
        // Gemini 的 OpenAI 兼容接口给的是 models/xxx
        const ids = [...new Set(rows.map(r => String(r.id ?? r.name ?? '').replace(/^models\//, '')).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        if (ids.length === 0)
            return { ok: false, error: '接口没返回任何模型' };
        const picked = ids.filter(id => PATTERNS[kind].test(id));
        return picked.length > 0 ? { ok: true, models: picked, filtered: true, total: ids.length } : { ok: true, models: ids, filtered: false, total: ids.length };
    }
    catch (e) {
        return { ok: false, error: e instanceof Error ? (e.name === 'TimeoutError' ? '连接超时' : e.message) : String(e) };
    }
}
