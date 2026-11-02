// 按"轮"数上下文：一轮 = 一条人说的话（QQ 消息或 dsh 里输入的话）加上她接下来的回复和工具调用。
// 这里只放不依赖 dsh 运行时的纯函数，方便单元测试。
/** 算"人说的话"的消息来源：dsh 里输入的（user）、QQ 来的（plugin:napcat-bridge）。其他（压缩摘要、运行信息、技能等）不算一轮。 */
export const HUMAN_SOURCES = new Set(['user', 'plugin:napcat-bridge']);
export function isHumanTurn(event) {
    if (event === undefined || event.type !== 'user/message')
        return false;
    const kind = event.data?.source?.kind;
    return typeof kind === 'string' && HUMAN_SOURCES.has(kind);
}
/** 当前上下文里一共有几轮。 */
export function countRounds(session) {
    let n = 0;
    for (const seq of session.surface.nodes)
        if (isHumanTurn(session.eventAt(seq)))
            n += 1;
    return n;
}
/**
 * 这一轮刚开始、人说的话还没放进上下文吗？dsh 在每一步发请求前检查要不要压缩（agent/pre-step），
 * 新一轮的第一步检查时，新消息还排在后面没进上下文。往回找日志：先碰到 turn/start 说明还没进来。
 */
export function pendingHumanTurn(session) {
    const top = typeof session.seq === 'number' ? session.seq - 1 : -1;
    for (let seq = top; seq >= 0; seq--) {
        const ev = session.eventAt(seq);
        if (ev === undefined)
            continue;
        if (isHumanTurn(ev))
            return false;
        if (ev.type === 'turn/start')
            return true;
    }
    return false;
}
/**
 * 挑出最早的 drop 轮（至少留下最新的一轮），返回要截掉/压缩的节点范围。
 * 开头的系统消息不动；切口不能把工具调用和它的结果分开（balanced 判断切口是否完整）。
 * 上一次的压缩摘要在最前面，会一起被处理（LLM 压缩时合并进新摘要）。
 */
export function selectRounds(session, drop, balanced) {
    const nodes = session.surface.nodes;
    if (nodes.length === 0 || drop <= 0)
        return null;
    const firstIdx = session.eventAt(nodes[0])?.type === 'system/message' ? 1 : 0;
    const human = [];
    for (let i = firstIdx; i < nodes.length; i++)
        if (isHumanTurn(session.eventAt(nodes[i])))
            human.push(i);
    if (human.length <= 1)
        return null;
    const k = Math.min(drop, human.length - 1);
    let keepFromIdx = human[k];
    while (keepFromIdx > firstIdx && !balanced(nodes[keepFromIdx]))
        keepFromIdx -= 1;
    if (keepFromIdx <= firstIdx)
        return null;
    return { start: nodes[firstIdx], end: nodes[keepFromIdx - 1], rounds: k };
}
/** 截断时留在原处的一句话。 */
export function truncationNote(rounds) {
    return '（更早的 ' + rounds + ' 轮对话已经省略。需要的话可以回想记忆。）';
}
/** LLM 压缩用的指令：中文、她的第一人称，作为最后一条用户消息接在被压缩的对话后面（能用上对话前缀的缓存）。 */
export const SUMMARY_INSTRUCTION = [
    '现在暂停聊天：请你以第一人称（"我"）把上面这段对话整理成一份回忆，替换掉这段对话的原文。之后你会接着这份回忆继续聊天，所以要让你自己读了以后能自然地接上。',
    '',
    '严格按下面的结构输出，每一节都要有，没有内容的写"（无）"。用简短的要点，不要写成长篇。',
    '',
    '## 我们聊了什么',
    '- 按时间顺序的主要话题和事情经过',
    '',
    '## 对方的状态和心情',
    '- 他/她最近在忙什么、心情怎么样、身体怎么样（群聊时按人分别写，写清昵称和 QQ 号）',
    '',
    '## 约定和答应过的事',
    '- 谁答应了谁什么、约好的时间，尽量保留原话',
    '',
    '## 还没聊完的话题',
    '- 说到一半的事、还没回答的问题',
    '',
    '## 我的感受',
    '- 我当时的心情、想法，和对方之间发生的值得记住的瞬间',
    '',
    '## 重要细节',
    '- 名字、称呼、数字、日期、地点、原话等不能丢的细节',
    '',
    '规则：',
    '- 用中文，用"我"指自己；准确保留名字、数字、日期和原话。',
    '- 如果上面已经有一份 <compacted-summary> 回忆，那是之前的回忆：保留仍然成立的内容，去掉过时的，把新内容合并进同一份结构里，不要原样照抄。',
    '- 不要提到"整理""压缩""摘要"这件事本身；只输出回忆正文，不要调用任何工具。',
].join('\n');
