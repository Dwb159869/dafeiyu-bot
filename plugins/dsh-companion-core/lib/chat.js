// 不走 dsh、直接用自己的 Key 调别家模型（OpenAI 兼容的 /chat/completions）：压缩、整理记忆、抽关系都可以选这种。
// 各家「思考」的开关写法不一样，按接口地址认是哪一家（THINK_STYLES），把统一的等级（off / low / medium / high）翻成那一家的参数。
/** 接口地址里包含这些就认成对应的写法；都不像就是 none。 */
const THINK_STYLES = [
    [/api\.openai\.com|generativelanguage\.googleapis\.com|api\.groq\.com/i, 'effort'],
    [/dashscope(-intl)?\.aliyuncs\.com|api\.siliconflow\.(cn|com)/i, 'budget'],
    [/open\.bigmodel\.cn|api\.z\.ai|volces\.com/i, 'toggle'],
    [/openrouter\.ai/i, 'openrouter'],
];
export function thinkStyleOf(apiUrl) {
    for (const [re, style] of THINK_STYLES)
        if (re.test(apiUrl))
            return style;
    return 'none';
}
/** 这种写法能选哪些等级（设置页下拉用）。 */
export function effortsOf(style) {
    if (style === 'none')
        return [];
    if (style === 'toggle')
        return ['off', 'low'];
    return ['off', 'low', 'medium', 'high'];
}
const BUDGET = { low: 1024, medium: 4096, high: 16384 };
/** 把统一的等级翻成这一家的请求参数。 */
export function thinkParams(style, effort) {
    const e = effort ?? '';
    if (e === '' || style === 'none')
        return {};
    if (style === 'effort')
        return e === 'off' ? {} : { reasoning_effort: e };
    if (style === 'budget')
        return e === 'off' ? { enable_thinking: false } : { enable_thinking: true, thinking_budget: BUDGET[e] ?? BUDGET.low };
    if (style === 'toggle')
        return { thinking: { type: e === 'off' ? 'disabled' : 'enabled' } };
    return e === 'off' ? { reasoning: { enabled: false } } : { reasoning: { effort: e } };
}
const TIMEOUT_MS = 180_000;
/** 发一条提示词（可以带一段系统提示），拿回文字。失败抛错。 */
export async function chatComplete(t, prompt, maxTokens = 4096, signal, doFetch = fetch) {
    const url = t.url.trim().replace(/\/+$/, '') + '/chat/completions';
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(t.key.trim() ? { authorization: 'Bearer ' + t.key.trim() } : {}) },
        body: JSON.stringify({
            model: t.model.trim(),
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            stream: false,
            ...thinkParams(thinkStyleOf(t.url), t.effort),
        }),
        signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    if (!res.ok) {
        let detail = '';
        try {
            detail = (await res.text()).slice(0, 300);
        }
        catch { /* 读不到就算了 */ }
        throw new Error('模型接口返回 HTTP ' + res.status + (detail ? '：' + detail : ''));
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content
        : Array.isArray(content) ? content.map(p => typeof p === 'string' ? p : String(p?.text ?? '')).join('') : '';
    if (text.trim() === '')
        throw new Error('模型没有返回文字' + (json.choices?.[0]?.finish_reason === 'length' ? '（思考用完了输出长度，把思考等级调低试试）' : ''));
    return text;
}
