// dsh-companion-core 设置页（浏览器一侧），嵌在 dsh「插件」页里（plugins.bundle.config 扩展点）。
// 普通设置读写 dsh 设置服务里本插件的配置行（id: companion-core），点「保存」后插件立即读到新值；
// 人格稿和核心记忆是文件，用各自的「保存」按钮，经 <dsh>/api/companion/… 接口读写（要先登录 dsh）。
// 只用 dsh 自带的表单组件和 --dsw-* 颜色变量，深色/浅色主题自动跟随；桌面端和 Web 端都用这一份：
// 不用 window.confirm/alert（桌面端可能不显示），确认都放在页面里；窄窗口下自动换行。
// 这个文件不经过打包，构建时原样复制到 lib/client.js。
window.__ModuleLoader__.load({
	id: "dsh-companion-core",
	factory: (require) => {
		var exports = {};
		var reactModule = require("react");
		var React = typeof reactModule.createElement === "function" ? reactModule : reactModule.default;
		var P = require("@deepseek-ai/dsh-client-ui-primitives");
		var h = React.createElement;

		var NS = "companionCore";
		var PACKAGE = "dsh-companion-core";
		var SECTION = "companion-core";

		var zh = {
			unsavedBar: "有改动还没保存：点「保存」才生效，离开这个页面会丢掉",
			discardChanges: "放弃改动",
			diaryModel: "写日记用的模型",
			diaryModelHint: "日记和月度总览使用管理员私聊模型，依次回退至普通私聊模型及 dsh 默认模型。模型选择在 dsh-napcat-bridge 中配置；此处单独设置思考等级，默认 high，仅在模型支持时生效。",
			diaryModelFrom_admin: "来自 dsh-napcat-bridge「管理员私聊用的模型」。",
			diaryModelFrom_private: "dsh-napcat-bridge 没单独设管理员私聊的模型，用的是「私聊用的模型」。",
			diaryModelFrom_default: "没装 dsh-napcat-bridge 或它没设模型，用的是 dsh 的默认模型。",
			diaryModelFrom_none: "dsh 还没有可用的模型。",
			apiKeySet: "已设置 Key。",
			apiKeyUnset: "还没设置 Key。",
			embedFoldClose: "收起向量模型设置",
			embedFold: "向量模型：{provider} · {model}（点开修改）",
			llmTestFailed: "不通：{error}",
			llmTestOk: "通了：{model}，思考等级 {effort}，{ms} 毫秒，回复「{text}」",
			llmTest: "测试这个模型",
			effort_max: "最高",
			effort_high: "高",
			effort_medium: "中",
			effort_low: "低",
			effort_minimal: "最少",
			effort_off: "关闭（不思考）",
			effortDefault: "模型默认",
			effortUnsupported: "（这个模型不支持）",
			effortPickModel: "先选模型。",
			effortNoneApi: "这家不能调思考等级（或者看不出来），由模型自己决定。",
			effortNone: "这个模型不能调思考等级。",
			effortHint: "选择目标模型支持的思考等级。较高等级通常增加生成时间与用量；不支持此参数的模型使用服务默认行为。选项随模型或服务变化。",
			effort: "思考等级",
			chatApiUrlHint: "聊天补全服务的 OpenAI 兼容基础地址，通常填写至 /v1。插件会追加 /chat/completions，不应重复填写具体接口路径。",
			apiModel: "模型",
			dshModelsFailed: "读不到 dsh 的模型列表：{error}",
			dshModelPick: "选一个模型",
			dshModelHint: "选择已在 dsh“设置 → 模型”中配置的模型，按提供方分组。此处不单独配置该提供方的凭据。",
			dshModel: "dsh 里的模型",
			followNone: "dsh 还没有默认模型",
			followUses: "现在会用",
			sourceApi: "其他服务商（用自己的 Key）",
			sourceDsh: "dsh 里配置的模型",
			followGraphNote: "用「记忆生成」里整理用的模型和思考等级。",
			followGraph: "和「整理用的模型」一样",
			followMemory: "跟随 dsh 配置（dsh 的默认模型）",
			followSummaryNote: "用正在聊的这个会话的模型和思考等级，不用另外设置。",
			followSummary: "跟随 dsh 配置（用这个会话自己的模型）",
			langIsEn: "0",
			provider: "服务商",
			providerHint: "选择服务商预设以填入接口基础地址和常用模型。选择“自定义”时，请使用与当前任务对应的 OpenAI 兼容接口；通常填写至 /v1。",
			providerSearch: "搜索服务商",
			providerCustom: "自定义（OpenAI 兼容）",
			providerGetKey: "去这家拿 Key ↗",
			pModelHint: "使用当前填写或已保存的凭据获取模型列表；失败时仍可使用预设选项或手动填写模型标识。列表仅供选择，不保证账号具有调用权限。",
			modelFetch: "获取模型列表",
			modelFetching: "正在获取…",
			modelFetched: "拿到 {n} 个可用的模型，在下拉里选。",
			modelFetchedAll: "拿到 {n} 个模型（从名字看不出哪些能用在这里，全列出来了）。",
			modelFetchFailed: "没拉到模型列表：{error}。下拉里是这家常用的模型。",
			modelManual: "手动填写…",
			modelManualLabel: "模型名（手动填写）",
			modelPickList: "从列表选",
			modelNoteArk: "火山方舟的模型可以填模型名，也可以填控制台里建的推理接入点 ID（ep- 开头）。",
			modelNoteLocal: "本机服务：先在服务器上装好并下载模型；Key 随便填一个（比如 local）。",
			summary: "人格和核心记忆对所有会话即时生效，按轮数截断或用中文回忆压缩上下文，消息存档。",
			status: "状态",
			statusHint: "显示插件数据目录及运行状态。人格、核心记忆、日记、历史版本、消息存档和记忆数据库均由此目录管理；迁移时可使用备份功能，或在停止写入后复制完整目录。",
			dataDir: "数据目录：{dir}",
			napcatOn: "dsh-napcat-bridge已连上：QQ 会话按主人 / 其他私聊 / 群聊分规则。",
			napcatOff: "没检测到dsh-napcat-bridge：所有会话都按「主人」处理，也不会有消息存档。",
			archiveCount: "存档 {total} 条（私聊 {private}，群聊 {group}）",
			loading: "正在读取…",
			loadFailed: "读取失败：{error}",
			scope: "生效范围",
			scopeHint: "本插件按预设筛选会话，再应用人格、核心记忆、召回和上下文管理。默认允许 companion 陪伴预设；dsh 内直接创建的受管会话按主人范围处理，QQ 会话由 bridge 区分主人私聊、其他私聊与群聊。",
			pluginAccess: "给其他插件用",
			pluginAccessHint: "控制其他插件通过本插件服务接口读取人格和记忆、写入记忆的范围。“全部”允许按目标访问主人资料；“只给公开的”将访问限制为公开范围；“不给”拒绝接口调用。此项不替代各会话内部的工具权限。",
			pluginAccessAll: "全部（含主人的）",
			pluginAccessPublic: "只给公开的",
			pluginAccessOff: "不给",
			personaPresets: "生效的预设",
			personaPresetsHint: "允许应用本插件人格、核心记忆、召回和上下文管理的预设 ID，默认 companion。多个值用空格或逗号分隔；* 表示全部，列表为空时也不按允许名单限制。仍会排除“不生效的预设”。",
			excludedPresets: "不生效的预设",
			excludedPresetsHint: "明确排除的预设 ID，多个值用空格或逗号分隔。排除规则优先于“生效的预设”，对应会话保留原预设的人格、工具和上下文管理方式。",
			personaOnly: "只用人格",
			personaOnlyHint: "移除 dsh 默认的 Harness 身份说明，使自定义人格不再同时附带该身份句。不会强制覆盖使用 complete 完整替换模式的其他人格插件；此类预设应按实际需求配置排除范围。",
			persona: "人格",
			personaHint: "编辑并“保存人格”后，受管会话后续模型请求将使用最新内容，无需重启。留空时不替换预设原有人格。此处直接编辑不受模型自改人格的审核规则限制。",
			savePersona: "保存人格",
			selfEdit: "让她自己改人格和核心记忆",
			selfEditHint: "仅向主人范围的受管会话提供修改人格和核心记忆的工具，包括管理员 QQ 私聊及 dsh 内直接创建的会话。群聊和其他人的私聊不获得这两项修改权限。",
			personaGuardSec: "改人格的限制",
			personaGuardHint: "模型修改人格时，检查单次新增字数、总长度、大幅删除，以及日期、长数字、链接、邮箱、密钥和改变规则的内容等；可进一步调用模型审核允许与禁止清单。拒绝时向模型返回原因。设置页直接编辑不受该自改流程限制。",
			personaGuard: "限制她改人格",
			personaReview: "改之前让模型审核",
			personaReviewHint: "在硬规则检查通过后，使用“整理用的模型”审核人格修改是否符合允许及禁止清单。调用失败或结果无法解析时，本次修改不予执行。",
			personaEditMaxChars: "一次最多加几个字",
			personaMaxChars: "人格最多几个字",
			personaMaxCharsHint: "模型自改人格的总字数上限，默认 15000，按非空白字符统计。超过上限后仅允许缩短现有内容；设置页直接编辑不受此自改上限流程限制。",
			personaAllowed: "可以写（一行一条）",
			personaForbidden: "不许写（一行一条）",
			historyKeep: "保留几份历史版本",
			historyKeepHint: "人格、主人核心记忆和公开核心记忆分别保留的历史版本数量，默认各 5 份。0 表示不保留历史版本，不会清空当前正文。",
			core: "核心记忆",
			coreHint: "每次模型请求持续附带的关键事实，不参与普通长期记忆的自动遗忘。主人核心记忆仅用于主人范围；公开核心记忆可用于群聊及其他私聊，应仅包含可公开信息。",
			coreMaster: "主人的核心记忆",
			corePublic: "公开的核心记忆",
			saveCore: "保存",
			coreMasterMaxChars: "主人的核心记忆最多几个字",
			coreMasterMaxCharsHint: "主人核心记忆的非空白字符上限，默认 5000。模型修改和设置页保存均检查此上限；现有内容超限时仅允许缩短。此上限为固定配置，不随人格上限自动调整。",
			corePublicMaxChars: "公开的核心记忆最多几个字",
			corePublicMaxCharsHint: "公开核心记忆的非空白字符上限，默认 1500。保存和模型修改均检查上限；内容将用于所有相应受管会话，请勿填写仅限主人可见的资料。",
			chars: "{n} 字",
			saved: "已保存。",
			saveDocFailed: "没保存成功：{error}",
			unsaved: "有改动还没保存",
			history: "历史版本",
			historyEmpty: "还没有历史版本。",
			bySettings: "设置页",
			byTool: "她自己",
			byRestore: "回退",
			view: "查看",
			hide: "收起",
			restore: "回退到这一版",
			restoreConfirm: "回退后当前内容会先存成一份历史版本。确认回退？",
			confirm: "确认",
			cancel: "取消",
			context: "上下文",
			contextHint: "会话轮数或上下文占用达到配置条件时，处理最早的若干轮，可选择截断或模型压缩。“压缩前先整理记忆”决定是否先提取长期记忆；模型报上下文超限时会执行截断重试。一轮按一条真实用户发言及其后续回复计算。",
			thresholdPercent: "到上限的百分之多少就处理",
			thresholdPercentHint: "上下文处理的占用阈值，取值 10～95，默认 70，表示达到模型上下文上限的 70% 时开始处理。与轮数限制共同生效，以先达到的条件为准。",
			masterRow: "主人",
			privateRow: "其他私聊",
			groupRow: "群聊",
			maxRounds: "最多保留轮数",
			maxRoundsHint: "该类会话保留的用户对话轮数上限，默认 60。0 表示关闭轮数触发条件，仍可因上下文占用阈值或模型超限而处理。",
			dropRounds: "一次处理几轮",
			mode: "处理方式",
			modeTruncate: "按轮数截断",
			modeLlm: "让模型写回忆（压缩）",
			modeDefault: "用默认",
			summaryModel: "压缩用的模型",
			summaryModelHint: "上下文处理选择“模型压缩”时，用此模型将旧对话整理为第一人称回忆。默认跟随当前会话模型；也可选择 dsh 已配置模型或独立服务商，压缩会产生额外模型请求。",
			rules: "例外规则",
			rulesHint: "按对方 QQ 号或群号覆盖该类会话的默认设置，留空的字段继承默认值。规则可调整上下文、存档、遗忘及主动聊天，但不能绕过 bridge 的白名单和存档权限边界。",
			rulesEmpty: "还没有例外规则。",
			addRule: "加一条",
			removeRule: "删除",
			kind: "类型",
			kindUser: "QQ 号",
			kindGroup: "群号",
			target: "号码",
			archiveDays: "存档天数",
			archiveUnwoken: "存没唤醒的群消息",
			unwokenOn: "存",
			unwokenOff: "不存",
			note: "备注",
			archive: "消息存档",
			archiveHint: "将获准的 QQ 收发消息保存在 companion 数据库中，与 dsh 会话日志独立。白名单开启时，名单外群聊包括管理员收发均不存，普通名单外私聊不存，管理员私聊允许。到期内容先尝试整理再删除；既有历史不会因移出名单而立即清除。",
			archiveEnabled: "消息存档",
			archiveUnwokenAll: "保存没唤醒她的群消息",
			archiveUnwokenAllHint: "在获准存档的群中，同时保存未触发回复的群消息，默认开启。关闭后不再保存这类来信，并停止附加“最近群聊上下文”；群例外规则可进一步设置，但不能允许名单外群存档。",
			archiveDaysMaster: "主人私聊保留天数",
			archiveDaysOthers: "其他私聊和群聊保留天数",
			log: "日志",
			logLevel: "日志级别",
			logLevelHint: "运行日志详细程度，默认 info。debug 额外记录上下文轮数、占用与处理细节，适用于排查问题，可能增加日志体积。",
			recentLogs: "最近的日志",
			noLogs: "还没有日志。",
			refresh: "刷新",
			overridden: "已修改",
			reset: "恢复默认",
			invalid: "格式不对",
			invalidCount: "请填 0 或正整数",
			invalidPositive: "请填正整数",
			readOnly: "本部署的设置为只读。",
			unavailable: "插件当前没有加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "没有保存成功，修改已保留，请检查后重试。",
			memRecall: "记忆召回",
			memRecallHint: "每轮自动从当前会话可见的长期记忆中检索相关内容，并附加到该轮输入。关键词检索为基础；配置可用向量接口后增加语义检索。主人范围可检索群记忆，群聊和其他私聊不得召回主人私密记忆。",
			recallEnabled: "自动想起相关记忆",
			recallTopK: "每轮最多几条（别人私聊、群聊）",
			recallTopKHint: "其他私聊和群聊每轮自动召回的条数上限，默认 6；0 表示不附加自动召回结果。群聊仅检索本群和公开记忆，实际数量取决于符合条件的结果。",
			recallTopKMaster: "每轮最多几条（主人的会话）",
			recallTopKMasterHint: "主人 QQ 私聊及 dsh 内主人范围会话每轮召回的条数上限，默认 10。可检索主人、公开及群记忆；实际结果仍受可见范围、门槛和排序约束。",
			keywordThreshold: "关键词门槛",
			keywordThresholdHint: "仅使用关键词相关度时的入选门槛，范围 0～1，默认 0.3。数值越高，文字匹配要求越严格，返回结果通常越少。",
			vectorThreshold: "向量门槛",
			vectorThresholdHint: "具备向量的候选记忆使用的综合相关度门槛，范围 0～1，默认 0.45。综合分数同时考虑关键词与向量相似度；缺少向量时使用关键词门槛。",
			keywordWeight: "关键词占比",
			keywordWeightHint: "综合相关度中关键词得分的比例，范围 0～1，默认 0.3，其余比例用于向量相似度。仅在查询和候选记忆均有可用向量时生效。",
			importanceWeight: "重要程度权重",
			recencyWeight: "新近程度权重",
			groupDiscount: "群记忆折扣",
			groupDiscountHint: "主人范围检索群记忆时，对相关度部分应用的折扣系数，范围 0～1，默认 0.7。越小越降低群记忆的排序优先级，不改变群记忆的可见权限。",
			halfLifeDays: "半衰期（天）",
			halfLifeDaysHint: "重要程度与新近程度评分的半衰期，默认 30 天。有效重要程度从最后召回时间或创建时间开始衰减；再次召回会更新其衰减起点，不直接删除记忆。",
			invalidRatio: "请填 0 到 1 之间的数",
			memGen: "记忆生成",
			memGenHint: "使用模型从尚未整理的聊天中提取值得保留的长期记忆。QQ 会话记录整理进度，避免同一段反复提取；需要可用的整理模型，执行时会产生模型请求。",
			activeMemory: "主动记忆",
			activeMemoryHint: "为符合生效范围的会话提供“回忆、记住、遗忘”工具，由模型按需调用。记忆读写仍受会话范围和权限限制；工具挂载在会话创建或插件重新加载时更新。",
			organizeEveryRounds: "每多少轮整理一次",
			organizeEveryRoundsHint: "达到此用户轮数后自动整理尚未处理的聊天，默认 20 轮。0 表示关闭按轮数整理，不关闭手动整理、到期前整理或已启用的压缩前整理。",
			organizeBeforeCompact: "压缩前先整理记忆",
			organizeBeforeCompactHint: "截断或压缩上下文前，先尝试从将要处理的旧对话中提取长期记忆，默认开启，会增加整理模型请求。“对话”和“记忆”标签中的控件修改同一个设置。",
			memoryModel: "整理用的模型",
			memoryModelHint: "用于聊天记忆提取、记忆清理、相近记忆整合及人格修改审核。默认跟随 dsh 默认模型；可选择 dsh 模型或独立服务商。日记和月度总览使用管理员私聊模型，不由此项控制。",
			currentModel: "现在用的模型：{model}",
			noModel: "没找到可用的模型，请填「整理用的模型」或在 dsh 里设置默认模型。",
			pending: "还没整理：QQ 会话 {qs} 个（{qm} 条消息），dsh 会话 {ds} 个",
			organizeNow: "立即整理",
			organizing: "整理中…",
			organizeStarted: "已开始整理，完成后刷新就能看到。",
			forget: "遗忘",
			forgetHint: "“普通遗忘”保留原文并停止正常召回，可手动恢复；“彻底遗忘”删除原文并保留内容指纹，以阻止相同内容重新写入。已彻底遗忘的原文无法通过恢复操作找回。",
			masterForget: "主人的记忆",
			privateForget: "别人私聊的记忆",
			groupForget: "群聊的记忆",
			forgetNormal: "普通遗忘",
			forgetPurge: "彻底遗忘",
			cleanupEnabled: "主人记忆的模型清理",
			cleanupEnabledHint: "启用对已普通遗忘的主人记忆进行模型清理。运行后生成建议彻底遗忘的条目，默认需用户勾选确认；只有同时启用“判断完直接删”才自动执行删除。",
			cleanupAutoPurge: "判断完直接删",
			cleanupAutoPurgeHint: "模型清理选出条目后直接执行彻底遗忘，不再等待逐条确认。默认关闭，仅在主人记忆模型清理启用时生效；删除原文后无法直接恢复。",
			runCleanup: "运行",
			running: "运行中…",
			cleanupNone: "模型没有挑出要删的。",
			cleanupResult: "{time} 模型建议彻底遗忘 {n} 条：",
			cleanupPurged: "已删",
			purgeSelected: "彻底遗忘勾选的",
			vector: "向量检索",
			vectorHint: "使用 OpenAI 兼容 embeddings 接口生成记忆向量，补充语义检索。默认接口预设使用 BAAI/bge-m3；未配置密钥时停用向量功能。切换模型后需重建对应索引，期间关键词检索仍可使用。",
			embedApiUrl: "接口地址",
			embedApiUrlHint: "向量服务的 OpenAI 兼容基础地址，通常填写至 /v1。插件会追加 /embeddings；需确保服务支持所选向量模型。",
			embedApiKey: "接口 Key",
			embedApiKeyHint: "所选模型服务的 API Key。已保存密钥不回显，留空保留现有值；密钥用于相应任务的服务调用，不会包含在插件导出备份中。",
			embedModel: "向量模型",
			embedBatch: "一次算几条",
			keySet: "已设置 Key。",
			keyUnset: "没有设置 Key，向量检索不启用。",
			indexState: "索引：{state}",
			stIdle: "空闲",
			stRunning: "正在建",
			stPaused: "已暂停",
			stDone: "已完成",
			stFailed: "失败",
			stCancelled: "已取消",
			stDisabled: "没启用（没填 Key）",
			graphStDisabled: "没启用（上面的「图记忆」开关是关的）",
			indexModel: "模型 {model}，{dim} 维",
			indexCount: "已建 {embedded} / {total} 条",
			indexProgress: "这次：{done} / {todo}",
			indexLastError: "最近的错误：{error}",
			indexErrors: "跳过了 {n} 条算不出来的",
			indexTimes: "开始 {start}，结束 {end}",
			rebuild: "手动重建",
			embedTest: "测试向量接口",
			embedTestOk: "能用：模型 {model}，向量 {dim} 维，用时 {ms} 毫秒。",
			embedTestFailed: "测试失败：{error}",
			testing: "测试中…",
			testUsesSaved: "测试用的是已保存的设置，改了先保存。",
			tabsLabel: "设置分类",
			tab_persona: "人格",
			tab_chat: "对话",
			tab_memory: "记忆",
			tab_diary: "日记",
			tab_proactive: "主动聊天",
			tab_backup: "备份和日志",
			graphSec: "图记忆",
			graphSecHint: "从长期记忆提取实体及关系，形成额外的图检索路径，并与普通检索合并排序。默认关闭；启用后会为既有非日记记忆补提取关系，增加模型请求。配置向量服务时也可为实体生成向量，最终召回条数仍受上限控制。",
			graphEnabled: "图记忆",
			graphModel: "抽关系用的模型",
			graphModelHint: "用于从记忆内容提取实体和关系。默认跟随“整理用的模型”及其思考设置，也可选择独立模型或服务；关系提取会产生额外请求。",
			graphBatch: "一次让模型看几条",
			graphHops: "顺着关系走几步",
			graphHopsHint: "图检索从匹配实体向关系相邻实体扩展的步数，范围 0～2，默认 1。0 不扩展邻接关系；增大可覆盖更多关联，也可能引入较弱相关内容。",
			graphState: "关系网：{state}",
			graphCounts: "已抽 {done}/{memories} 条记忆 · 实体 {entities} 个 · 关系 {relations} 条",
			graphSample: "最近抽出来的关系",
			graphEmpty: "还没有关系。",
			graphRebuildConfirm: "清空关系网，对所有记忆重新抽一遍（要调很多次模型）。确认？",
			rebuildConfirm: "会清掉所有向量重新算，期间关键词检索照常能用。确认重建？",
			pause: "暂停",
			resume: "继续",
			cancelIndex: "取消",
			memList: "记忆列表",
			memListOpen: "展开记忆列表（看、搜、改、遗忘、手动加）",
			memListClose: "收起记忆列表",
			memListHint: "查看和管理长期记忆，可新增、编辑、普通遗忘、彻底遗忘或恢复。操作影响记忆库，不等同于修改原始聊天存档；彻底遗忘不能直接恢复原文。",
			filterScope: "归属",
			scopeAll: "全部",
			scopeMaster: "主人",
			scopePublic: "公开",
			scopeGroups: "所有群",
			scopeUsers: "所有别人私聊",
			filterStatus: "状态",
			statusActive: "正常",
			statusForgotten: "普通遗忘",
			statusSuperseded: "已被取代",
			statusAll: "全部",
			search: "搜索",
			memTotal: "共 {n} 条",
			memEmpty: "没有记忆。",
			loadMore: "再看 50 条",
			edit: "改",
			saveEdit: "保存",
			doForget: "普通遗忘",
			doPurge: "彻底遗忘",
			purgeConfirm: "彻底遗忘后原文删掉、不能恢复。确认？",
			doRestore: "恢复",
			memMeta: "#{id} · {scope} · {kind} · 重要 {imp} · 想起 {count} 次 · {time}",
			addMemory: "手动加一条",
			addScope: "记成",
			addContent: "内容",
			addKind: "类型",
			addImportance: "重要程度（0–1）",
			add: "加上",
			added: "加上了。",
			blocked: "这条以前被彻底遗忘过，不能再加。",
			kindFact: "事实",
			kindPreference: "喜好",
			kindEvent: "事件",
			kindPromise: "约定",
			kindOther: "其他",
			kindDiary: "日记",
			groupCtx: "群聊上下文",
			groupCtxHint: "群聊通过 @、引用、唤醒词或前缀进入正式回复时，附加当前消息之前的本群近期存档，包括机器人已发送的消息。需要开启未唤醒消息存档；图片可附加，语音和视频按 bridge 媒体设置转换。此上下文与 dsh 正式对话历史分开。",
			groupContextCount: "附上之前几条",
			groupContextCountHint: "正式群聊回复附带的最近本群存档条数，默认 10，排除当前来信。0 表示不附加；未开启未唤醒存档或没有可用记录时不提供这部分历史。",
			groupCtxOff: "「保存没唤醒她的群消息」关着，这一项不起作用。",
			forgetMode: "遗忘方式",
			proactive: "主动聊天",
			proRuleOn: "主动找",
			proRuleOff: "不主动找",
			memStats: "记忆：正常 {active} 条，普通遗忘 {forgotten} 条，被取代 {superseded} 条，指纹 {tomb} 个",
			diarySec: "日记",
			diarySecHint: "按日生成仅围绕主人互动的第一人称日记，并按月生成总览；文件长期保留，日记也写入记忆库。主人新会话可按下方设置读取近期日记与总览。生成需要可用模型并产生额外请求。",
			diaryEnabled: "每天写日记",
			diaryTime: "每天几点",
			diaryTimeHint: "每日维护任务的计划时间，采用 HH:MM 24 小时制，默认 01:30，按本插件时区执行。维护包含已启用的日记生成及存档到期处理；备份有独立时间设置。",
			dayBoundaryHour: "一天按凌晨几点分界",
			dayBoundaryHourHint: "划分日记归属日期的小时，范围 0～12，默认 4。例如凌晨 04:00 前的互动计入前一个逻辑日，不改变原始消息时间。",
			timezone: "时区",
			monthlyEnabled: "每月写月度总览",
			diaryOnNewSession: "主人开新会话时先给她看日记",
			diaryDays: "最近几天的日记",
			overviewMonths: "最近几个月的总览",
			diaryBudgetPercent: "最多占模型上限的百分之多少",
			diaryBudgetPercentHint: "新会话附加日记及总览所占的模型上下文比例上限，范围 1～60，默认 20。超限时先缩短较早日记，必要时移除最早内容，不删除日记原文件。",
			diaryCount: "已有日记 {days} 篇、月度总览 {months} 篇。最近一篇：{latest}",
			writeDiaryNow: "现在就写一篇",
			diaryWritten: "写好了 {date} 的日记。",
			diaryNothing: "这段时间没有和主人的聊天，没写。",
			diaryPage: "日记本",
			diaryPageHint: "按日期查看、编辑或删除日记和月度总览，也可导入历史 Markdown 或文本日记。导入依据文件名或正文中的日期识别归属，请核对预览和日期。",
			diaryEmpty: "还没有日记。",
			monthlyLabel: "月度总览",
			del: "删除",
			delConfirm: "删掉这篇日记？（记忆库里的那份不受影响）",
			upload: "上传日记文件",
			uploadHint: "支持同时选择多个 Markdown 或文本日记文件。文件需包含可识别日期；导入后请检查对应日期的内容。",
			conflict: "同一天已经有日记时",
			conflictSkip: "跳过",
			conflictMerge: "合并（接在后面）",
			conflictOverwrite: "覆盖",
			importPreview: "选了 {n} 个文件：",
			importNoDate: "认不出日期",
			importExists: "这天已有日记",
			importNew: "新的一天",
			importNow: "导入",
			importDone: "导入了 {n} 篇，跳过 {skip} 篇，认不出日期 {bad} 个。",
			expirySec: "存档到期",
			expirySecHint: "每日维护时处理存档到期：尝试整理未处理内容、移除到期消息，并按设置轮换会话、携带近期消息及归档旧会话。其他人的旧会话可在到期后删除；主人旧会话不自动删除。",
			rotateSessions: "会话用满保留期就换新会话",
			deleteOldSessions: "其他人的旧会话过期后删除",
			deleteOldSessionsHint: "到期后自动删除其他私聊及群聊的旧会话文件，默认开启。关闭后仅归档保留；主人旧会话始终保留，不受此开关影响。",
			carryMessages: "换会话时带过去最近几条消息",
			archiveImages: "收到的图片下载存起来",
			archiveImagesHint: "对获准存档消息中的图片下载本地副本，以避免临时 QQ 链接失效。图片保存在数据目录的 media/，随存档到期清理；名单外群聊和普通私聊不触发存档图片下载。",
			runExpiry: "现在处理到期",
			expiryDone: "处理完了：删了 {deleted} 条存档，换了 {rotated} 个会话，删了 {sessions} 个旧会话，清掉 {media} 张图片。",
			lastRun: "上次运行：{time}",
			retired: "换下来的旧会话",
			retiredEmpty: "还没有换下来的会话。",
			retiredState: "{umo} · {cat} · 最后一条 {last} · {state}",
			stArchived: "已归档",
			stDeleted: "已删除",
			stDeleteFailed: "删除失败：{note}",
			proSec: "主动聊天",
			proSecHint: "按随机时间间隔向符合条件的 QQ 会话发起主动聊天请求，由正式模型决定是否发言；静默标记不发送到 QQ。遵守 bridge 白名单、免打扰、近期发言和活跃天数限制，群聊可附近期上下文。需要 bridge 提供主动唤醒接口，不使用独立判断模型。",
			proactiveEnabled: "主动聊天",
			proactiveMinMinutes: "主人私聊：最短间隔（分钟）",
			proactiveMaxMinutes: "主人私聊：最长间隔（分钟）",
			proactiveOthersMinMinutes: "别人和群：最短间隔（分钟）",
			proactiveOthersMaxMinutes: "别人和群：最长间隔（分钟）",
			proIntervalHint: "从最短到最长间隔随机安排下一次主动聊天，单位为分钟，最短与最长均须至少 10。默认主人 60～240，其他私聊及群聊 120～240；最长间隔应不小于最短间隔。",
			proactivePrivate: "也主动找别人私聊",
			proactiveGroup: "也在群里主动说话",
			quietStart: "免打扰开始",
			quietEnd: "免打扰结束",
			quietHint: "主动聊天免打扰时段，使用 HH:MM 24 小时制，允许跨午夜，默认 01:00～09:00。按本插件时区判断，仅暂停主动聊天，不阻止收到消息后的正常回复。",
			proactiveRecentMinutes: "她说过话后几分钟内不触发",
			proactiveGroupContext: "群里带几条上下文",
			proactiveActiveDays: "别人和群：最近几天聊过才找",
			proSilence: "「不发」暗号",
			proSilenceHint: "主动聊天提示中约定的静默标记，默认 [不发]，须与 bridge 的“「不发」暗号”一致。模型返回该标记表示本次不发送消息；不增加额外判断请求。",
			proNoWake: "没检测到 dsh-napcat-bridge 0.7.0 以上的唤醒接口，主动聊天不会生效。",
			proListEmpty: "还没有可以主动找的会话（要先在 QQ 上聊过）。",
			proItem: "{umo} · {cat} · 下次 {next} · 上次 {last}",
			proTry: "现在试一次",
			proTried: "唤醒了，看她发不发。",
			never: "还没有",
			careSec: "记忆保养",
			careSecHint: "按维护周期清理长期未召回且重要程度较低的记忆，并可调用模型整合相近记忆。遗忘方式按范围和例外规则决定；日记不参与自动清理及整合。最近一次整合支持撤销。",
			autoCleanup: "自动清理",
			autoCleanupDays: "超过几天没被想起",
			autoCleanupImportance: "重要程度低于",
			purgeForgotten: "普通遗忘很久的自动彻底遗忘",
			purgeForgottenDays: "普通遗忘超过几天",
			consolidateEnabled: "定期整合",
			consolidateOverlap: "相近程度门槛",
			consolidateOverlapHint: "候选记忆分组的相近程度门槛，范围 0.2～0.95，默认 0.5。越高越严格，通常只有更相似的记忆进入同一整合组。",
			consolidateGroups: "一次最多整合几组",
			careIntervalDays: "每几天做一次",
			careLast: "上次清理：{cleanup}；上次整合：{consolidate}",
			careRun: "现在做一次",
			careDone: "做完了：普通遗忘 {f} 条，彻底遗忘 {p} 条；整合 {g} 组（{m} 条合成 {c} 条）。",
			careLastRun: "最近一次整合（{time}）：",
			careGroup: "{old} → {created}",
			careUndo: "撤销最近一次整合",
			careUndoConfirm: "撤销后合成的新记忆删掉，原来的几条恢复。确认？",
			careUndone: "撤销了。",
			backupSec: "备份与迁移",
			backupSecHint: "导出所选人格、记忆、日记、存档及插件或 dsh 设置，用于恢复或迁移。配置密钥和 Token 不导出；可单独选择主人 QQ 私聊的 dsh 原始会话。导入时可选择恢复范围；模型变更时可能需要重建向量索引。",
			backupItemsLabel: "备份哪些内容",
			backupItemsHint: "自动备份和“现在备份并下载”使用这些选项；手动备份直接采用当前勾选，无需先保存。主人原始会话默认关闭，旧配置选中的其他存档会替换为此项。配置凭据不导出；导入时仍可缩小恢复范围。",
			bi_persona: "人格",
			bi_personaDesc: "现在的人格稿（不含历史版本）",
			bi_core: "核心记忆",
			bi_coreDesc: "主人的、公开的两份（不含历史版本）",
			bi_diary: "日记",
			bi_diaryDesc: "每天的日记和月度总览",
			bi_memory: "记忆库",
			bi_memoryDesc: "长期记忆、向量、关系网（图记忆）、彻底遗忘的指纹、整合记录",
			bi_archiveMaster: "主人私聊的存档",
			bi_archiveMasterDesc: "你和她私聊的原话和图片，还有 dsh 里直接聊的记录",
			bi_sessionsMaster: "主人私聊的 dsh 会话",
			bi_sessionsMasterDesc: "主人 QQ 私聊的原始 dsh 会话、历史会话及其引用附件；恢复后接回原对话（默认不带）",
			bi_settingsCompanion: "dsh-companion-core 的设置",
			bi_settingsCompanionDesc: "这个页面里的所有设置（不含向量 Key）",
			bi_settingsBridge: "dsh-napcat-bridge 的设置",
			bi_settingsBridgeDesc: "主人 QQ、白名单、唤醒词、模型、发消息节奏等（不含连接 Token、语音 Key）",
			bi_settingsDsh: "dsh 其他设置",
			bi_settingsDshDesc: "dsh 网页设置页里改过的其他设置，比如选的默认预设、模型（不含 Key）",
			backupNotIncluded: "备份不导出配置密钥、QQ 登录数据或运行环境，也不包含其他私聊、群聊及网页的原始会话。人格和核心记忆只备份现稿。主人原始会话含完整事件及引用附件，可能包含聊天中出现的敏感内容，请妥善保管。",
			backupNoItems: "一样都没勾，备份包会是空的。",
			restorePick: "要还原哪些（没勾的保持现在的样子）：",
			restoreSettingsNote: "勾了的设置确认后马上套用（Key 和 Token 不动）；包里没改过的设置会恢复成默认值。",
			importedItems: "还原了：{items}",
			backupEnabled: "每天自动备份",
			backupTime: "自动备份时间",
			backupKeep: "每一类最多留几份",
			backupKeepHint: "自动备份、手动备份及导入前备份分别保留的文件数量上限，默认各 5 份。超过后清理较旧备份；本机备份不能替代异机副本。",
			exportNow: "现在备份并下载",
			exported: "备份好了：{name}",
			download: "下载",
			importFile: "导入备份包",
			chooseFile: "选择备份包…",
			importFileHint: "选择本插件导出的 companion-….tar.gz 备份包。系统先校验并展示内容，确认所选恢复项后才执行覆盖；导入前会创建备份。",
			previewTitle: "包里有：",
			previewLine: "插件 {plugin} · {time} 做的 · 记忆 {mem} 条 · 日记 {days} 篇 · 月度总览 {months} 篇 · 主人存档 {msgs} 条 · 主人 dsh 会话 {sessions} 个 · 图片 {media} 张 · 向量模型 {model}",
			previewSettings: "包里 dsh-companion-core 的设置：",
			confirmImport: "确认导入（先自动备份当前数据）",
			cancelImport: "不导入",
			importing: "正在导入，插件会自动重新加载…",
			imported: "导入完成（{time}）。",
			importFailed: "导入失败，原来的数据没动：{error}",
			backupList: "备份列表",
			backupEmpty: "还没有备份。",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "自动",
			reasonManual: "手动",
			reasonBefore: "导入前",
			restoreThis: "从它还原",
			deleteBackup: "删除",
			deleteBackupConfirm: "删除这个备份文件？",
			selfCheck: "迁移后自检",
			selfCheckHint: "使用固定查询检查主人范围记忆的检索结果，适用于迁移或导入后验证。多个问题用空格或逗号分隔；此检查不等于调用聊天模型生成答案，导入完成后也会自动执行。",
			selfCheckQueries: "自检问题",
			runSelfCheck: "现在自检",
			selfCheckResult: "「{q}」→ {a}",
			selfCheckNone: "（没想起来）",
			personaGuardHintField: "模型自改人格的规则检查总开关，默认开启。关闭后跳过该自改限制流程；设置页直接编辑本就不使用此流程。",
			personaEditMaxCharsHint: "模型一次人格修改允许增加的非空白字符数，默认 300，最小 10。限制净新增量，不限制同等长度的正常替换；仅用于已启用的人格自改检查。",
			personaAllowedHint: "供人格修改审核使用的允许内容清单，每行一条。建议描述稳定的身份、性格及表达方式；审核模型将与禁止清单共同参考。",
			personaForbiddenHint: "供人格修改审核使用的禁止内容清单，每行一条。用于约束模型自改人格；不代替长期记忆管理，也不限制设置页直接编辑。",
			archiveEnabledHint: "QQ 消息存档总开关，默认开启。关闭后停止新增 QQ 消息及其存档图片，也会影响依赖存档的群上下文、整理与日记数据来源；已有数据不会立即删除。",
			archiveDaysMasterHint: "管理员 QQ 私聊消息存档的保留天数，默认 365，最小 1。到期后由维护任务处理；这不代表主人长期记忆或日记会随之删除。",
			archiveDaysOthersHint: "其他私聊和群聊消息存档的默认保留天数，默认 5，最小 1。例外规则可覆盖该值；实际写入仍须通过 bridge 存档权限检查。",
			recallEnabledHint: "自动长期记忆召回总开关，默认开启。关闭后不在每轮自动附加检索结果；人格、核心记忆以及已启用的主动记忆工具分别由各自设置控制。",
			importanceWeightHint: "召回排序中有效重要程度的加分权重，范围 0～1，默认 0.2。数值越高越优先保留重要记忆；不改变相关度入选门槛。",
			recencyWeightHint: "召回排序中新近程度的加分权重，范围 0～1，默认 0.1。越高越倾向较新创建的记忆；新近程度按半衰期衰减。",
			embedBatchHint: "单次向量请求处理的记忆数量，范围 1～64，默认 16。增大可减少请求次数，但会增加单次请求体积；应符合服务商批量限制。",
			graphEnabledHint: "启用图记忆关系提取和图检索，默认关闭。需要可用的关系提取模型，既有记忆的补提取会增加模型请求；关闭后不等于删除已有图数据。",
			graphBatchHint: "每批关系提取处理的记忆数量，范围 1～30，默认 8。较大批次增加单次输入规模，应结合目标模型的上下文和输出能力调整。",
			masterForgetHint: "主人范围记忆的默认遗忘方式，默认普通遗忘，保留原文以供恢复。可选择彻底遗忘；到期消息存档与长期记忆使用不同的保留机制。",
			privateForgetHint: "其他私聊记忆的默认遗忘方式，默认彻底遗忘。彻底遗忘删除记忆原文并保留指纹；普通遗忘保留原文，可在记忆列表恢复。",
			groupForgetHint: "群聊长期记忆的默认遗忘方式，默认彻底遗忘，可由群例外规则覆盖。此项不控制群消息存档的保留天数。",
			diaryEnabledHint: "启用每日自动日记生成，默认开启，需要可用的日记模型及主人聊天数据。关闭不删除已有日记，也不关闭独立的存档到期维护。",
			monthlyEnabledHint: "启用月度总览生成，默认开启，从已有日记整理月度内容。实际生成随日记维护流程执行，需要日记生成功能及模型可用。",
			timezoneHint: "日记、维护、备份与主动聊天免打扰时段使用的 IANA 时区，默认 Asia/Shanghai。应与预期运行时间一致；不修改系统时钟或 bridge 自己的时间提示设置。",
			diaryOnNewSessionHint: "主人范围的新会话在开始时附加近期日记及月度总览，默认开启。条数范围由下方天数和月数控制，并受日记上下文预算限制。",
			diaryDaysHint: "主人新会话可读取的近期日记天数，默认 30；0 表示不附加日记。不会删除超出范围的日记文件，附加内容仍受上下文预算约束。",
			overviewMonthsHint: "主人新会话可读取的月度总览月数，默认 12；0 表示不附加总览。不影响总览文件保留。",
			rotateSessionsHint: "会话达到对应存档保留周期时自动创建新会话并归档旧会话，默认开启。近期消息可按下方数量带入；不会删除长期记忆或日记。",
			carryMessagesHint: "自动轮换会话时附加到新会话的近期消息数量，默认 10。0 表示不带入消息；这是轮换衔接内容，不等同于全部迁移旧会话历史。",
			proactiveEnabledHint: "主动聊天总开关，默认开启。仅向符合白名单、类别开关、活跃范围和时间条件的 QQ 会话发起请求；每次请求由正式模型决定是否实际发言。",
			proactiveMinMinutesHint: "管理员私聊主动聊天的最短随机间隔，单位为分钟，默认 60，最小 10。与最长间隔配合，仍受近期发言及免打扰条件限制。",
			proactiveMaxMinutesHint: "管理员私聊主动聊天的最长随机间隔，单位为分钟，默认 240，最小 10。应不小于最短间隔；免打扰或近期已回复时可能继续顺延。",
			proactivePrivateHint: "允许对非管理员 QQ 私聊安排主动聊天，默认开启。对方须满足私聊白名单及最近活跃天数条件，仍受主动聊天总开关限制。",
			proactiveGroupHint: "允许在群聊安排主动发言，默认开启。群必须通过当前群白名单，不能继承管理员此前在群内发言的豁免；仍受活跃时间及免打扰限制。",
			proactiveRecentMinutesHint: "机器人在同一会话最近已发言时的主动聊天抑制时间，单位为分钟，默认 30。窗口内不再次主动唤醒；0 表示关闭此项近期发言抑制。",
			proactiveGroupContextHint: "群主动聊天请求附带的近期本群存档条数，默认 15，0 表示不附加。图片及其他媒体按现有上下文转换规则处理；不读取其他群的记录。",
			proactiveActiveDaysHint: "其他私聊及群聊在最近多少天有互动时才纳入主动聊天，默认 7，最小 1。管理员私聊不使用此项活跃天数过滤。",
			autoCleanupHint: "按维护周期自动处理长期未召回且有效重要程度低于阈值的记忆，默认开启。处理方式遵守对应范围的遗忘设置；日记不参与。",
			autoCleanupDaysHint: "自动清理的未召回时长条件，单位为天，默认 90，最小 1。还必须同时满足有效重要程度阈值，才会进入清理。",
			autoCleanupImportanceHint: "自动清理的有效重要程度阈值，范围 0～1，默认 0.2。与未召回天数共同使用；有效重要程度包含时间衰减。",
			careIntervalDaysHint: "自动清理和记忆整合的运行周期，单位为天，默认 7，最小 1。由每日维护调度检查，不表示每次收到消息都执行。",
			purgeForgottenHint: "将已普通遗忘超过指定天数的记忆自动转为彻底遗忘，默认关闭。启用后会删除相应原文，仅保留内容指纹。",
			purgeForgottenDaysHint: "普通遗忘记忆转为彻底遗忘前的等待天数，默认 180，最小 1。仅在启用对应自动彻底遗忘开关时生效。",
			consolidateEnabledHint: "启用相近长期记忆的定期模型整合，默认开启。原记忆标记为被取代，保留最近一次整合的撤销信息；此操作会产生模型请求。",
			consolidateGroupsHint: "每轮记忆保养最多处理的整合候选组数，默认 20，最小 1。用于限制单次任务规模，不代表每组固定包含多少条记忆。",
			backupEnabledHint: "启用每日定时备份，默认开启。按备份时间、备份项目和保留数量执行；关闭后仍可手动导出备份。",
			backupTimeHint: "每日自动备份的计划时间，HH:MM 24 小时制，默认 04:00，按本插件时区执行。与日记及存档维护时间分别配置。",
			selfCheckQueriesHint: "迁移自检使用的主人记忆查询问题，多个问题用空格或逗号分隔。用于核验检索是否返回预期记忆，不修改人格或聊天记录。",
			dropRoundsHint: "每次上下文处理从最早开始处理的用户轮数，默认 20，至少 1。处理采用所选截断或压缩方式，仍会保留必要的近期上下文。",
			modeHint: "“按轮数截断”直接移除旧轮次的模型上下文；“模型压缩”请求模型生成回忆后替代旧内容。两者均不直接删除消息存档、日记或长期记忆。",
			kindHint: "选择例外规则匹配目标的类型。“QQ 号”匹配私聊对方，“群号”匹配当前群聊。",
			targetHint: "填写与规则类型对应的完整 QQ 号或群号。留空的规则不参与匹配；此字段不使用 dsh 会话 ID。",
			archiveDaysHint: "该目标的消息存档保留天数覆盖值，留空或填 0 继承类别默认。到期由维护任务处理；不能绕过存档总开关或 bridge 存档权限。",
			archiveUnwokenHint: "覆盖本群未唤醒消息的存档选项，留空继承全局设置。即使选择“存”，仍须启用存档总开关并通过群存档权限检查。",
			forgetModeHint: "覆盖此目标长期记忆的默认遗忘方式，留空继承所属类别。普通遗忘可恢复原文；彻底遗忘删除原文并保留指纹。",
			proactiveHint: "覆盖此目标是否参与主动聊天，留空继承默认类别设置。启用不能绕过主动聊天总开关、bridge 白名单、免打扰及其他调度条件。",
			noteHint: "规则备注，仅用于说明配置用途，不改变匹配或权限行为。",
		};
		var en = {
			unsavedBar: "Unsaved changes: click Save to apply; leaving the page discards them",
			discardChanges: "Discard",
			diaryModel: "Diary model",
			diaryModelHint: "Diary and monthly summaries use the administrator-private model, falling back to the private model and then the dsh default. Configure the model in dsh-napcat-bridge; set reasoning here, default high, when supported.",
			diaryModelFrom_admin: "From dsh-napcat-bridge's admin private chat model.",
			diaryModelFrom_private: "dsh-napcat-bridge's private chat model (no separate admin model).",
			diaryModelFrom_default: "dsh's default model (dsh-napcat-bridge not installed or no model set).",
			diaryModelFrom_none: "dsh has no usable model yet.",
			apiKeySet: "Key is set.",
			apiKeyUnset: "No key yet.",
			embedFoldClose: "Hide embedding settings",
			embedFold: "Embedding: {provider} · {model} (click to change)",
			llmTestFailed: "Failed: {error}",
			llmTestOk: "OK: {model}, effort {effort}, {ms} ms, replied \"{text}\"",
			llmTest: "Test this model",
			effort_max: "Max",
			effort_high: "High",
			effort_medium: "Medium",
			effort_low: "Low",
			effort_minimal: "Minimal",
			effort_off: "Off",
			effortDefault: "model default",
			effortUnsupported: " (not supported)",
			effortPickModel: "Pick a model first.",
			effortNoneApi: "This provider has no adjustable reasoning (or it is unknown).",
			effortNone: "This model's reasoning cannot be adjusted.",
			effortHint: "Choose a reasoning effort supported by the target model. Higher effort typically increases latency and usage. Unsupported models use provider defaults; options depend on the selected model or service.",
			effort: "Reasoning effort",
			chatApiUrlHint: "OpenAI-compatible chat base URL, usually ending in /v1. The plugin appends /chat/completions; do not repeat the endpoint suffix.",
			apiModel: "Model",
			dshModelsFailed: "Could not read dsh models: {error}",
			dshModelPick: "Pick a model",
			dshModelHint: "Choose a model already configured in dsh Settings → Models, grouped by provider. Provider credentials are managed in dsh.",
			dshModel: "dsh model",
			followNone: "dsh has no default model yet",
			followUses: "Currently uses",
			sourceApi: "Another provider (your own key)",
			sourceDsh: "A model configured in dsh",
			followGraphNote: "Uses the organizing model and its reasoning effort.",
			followGraph: "Same as the organizing model",
			followMemory: "Follow dsh (dsh's default model)",
			followSummaryNote: "Uses the current session's model and reasoning effort.",
			followSummary: "Follow dsh (the session's own model)",
			langIsEn: "1",
			provider: "Provider",
			providerHint: "Select a provider preset to fill its base URL and common models. For a custom service, use an OpenAI-compatible API appropriate to the task, usually ending in /v1.",
			providerSearch: "Search providers",
			providerCustom: "Custom (OpenAI compatible)",
			providerGetKey: "Get a key ↗",
			pModelHint: "Fetch the model list with current or saved credentials. Presets and manual model IDs remain available if fetching fails. Listing a model does not guarantee account access.",
			modelFetch: "Fetch models",
			modelFetching: "Fetching…",
			modelFetched: "Found {n} usable models.",
			modelFetchedAll: "Found {n} models (could not tell which fit, showing all).",
			modelFetchFailed: "Could not list models: {error}. Showing common ones.",
			modelManual: "Type a model…",
			modelManualLabel: "Model name",
			modelPickList: "Pick from list",
			modelNoteArk: "Ark accepts a model name or an endpoint ID (ep-…).",
			modelNoteLocal: "Local service: install it and pull the model on the server first; any key works (e.g. local).",
			summary: "A live persona and core memory for every session, round-based truncation or first-person summaries, and a message archive.",
			status: "Status",
			statusHint: "Shows the data directory and runtime state. It contains persona, core memory, diaries, document history, archives, and memory data. Use backups for migration or copy the full directory after stopping writes.",
			dataDir: "Data directory: {dir}",
			napcatOn: "dsh-napcat-bridge is loaded: QQ sessions follow master / other private / group rules.",
			napcatOff: "dsh-napcat-bridge not detected: every session is treated as the master's, and nothing is archived.",
			archiveCount: "{total} archived messages (private {private}, group {group})",
			loading: "Loading…",
			loadFailed: "Failed to load: {error}",
			scope: "Scope",
			scopeHint: "Sessions are filtered by preset before persona, core memory, recall, and context management apply. Companion is allowed by default. Managed sessions created directly in dsh use master scope; bridge classifies QQ sessions.",
			pluginAccess: "Share with other plugins",
			pluginAccessHint: "Control access through this plugin's service API. All permits target-appropriate master access; public restricts calls to public scope; off rejects calls. This does not replace tool permissions inside sessions.",
			pluginAccessAll: "All (incl. master's)",
			pluginAccessPublic: "Public only",
			pluginAccessOff: "Off",
			personaPresets: "Presets it applies to",
			personaPresetsHint: "Preset IDs eligible for this plugin's persona, core memory, recall, and context management, default companion. Separate with spaces or commas. Asterisk or an empty list allows all, except explicitly excluded presets.",
			excludedPresets: "Excluded presets",
			excludedPresetsHint: "Preset IDs explicitly excluded, separated by spaces or commas. Exclusions override the allowed list; affected sessions retain their preset's persona, tools, and context behavior.",
			personaOnly: "Persona only",
			personaOnlyHint: "Remove the default Harness identity sentence when applying the custom persona. This does not override other persona plugins using complete-replacement mode; configure exclusions for such presets as needed.",
			persona: "Persona",
			personaHint: "After saving the persona, subsequent model requests in managed sessions use the latest text without a restart. Blank preserves the preset persona. Direct edits here bypass model self-edit review restrictions.",
			savePersona: "Save persona",
			selfEdit: "Let her edit her persona and core memory",
			selfEditHint: "Provide persona and core-memory editing tools only in managed master-scope sessions: administrator QQ private chats and sessions created directly in dsh. Other private and group chats do not receive these permissions.",
			personaGuardSec: "Persona edit limits",
			personaGuardHint: "Validate model self-edits for added length, total size, excessive deletion, and disallowed dates, long numbers, links, email addresses, credentials, or rule-changing content. Optional model review checks the allow/deny lists. Rejections return a reason; direct UI edits bypass this self-edit flow.",
			personaGuard: "Limit her persona edits",
			personaReview: "Model review before editing",
			personaReviewHint: "After hard-rule validation, use the memory-processing model to review persona changes against allow/deny lists. Failed or unparseable reviews reject the change.",
			personaEditMaxChars: "Max characters added per edit",
			personaMaxChars: "Max persona length (characters)",
			personaMaxCharsHint: "Total non-whitespace character limit for model persona self-edits, default 15000. Above the limit, edits may only shorten the text. Direct UI editing is outside this self-edit limit workflow.",
			personaAllowed: "Allowed (one per line)",
			personaForbidden: "Not allowed (one per line)",
			historyKeep: "History versions to keep",
			historyKeepHint: "History versions retained separately for persona, master core memory, and public core memory, default 5 each. Zero disables history retention without clearing current documents.",
			core: "Core memory",
			coreHint: "Key facts continuously included in model requests, outside ordinary long-term-memory forgetting. Master core memory is master-only; public core memory is available to groups and other private chats and should contain public information only.",
			coreMaster: "Master's core memory",
			corePublic: "Public core memory",
			saveCore: "Save",
			coreMasterMaxChars: "Master core memory limit (characters)",
			coreMasterMaxCharsHint: "Non-whitespace character limit for master core memory, default 5000. Checked for model edits and UI saves; over-limit content may only be shortened. This limit does not automatically track the persona limit.",
			corePublicMaxChars: "Public core memory limit (characters)",
			corePublicMaxCharsHint: "Non-whitespace character limit for public core memory, default 1500. Enforced for UI saves and model edits. This content is shared with applicable managed sessions; do not include master-private information.",
			chars: "{n} chars",
			saved: "Saved.",
			saveDocFailed: "Not saved: {error}",
			unsaved: "Unsaved changes",
			history: "History",
			historyEmpty: "No history yet.",
			bySettings: "settings",
			byTool: "herself",
			byRestore: "restore",
			view: "View",
			hide: "Hide",
			restore: "Restore this version",
			restoreConfirm: "The current text is saved to history first. Restore?",
			confirm: "Confirm",
			cancel: "Cancel",
			context: "Context",
			contextHint: "Process the oldest rounds when round-count or context-usage conditions are met, using truncation or model summarization. The pre-compaction memory switch controls extraction first. Context-overflow errors trigger truncation and retry. A round starts with a real user message and includes subsequent replies.",
			thresholdPercent: "Handle at this % of the window",
			thresholdPercentHint: "Context-usage trigger from 10 to 95 percent, default 70. Processing starts at 70 percent of model capacity by default. The round limit also applies; the first reached condition triggers processing.",
			masterRow: "Master",
			privateRow: "Other private",
			groupRow: "Groups",
			maxRounds: "Max rounds",
			maxRoundsHint: "Maximum user rounds for this conversation category, default 60. Zero disables the round trigger; usage thresholds and overflow recovery still apply.",
			dropRounds: "Rounds per pass",
			mode: "Method",
			modeTruncate: "Truncate",
			modeLlm: "Summarize",
			modeDefault: "Default",
			summaryModel: "Compression model",
			summaryModelHint: "Model used to compress older conversation into a first-person recollection. Defaults to the current session model; a configured dsh model or external provider may be selected. Summarization adds model requests.",
			rules: "Exceptions",
			rulesHint: "Override category defaults by peer QQ ID or group ID; blank fields inherit defaults. Rules can adjust context, archiving, forgetting, and proactive chat, but cannot bypass bridge access or archive permissions.",
			rulesEmpty: "No exceptions yet.",
			addRule: "Add",
			removeRule: "Remove",
			kind: "Type",
			kindUser: "QQ",
			kindGroup: "Group",
			target: "Number",
			archiveDays: "Archive days",
			archiveUnwoken: "Archive unwoken",
			unwokenOn: "Yes",
			unwokenOff: "No",
			note: "Note",
			archive: "Message archive",
			archiveHint: "Store permitted QQ messages in the companion database, separate from dsh session logs. With allowlists enabled, unlisted groups are never archived, including administrator traffic; unlisted ordinary private chats are denied, administrator private chats are allowed. Expiry attempts extraction before deletion; removing an entry does not immediately erase history.",
			archiveEnabled: "Archive messages",
			archiveUnwokenAll: "Archive group messages that did not wake her",
			archiveUnwokenAllHint: "Archive group input that does not trigger a reply in groups permitted for archiving, enabled by default. Disabling stops those inputs and supplementary recent-group context. Group overrides may refine this setting but cannot admit unlisted groups.",
			archiveDaysMaster: "Master's private chat: days to keep",
			archiveDaysOthers: "Others and groups: days to keep",
			log: "Logging",
			logLevel: "Log level",
			logLevelHint: "Runtime verbosity, default info. Debug adds context-round, usage, and processing details for troubleshooting and may increase log volume.",
			recentLogs: "Recent log",
			noLogs: "No log yet.",
			refresh: "Refresh",
			overridden: "Changed",
			reset: "Reset",
			invalid: "Invalid value",
			invalidCount: "Enter 0 or a positive integer",
			invalidPositive: "Enter a positive integer",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "The plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "Not saved; your edits are kept for you to correct.",
			memRecall: "Recall",
			memRecallHint: "Retrieve relevant visible long-term memories and attach them to each turn. Keyword search is the baseline; a configured embedding service adds semantic retrieval. Master scope can retrieve group memories; groups and other private chats cannot retrieve master-private memories.",
			recallEnabled: "Recall related memories",
			recallTopK: "Max per round (others, groups)",
			recallTopKHint: "Maximum automatic recalls per turn in other private and group chats, default 6. Zero attaches none. Groups search only their own and public memories; the actual count depends on eligible matches.",
			recallTopKMaster: "Max per round (master)",
			recallTopKMasterHint: "Maximum automatic recalls per master-scope turn, default 10. Master, public, and group memories are eligible, subject to visibility, thresholds, and ranking.",
			keywordThreshold: "Keyword threshold",
			keywordThresholdHint: "Admission threshold for keyword-only relevance, from 0 to 1, default 0.3. Higher values require stronger lexical matches and usually return fewer results.",
			vectorThreshold: "Vector threshold",
			vectorThresholdHint: "Combined relevance threshold for candidates with embeddings, from 0 to 1, default 0.45. The score combines keyword and vector relevance; candidates without vectors use the keyword threshold.",
			keywordWeight: "Keyword share",
			keywordWeightHint: "Keyword share of combined relevance, from 0 to 1, default 0.3; the remainder is vector similarity. Applies when both query and candidate embeddings are available.",
			importanceWeight: "Importance weight",
			recencyWeight: "Recency weight",
			groupDiscount: "Group discount",
			groupDiscountHint: "Relevance multiplier for group memories retrieved in master scope, from 0 to 1, default 0.7. Lower values reduce ranking priority without changing visibility permissions.",
			halfLifeDays: "Half-life (days)",
			halfLifeDaysHint: "Half-life for importance and recency scoring, default 30 days. Effective importance decays from the last recall or creation time; recalling updates that reference time. This does not directly delete memory.",
			invalidRatio: "Enter a number from 0 to 1",
			memGen: "Memory writing",
			memGenHint: "Use a model to extract lasting facts from unprocessed conversation. QQ extraction tracks progress to avoid reprocessing the same range. Requires an available processing model and adds model requests.",
			activeMemory: "Active memory",
			activeMemoryHint: "Provide recall, remember, and forget tools to eligible sessions for model-directed use. Scope and permissions still apply. Tool registration updates at session creation or plugin reload.",
			organizeEveryRounds: "Organize every N rounds",
			organizeEveryRoundsHint: "Automatically extract unprocessed memories after this many user rounds, default 20. Zero disables round-based extraction only; manual, expiry, and enabled pre-compaction extraction remain available.",
			organizeBeforeCompact: "Organize before truncating/summarizing",
			organizeBeforeCompactHint: "Attempt long-term-memory extraction before truncating or summarizing old context, enabled by default. This adds processing-model requests. Controls on Chat and Memory tabs edit the same setting.",
			memoryModel: "Organizing model",
			memoryModelHint: "Model for memory extraction, cleanup, consolidation, and persona-edit review. Defaults to the dsh default model, with configured dsh or external-provider alternatives. Diaries and monthly summaries use the administrator-private model instead.",
			currentModel: "Using: {model}",
			noModel: "No usable model; set one here or a dsh default model.",
			pending: "Not organized yet: {qs} QQ chats ({qm} messages), {ds} dsh sessions",
			organizeNow: "Organize now",
			organizing: "Organizing…",
			organizeStarted: "Started; refresh to see the result.",
			forget: "Forgetting",
			forgetHint: "Normal forgetting preserves text but excludes it from ordinary recall and can be reversed. Purge removes the text and retains a fingerprint to prevent identical reinsertion. Purged text cannot be restored through the restore action.",
			masterForget: "Master's memories",
			privateForget: "Others' private chats",
			groupForget: "Groups",
			forgetNormal: "Forget",
			forgetPurge: "Purge",
			cleanupEnabled: "Model cleanup of the master's memories",
			cleanupEnabledHint: "Enable model-assisted cleanup of normally forgotten master memories. Runs produce purge suggestions requiring confirmation by default; automatic purge occurs only if its separate switch is enabled.",
			cleanupAutoPurge: "Purge without asking",
			cleanupAutoPurgeHint: "Automatically purge entries selected by model cleanup without per-entry confirmation. Disabled by default and requires master-memory cleanup. Removed text cannot be directly restored.",
			runCleanup: "Run",
			running: "Running…",
			cleanupNone: "Nothing suggested.",
			cleanupResult: "{time}: {n} suggested for purging:",
			cleanupPurged: "purged",
			purgeSelected: "Purge selected",
			vector: "Vector search",
			vectorHint: "Generate memory embeddings with an OpenAI-compatible embeddings API for semantic retrieval. The default preset uses BAAI/bge-m3. No key disables embedding features. Model changes require a matching index rebuild; keyword retrieval remains available.",
			embedApiUrl: "API base URL",
			embedApiUrlHint: "OpenAI-compatible embedding base URL, usually ending in /v1. The plugin appends /embeddings; the service must support the selected model.",
			embedApiKey: "API key",
			embedApiKeyHint: "API key for the selected model service. Stored keys are not displayed; blank retains the saved value. Used for the corresponding service task and excluded from exported plugin backups.",
			embedModel: "Embedding model",
			embedBatch: "Batch size",
			keySet: "A key is set.",
			keyUnset: "No key: vector search is off.",
			indexState: "Index: {state}",
			stIdle: "idle",
			stRunning: "building",
			stPaused: "paused",
			stDone: "done",
			stFailed: "failed",
			stCancelled: "cancelled",
			stDisabled: "off (no key)",
			graphStDisabled: "Off (the graph memory switch above is off)",
			indexModel: "{model}, {dim} dims",
			indexCount: "{embedded} / {total} embedded",
			indexProgress: "This run: {done} / {todo}",
			indexLastError: "Last error: {error}",
			indexErrors: "{n} skipped",
			indexTimes: "Started {start}, finished {end}",
			rebuild: "Rebuild",
			embedTest: "Test embedding API",
			embedTestOk: "Works: model {model}, {dim} dimensions, {ms} ms.",
			embedTestFailed: "Test failed: {error}",
			testing: "Testing…",
			testUsesSaved: "Uses the saved settings; save first.",
			tabsLabel: "Settings sections",
			tab_persona: "Persona",
			tab_chat: "Chat",
			tab_memory: "Memory",
			tab_diary: "Diary",
			tab_proactive: "Proactive",
			tab_backup: "Backup & logs",
			graphSec: "Graph memory",
			graphSecHint: "Extract entities and relations into an additional graph-retrieval path and merge its rankings with ordinary retrieval. Disabled by default. Enabling backfills existing non-diary memories and adds model requests. An embedding service may also vectorize entities; recall count limits still apply.",
			graphEnabled: "Graph memory",
			graphModel: "Graph extraction model",
			graphModelHint: "Model for extracting entities and relations. Defaults to the memory-processing model and its reasoning settings, with independent model or provider options. Extraction adds requests.",
			graphBatch: "Memories per call",
			graphHops: "Hops",
			graphHopsHint: "Number of relation hops from matched entities, from 0 to 2, default 1. Zero disables neighbor expansion. More hops broaden coverage but may include weaker associations.",
			graphState: "Graph: {state}",
			graphCounts: "{done}/{memories} memories extracted · {entities} entities · {relations} relations",
			graphSample: "Latest relations",
			graphEmpty: "No relations yet.",
			graphRebuildConfirm: "Clear the graph and extract every memory again (many model calls). Confirm?",
			rebuildConfirm: "All vectors are recomputed; keyword search keeps working. Rebuild?",
			pause: "Pause",
			resume: "Resume",
			cancelIndex: "Cancel",
			memList: "Memories",
			memListOpen: "Show memories (browse, search, edit, forget, add)",
			memListClose: "Hide memories",
			memListHint: "View and manage long-term memories: add, edit, forget, purge, or restore. These actions affect memory data rather than original chat archives. Purged text cannot be directly restored.",
			filterScope: "Scope",
			scopeAll: "All",
			scopeMaster: "Master",
			scopePublic: "Public",
			scopeGroups: "All groups",
			scopeUsers: "All other private chats",
			filterStatus: "Status",
			statusActive: "Active",
			statusForgotten: "Forgotten",
			statusSuperseded: "Superseded",
			statusAll: "All",
			search: "Search",
			memTotal: "{n} in total",
			memEmpty: "No memories.",
			loadMore: "50 more",
			edit: "Edit",
			saveEdit: "Save",
			doForget: "Forget",
			doPurge: "Purge",
			purgeConfirm: "Purging deletes the text for good. Confirm?",
			doRestore: "Restore",
			memMeta: "#{id} · {scope} · {kind} · importance {imp} · recalled {count}× · {time}",
			addMemory: "Add a memory",
			addScope: "Scope",
			addContent: "Text",
			addKind: "Kind",
			addImportance: "Importance (0–1)",
			add: "Add",
			added: "Added.",
			blocked: "This was purged before and cannot be added again.",
			kindFact: "fact",
			kindPreference: "preference",
			kindEvent: "event",
			kindPromise: "promise",
			kindOther: "other",
			kindDiary: "diary",
			groupCtx: "Group context",
			groupCtxHint: "When group input enters the reply flow through a mention, quote, wake word, or prefix, attach recent prior archive messages from that group, including bot replies. Requires unwoken-message archiving. Images may be included; audio and video use bridge media settings. This context is separate from dsh conversation history.",
			groupContextCount: "Messages to include",
			groupContextCountHint: "Recent same-group archive messages attached to a normal reply, default 10, excluding the current input. Zero disables this addition. No history is attached without unwoken archiving or available records.",
			groupCtxOff: "\"Archive group messages that did not wake her\" is off, so this has no effect.",
			forgetMode: "Forgetting",
			proactive: "Proactive",
			proRuleOn: "On",
			proRuleOff: "Off",
			memStats: "Memories: {active} active, {forgotten} forgotten, {superseded} superseded, {tomb} fingerprints",
			diarySec: "Diary",
			diarySecHint: "Generate first-person daily diaries focused on master interactions and monthly overviews. Files are retained long-term, and diaries are also added to memory. New master sessions can receive recent entries under the settings below. Generation requires a model and adds requests.",
			diaryEnabled: "Write a daily diary",
			diaryTime: "At",
			diaryTimeHint: "Daily maintenance time in 24-hour HH:MM format, default 01:30 in this plugin's timezone. Includes enabled diary generation and archive expiry. Backups have a separate schedule.",
			dayBoundaryHour: "Day starts at (hour)",
			dayBoundaryHourHint: "Hour defining diary-day boundaries, from 0 to 12, default 4. Interactions before 04:00 belong to the previous logical day; original message timestamps are unchanged.",
			timezone: "Time zone",
			monthlyEnabled: "Monthly overview",
			diaryOnNewSession: "Read the diary when a master session starts",
			diaryDays: "Days of entries",
			overviewMonths: "Months of overviews",
			diaryBudgetPercent: "Max % of the context window",
			diaryBudgetPercentHint: "Context-capacity budget for diary and overview material attached to new sessions, from 1 to 60 percent, default 20. Older entries are shortened or omitted as needed; source files are not deleted.",
			diaryCount: "{days} entries, {months} overviews. Latest: {latest}",
			writeDiaryNow: "Write one now",
			diaryWritten: "Wrote the entry for {date}.",
			diaryNothing: "No chat with the master in that period; nothing written.",
			diaryPage: "Diary book",
			diaryPageHint: "View, edit, or delete dated diaries and monthly overviews, or import historical Markdown/text diaries. Import dates are detected from filenames or content; verify the resulting dates.",
			diaryEmpty: "No entries yet.",
			monthlyLabel: "Monthly overview",
			del: "Delete",
			delConfirm: "Delete this entry? (The copy in memory is kept.)",
			upload: "Upload diary files",
			uploadHint: "Select multiple Markdown or plain-text diary files. Each requires a recognizable date; verify imported content under the corresponding date.",
			conflict: "When the day already has an entry",
			conflictSkip: "Skip",
			conflictMerge: "Merge (append)",
			conflictOverwrite: "Overwrite",
			importPreview: "{n} files selected:",
			importNoDate: "no date found",
			importExists: "day already has an entry",
			importNew: "new day",
			importNow: "Import",
			importDone: "Imported {n}, skipped {skip}, {bad} without a date.",
			expirySec: "Archive expiry",
			expirySecHint: "Daily maintenance attempts extraction from unprocessed data, removes expired archives, and optionally rotates sessions with recent messages and archives old sessions. Expired non-master sessions may be deleted; old master sessions are never auto-deleted.",
			rotateSessions: "Start a new session when the retention period is used up",
			deleteOldSessions: "Delete others' old sessions after expiry",
			deleteOldSessionsHint: "Automatically delete expired old non-master private and group session files, enabled by default. When disabled, retain them as archived. Old master sessions are always retained.",
			carryMessages: "Messages carried into the new session",
			archiveImages: "Save received images",
			archiveImagesHint: "Download local image copies for messages permitted to be archived, avoiding expired QQ links. Files are stored in media/ and cleaned up with archive expiry. Unlisted groups and ordinary private chats do not trigger archive image downloads.",
			runExpiry: "Run expiry now",
			expiryDone: "Done: {deleted} messages deleted, {rotated} sessions renewed, {sessions} old sessions deleted, {media} images removed.",
			lastRun: "Last run: {time}",
			retired: "Retired sessions",
			retiredEmpty: "None yet.",
			retiredState: "{umo} · {cat} · last message {last} · {state}",
			stArchived: "archived",
			stDeleted: "deleted",
			stDeleteFailed: "delete failed: {note}",
			proSec: "Proactive chat",
			proSecHint: "Schedule proactive requests at randomized intervals for eligible QQ conversations. The normal model chooses whether to speak; silence tokens are suppressed. Bridge allowlists, quiet hours, recent replies, and activity limits apply. Group context may be attached. Requires bridge proactive wake support, with no separate judgment model.",
			proactiveEnabled: "Proactive chat",
			proactiveMinMinutes: "Master: min interval (min)",
			proactiveMaxMinutes: "Master: max interval (min)",
			proactiveOthersMinMinutes: "Others/groups: min interval (min)",
			proactiveOthersMaxMinutes: "Others/groups: max interval (min)",
			proIntervalHint: "Randomize the next proactive request between the minimum and maximum interval in minutes, each at least 10. Defaults: master 60–240, others/groups 120–240. The maximum should not be below the minimum.",
			proactivePrivate: "Also others' private chats",
			proactiveGroup: "Also groups",
			quietStart: "Quiet from",
			quietEnd: "Quiet until",
			quietHint: "Quiet hours for proactive chat in 24-hour HH:MM format, including overnight ranges. Default: 01:00–09:00 in this plugin's timezone. Incoming-message replies are unaffected.",
			proactiveRecentMinutes: "Skip if she spoke within (min)",
			proactiveGroupContext: "Group context messages",
			proactiveActiveDays: "Others/groups: active within (days)",
			proSilence: "Silence token",
			proSilenceHint: "Silence token specified in proactive prompts, default [不发]. Must match the bridge silence token. A matching model response suppresses that message without another judgment request.",
			proNoWake: "dsh-napcat-bridge 0.7.0+ wake API not found; proactive chat is inactive.",
			proListEmpty: "No chats to reach yet.",
			proItem: "{umo} · {cat} · next {next} · last {last}",
			proTry: "Try now",
			proTried: "Woken; she decides whether to speak.",
			never: "never",
			careSec: "Memory care",
			careSecHint: "Periodically clean up stale low-importance memories and optionally consolidate similar ones with a model. Forgetting follows category and override rules. Diaries are excluded from cleanup and consolidation; the latest consolidation can be undone.",
			autoCleanup: "Automatic cleanup",
			autoCleanupDays: "Not recalled for (days)",
			autoCleanupImportance: "Importance below",
			purgeForgotten: "Purge long-forgotten memories",
			purgeForgottenDays: "Forgotten for (days)",
			consolidateEnabled: "Periodic consolidation",
			consolidateOverlap: "Similarity threshold",
			consolidateOverlapHint: "Similarity threshold for consolidation grouping, from 0.2 to 0.95, default 0.5. Higher values require closer similarity for memories to share a group.",
			consolidateGroups: "Max groups per run",
			careIntervalDays: "Every (days)",
			careLast: "Last cleanup: {cleanup}; last consolidation: {consolidate}",
			careRun: "Run now",
			careDone: "Done: {f} forgotten, {p} purged; {g} groups ({m} merged into {c}).",
			careLastRun: "Latest consolidation ({time}):",
			careGroup: "{old} → {created}",
			careUndo: "Undo the latest consolidation",
			careUndoConfirm: "The merged memories are removed and the originals restored. Confirm?",
			careUndone: "Undone.",
			backupSec: "Backup & migration",
			backupSecHint: "Export selected documents, memories, diaries, archives, and plugin/dsh settings for recovery or migration. Configuration credentials are excluded; master QQ private dsh sessions are a separate selection. Import supports selective restoration; model changes may require embedding-index rebuilds.",
			backupItemsLabel: "What to back up",
			backupItemsHint: "Applies to automatic and manual backups. Manual backup uses the current selection without requiring a save. Master raw sessions are off by default; a selected legacy others-archive setting migrates to this item. Configuration credentials are omitted, and import can restore a smaller subset.",
			bi_persona: "Persona",
			bi_personaDesc: "Current persona (no history)",
			bi_core: "Core memory",
			bi_coreDesc: "Master and public (no history)",
			bi_diary: "Diary",
			bi_diaryDesc: "Daily entries and monthly summaries",
			bi_memory: "Memory database",
			bi_memoryDesc: "Long-term memories, vectors, graph, purge fingerprints, consolidations",
			bi_archiveMaster: "Master's archive",
			bi_archiveMasterDesc: "Your private chat with her, images, and dsh chats",
			bi_sessionsMaster: "Master's dsh sessions",
			bi_sessionsMasterDesc: "Raw master QQ private sessions, historical sessions and referenced attachments; resumes restored chat (off by default)",
			bi_settingsCompanion: "This plugin's settings",
			bi_settingsCompanionDesc: "Everything on this page (no embedding key)",
			bi_settingsBridge: "NapCat bridge settings",
			bi_settingsBridgeDesc: "Master QQ, allowlists, wake words, models, pacing (no token or STT key)",
			bi_settingsDsh: "Other dsh settings",
			bi_settingsDshDesc: "Other settings changed in the dsh web settings, e.g. default preset, models (no keys)",
			backupNotIncluded: "Backups exclude configuration credentials, QQ login data, runtime files, and raw sessions from other private chats, groups or the web. Persona and core memory contain current drafts only. Master sessions contain complete events and referenced attachments, which may contain sensitive chat content.",
			backupNoItems: "Nothing selected; the package would be empty.",
			restorePick: "Restore which (unchecked parts stay as they are):",
			restoreSettingsNote: "Checked settings are applied right away (keys and tokens untouched); settings not changed in the package go back to defaults.",
			importedItems: "Restored: {items}",
			backupEnabled: "Daily automatic backup",
			backupTime: "Backup time",
			backupKeep: "Keep per kind",
			backupKeepHint: "Retention limit for automatic, manual, and pre-import backups separately, default 5 each. Older backups are removed when exceeded. Local backups do not replace off-machine copies.",
			exportNow: "Back up and download now",
			exported: "Backed up: {name}",
			download: "Download",
			importFile: "Import a backup",
			chooseFile: "Choose a package…",
			importFileHint: "Select a companion-….tar.gz backup exported by this plugin. The package is validated and previewed before confirmed selected data is restored. A pre-import backup is created.",
			previewTitle: "The package contains:",
			previewLine: "plugin {plugin} · made {time} · {mem} memories · {days} entries · {months} overviews · {msgs} archived messages · {sessions} master sessions · {media} images · embedding {model}",
			previewSettings: "This plugin's settings in the package:",
			confirmImport: "Import (current data is backed up first)",
			cancelImport: "Don't import",
			importing: "Importing; the plugin reloads itself…",
			imported: "Imported ({time}).",
			importFailed: "Import failed; existing data untouched: {error}",
			backupList: "Backups",
			backupEmpty: "No backups yet.",
			backupItem: "{name} · {size} · {reason}",
			reasonAuto: "auto",
			reasonManual: "manual",
			reasonBefore: "pre-import",
			restoreThis: "Restore",
			deleteBackup: "Delete",
			deleteBackupConfirm: "Delete this backup file?",
			selfCheck: "Post-migration self-check",
			selfCheckHint: "Run fixed queries against master-scope memory to verify retrieval after migration or import. Separate queries with spaces or commas. This checks retrieval rather than generating chat-model answers, and also runs after import.",
			selfCheckQueries: "Questions",
			runSelfCheck: "Run self-check",
			selfCheckResult: "\"{q}\" → {a}",
			selfCheckNone: "(nothing recalled)",
			personaGuardHintField: "Master switch for persona self-edit validation, enabled by default. Disabling bypasses this validation workflow; direct UI edits already bypass it.",
			personaEditMaxCharsHint: "Maximum added non-whitespace characters per model persona edit, default 300, minimum 10. Limits net growth rather than equal-length replacement, when self-edit validation is enabled.",
			personaAllowedHint: "Allowed-content criteria for persona-edit review, one per line. Describe stable identity, personality, and expression; the reviewer considers both allow and deny lists.",
			personaForbiddenHint: "Disallowed-content criteria for persona-edit review, one per line. Constrains model self-edits, not long-term-memory management or direct UI edits.",
			archiveEnabledHint: "Master QQ-archive switch, enabled by default. Disabling stops new message and archive-image writes and affects archive-dependent context, extraction, and diary input. Existing data is not immediately deleted.",
			archiveDaysMasterHint: "Retention days for administrator QQ private-message archives, default 365, minimum 1. Maintenance handles expiry; master memories and diaries do not automatically expire with these messages.",
			archiveDaysOthersHint: "Default retention days for other private and group message archives, default 5, minimum 1. Per-peer rules can override it; bridge archive permission is still required.",
			recallEnabledHint: "Master switch for automatic long-term-memory recall, enabled by default. Disabling stops per-turn recall attachments; persona, core memory, and active-memory tools have separate controls.",
			importanceWeightHint: "Weight of effective importance in recall ranking, from 0 to 1, default 0.2. Higher values favor important memories without changing relevance admission thresholds.",
			recencyWeightHint: "Weight of recency in recall ranking, from 0 to 1, default 0.1. Higher values favor newer memories; recency decays according to the half-life setting.",
			embedBatchHint: "Memories per embedding request, from 1 to 64, default 16. Larger batches reduce request count but increase request size; respect the provider's batch limits.",
			graphEnabledHint: "Enable graph-memory extraction and retrieval, disabled by default. Requires a relation-extraction model; backfilling existing memories adds requests. Disabling does not mean existing graph data is deleted.",
			graphBatchHint: "Memories processed per relation-extraction batch, from 1 to 30, default 8. Larger batches increase input size; consider the model's context and output capacity.",
			masterForgetHint: "Default forgetting mode for master-scope memories, normally reversible forgetting. Purge may be selected. Message-archive expiry is separate from long-term-memory forgetting.",
			privateForgetHint: "Default forgetting mode for other private-chat memories, default purge. Purge removes text and retains a fingerprint; normal forgetting preserves text for restoration in the memory list.",
			groupForgetHint: "Default forgetting mode for group long-term memories, default purge, overridable per group. Does not control group-message archive retention days.",
			diaryEnabledHint: "Enable daily diary generation, on by default, requiring a diary model and master chat data. Disabling does not delete existing diaries or stop separate archive-expiry maintenance.",
			monthlyEnabledHint: "Enable monthly overviews from existing diaries, on by default. Generation runs within diary maintenance and requires diary generation and an available model.",
			timezoneHint: "IANA timezone for diaries, maintenance, backups, and proactive quiet hours, default Asia/Shanghai. Does not change the system clock or bridge's separate time-note setting.",
			diaryOnNewSessionHint: "Attach recent diaries and monthly overviews when a master session starts, enabled by default. Day/month ranges and the diary context budget limit the attachment.",
			diaryDaysHint: "Recent diary days eligible for new master sessions, default 30. Zero omits diaries. Older files are not deleted; attached material remains subject to the context budget.",
			overviewMonthsHint: "Recent overview months eligible for new master sessions, default 12. Zero omits overviews without changing file retention.",
			rotateSessionsHint: "Rotate sessions after their applicable archive-retention period and archive the old sessions, enabled by default. Recent messages can be carried over. Long-term memories and diaries are not deleted.",
			carryMessagesHint: "Recent messages carried into an automatically rotated session, default 10. Zero carries none. This provides continuity rather than migrating the entire old history.",
			proactiveEnabledHint: "Master proactive-chat switch, enabled by default. Only eligible QQ conversations passing allowlists, category switches, activity, and time conditions receive requests. The normal model decides whether to speak.",
			proactiveMinMinutesHint: "Minimum randomized interval for administrator-private proactive chat, in minutes, default 60, minimum 10. Used with the maximum and subject to recent-reply and quiet-hour conditions.",
			proactiveMaxMinutesHint: "Maximum randomized interval for administrator-private proactive chat, in minutes, default 240, minimum 10. Should not be below the minimum; quiet hours or recent replies can defer it further.",
			proactivePrivateHint: "Allow proactive non-administrator private chats, enabled by default. The peer must pass private allowlist and recent-activity conditions; the master proactive switch still applies.",
			proactiveGroupHint: "Allow proactive group chat, enabled by default. The group must pass its current allowlist and cannot inherit an earlier administrator exemption. Activity and quiet-hour conditions still apply.",
			proactiveRecentMinutesHint: "Suppress proactive requests after a recent bot reply in the same conversation, in minutes, default 30. Zero disables this recent-reply suppression.",
			proactiveGroupContextHint: "Recent same-group archive messages attached to proactive requests, default 15. Zero omits them. Media follows existing context conversion rules; other groups' records are excluded.",
			proactiveActiveDaysHint: "Recent-activity window in days for other private and group proactive chat, default 7, minimum 1. Administrator private chats do not use this activity-day filter.",
			autoCleanupHint: "Periodically process memories that are both stale and below the effective-importance threshold, enabled by default. Forgetting follows scope settings; diaries are excluded.",
			autoCleanupDaysHint: "No-recall age condition for automatic cleanup, in days, default 90, minimum 1. The effective-importance condition must also be met.",
			autoCleanupImportanceHint: "Effective-importance threshold for automatic cleanup, from 0 to 1, default 0.2. Used together with no-recall age; the score includes time decay.",
			careIntervalDaysHint: "Interval for automatic cleanup and consolidation in days, default 7, minimum 1. Checked by daily maintenance rather than run on every incoming message.",
			purgeForgottenHint: "Automatically purge memories that have remained normally forgotten beyond the configured age, disabled by default. Removes text while retaining content fingerprints.",
			purgeForgottenDaysHint: "Days before normally forgotten memories are automatically purged, default 180, minimum 1. Applies only when automatic purging is enabled.",
			consolidateEnabledHint: "Enable periodic model consolidation of similar memories, on by default. Originals are marked superseded, with undo information for the latest consolidation. Adds model requests.",
			consolidateGroupsHint: "Maximum candidate groups processed per care run, default 20, minimum 1. Bounds a run's size rather than the number of memories per group.",
			backupEnabledHint: "Enable scheduled daily backups, on by default, using the configured time, items, and retention. Manual backups remain available when disabled.",
			backupTimeHint: "Scheduled daily backup time in 24-hour HH:MM format, default 04:00 in this plugin's timezone. Configured separately from diary and archive maintenance.",
			selfCheckQueriesHint: "Master-memory queries used for migration checks, separated by spaces or commas. Verifies expected retrieval results without editing persona or conversation history.",
			dropRoundsHint: "Oldest user rounds processed per compaction pass, default 20, minimum 1. Uses the selected truncate or summarize mode while retaining necessary recent context.",
			modeHint: "Truncate removes old rounds from model context; summarize requests a recollection to replace them. Neither directly deletes archives, diaries, or long-term memories.",
			kindHint: "Target type for an override rule. QQ ID matches the private-chat peer; group ID matches the group.",
			targetHint: "Full QQ or group ID matching the selected rule type. Blank-target rules are ignored. Do not use a dsh session ID here.",
			archiveDaysHint: "Archive-retention override for this target, in days. Blank or zero inherits the category default. Maintenance handles expiry; the archive switch and bridge permissions still apply.",
			archiveUnwokenHint: "Override unwoken-message archiving for this group; blank inherits the global setting. Enabling it still requires the master archive switch and group archive permission.",
			forgetModeHint: "Override the target's long-term-memory forgetting mode; blank inherits its category. Normal forgetting preserves restorable text; purge removes text and retains a fingerprint.",
			proactiveHint: "Override proactive-chat participation for this target; blank inherits category defaults. Enabling cannot bypass the master switch, bridge allowlist, quiet hours, or other scheduling conditions.",
			noteHint: "Optional description of the rule's purpose. Does not affect matching or permissions.",
		};

		var CSS = [
			".compc-section{display:grid;gap:12px;padding:16px 0 8px;border-top:.5px solid var(--dsw-alias-border-l3)}",
			".compc-section:first-child{border-top:none;padding-top:4px}",
			".compc-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin:0}",
			".compc-subtitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;margin:4px 0 0}",
			".compc-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--dsw-alias-border-l3);margin:4px 0 0;position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,inherit))}",
			".compc-tabs::-webkit-scrollbar{display:none}",
			".compc-tab{flex:none;padding:9px 12px 8px;border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer;border-radius:0}",
			".compc-tab:hover{color:var(--dsw-alias-label-primary)}",
			".compc-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-label-primary)}",
			".compc-tab:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:-2px}",
			".compc-tabs + .compc-section{border-top:none;padding-top:12px}",
			".compc-labelText{display:inline-flex;align-items:center;gap:3px;line-height:20px}",
			".compc-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-top:0;border-radius:50%;border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:600;line-height:1;cursor:help;user-select:none}",
			".compc-tip:hover,.compc-tip:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary);outline:none}",
			".compc-toggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".compc-field{display:grid;gap:6px;min-width:0}",
			".compc-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;min-height:20px}",
			".compc-select,.compc-input{min-width:0;height:35px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;padding:0 12px;font:inherit;font-size:13px;box-sizing:border-box}",
			".compc-select{justify-self:start;align-self:start;min-width:120px;max-width:100%}",
			".compc-ruleGrid .compc-select,.compc-ruleGrid .compc-input,.compc-grid .compc-select{width:100%;min-width:0}",
			".compc-textarea{width:100%;min-height:220px;resize:vertical;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px);padding:10px;font:inherit;font-size:13px;line-height:1.6}",
			".compc-textarea.compc-small{min-height:120px}",
			".compc-select:focus-visible,.compc-input:focus-visible,.compc-textarea:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".compc-testBtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-label-primary);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;cursor:pointer}",
			".compc-testBtn:hover:not(:disabled){background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff))}",
			".compc-testBtn:disabled{opacity:.55;cursor:default}",
			".compc-testBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:2px}",
			".compc-testIcon{font-size:14px;line-height:1}",
			".compc-pCurrent{display:inline-flex;align-items:center;gap:10px;min-width:220px;max-width:100%;height:38px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}",
			".compc-pCurrent:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pCurrent .compc-pName{flex:1;text-align:left}",
			".compc-pCaret{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".compc-pIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:6px;object-fit:contain}",
			".compc-pIconMono{background-color:var(--dsw-alias-label-primary);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}",
			".compc-pIconText{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.18));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600}",
			".compc-pPanel{display:grid;gap:10px;margin-top:4px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,transparent)}",
			".compc-pSearch{width:100%;box-sizing:border-box}",
			".compc-pGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}",
			".compc-pCard{display:flex;align-items:center;gap:10px;min-width:0;height:46px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}",
			".compc-pCard:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pCard.compc-pOn{border-color:var(--dsw-alias-label-primary);font-weight:600}",
			".compc-pCard .compc-pName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".compc-pCard:focus-visible,.compc-pCurrent:focus-visible,.compc-pBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-pModel{min-width:240px;max-width:100%;flex:1 1 240px}",
			".compc-pBtn{height:35px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}",
			".compc-pBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".compc-pBtn:disabled{opacity:.55;cursor:default}",
			".compc-link{text-decoration:underline;text-underline-offset:2px}",
			"@media (max-width:520px){.compc-pCurrent{width:100%}.compc-pGrid{grid-template-columns:1fr 1fr}}",
			".compc-llm{gap:10px}",
			".compc-saveBar{position:sticky;bottom:12px;z-index:5;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:16px;padding:10px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#1e1e1e));box-shadow:0 4px 18px rgba(0,0,0,.25);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".compc-saveBtns{display:flex;gap:8px}",
			".compc-pill{display:inline-block;margin:0;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-pill.compc-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 14%,transparent)}",
			".compc-pill.compc-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e03131) 14%,transparent)}",
			".compc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 16px;align-items:end}",
			".compc-grid>*{padding-top:0!important;padding-bottom:0!important;border-top:none!important;margin:0!important;min-width:0}",
			".compc-grid>*>:first-child{flex-wrap:wrap;row-gap:2px}",
			".compc-grid>.compc-field,.compc-grid>.compc-toggleRow{align-self:end}",
			".compc-card{display:grid;gap:10px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px)}",
			".compc-ruleGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px 12px;align-items:end}",
			".compc-result{margin:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".compc-ok{color:var(--dsw-alias-state-success-primary,#2f9e44)}",
			".compc-warn{color:var(--dsw-alias-state-warning-primary,#d97706)}",
			".compc-error{color:var(--dsw-alias-state-error-primary)}",
			".compc-history{display:grid;gap:6px;margin:0;padding:0;list-style:none}",
			".compc-historyItem{display:grid;gap:6px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px)}",
			".compc-pre{margin:0;max-height:240px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary))}",
			".compc-details{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);padding:0 12px}",
			".compc-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".compc-summary::-webkit-details-marker{display:none}",
			".compc-chevron{display:inline-block;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease;font-size:16px;line-height:1}",
			".compc-details[open] .compc-chevron{transform:rotate(90deg)}",
			".compc-detailsBody{display:grid;gap:8px;padding:0 0 12px}",
			".compc-progress{height:6px;border-radius:3px;background:var(--dsw-alias-border-l3);overflow:hidden}",
			".compc-progressBar{height:100%;background:var(--dsw-alias-state-success-primary,#2f9e44);transition:width .3s ease}",
			".compc-mem{display:grid;gap:6px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md,6px)}",
			".compc-memText{margin:0;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary);white-space:pre-wrap;overflow-wrap:anywhere}",
			".compc-check{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary);line-height:1.5}",
			".compc-check input{margin-top:3px}",
			".compc-checkGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}",
			".compc-checkItem{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);cursor:pointer;min-width:0}",
			".compc-checkItem.compc-on{border-color:var(--dsw-alias-label-tertiary)}",
			".compc-checkItem input{margin:3px 0 0;flex:none;width:15px;height:15px;accent-color:var(--dsw-alias-label-primary)}",
			".compc-checkItem:focus-within{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".compc-checkText{display:grid;gap:2px;min-width:0}",
			".compc-checkTitle{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.5}",
			".compc-checkDesc{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.5;overflow-wrap:anywhere}",
			".compc-input.compc-wide{width:100%}",
			"@media (prefers-reduced-motion:reduce){.compc-chevron,.compc-progressBar{transition:none}}"
		].join("\n");
		var CSS_ID = "dsh-companion-core/settings.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_ID) + "]") === null) {
			var tag = document.createElement("style");
			tag.dataset.plugin = PACKAGE;
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		//#region 字段格式：文字 ↔ 配置值
		function boolField(field) {
			return {
				field: field,
				format: function (v) { return v === true ? "true" : "false"; },
				parse: function (text) { return text === "true" ? { kind: "set", value: true } : text === "false" ? { kind: "set", value: false } : void 0; }
			};
		}
		function intField(field, min, max) {
			return {
				field: field,
				format: function (v) { return typeof v === "number" ? String(v) : ""; },
				parse: function (text) {
					var s = text.trim();
					if (s === "") return { kind: "clear" };
					var n = Number(s);
					return Number.isSafeInteger(n) && n >= min && n <= max ? { kind: "set", value: n } : void 0;
				}
			};
		}
		function listField(field) {
			return {
				field: field,
				format: function (v) { return Array.isArray(v) ? v.join(" ") : ""; },
				parse: function (text) { return { kind: "set", value: text.split(/[\s,，]+/).filter(function (x) { return x !== ""; }) }; }
			};
		}
		/** 一行一条的列表（条目里可以有空格、逗号） */
		function lineListField(field) {
			return {
				field: field,
				format: function (v) { return Array.isArray(v) ? v.join("\n") : ""; },
				parse: function (text) { return { kind: "set", value: text.split("\n").map(function (x) { return x.trim(); }).filter(function (x) { return x !== ""; }) }; }
			};
		}
		function enumField(field, choices) {
			var text = P.settingsTextField(field);
			return {
				field: field,
				format: text.format,
				parse: function (s) { var v = s.trim(); return v === "" ? { kind: "clear" } : choices.indexOf(v) >= 0 ? { kind: "set", value: v } : void 0; }
			};
		}
		/** 例外规则：整张表存成 JSON 文字，编辑器里改完写回。 */
		function rulesField(field) {
			return {
				field: field,
				format: function (v) { return JSON.stringify(Array.isArray(v) ? v : []); },
				parse: function (text) {
					try {
						var rows = JSON.parse(text);
						if (!Array.isArray(rows)) return void 0;
						return { kind: "set", value: rows.map(cleanRule).filter(function (r) { return r.target !== ""; }) };
					} catch (e) { return void 0; }
				}
			};
		}
		function cleanRule(r) {
			var out = { target: String(r.target || "").trim(), kind: r.kind === "group" ? "group" : "user" };
			["maxRounds", "dropRounds", "archiveDays"].forEach(function (k) {
				var n = Number(r[k]);
				if (r[k] !== "" && r[k] !== void 0 && r[k] !== null && Number.isSafeInteger(n) && n >= 0) out[k] = n;
			});
			out.mode = r.mode === "truncate" || r.mode === "llm" ? r.mode : "";
			out.archiveUnwoken = r.archiveUnwoken === "on" || r.archiveUnwoken === "off" ? r.archiveUnwoken : "";
			out.forgetMode = r.forgetMode === "normal" || r.forgetMode === "purge" ? r.forgetMode : "";
			out.proactive = r.proactive === "on" || r.proactive === "off" ? r.proactive : "";
			if (r.note) out.note = String(r.note);
			return out;
		}
		var MODES = ["truncate", "llm"];
		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var BOOLS = ["personaOnly", "selfEdit", "archiveEnabled", "archiveUnwoken", "recallEnabled", "activeMemory", "organizeBeforeCompact", "cleanupEnabled", "cleanupAutoPurge",
			"diaryEnabled", "monthlyEnabled", "diaryOnNewSession", "rotateSessions", "deleteOldSessions", "archiveImages",
			"proactiveEnabled", "proactivePrivate", "proactiveGroup", "graphEnabled", "personaGuard", "personaReview", "autoCleanup", "purgeForgotten", "consolidateEnabled", "backupEnabled"];
		var TEXTS = ["diaryEffort", "summaryModel", "memoryModel", "graphModel", "summaryEffort", "summaryApiUrl", "summaryApiModel", "memoryEffort", "memoryApiUrl", "memoryApiModel", "graphEffort", "graphApiUrl", "graphApiModel", "embedApiUrl", "embedModel", "diaryTime", "timezone", "quietStart", "quietEnd", "silenceToken", "backupTime"];
		var SECRETS = ["embedApiKey", "summaryApiKey", "memoryApiKey", "graphApiKey"];
		var FLOATS = ["keywordThreshold", "vectorThreshold", "keywordWeight", "importanceWeight", "recencyWeight", "groupDiscount", "autoCleanupImportance", "consolidateOverlap"];
		var FORGET = ["normal", "purge"];
		var LISTS = ["personaPresets", "excludedPresets", "selfCheckQueries", "backupItems"];
		/** 一行一条 */
		var LINE_LISTS = ["personaAllowed", "personaForbidden"];
		var INTS = [
			["historyKeep", 0], ["coreMasterMaxChars", 100], ["corePublicMaxChars", 100], ["thresholdPercent", 10, 95],
			["masterMaxRounds", 0], ["masterDropRounds", 1], ["privateMaxRounds", 0], ["privateDropRounds", 1],
			["groupMaxRounds", 0], ["groupDropRounds", 1], ["archiveDaysMaster", 1], ["archiveDaysOthers", 1],
			["recallTopK", 0], ["recallTopKMaster", 0], ["halfLifeDays", 1], ["organizeEveryRounds", 0], ["embedBatch", 1, 64], ["groupContextCount", 0], ["graphBatch", 1, 30], ["graphHops", 0, 2],
			["dayBoundaryHour", 0, 12], ["diaryDays", 0], ["overviewMonths", 0], ["diaryBudgetPercent", 1, 60], ["carryMessages", 0],
			["personaEditMaxChars", 10], ["personaMaxChars", 100],
			["proactiveMinMinutes", 10], ["proactiveMaxMinutes", 10], ["proactiveOthersMinMinutes", 10], ["proactiveOthersMaxMinutes", 10], ["proactiveRecentMinutes", 0], ["proactiveGroupContext", 0], ["proactiveActiveDays", 1],
			["autoCleanupDays", 1], ["purgeForgottenDays", 1], ["consolidateGroups", 1], ["careIntervalDays", 1], ["backupKeep", 1]
		];
		var ENUMS = [["pluginAccess", ["all", "public", "off"]], ["summarySource", ["follow", "dsh", "api"]], ["memorySource", ["follow", "dsh", "api"]], ["graphSource", ["follow", "dsh", "api"]], ["masterMode", MODES], ["privateMode", MODES], ["groupMode", MODES], ["logLevel", LOG_LEVELS], ["masterForget", FORGET], ["privateForget", FORGET], ["groupForget", FORGET]];
		function floatField(field) {
			return {
				field: field,
				format: function (v) { return typeof v === "number" ? String(v) : ""; },
				parse: function (text) {
					var t = text.trim();
					if (t === "") return { kind: "clear" };
					var n = Number(t);
					return Number.isFinite(n) && n >= 0 && n <= 1 ? { kind: "set", value: n } : void 0;
				}
			};
		}
		//#endregion

		//#region 表单模型
		function createForm(scope) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === void 0 ? Number.MAX_SAFE_INTEGER : x[2]); })
				.concat(ENUMS.map(function (x) { return enumField(x[0], x[1]); }), LISTS.map(listField), LINE_LISTS.map(lineListField), BOOLS.map(boolField),
					TEXTS.map(function (f) { return P.settingsTextField(f); }), FLOATS.map(floatField), [rulesField("rules")]);
			var secrets = SECRETS.map(function (field) {
				return { field: field, write: function (text) { return scope.mutate([{ op: "set", path: [field], value: text }]); } };
			});
			var form = new P.SettingsFormModel(scope, specs, secrets);
			var all = INTS.map(function (x) { return x[0]; }).concat(ENUMS.map(function (x) { return x[0]; }), LISTS, LINE_LISTS, BOOLS, TEXTS, FLOATS, SECRETS, ["rules"]);
			// 设置服务不把密钥发给浏览器，只告诉它有没有设置
			var secretSet = {};
			function compute() {
				var state = Object.assign({}, form.shell());
				all.forEach(function (f) { state[f] = form.field(f); });
				state.secretSet = Object.assign({}, secretSet);
				return state;
			}
			var store = form.bind(compute);
			return {
				form: form,
				store: store,
				setSecrets: function (next) {
					if (JSON.stringify(next) === JSON.stringify(secretSet)) return;
					secretSet = next;
					store.set(compute());
				}
			};
		}
		//#endregion

		//#region 通用小组件
		function Label(props) {
			if (!props.hint) return props.text;
			return h("span", { className: "compc-labelText" },
				props.text,
				h(P.Tooltip, { label: props.hint, side: "top", delayMs: 150, maxWidth: 320 },
					h("span", { className: "compc-tip", tabIndex: 0, role: "img", "aria-label": props.hint }, "?")));
		}
		function Section(props) {
			if (props.tab !== undefined && props.tab !== props.cur) return null
			return h("section", { className: "compc-section" },
				h("h3", { className: "compc-title" }, h(Label, { text: props.title, hint: props.hint })),
				props.children);
		}
		var TAB_IDS = ["persona", "chat", "memory", "diary", "proactive", "backup"];
		function readTab() {
			try { var v = window.localStorage.getItem("companion-core:tab"); if (v === "search") v = "memory"; return TAB_IDS.indexOf(v) >= 0 ? v : "persona"; } catch (e) { return "persona"; }
		}
		function Tabs(props) {
			var t = props.t;
			return h("div", { className: "compc-tabs", role: "tablist", "aria-label": t("tabsLabel") },
				TAB_IDS.map(function (id) {
					return h("button", {
						key: id, type: "button", role: "tab", className: "compc-tab",
						"aria-selected": props.cur === id,
						onClick: function () { props.onChange(id); try { window.localStorage.setItem("companion-core:tab", id); } catch (e) { /* 存不了就算了 */ } }
					}, t("tab_" + id));
				}));
		}
		/** 默认收起的一块，展开时才渲染里面的内容（记忆列表这种又长又要去服务器取的） */
		function Fold(props) {
			var [open, setOpen] = React.useState(false);
			return h("details", { className: "compc-details", open: open, onToggle: function (e) { setOpen(e.currentTarget.open); } },
				h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), open && props.openTitle ? props.openTitle : props.title),
				open ? h("div", { className: "compc-detailsBody" }, props.children) : null);
		}
		function Toggle(props) {
			var field = props.state[props.field];
			return h("div", { className: "compc-toggleRow" },
				h(Label, { text: props.label, hint: props.hint }),
				h(P.Switch, {
					checked: field.text === "true",
					label: props.label,
					disabled: props.disabled,
					onChange: function (checked) { props.edit(props.field, checked ? "true" : "false"); }
				}));
		}
		function Value(props) {
			var t = props.t;
			return h(P.SettingsValueField, Object.assign({
				id: "companion-core-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: props.invalidLabel || t("invalid"),
				numeric: props.numeric === true,
				disabled: props.disabled
			}, props.state[props.field], {
				onEdit: function (text) { props.edit(props.field, text); },
				onReset: function () { props.resetField(props.field); }
			}));
		}
		function Lines(props) {
			var t = props.t, field = props.state[props.field];
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("textarea", { id: "companion-core-" + props.field, className: "compc-textarea compc-small", value: field.text, disabled: props.disabled, onChange: function (e) { props.edit(props.field, e.target.value); } }),
				field.overridden ? h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: function () { props.resetField(props.field); } }, t("reset"))) : null);
		}
		function Select(props) {
			var field = props.state[props.field];
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("select", {
					id: "companion-core-" + props.field,
					className: "compc-select",
					value: field.text || props.fallback,
					disabled: props.disabled,
					onChange: function (event) { props.edit(props.field, event.target.value); }
				}, props.options.map(function (o) { return h("option", { key: o.value, value: o.value }, o.label); })));
		}
		function apiUrl(path) { return new URL("api/companion/" + path, document.baseURI).href; }
		function api(method, path, body) {
			var init = { method: method, credentials: "same-origin", cache: "no-store" };
			if (body !== void 0) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
			return fetch(apiUrl(path), init).then(function (res) {
				return res.json().catch(function () { return {}; }).then(function (json) {
					if (!res.ok) throw new Error(json && json.error || "HTTP " + res.status);
					return json;
				});
			});
		}
		function fmtTime(ms) {
			var d = new Date(ms);
			var p = function (n) { return String(n).padStart(2, "0"); };
			return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		}
		//#endregion

		//#region 人格、核心记忆：文件编辑器 + 历史版本
		function HistoryList(props) {
			var t = props.t;
			var [open, setOpen] = React.useState(null);
			var [text, setText] = React.useState("");
			var [asking, setAsking] = React.useState(null);
			var list = props.history || [];
			if (list.length === 0) return h("p", { className: "compc-hint" }, t("historyEmpty"));
			function view(id) {
				if (open === id) { setOpen(null); return; }
				setOpen(id); setText(t("loading"));
				api("GET", "doc/" + props.name + "/version/" + encodeURIComponent(id)).then(function (r) { setText(r.text); }, function (e) { setText(t("loadFailed", { error: e.message })); });
			}
			var BY = { settings: "bySettings", tool: "byTool", restore: "byRestore" };
			return h("ul", { className: "compc-history" }, list.map(function (v) {
				var who = BY[v.by] ? t(BY[v.by]) : v.by;
				return h("li", { key: v.id, className: "compc-historyItem" },
					h("div", { className: "compc-row" },
						h("span", { className: "compc-label" }, fmtTime(v.time)),
						h("span", { className: "compc-hint" }, who + " · " + t("chars", { n: v.length }) + (v.reason ? " · " + v.reason : ""))),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { view(v.id); } }, open === v.id ? t("hide") : t("view")),
						asking === v.id ? null : h(P.Button, { size: "sm", disabled: props.busy, onClick: function () { setAsking(v.id); } }, t("restore"))),
					asking === v.id ? h("div", { className: "compc-card", role: "group" },
						h("p", { className: "compc-hint" }, t("restoreConfirm")),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", onClick: function () { setAsking(null); props.onRestore(v.id); } }, t("confirm")),
							h(P.Button, { size: "sm", onClick: function () { setAsking(null); } }, t("cancel")))) : null,
					open === v.id ? h("pre", { className: "compc-pre" }, text) : null);
			}));
		}

		function DocEditor(props) {
			var t = props.t;
			var doc = props.doc || { text: "", history: [] };
			var [draft, setDraft] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			var [msg, setMsg] = React.useState(null);
			var value = draft === null ? doc.text : draft;
			var dirty = draft !== null && draft !== doc.text;
			function save() {
				setBusy(true); setMsg(null);
				api("POST", "doc/" + props.name, { text: value }).then(function (st) {
					setDraft(null); props.onState(st); setMsg({ tone: "ok", text: t("saved") });
				}, function (e) { setMsg({ tone: "error", text: t("saveDocFailed", { error: e.message }) }); }).finally(function () { setBusy(false); });
			}
			function restore(id) {
				setBusy(true); setMsg(null);
				api("POST", "doc/" + props.name + "/restore/" + encodeURIComponent(id), {}).then(function (st) {
					setDraft(null); props.onState(st); setMsg({ tone: "ok", text: t("saved") });
				}, function (e) { setMsg({ tone: "error", text: t("saveDocFailed", { error: e.message }) }); }).finally(function () { setBusy(false); });
			}
			return h("div", { className: "compc-field" },
				props.title ? h("h4", { className: "compc-subtitle" }, props.title) : null,
				h("textarea", {
					className: "compc-textarea" + (props.small ? " compc-small" : ""),
					value: value,
					"aria-label": props.title || props.ariaLabel,
					spellCheck: false,
					onChange: function (e) { setDraft(e.target.value); setMsg(null); }
				}),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: busy || !dirty, onClick: save }, busy ? t("saving") : props.saveLabel),
					h("span", { className: "compc-hint" }, t("chars", { n: value.length }) + (dirty ? " · " + t("unsaved") : ""))),
				msg ? h("p", { className: "compc-result compc-" + msg.tone, role: "status" }, msg.text) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("history") + "（" + (doc.history || []).length + "）"),
					h("div", { className: "compc-detailsBody" }, h(HistoryList, { t: t, name: props.name, history: doc.history, busy: busy, onRestore: restore }))));
		}
		//#endregion

		//#region 例外规则表
		function RulesEditor(props) {
			var t = props.t;
			var rows;
			try { rows = JSON.parse(props.state.rules.text || "[]"); } catch (e) { rows = []; }
			if (!Array.isArray(rows)) rows = [];
			function write(next) { props.edit("rules", JSON.stringify(next)); }
			function set(i, key, value) {
				var next = rows.map(function (r, j) { return j === i ? Object.assign({}, r, { [key]: value }) : r; });
				write(next);
			}
			function num(i, key) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, h(Label, { text: t(key), hint: t(key + "Hint") })),
					h("input", { className: "compc-input", inputMode: "numeric", value: rows[i][key] === void 0 ? "" : String(rows[i][key]), placeholder: t("modeDefault"), disabled: props.disabled,
						onChange: function (e) { var v = e.target.value.trim(); set(i, key, v === "" ? void 0 : Number(v)); } }));
			}
			function sel(i, key, options) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, h(Label, { text: t(key), hint: t(key + "Hint") })),
					h("select", { className: "compc-select", value: rows[i][key] || "", disabled: props.disabled, onChange: function (e) { set(i, key, e.target.value); } },
						options.map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
			}
			return h("div", { className: "compc-field" },
				rows.length === 0 ? h("p", { className: "compc-hint" }, t("rulesEmpty")) : null,
				rows.map(function (r, i) {
					return h("div", { key: i, className: "compc-card" },
						h("div", { className: "compc-ruleGrid" },
							sel(i, "kind", [["user", t("kindUser")], ["group", t("kindGroup")]]),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, h(Label, { text: t("target"), hint: t("targetHint") })),
								h("input", { className: "compc-input", inputMode: "numeric", value: r.target || "", disabled: props.disabled, onChange: function (e) { set(i, "target", e.target.value.trim()); } })),
							num(i, "maxRounds"), num(i, "dropRounds"),
							sel(i, "mode", [["", t("modeDefault")], ["truncate", t("modeTruncate")], ["llm", t("modeLlm")]]),
							num(i, "archiveDays"),
							r.kind === "group" ? sel(i, "archiveUnwoken", [["", t("modeDefault")], ["on", t("unwokenOn")], ["off", t("unwokenOff")]]) : null,
							sel(i, "forgetMode", [["", t("modeDefault")], ["normal", t("forgetNormal")], ["purge", t("forgetPurge")]]),
							sel(i, "proactive", [["", t("modeDefault")], ["on", t("proRuleOn")], ["off", t("proRuleOff")]]),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, h(Label, { text: t("note"), hint: t("noteHint") })),
								h("input", { className: "compc-input", value: r.note || "", disabled: props.disabled, onChange: function (e) { set(i, "note", e.target.value); } }))),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.filter(function (_r, j) { return j !== i; })); } }, t("removeRule"))));
				}),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.disabled, onClick: function () { write(rows.concat([{ kind: "group", target: "" }])); } }, t("addRule"))));
		}
		//#endregion

		//#region 记忆：整理、清理、向量索引、记忆列表
		function Secret(props) {
			var set = props.state.secretSet && props.state.secretSet[props.field] === true;
			return h(P.SettingsSecretField, {
				id: "companion-core-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				disabled: props.disabled,
				text: props.state[props.field].text,
				configured: set,
				stateLabel: set ? props.setLabel : props.unsetLabel,
				onEdit: function (text) { props.edit(props.field, text); }
			});
		}
		function Status(props) {
			return props.msg ? h("p", { className: "compc-result compc-" + props.msg.tone, role: "status" }, props.msg.text) : null;
		}
		function useAction() {
			var busyHook = React.useState(false), msgHook = React.useState(null);
			return {
				busy: busyHook[0], msg: msgHook[0], setMsg: msgHook[1],
				run: function (task, okText) {
					busyHook[1](true); msgHook[1](null);
					return task().then(function (r) { if (okText) msgHook[1]({ tone: "ok", text: okText }); return r; },
						function (e) { msgHook[1]({ tone: "error", text: e.message }); }).finally(function () { busyHook[1](false); });
				}
			};
		}

		function OrganizePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var p = data.pending || { qqSessions: 0, qqMessages: 0, dshSessions: 0 };
			var target = data.modelTarget;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, target ? t("currentModel", { model: target.provider + "/" + target.model }) : t("noModel")),
				data.memory ? h("p", { className: "compc-hint" }, t("memStats", { active: data.memory.active, forgotten: data.memory.forgotten, superseded: data.memory.superseded, tomb: data.memory.tombstones })) : null,
				h("p", { className: "compc-hint" }, t("pending", { qs: p.qqSessions, qm: p.qqMessages, ds: p.dshSessions })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "organize", {}).then(props.onState); }, t("organizeStarted")); } }, act.busy ? t("organizing") : t("organizeNow"))),
				h(Status, { msg: act.msg }));
		}

		function CleanupPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var [picked, setPicked] = React.useState({});
			if (!data || props.enabled !== true) return null;
			var c = data.cleanup;
			var purged = c ? c.purged || [] : [];
			var left = c ? c.suggestions.filter(function (x) { return purged.indexOf(x.id) < 0; }) : [];
			var chosen = left.filter(function (x) { return picked[x.id]; }).map(function (x) { return x.id; });
			return h("div", { className: "compc-card" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "cleanup", {}).then(function (st) { setPicked({}); props.onState(st); }); }); } }, act.busy ? t("running") : t("runCleanup"))),
				h(Status, { msg: act.msg }),
				c ? (c.suggestions.length === 0 ? h("p", { className: "compc-hint" }, t("cleanupNone")) : h("div", { className: "compc-field" },
					h("p", { className: "compc-hint" }, t("cleanupResult", { time: fmtTime(c.at), n: c.suggestions.length })),
					c.suggestions.map(function (x) {
						var done = purged.indexOf(x.id) >= 0;
						return h("label", { key: x.id, className: "compc-check" },
							h("input", { type: "checkbox", disabled: done, checked: done || picked[x.id] === true, onChange: function (e) { var n = Object.assign({}, picked); n[x.id] = e.target.checked; setPicked(n); } }),
							h("span", null, "#" + x.id + " " + x.content + (x.reason ? "（" + x.reason + "）" : "") + (done ? " · " + t("cleanupPurged") : "")));
					}),
					left.length > 0 ? h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", disabled: act.busy || chosen.length === 0, onClick: function () { act.run(function () { return api("POST", "cleanup/purge", { ids: chosen }).then(props.onState); }); } }, t("purgeSelected"))) : null)) : null);
		}

		/** 向量接口的「测试」（用保存过的设置算一句话的向量）。 */
		function EmbedTest(props) {
			var t = props.t;
			var act = useAction();
			function run() {
				act.run(function () {
					return api("POST", "embed/test", {}).then(function (r) {
						act.setMsg(r.ok ? { tone: "ok", text: t("embedTestOk", { model: r.model, dim: r.dim, ms: r.ms }) } : { tone: "error", text: t("embedTestFailed", { error: r.error }) });
					});
				});
			}
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-row" },
					h("button", { type: "button", className: "compc-testBtn", disabled: act.busy, onClick: run },
						h("span", { className: "compc-testIcon", "aria-hidden": true }, act.busy ? "…" : "⇄"), act.busy ? t("testing") : t("embedTest")),
					props.dirty ? h("span", { className: "compc-hint" }, t("testUsesSaved")) : null),
				act.msg ? h("div", null, h("p", { className: "compc-pill compc-result compc-" + act.msg.tone, role: "status" }, act.msg.text)) : null);
		}
		function IndexPanel(props) {
			var t = props.t;
			var [st, setSt] = React.useState(props.initial || null);
			var [asking, setAsking] = React.useState(false);
			var act = useAction();
			function load() { return api("GET", "index").then(setSt, function () {}); }
			React.useEffect(function () { if (props.initial) setSt(props.initial); }, [props.initial]);
			var running = st && st.state === "running";
			React.useEffect(function () {
				if (!running) return void 0;
				var timer = setInterval(load, 1500);
				return function () { clearInterval(timer); };
			}, [running]);
			if (!st) return null;
			var names = { idle: "stIdle", running: "stRunning", paused: "stPaused", done: "stDone", failed: "stFailed", cancelled: "stCancelled", disabled: "stDisabled" };
			var tone = st.state === "done" ? "ok" : st.state === "failed" ? "error" : st.state === "disabled" ? "warn" : "hint";
			var pct = st.todo ? Math.min(100, Math.round((st.done || 0) * 100 / st.todo)) : (st.total ? Math.round(st.embedded * 100 / st.total) : 0);
			function post(path) { return act.run(function () { return api("POST", "index/" + path, {}).then(setSt); }); }
			return h("div", { className: "compc-card" },
				h("p", { className: tone === "hint" ? "compc-hint" : "compc-result compc-" + tone, role: "status" }, t("indexState", { state: t(names[st.state] || "stIdle") })),
				st.model ? h("p", { className: "compc-hint" }, t("indexModel", { model: st.model, dim: st.dim || "?" }) + " · " + t("indexCount", { embedded: st.embedded, total: st.total })) : null,
				h("div", { className: "compc-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct }, h("div", { className: "compc-progressBar", style: { width: pct + "%" } })),
				st.todo ? h("p", { className: "compc-hint" }, t("indexProgress", { done: st.done || 0, todo: st.todo })) : null,
				st.startedAt ? h("p", { className: "compc-hint" }, t("indexTimes", { start: fmtTime(st.startedAt), end: st.finishedAt ? fmtTime(st.finishedAt) : "…" })) : null,
				st.lastError ? h("p", { className: "compc-result compc-error" }, t("indexLastError", { error: st.lastError })) : null,
				st.errors && st.errors.length > 0 ? h("p", { className: "compc-hint" }, t("indexErrors", { n: st.errors.length })) : null,
				st.state === "disabled" ? null : h("div", { className: "compc-row" },
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy || running, onClick: function () { setAsking(true); } }, t("rebuild")),
					running ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("pause"); } }, t("pause")) : null,
					st.state === "paused" || st.state === "failed" || st.state === "cancelled" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("resume"); } }, t("resume")) : null,
					running || st.state === "paused" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("cancel"); } }, t("cancelIndex")) : null,
					h(P.Button, { size: "sm", onClick: load }, t("refresh"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("rebuildConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("rebuild"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		function GraphPanel(props) {
			var t = props.t, data = props.data;
			var [asking, setAsking] = React.useState(false);
			var act = useAction();
			var st = data && data.graph;
			var running = !!st && st.state === "running";
			React.useEffect(function () {
				if (!running) return void 0;
				var timer = setInterval(function () { api("GET", "state").then(props.onState, function () {}); }, 2000);
				return function () { clearInterval(timer); };
			}, [running]);
			if (!st) return null;
			var names = { idle: "stIdle", running: "stRunning", paused: "stPaused", done: "stDone", failed: "stFailed", cancelled: "stCancelled", disabled: "graphStDisabled" };
			var tone = st.state === "done" ? "ok" : st.state === "failed" ? "error" : st.state === "disabled" ? "warn" : "hint";
			var c = st.counts;
			var pct = st.todo ? Math.min(100, Math.round((st.done || 0) * 100 / st.todo)) : (c.memories ? Math.round(c.done * 100 / c.memories) : 0);
			function post(path) { return act.run(function () { return api("POST", "graph/" + path, {}).then(props.onState); }); }
			return h("div", { className: "compc-card" },
				h("p", { className: tone === "hint" ? "compc-hint" : "compc-result compc-" + tone, role: "status" }, t("graphState", { state: t(names[st.state] || "stIdle") })),
				h("p", { className: "compc-hint" }, t("graphCounts", c)),
				h("div", { className: "compc-progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct }, h("div", { className: "compc-progressBar", style: { width: pct + "%" } })),
				st.todo ? h("p", { className: "compc-hint" }, t("indexProgress", { done: st.done || 0, todo: st.todo })) : null,
				st.startedAt ? h("p", { className: "compc-hint" }, t("indexTimes", { start: fmtTime(st.startedAt), end: st.finishedAt ? fmtTime(st.finishedAt) : "…" })) : null,
				st.lastError ? h("p", { className: "compc-result compc-error" }, t("indexLastError", { error: st.lastError })) : null,
				st.errors && st.errors.length > 0 ? h("p", { className: "compc-hint" }, t("indexErrors", { n: st.errors.length })) : null,
				st.state === "disabled" ? null : h("div", { className: "compc-row" },
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy || running, onClick: function () { setAsking(true); } }, t("rebuild")),
					running ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("pause"); } }, t("pause")) : null,
					st.state === "paused" || st.state === "failed" || st.state === "cancelled" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("resume"); } }, t("resume")) : null,
					running || st.state === "paused" ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("cancel"); } }, t("cancelIndex")) : null),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("graphRebuildConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("rebuild"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("graphSample")),
					h("div", { className: "compc-detailsBody" },
						(st.sample || []).length === 0 ? h("p", { className: "compc-hint" }, t("graphEmpty")) : st.sample.map(function (r, i) {
							return h("p", { key: i, className: "compc-memText" }, r.src + " —" + r.rel + "→ " + r.dst + "  ", h("span", { className: "compc-hint" }, scopeLabel(t, r.scope) + " · #" + r.memory));
						}))),
				h(Status, { msg: act.msg }));
		}

		var KIND_KEYS = { fact: "kindFact", preference: "kindPreference", event: "kindEvent", promise: "kindPromise", other: "kindOther", diary: "kindDiary" };
		function scopeLabel(t, sc) {
			if (sc === "master") return t("scopeMaster");
			if (sc === "public") return t("scopePublic");
			if (sc.indexOf("group:") === 0) return t("kindGroup") + " " + sc.slice(6);
			if (sc.indexOf("user:") === 0) return t("kindUser") + " " + sc.slice(5);
			return sc;
		}

		function MemoryItem(props) {
			var t = props.t, m = props.m;
			var [draft, setDraft] = React.useState(null);
			var [asking, setAsking] = React.useState(false);
			var act = useAction();
			function post(path, body) { return act.run(function () { return api("POST", "memory/" + m.id + "/" + path, body || {}).then(props.onChanged); }); }
			var inactive = m.status === "forgotten" || m.supersededBy !== void 0;
			return h("div", { className: "compc-mem" },
				draft === null ? h("p", { className: "compc-memText" }, m.content)
					: h("textarea", { className: "compc-textarea compc-small", value: draft, autoFocus: true, "aria-label": t("edit"), onChange: function (e) { setDraft(e.target.value); } }),
				h("p", { className: "compc-hint" }, t("memMeta", { id: m.id, scope: scopeLabel(t, m.scope), kind: t(KIND_KEYS[m.kind] || "kindOther"), imp: m.importance.toFixed(2), count: m.recallCount, time: fmtTime(m.createdAt) })
					+ (m.status === "forgotten" ? " · " + t("statusForgotten") : "") + (m.supersededBy !== void 0 ? " · " + t("statusSuperseded") + " #" + m.supersededBy : "")),
				h("div", { className: "compc-row" },
					draft === null ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setDraft(m.content); } }, t("edit"))
						: h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("edit", { content: draft }).then(function () { setDraft(null); }); } }, t("saveEdit")),
					draft !== null ? h(P.Button, { size: "sm", onClick: function () { setDraft(null); } }, t("cancel")) : null,
					inactive ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("restore"); } }, t("doRestore"))
						: h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { post("forget"); } }, t("doForget")),
					asking ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("doPurge"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("purgeConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); post("purge"); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		function MemoryList(props) {
			var t = props.t;
			var [f, setF] = React.useState({ scope: "", status: "active", q: "" });
			var [qDraft, setQDraft] = React.useState("");
			var [list, setList] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var [limit, setLimit] = React.useState(50);
			function load() {
				var qs = "status=" + encodeURIComponent(f.status) + "&limit=" + limit + (f.scope ? "&scope=" + encodeURIComponent(f.scope) : "") + (f.q ? "&q=" + encodeURIComponent(f.q) : "");
				return api("GET", "memory?" + qs).then(function (r) { setErr(null); setList(r); }, function (e) { setErr(e.message); });
			}
			React.useEffect(function () { load(); }, [f.scope, f.status, f.q, limit, props.version]);
			var add = useAction();
			var [nm, setNm] = React.useState({ scope: "master", content: "", kind: "fact", importance: "0.6" });
			function addMemory() {
				return add.run(function () {
					return api("POST", "memory/add", { scope: nm.scope, content: nm.content, kind: nm.kind, importance: Number(nm.importance) }).then(function (r) {
						if (r.action === "blocked") throw new Error(t("blocked"));
						setNm(Object.assign({}, nm, { content: "" })); load(); props.onChanged();
					});
				}, t("added"));
			}
			function selectBox(label, value, options, onChange) {
				return h("label", { className: "compc-field" },
					h("span", { className: "compc-hint" }, label),
					h("select", { className: "compc-select", value: value, onChange: function (e) { onChange(e.target.value); } },
						options.map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
			}
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-ruleGrid" },
					selectBox(t("filterScope"), f.scope, [["", t("scopeAll")], ["master", t("scopeMaster")], ["public", t("scopePublic")], ["group:*", t("scopeGroups")], ["user:*", t("scopeUsers")]], function (v) { setF(Object.assign({}, f, { scope: v })); }),
					selectBox(t("filterStatus"), f.status, [["active", t("statusActive")], ["forgotten", t("statusForgotten")], ["superseded", t("statusSuperseded")], ["all", t("statusAll")]], function (v) { setF(Object.assign({}, f, { status: v })); }),
					h("label", { className: "compc-field" },
						h("span", { className: "compc-hint" }, t("search")),
						h("input", { className: "compc-input", value: qDraft, onChange: function (e) { setQDraft(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter") setF(Object.assign({}, f, { q: qDraft.trim() })); }, onBlur: function () { setF(Object.assign({}, f, { q: qDraft.trim() })); } }))),
				err ? h("p", { className: "compc-result compc-error" }, t("loadFailed", { error: err })) : null,
				list ? h("p", { className: "compc-hint" }, t("memTotal", { n: list.total })) : h("p", { className: "compc-hint" }, t("loading")),
				list && list.items.length === 0 ? h("p", { className: "compc-hint" }, t("memEmpty")) : null,
				list ? list.items.map(function (m) { return h(MemoryItem, { key: m.id + ":" + m.content.length + ":" + m.status + ":" + (m.supersededBy || ""), t: t, m: m, onChanged: function () { load(); props.onChanged(); } }); }) : null,
				list && list.total > list.items.length ? h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: function () { setLimit(limit + 50); } }, t("loadMore"))) : null,
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("addMemory")),
					h("div", { className: "compc-detailsBody" },
						h("div", { className: "compc-ruleGrid" },
							selectBox(t("addScope"), nm.scope, [["master", t("scopeMaster")], ["public", t("scopePublic")]], function (v) { setNm(Object.assign({}, nm, { scope: v })); }),
							selectBox(t("addKind"), nm.kind, [["fact", t("kindFact")], ["preference", t("kindPreference")], ["event", t("kindEvent")], ["promise", t("kindPromise")], ["other", t("kindOther")]], function (v) { setNm(Object.assign({}, nm, { kind: v })); }),
							h("label", { className: "compc-field" },
								h("span", { className: "compc-hint" }, t("addImportance")),
								h("input", { className: "compc-input", inputMode: "decimal", value: nm.importance, onChange: function (e) { setNm(Object.assign({}, nm, { importance: e.target.value })); } }))),
						h("label", { className: "compc-field" },
							h("span", { className: "compc-hint" }, t("addContent")),
							h("textarea", { className: "compc-textarea compc-small", value: nm.content, onChange: function (e) { setNm(Object.assign({}, nm, { content: e.target.value })); } })),
						h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: add.busy || nm.content.trim() === "", onClick: addMemory }, t("add"))),
						h(Status, { msg: add.msg }))));
		}
		//#endregion

		//#region 日记、存档到期
		function DiaryPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data || !data.diary) return null;
			var d = data.diary;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, t("diaryCount", { days: d.days, months: d.months, latest: d.latest || "—" })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "maintenance", { what: "diary" }).then(function (r) {
								props.onState(r.state);
								var dr = r.report && r.report.diary;
								if (dr && dr.error) throw new Error(dr.error);
								act.setMsg({ tone: dr && dr.written ? "ok" : "warn", text: dr && dr.written ? t("diaryWritten", { date: dr.date }) : t("diaryNothing") });
							});
						});
					} }, act.busy ? t("running") : t("writeDiaryNow"))),
				h(Status, { msg: act.msg }));
		}

		function DiaryEntryItem(props) {
			var t = props.t, e = props.entry;
			var [open, setOpen] = React.useState(false);
			var [text, setText] = React.useState(null);
			var [draft, setDraft] = React.useState(null);
			var [asking, setAsking] = React.useState(false);
			var act = useAction();
			function load() { return api("GET", "diary/" + e.date).then(function (r) { setText(r.text); }); }
			return h("div", { className: "compc-mem" },
				h("div", { className: "compc-row" },
					h("span", { className: "compc-label" }, e.date + (props.monthly ? " · " + t("monthlyLabel") : "")),
					h("span", { className: "compc-hint" }, t("chars", { n: e.length }))),
				open && draft === null ? h("pre", { className: "compc-pre" }, text === null ? t("loading") : text) : null,
				draft !== null ? h("textarea", { className: "compc-textarea", value: draft, autoFocus: true, "aria-label": e.date, onChange: function (ev) { setDraft(ev.target.value); } }) : null,
				h("div", { className: "compc-row" },
					draft === null ? h(P.Button, { size: "sm", onClick: function () { if (!open && text === null) load(); setOpen(!open); } }, open ? t("hide") : t("view")) : null,
					draft === null ? h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { if (text !== null) { setOpen(true); setDraft(text); return; } act.run(function () { return api("GET", "diary/" + e.date).then(function (r) { setText(r.text); setDraft(r.text); setOpen(true); }); }); } }, t("edit")) : null,
					draft !== null ? h(P.Button, { size: "sm", disabled: act.busy || draft.trim() === "", onClick: function () { act.run(function () { return api("POST", "diary/" + e.date, { text: draft }).then(function () { setText(draft); setDraft(null); props.onChanged(); }); }, t("saved")); } }, t("saveEdit")) : null,
					draft !== null ? h(P.Button, { size: "sm", onClick: function () { setDraft(null); } }, t("cancel")) : null,
					asking || draft !== null ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("del"))),
				asking ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-hint" }, t("delConfirm")),
					h("div", { className: "compc-row" },
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); act.run(function () { return api("POST", "diary/" + e.date + "/delete", {}).then(props.onChanged); }); } }, t("confirm")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel")))) : null,
				h(Status, { msg: act.msg }));
		}

		/** 和服务端一样的认日期规则（上传前预览用）。 */
		function guessDate(name, text) {
			function one(s) {
				var m = /(20\d{2})[-_.年/]?(\d{1,2})[-_.月/]?(\d{1,2})日?/.exec(s);
				if (!m) return null;
				var mo = Number(m[2]), d = Number(m[3]);
				if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
				return m[1] + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
			}
			return one(name) || one(String(text).slice(0, 200));
		}

		function DiaryBook(props) {
			var t = props.t;
			var [list, setList] = React.useState(null);
			var [files, setFiles] = React.useState([]);
			var [mode, setMode] = React.useState("skip");
			var act = useAction();
			var inputRef = React.useRef(null);
			function load() { return api("GET", "diary").then(setList, function (e) { act.setMsg({ tone: "error", text: e.message }); }); }
			React.useEffect(function () { load(); }, [props.version]);
			function pick(ev) {
				var chosen = Array.prototype.slice.call(ev.target.files || []);
				Promise.all(chosen.map(function (f) { return f.text().then(function (text) { return { name: f.name, text: text }; }); })).then(setFiles);
			}
			var known = list ? list.days.map(function (x) { return x.date; }) : [];
			function doImport() {
				act.run(function () {
					return api("POST", "diary/import", { files: files, conflict: mode }).then(function (r) {
						var res = r.results || [];
						var skip = res.filter(function (x) { return x.result === "skipped"; }).length;
						var bad = res.filter(function (x) { return x.result === "no-date"; }).length;
						act.setMsg({ tone: "ok", text: t("importDone", { n: res.length - skip - bad, skip: skip, bad: bad }) });
						setFiles([]);
						if (inputRef.current) inputRef.current.value = "";
						load(); props.onChanged();
					});
				});
			}
			return h("div", { className: "compc-field" },
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("upload")),
					h("div", { className: "compc-detailsBody" },
						h("p", { className: "compc-hint" }, t("uploadHint")),
						h("input", { ref: inputRef, type: "file", multiple: true, accept: ".md,.markdown,.txt,text/markdown,text/plain", onChange: pick, "aria-label": t("upload") }),
						h("label", { className: "compc-field" },
							h("span", { className: "compc-hint" }, t("conflict")),
							h("select", { className: "compc-select", value: mode, onChange: function (e) { setMode(e.target.value); } },
								h("option", { value: "skip" }, t("conflictSkip")), h("option", { value: "merge" }, t("conflictMerge")), h("option", { value: "overwrite" }, t("conflictOverwrite")))),
						files.length > 0 ? h("div", { className: "compc-field" },
							h("p", { className: "compc-hint" }, t("importPreview", { n: files.length })),
							files.map(function (f, i) {
								var date = guessDate(f.name, f.text);
								var note = !date ? t("importNoDate") : known.indexOf(date) >= 0 ? t("importExists") : t("importNew");
								return h("p", { key: i, className: !date ? "compc-result compc-warn" : "compc-hint" }, f.name + " → " + (date || "?") + "（" + note + "）");
							}),
							h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy, onClick: doImport }, t("importNow")))) : null)),
				h(Status, { msg: act.msg }),
				!list ? h("p", { className: "compc-hint" }, t("loading")) : list.days.length === 0 && list.months.length === 0 ? h("p", { className: "compc-hint" }, t("diaryEmpty")) : null,
				list ? list.months.map(function (e) { return h(DiaryEntryItem, { key: "m" + e.date + e.length, t: t, entry: e, monthly: true, onChanged: function () { load(); props.onChanged(); } }); }) : null,
				list ? list.days.map(function (e) { return h(DiaryEntryItem, { key: e.date + e.length, t: t, entry: e, onChanged: function () { load(); props.onChanged(); } }); }) : null);
		}

		function ExpiryPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var last = data.maintenance;
			var names = { archived: "stArchived", deleted: "stDeleted", failed: "stDeleteFailed" };
			return h("div", { className: "compc-field" },
				last ? h("p", { className: "compc-hint" }, t("lastRun", { time: fmtTime(last.at) })) : null,
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "maintenance", { what: "expire" }).then(function (r) {
								props.onState(r.state);
								var rep = r.report;
								var deleted = rep.expired.reduce(function (n, e) { return n + (e.deleted || 0); }, 0);
								var rotated = rep.expired.filter(function (e) { return e.rotated; }).length;
								act.setMsg({ tone: "ok", text: t("expiryDone", { deleted: deleted, rotated: rotated, sessions: rep.deletedSessions.length, media: rep.mediaRemoved }) });
							});
						});
					} }, act.busy ? t("running") : t("runExpiry"))),
				h(Status, { msg: act.msg }),
				h("details", { className: "compc-details" },
					h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("retired") + "（" + (data.retired || []).length + "）"),
					h("div", { className: "compc-detailsBody" },
						(data.retired || []).length === 0 ? h("p", { className: "compc-hint" }, t("retiredEmpty")) :
							data.retired.map(function (r) {
								var cat = r.category === "master" ? t("scopeMaster") : r.category === "group" ? t("kindGroup") : t("kindUser");
								return h("p", { key: r.sessionId, className: r.state === "failed" ? "compc-result compc-warn" : "compc-hint" },
									t("retiredState", { umo: r.umo, cat: cat, last: fmtTime(r.lastTime), state: t(names[r.state] || "stArchived", { note: r.note || "" }) }));
							}))));
		}
		//#endregion

		//#region 主动聊天、记忆保养、备份与迁移
		function ProactivePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data || !data.proactive) return null;
			var pr = data.proactive;
			var catName = function (c) { return c === "master" ? t("scopeMaster") : c === "group" ? t("kindGroup") : t("kindUser"); };
			return h("div", { className: "compc-field" },
				pr.wakeAvailable ? null : h("p", { className: "compc-result compc-warn" }, t("proNoWake")),
				pr.list.length === 0 ? h("p", { className: "compc-hint" }, t("proListEmpty")) : pr.list.map(function (e) {
					return h("div", { key: e.umo, className: "compc-row" },
						h("span", { className: "compc-hint" }, t("proItem", { umo: e.umo, cat: catName(e.category), next: e.next ? fmtTime(e.next) : "—", last: e.last ? fmtTime(e.last) : t("never") })),
						h(P.Button, { size: "sm", disabled: act.busy || !pr.wakeAvailable, onClick: function () { act.run(function () { return api("POST", "proactive/try", { umo: e.umo }).then(props.onState); }, t("proTried")); } }, t("proTry")));
				}),
				h(Status, { msg: act.msg }));
		}

		function CarePanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var [asking, setAsking] = React.useState(false);
			if (!data || !data.care) return null;
			var c = data.care;
			var lr = c.lastRun;
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-hint" }, t("careLast", { cleanup: c.lastCleanup ? fmtTime(c.lastCleanup) : t("never"), consolidate: c.lastConsolidate ? fmtTime(c.lastConsolidate) : t("never") })),
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () {
						act.run(function () {
							return api("POST", "care/run", {}).then(function (r) {
								props.onState(r.state);
								var cl = r.report.cleanup || { forgotten: 0, purged: 0 }, co = r.report.consolidate || { groups: 0, merged: 0, created: 0 };
								if (r.report.consolidateError) throw new Error(r.report.consolidateError);
								act.setMsg({ tone: "ok", text: t("careDone", { f: cl.forgotten, p: cl.purged, g: co.groups, m: co.merged, c: co.created }) });
							});
						});
					} }, act.busy ? t("running") : t("careRun"))),
				h(Status, { msg: act.msg }),
				lr && lr.groups.length > 0 ? h("div", { className: "compc-card" },
					h("p", { className: "compc-hint" }, t("careLastRun", { time: fmtTime(lr.at) })),
					lr.groups.map(function (g, i) {
						return h("p", { key: i, className: "compc-memText" }, t("careGroup", { old: g.old.map(function (m) { return m.content; }).join(" / "), created: g.created.map(function (m) { return m.content; }).join(" / ") }));
					}),
					asking ? h("div", { className: "compc-card", role: "group" },
						h("p", { className: "compc-hint" }, t("careUndoConfirm")),
						h("div", { className: "compc-row" },
							h(P.Button, { size: "sm", onClick: function () { setAsking(false); act.run(function () { return api("POST", "care/undo", {}).then(function (r) { props.onState(r.state); }); }, t("careUndone")); } }, t("confirm")),
							h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("cancel"))))
						: h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(true); } }, t("careUndo")))) : null);
		}

		function firstLine(text) {
			var line = text.split("\n").map(function (x) { return x.replace(/^#+\s*/, "").trim(); }).filter(Boolean)[0] || "";
			return line.length > 80 ? line.slice(0, 80) + "…" : line;
		}
		function sizeText(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

		var BACKUP_ITEMS = ["persona", "core", "diary", "memory", "archiveMaster", "sessionsMaster", "settingsCompanion", "settingsBridge", "settingsDsh"];
		var LEGACY_ITEMS = ["persona", "core", "diary", "memory", "archiveMaster", "settingsCompanion"];
		/** 一组勾选框：每项一个标题和一句说明 */
		function ItemChecks(props) {
			var t = props.t;
			return h("div", { className: "compc-checkGrid", role: "group", "aria-label": props.label },
				props.ids.map(function (id) {
					var on = props.value.indexOf(id) >= 0;
					return h("label", { key: id, className: "compc-checkItem" + (on ? " compc-on" : "") },
						h("input", { type: "checkbox", checked: on, disabled: props.disabled, onChange: function (e) {
							var next = props.ids.filter(function (x) { return x === id ? e.target.checked : props.value.indexOf(x) >= 0; });
							props.onChange(next);
						} }),
						h("span", { className: "compc-checkText" },
							h("span", { className: "compc-checkTitle" }, t("bi_" + id)),
							h("span", { className: "compc-checkDesc" }, t("bi_" + id + "Desc"))));
				}));
		}
		/** 设置里的「备份哪些内容」 */
		function backupItemsOf(state) {
			var text = state.backupItems ? state.backupItems.text : "";
			return text.split(/[\s,，]+/).map(function (x) { return x === "archiveOthers" ? "sessionsMaster" : x; }).filter(function (x) { return BACKUP_ITEMS.indexOf(x) >= 0; });
		}
		function BackupItemsField(props) {
			var t = props.t;
			var value = backupItemsOf(props.state);
			return h("div", { className: "compc-field" },
				h("span", { className: "compc-label" }, h(Label, { text: t("backupItemsLabel"), hint: t("backupItemsHint") })),
				h(ItemChecks, { t: t, ids: BACKUP_ITEMS, value: value, label: t("backupItemsLabel"), disabled: props.disabled, onChange: function (next) { props.edit("backupItems", next.join(" ")); } }),
				value.length === 0 ? h("p", { className: "compc-result compc-warn" }, t("backupNoItems")) : null,
				h("p", { className: "compc-hint" }, t("backupNotIncluded")));
		}
		/** 导入预览里的「要还原哪些」 */
		function RestoreChoice(props) {
			var t = props.t, m = props.manifest;
			var have = (m.items || LEGACY_ITEMS).filter(function (x) { return BACKUP_ITEMS.indexOf(x) >= 0; });
			var [picked, setPicked] = React.useState(have);
			var hasSettings = picked.some(function (x) { return x.indexOf("settings") === 0; });
			return h("div", { className: "compc-field" },
				h("p", { className: "compc-label" }, t("restorePick")),
				h(ItemChecks, { t: t, ids: have, value: picked, label: t("restorePick"), disabled: props.busy, onChange: setPicked }),
				hasSettings ? h("p", { className: "compc-hint" }, t("restoreSettingsNote")) : null,
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: props.busy || picked.length === 0, onClick: function () { props.onConfirm(picked); } }, t("confirmImport")),
					h(P.Button, { size: "sm", disabled: props.busy, onClick: props.onCancel }, t("cancelImport"))));
		}

		function BackupPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			var [asking, setAsking] = React.useState(null);
			var [waiting, setWaiting] = React.useState(false);
			var inputRef = React.useRef(null);
			if (!data) return null;
			var fileUrl = function (name) { return apiUrl("backup/file/" + encodeURIComponent(name)); };
			var reasonName = function (r) { return r === "auto" ? t("reasonAuto") : r === "before-import" ? t("reasonBefore") : t("reasonManual"); };
			function upload(ev) {
				var f = ev.target.files && ev.target.files[0];
				if (!f) return;
				act.run(function () {
					return fetch(apiUrl("backup/upload"), { method: "POST", credentials: "same-origin", headers: { "content-type": "application/octet-stream", "x-companion-upload": "1" }, body: f })
						.then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || "HTTP " + res.status); return j; }); })
						.then(props.onState);
				}).finally(function () { if (inputRef.current) inputRef.current.value = ""; });
			}
			function confirmImport(id, items) {
				var before = data.lastImport ? data.lastImport.at : 0;
				act.run(function () {
					return api("POST", "backup/confirm", { id: id, items: items }).then(function () {
						setWaiting(true);
						var tries = 0;
						var timer = setInterval(function () {
							tries += 1;
							api("GET", "state").then(function (st) {
								if (st.lastImport && st.lastImport.at !== before) { clearInterval(timer); setWaiting(false); props.onState(st); }
							}, function () {});
							if (tries > 60) { clearInterval(timer); setWaiting(false); }
						}, 1000);
					});
				});
			}
			var pend = data.importing;
			var m = pend && pend.manifest;
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy || (props.items && props.items.length === 0), onClick: function () {
						act.run(function () {
							return api("POST", "backup/create", props.items ? { items: props.items } : {}).then(function (r) {
								props.onState(r.state);
								act.setMsg({ tone: "ok", text: t("exported", { name: r.name }) });
								var a = document.createElement("a"); a.href = fileUrl(r.name); a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
							});
						});
					} }, act.busy ? t("running") : t("exportNow"))),
				h("div", { className: "compc-field" },
					h("span", { className: "compc-label" }, h(Label, { text: t("importFile"), hint: t("importFileHint") })),
					h("input", { ref: inputRef, type: "file", accept: ".gz,.tgz,application/gzip", hidden: true, onChange: upload }),
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", disabled: act.busy || waiting, onClick: function () { if (inputRef.current) inputRef.current.click(); } }, t("chooseFile")))),
				waiting ? h("p", { className: "compc-result compc-warn", role: "status" }, t("importing")) : null,
				h(Status, { msg: act.msg }),
				data.lastImport ? h("p", { className: "compc-result " + (data.lastImport.error ? "compc-error" : "compc-ok") }, data.lastImport.error ? t("importFailed", { error: data.lastImport.error }) : t("imported", { time: fmtTime(data.lastImport.at) })) : null,
				data.lastImport && !data.lastImport.error && data.lastImport.plan ? h("p", { className: "compc-hint" },
					t("importedItems", { items: data.lastImport.plan.items.map(function (x) { return t("bi_" + x); }).join("、") }) + ((data.lastImport.plan.notes || []).length ? "；" + data.lastImport.plan.notes.join("；") : "")) : null,
				m ? h("div", { className: "compc-card", role: "group" },
					h("p", { className: "compc-label" }, t("previewTitle")),
					h("p", { className: "compc-hint" }, t("previewLine", { plugin: m.plugin, time: fmtTime(m.createdAt), mem: m.counts.memories, days: m.counts.diaryDays, months: m.counts.months, msgs: m.counts.archiveMessages, sessions: m.counts.masterSessions || 0, media: m.counts.media, model: (m.embed && m.embed.model) || "—" })),
					m.settings && Object.keys(m.settings).length > 0 ? h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("previewSettings")),
						h("div", { className: "compc-detailsBody" }, h("pre", { className: "compc-pre" }, JSON.stringify(m.settings, null, 2)))) : null,
					h(RestoreChoice, { key: pend.id, t: t, manifest: m, busy: act.busy || waiting, onConfirm: function (items) { confirmImport(pend.id, items); },
						onCancel: function () { act.run(function () { return api("POST", "backup/cancel", {}).then(props.onState); }); } })) : null,
				h("h4", { className: "compc-subtitle" }, t("backupList")),
				(data.backups || []).length === 0 ? h("p", { className: "compc-hint" }, t("backupEmpty")) : data.backups.map(function (b) {
					return h("div", { key: b.name, className: "compc-mem" },
						h("p", { className: "compc-hint" }, t("backupItem", { name: b.name, size: sizeText(b.size), reason: reasonName(b.reason) })),
						h("div", { className: "compc-row" },
							h("a", { href: fileUrl(b.name), download: b.name, className: "compc-hint" }, t("download")),
							h(P.Button, { size: "sm", disabled: act.busy || waiting, onClick: function () { act.run(function () { return api("POST", "backup/restore", { name: b.name }).then(props.onState); }); } }, t("restoreThis")),
							asking === b.name ? null : h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { setAsking(b.name); } }, t("deleteBackup"))),
						asking === b.name ? h("div", { className: "compc-card", role: "group" },
							h("p", { className: "compc-hint" }, t("deleteBackupConfirm")),
							h("div", { className: "compc-row" },
								h(P.Button, { size: "sm", onClick: function () { setAsking(null); act.run(function () { return api("POST", "backup/delete", { name: b.name }).then(props.onState); }); } }, t("confirm")),
								h(P.Button, { size: "sm", onClick: function () { setAsking(null); } }, t("cancel")))) : null);
				}));
		}

		function SelfCheckPanel(props) {
			var t = props.t, data = props.data;
			var act = useAction();
			if (!data) return null;
			var sc = data.selfCheck;
			return h("div", { className: "compc-field" },
				h("div", { className: "compc-row" },
					h(P.Button, { size: "sm", disabled: act.busy, onClick: function () { act.run(function () { return api("POST", "selfcheck", {}).then(function () { return api("GET", "state").then(props.onState); }); }); } }, act.busy ? t("running") : t("runSelfCheck"))),
				h(Status, { msg: act.msg }),
				sc ? h("div", { className: "compc-card" },
					h("p", { className: "compc-hint" }, fmtTime(sc.at)),
					sc.results.map(function (r, i) {
						return h("p", { key: i, className: r.found.length > 0 ? "compc-memText" : "compc-result compc-warn" }, t("selfCheckResult", { q: r.query, a: r.found.length > 0 ? firstLine(r.found[0].content) : t("selfCheckNone") }));
					})) : null);
		}
		//#endregion

		//#region 页面
		function ContextRow(props) {
			var t = props.t, c = props.common, p = props.prefix;
			return h("div", { className: "compc-card" },
				h("h4", { className: "compc-subtitle" }, props.title),
				h("div", { className: "compc-grid" },
					h(Value, Object.assign({ field: p + "MaxRounds", label: t("maxRounds"), hint: t("maxRoundsHint"), numeric: true, invalidLabel: t("invalidCount") }, c)),
					h(Value, Object.assign({ field: p + "DropRounds", label: t("dropRounds"), hint: t("dropRoundsHint"), numeric: true, invalidLabel: t("invalidPositive") }, c)),
					h(Select, Object.assign({ field: p + "Mode", label: t("mode"), hint: t("modeHint"), fallback: props.fallback, options: [{ value: "truncate", label: t("modeTruncate") }, { value: "llm", label: t("modeLlm") }] }, c))));
		}

		//#region 服务商预设（地址、常用模型、logo）和模型列表
		// logo 来自 LobeHub 的 lobe-icons（MIT，见 NOTICE.md），以 data: 图片内嵌，不从外网加载；商标归各厂商所有。
		// 单色的 logo 用 CSS 遮罩染成文字颜色，深色、浅色主题都看得清。
		var PROVIDER_ICONS = {
			"groq": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+R3JvcTwvdGl0bGU+PHBhdGggZD0iTTEyLjAzNiAyYy0zLjg1My0uMDM1LTcgMy03LjAzNiA2Ljc4MS0uMDM1IDMuNzgyIDMuMDU1IDYuODcyIDYuOTA4IDYuOTA3aDIuNDJ2LTIuNTY2aC0yLjI5MmMtMi40MDcuMDI4LTQuMzgtMS44NjYtNC40MDgtNC4yMy0uMDI5LTIuMzYyIDEuOTAxLTQuMjk4IDQuMzA4LTQuMzI2aC4xYzIuNDA3IDAgNC4zNTggMS45MTUgNC4zNjUgNC4yNzh2Ni4zMDVjMCAyLjM0Mi0xLjk0NCA0LjI1LTQuMzIzIDQuMjc5YTQuMzc1IDQuMzc1IDAgMDEtMy4wMzMtMS4yNTJsLTEuODUxIDEuODE4QTcgNyAwIDAwMTIuMDI5IDIyaC4wOTJjMy44MDMtLjA1NiA2Ljg1OC0zLjA4MyA2Ljg3OS02LjgxNnYtNi41QzE4LjkwNyA0Ljk2MyAxNS44MTcgMiAxMi4wMzYgMnoiPjwvcGF0aD48L3N2Zz4=" },
			"minimax": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk1pbmltYXg8L3RpdGxlPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ibG9iZS1pY29ucy1taW5pbWF4LV9SXzBfIiB4MT0iMCUiIHgyPSIxMDAuMTgyJSIgeTE9IjUwLjA1NyUiIHkyPSI1MC4wNTclIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRTIxNjdFIj48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkU2MDNDIj48L3N0b3A+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHBhdGggZD0iTTE2LjI3OCAyYzEuMTU2IDAgMi4wOTMuOTI3IDIuMDkzIDIuMDd2MTIuNTAxYS43NC43NCAwIDAwLjc0NC43MDkuNzQuNzQgMCAwMC43NDMtLjcwOVY5LjA5OWEyLjA2IDIuMDYgMCAwMTIuMDcxLTIuMDQ5QTIuMDYgMi4wNiAwIDAxMjQgOS4xdjYuNTYxYS42NDkuNjQ5IDAgMDEtLjY1Mi42NDUuNjQ5LjY0OSAwIDAxLS42NTMtLjY0NVY5LjFhLjc2Mi43NjIgMCAwMC0uNzY2LS43NTguNzYyLjc2MiAwIDAwLS43NjYuNzU4djcuNDcyYTIuMDM3IDIuMDM3IDAgMDEtMi4wNDggMi4wMjYgMi4wMzcgMi4wMzcgMCAwMS0yLjA0OC0yLjAyNnYtMTIuNWEuNzg1Ljc4NSAwIDAwLS43ODgtLjc1My43ODUuNzg1IDAgMDAtLjc4OS43NTJsLS4wMDEgMTUuOTA0QTIuMDM3IDIuMDM3IDAgMDExMy40NDEgMjJhMi4wMzcgMi4wMzcgMCAwMS0yLjA0OC0yLjAyNlYxOC4wNGMwLS4zNTYuMjkyLS42NDUuNjUyLS42NDUuMzYgMCAuNjUyLjI4OS42NTIuNjQ1djEuOTM0YzAgLjI2My4xNDIuNTA2LjM3Mi42MzguMjMuMTMxLjUxNC4xMzEuNzQ0IDBhLjczNC43MzQgMCAwMC4zNzItLjYzOFY0LjA3YzAtMS4xNDMuOTM3LTIuMDcgMi4wOTMtMi4wN3ptLTUuNjc0IDBjMS4xNTYgMCAyLjA5My45MjcgMi4wOTMgMi4wN3YxMS41MjNhLjY0OC42NDggMCAwMS0uNjUyLjY0NS42NDguNjQ4IDAgMDEtLjY1Mi0uNjQ1VjQuMDdhLjc4NS43ODUgMCAwMC0uNzg5LS43OC43ODUuNzg1IDAgMDAtLjc4OS43OHYxNC4wMTNhMi4wNiAyLjA2IDAgMDEtMi4wNyAyLjA0OCAyLjA2IDIuMDYgMCAwMS0yLjA3MS0yLjA0OFY5LjFhLjc2Mi43NjIgMCAwMC0uNzY2LS43NTguNzYyLjc2MiAwIDAwLS43NjYuNzU4djMuOGEyLjA2IDIuMDYgMCAwMS0yLjA3MSAyLjA0OUEyLjA2IDIuMDYgMCAwMTAgMTIuOXYtMS4zNzhjMC0uMzU3LjI5Mi0uNjQ2LjY1Mi0uNjQ2LjM2IDAgLjY1My4yOS42NTMuNjQ2VjEyLjljMCAuNDE4LjM0My43NTcuNzY2Ljc1N3MuNzY2LS4zMzkuNzY2LS43NTdWOS4wOTlhMi4wNiAyLjA2IDAgMDEyLjA3LTIuMDQ4IDIuMDYgMi4wNiAwIDAxMi4wNzEgMi4wNDh2OC45ODRjMCAuNDE5LjM0My43NTguNzY3Ljc1OC40MjMgMCAuNzY2LS4zMzkuNzY2LS43NThWNC4wN2MwLTEuMTQzLjkzNy0yLjA3IDIuMDkzLTIuMDd6IiBmaWxsPSJ1cmwoI2xvYmUtaWNvbnMtbWluaW1heC1fUl8wXykiIGZpbGwtcnVsZT0ibm9uemVybyI+PC9wYXRoPjwvc3ZnPg==" },
			"moonshot": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+TW9vbnNob3RBSTwvdGl0bGU+PHBhdGggZD0iTTEuMDUyIDE2LjkxNmw5LjUzOSAyLjU1MmEyMS4wMDcgMjEuMDA3IDAgMDAuMDYgMi4wMzNsNS45NTYgMS41OTNhMTEuOTk3IDExLjk5NyAwIDAxLTUuNTg2Ljg2NWwtLjE4LS4wMTYtLjA0NC0uMDA0LS4wODQtLjAwOS0uMDk0LS4wMWExMS42MDUgMTEuNjA1IDAgMDEtLjE1Ny0uMDJsLS4xMDctLjAxNC0uMTEtLjAxNmExMS45NjIgMTEuOTYyIDAgMDEtLjMyLS4wNTFsLS4wNDItLjAwOC0uMDc1LS4wMTMtLjEwNy0uMDItLjA3LS4wMTUtLjA5My0uMDE5LS4wNzUtLjAxNi0uMDk1LS4wMi0uMDk3LS4wMjMtLjA5NC0uMDIyLS4wNjgtLjAxNy0uMDg4LS4wMjItLjA5LS4wMjQtLjA5NS0uMDI1LS4wODItLjAyMy0uMTA5LS4wMy0uMDYyLS4wMi0uMDg0LS4wMjUtLjA5My0uMDI4LS4xMDUtLjAzNC0uMDU4LS4wMTktLjA4LS4wMjYtLjA5LS4wMzEtLjA2Ni0uMDI0YTYuMjkzIDYuMjkzIDAgMDEtLjA0NC0uMDE1bC0uMDY4LS4wMjUtLjEwMS0uMDM3LS4wNTctLjAyMi0uMDgtLjAzLS4wODctLjAzNS0uMDg4LS4wMzUtLjA3OS0uMDMyLS4wOTUtLjA0LS4wNjMtLjAyOC0uMDYzLS4wMjdhNS42NTUgNS42NTUgMCAwMS0uMDQxLS4wMThsLS4wNjYtLjAzLS4xMDMtLjA0Ny0uMDUyLS4wMjQtLjA5Ni0uMDQ2LS4wNjItLjAzLS4wODQtLjA0LS4wODYtLjA0NC0uMDkzLS4wNDctLjA1Mi0uMDI3LS4xMDMtLjA1NS0uMDU3LS4wMy0uMDU4LS4wMzJhNi40OSA2LjQ5IDAgMDEtLjA0Ni0uMDI2bC0uMDk0LS4wNTMtLjA2LS4wMzQtLjA1MS0uMDMtLjA3Mi0uMDQxLS4wODItLjA1LS4wOTMtLjA1Ni0uMDUyLS4wMzItLjA4NC0uMDUzLS4wNjEtLjAzOS0uMDc5LS4wNS0uMDctLjA0Ny0uMDUzLS4wMzVhNy43ODUgNy43ODUgMCAwMS0uMDU0LS4wMzZsLS4wNDQtLjAzLS4wNDQtLjAzYTYuMDY2IDYuMDY2IDAgMDEtLjA0LS4wMjhsLS4wNTctLjA0LS4wNzYtLjA1NC0uMDY5LS4wNS0uMDc0LS4wNTQtLjA1Ni0uMDQyLS4wNzYtLjA1Ny0uMDc2LS4wNTktLjA4Ni0uMDY3LS4wNDUtLjAzNS0uMDY0LS4wNTItLjA3NC0uMDYtLjA4OS0uMDczLS4wNDYtLjAzOS0uMDQ2LS4wMzlhNy41MTYgNy41MTYgMCAwMS0uMDQzLS4wMzdsLS4wNDUtLjA0LS4wNjEtLjA1My0uMDctLjA2Mi0uMDY4LS4wNi0uMDYyLS4wNTgtLjA2Ny0uMDYyLS4wNTMtLjA1LS4wODgtLjA4NGExMy4yOCAxMy4yOCAwIDAxLS4wOTktLjA5N2wtLjAyOS0uMDI4LS4wNDEtLjA0Mi0uMDY5LS4wNy0uMDUtLjA1MS0uMDUtLjA1M2E2LjQ1NyA2LjQ1NyAwIDAxLS4xNjgtLjE3OWwtLjA4LS4wODgtLjA2Mi0uMDctLjA3MS0uMDgtLjA0Mi0uMDQ5LS4wNTMtLjA2Mi0uMDU4LS4wNjgtLjA0Ni0uMDU2YTcuMTc1IDcuMTc1IDAgMDEtLjAyNy0uMDMzbC0uMDQ1LS4wNTUtLjA2Ni0uMDgyLS4wNDEtLjA1Mi0uMDUtLjA2NC0uMDItLjAyNWExMS45OSAxMS45OSAwIDAxLTEuNDQtMi40MDJ6bS0xLjAyLTUuNzk0bDExLjM1MyAzLjAzN2EyMC40NjggMjAuNDY4IDAgMDAtLjQ2OSAyLjAxMWwxMC44MTcgMi44OTRhMTIuMDc2IDEyLjA3NiAwIDAxLTEuODQ1IDIuMDA1TC42NTcgMTUuOTIzbC0uMDE2LS4wNDYtLjAzNS0uMTA0YTExLjk2NSAxMS45NjUgMCAwMS0uMDUtLjE1M2wtLjAwNy0uMDIzYTExLjg5NiAxMS44OTYgMCAwMS0uMjA3LS43NDFsLS4wMy0uMTI2LS4wMTgtLjA4LS4wMjEtLjA5Ny0uMDE4LS4wODEtLjAxOC0uMDktLjAxNy0uMDg0LS4wMTgtLjA5NGMtLjAyNi0uMTQxLS4wNS0uMjgzLS4wNzEtLjQyNmwtLjAxNy0uMTE4LS4wMTEtLjA4My0uMDEzLS4xMDJhMTIuMDEgMTIuMDEgMCAwMS0uMDE5LS4xNjFsLS4wMDUtLjA0N2ExMi4xMiAxMi4xMiAwIDAxLS4wMzQtMi4xNDV6bTEuNTkzLTUuMTVsMTEuOTQ4IDMuMTk2Yy0uMzY4LjYwNS0uNzA1IDEuMjMxLTEuMDEgMS44NzVsMTEuMjk1IDMuMDIyYy0uMTQyLjgyLS4zNjggMS42MTItLjY2OCAyLjM2NWwtMTEuNTUtMy4wOUwuMTI0IDEwLjI2bC4wMTUtLjEuMDA4LS4wNDkuMDEtLjA2Ny4wMTUtLjA4Ny4wMTgtLjA5OGMuMDI2LS4xNDguMDU2LS4yOTUuMDg4LS40NDJsLjAyOC0uMTI0LjAyLS4wODUuMDI0LS4wOTdjLjAyMi0uMDkuMDQ1LS4xOC4wNy0uMjY4bC4wMjgtLjEwMi4wMjMtLjA4My4wMy0uMS4wMjUtLjA4Mi4wMy0uMDk2LjAyNi0uMDgyLjAzMS0uMDk1YTExLjg5NiAxMS44OTYgMCAwMTEuMDEtMi4yMzJ6bTQuNDQyLTQuNEwxNy4zNTIgNC41OWEyMC43NyAyMC43NyAwIDAwLTEuNjg4IDEuNzIxbDcuODIzIDIuMDkzYy4yNjcuODUyLjQ0MiAxLjc0NC41MTMgMi42NjVMMi4xMDYgNS4yMTNsLjA0NS0uMDY1LjAyNy0uMDQuMDQtLjA1NS4wNDYtLjA2NS4wNTUtLjA3Ni4wNTQtLjA3Mi4wNjQtLjA4Ni4wNS0uMDY1LjA1Ny0uMDczLjA1NS0uMDcuMDYtLjA3NC4wNTUtLjA2OS4wNjUtLjA3Ny4wNTQtLjA2Ni4wNjYtLjA3Ny4wNTMtLjA2LjA3Mi0uMDgyLjA1My0uMDYuMDY3LS4wNzQuMDU0LS4wNTguMDczLS4wNzguMDU4LS4wNi4wNjMtLjA2Ny4xNjgtLjE3LjEtLjA5OC4wNTktLjA1Ni4wNzYtLjA3MWExMi4wODQgMTIuMDg0IDAgMDEyLjI3Mi0xLjY3N3pNMTIuMDE3IDBoLjA5N2wuMDgyLjAwMS4wNjkuMDAxLjA1NC4wMDIuMDY4LjAwMi4wNDYuMDAxLjA3Ni4wMDMuMDQ3LjAwMi4wNi4wMDMuMDU0LjAwMi4wODcuMDA1LjEwNS4wMDcuMTQ0LjAxMS4wODguMDA3LjA0NC4wMDQuMDc3LjAwOC4wODIuMDA4LjA0Ny4wMDUuMTAyLjAxMi4wNS4wMDYuMTA4LjAxNC4wODEuMDEuMDQyLjAwNi4wNjUuMDEuMjA3LjAzMi4wNy4wMTIuMDY1LjAxMS4xNC4wMjYuMDkyLjAxOC4xMS4wMjIuMDQ2LjAxLjA3NS4wMTYuMDQxLjAxTDE0LjcuM2wuMDQyLjAxLjA2NS4wMTUuMDQ5LjAxMi4wNzEuMDE3LjA5Ni4wMjQuMTEyLjAzLjExMy4wMy4xMTMuMDMyLjA1LjAxNS4wNy4wMi4wNzguMDI0LjA3My4wMjMuMDUuMDE2LjA1LjAxNi4wNzYuMDI1LjA5OS4wMzMuMTAyLjAzNi4wNDguMDE3LjA2NC4wMjMuMDkzLjAzNC4xMS4wNDEuMTE2LjA0NS4xLjA0LjA0Ny4wMi4wNi4wMjQuMDQxLjAxOC4wNjMuMDI2LjA0LjAxOC4wNTcuMDI1LjExLjA0OC4xLjA0Ni4wNzQuMDM1LjA3NS4wMzYuMDYuMDI4LjA5Mi4wNDYuMDkxLjA0NS4xMDIuMDUyLjA1My4wMjguMDQ5LjAyNi4wNDYuMDI0LjA2LjAzMy4wNDEuMDIyLjA1Mi4wMjkuMDg4LjA1LjEwNi4wNi4wODcuMDUxLjA1Ny4wMzQuMDUzLjAzMi4wOTYuMDU5LjA4OC4wNTUuMDk4LjA2Mi4wMzYuMDI0LjA2NC4wNDEuMDg0LjA1Ni4wNC4wMjcuMDYyLjA0Mi4wNjIuMDQzLjAyMy4wMTdjLjA1NC4wMzcuMTA4LjA3NS4xNjEuMTE0bC4wODMuMDYuMDY1LjA0OC4wNTYuMDQzLjA4Ni4wNjUuMDgyLjA2NC4wNC4wMy4wNS4wNDEuMDg2LjA2OS4wNzkuMDY1LjA4NS4wNzFjLjcxMi42IDEuMzUzIDEuMjgzIDEuOTA5IDIuMDMxTDcuMjIyLjk5NGwuMDYyLS4wMjcuMDY1LS4wMjguMDgxLS4wMzQuMDg2LS4wMzVjLjExMy0uMDQ1LjIyNy0uMDkuMzQxLS4xMzFsLjA5Ni0uMDM1LjA5My0uMDMzLjA4NC0uMDMuMDk2LS4wMzFjLjA4Ny0uMDMuMTc2LS4wNTguMjY0LS4wODVsLjA5MS0uMDI3LjA4Ni0uMDI1LjEwMi0uMDMuMDg1LS4wMjMuMS0uMDI2TDkuMDQuMzdsLjA5LS4wMjMuMDkxLS4wMjIuMDk1LS4wMjIuMDktLjAyLjA5OC0uMDIxLjA5MS0uMDIuMDk1LS4wMTguMDkyLS4wMTguMS0uMDE4LjA5MS0uMDE2LjA5OC0uMDE3LjA5Mi0uMDE0LjA5Ny0uMDE1LjA5Mi0uMDEzLjEwMi0uMDEzLjA5MS0uMDEyLjEwNS0uMDEyLjA5LS4wMS4xMDUtLjAxYy4wOTMtLjAxLjE4Ni0uMDE4LjI4LS4wMjRsLjEwNi0uMDA4LjA5LS4wMDUuMTEtLjAwNi4wOTMtLjAwNC4xLS4wMDQuMDk3LS4wMDIuMDk5LS4wMDIuMTk3LS4wMDJ6Ij48L3BhdGg+PC9zdmc+" },
			"openrouter": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk9wZW5Sb3V0ZXI8L3RpdGxlPjxwYXRoIGQ9Ik0xOC42NTQgMy44N2E1LjA4NyA1LjA4NyAwIDExMCAxMC4xNzRMMjMuNyAxOS4wOWMuNjQuNjQxLjE4NyAxLjczNy0uNzIgMS43MzdIOC40OGE4LjQ3OSA4LjQ3OSAwIDAxMC0xNi45NThoMTAuMTc1ek04LjQ3OSA3LjI2YTUuMDg3IDUuMDg3IDAgMTAwIDEwLjE3NiA1LjA4NyA1LjA4NyAwIDAwMC0xMC4xNzV6IiBmaWxsPSIjQzhGRjAwIj48L3BhdGg+PC9zdmc+" },
			"baidu": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkJhaWR1PC90aXRsZT48cGF0aCBkPSJNOC44NTkgMTEuNzM1YzEuMDE3LTEuNzEgNC4wNTktMy4wODMgNi4yMDIuMjg2IDEuNTc5IDIuMjg0IDQuMjg0IDQuMzk3IDQuMjg0IDQuMzk3czIuMDI3IDEuNjAxLjczIDQuNjg0Yy0xLjI0IDIuOTU2LTUuNjQgMS42MDctNi4wMDUgMS40OWwtLjAyNC0uMDA5cy0xLjc0Ni0uNTY4LTMuNzc2LS4xMTJjLTIuMDI2LjQ1OC0zLjc3My4yODYtMy43NzMuMjg2bC0uMDQ1LS4wMDFjLS4zMjgtLjAxLTIuMzgtLjE4Ny0zLjAwMS0yLjk2OC0uNjc1LTMuMDI4IDIuMzY1LTQuNjg3IDIuNTkyLTQuOTY4LjIyNi0uMjg4IDEuODAyLTEuMzcgMi44MTYtMy4wODV6bS45ODYgMS43Mzh2Mi4wMzJoLTEuNjRzLTEuNjQuMTM4LTIuMjEzIDIuMDE0Yy0uMiAxLjI1Mi4xNzcgMS45OS4yNDIgMi4xNDguMDY3LjE1Ny41OTYgMS4wNzMgMS45MjcgMS4zNDJoMy4wNzh2LTcuNTE0bC0xLjM5NC0uMDIyem0zLjU4OCAyLjE5MWwtMS40NC4wMjR2My45NTZzLjA2NC45ODUgMS40NCAxLjM0NGgzLjU0MXYtNS4zaC0xLjUyOHYzLjk3OWgtMS40NnMtLjQ2Ni0uMDY4LS41NTMtLjQ0N3YtMy41NTZ6TTkuODIgMTYuNzE1djMuMDZIOC41OHMtLjg2My0uMDQ1LTEuMTI2LTEuMDQ5Yy0uMTM2LS40NDUuMDItLjk1OS4wODgtMS4xNi4wNjMtLjIwMy4zNTMtLjY3MS45NTEtLjg1SDkuODJ6bTkuNTI1LTkuMDM2YzIuMDg2IDAgMi42NDYgMi4wNiAyLjY0NiAyLjc0MiAwIC42ODguMjg0IDMuNTk3LTIuMzA5IDMuNjU1LTIuNTk1LjA1Ny0yLjcwNC0xLjc3LTIuNzA0LTMuMDggMC0xLjM3NC4yNzctMy4zMTcgMi4zNjctMy4zMTd6TTQuMjQgNi4wOGMxLjUyMy0uMTM1IDIuNjQ1IDEuNTUgMi43NjIgMi41MTMuMDcuNjI1LjM5MyAzLjQ4Ni0xLjk3NSA0LTIuMzY0LjUxNS0zLjI0NC0yLjI0OS0yLjk4NC0zLjU0NCAwIDAgLjI4LTIuNzk3IDIuMTk3LTIuOTY5em04Ljg0Ny0xLjQ4M2MuMTQtMS4zMSAxLjY5LTMuMzE2IDIuOTMxLTMuMDI4IDEuMjM2LjI4NSAyLjM2NyAxLjk0NCAyLjEzNyAzLjM3LS4yMjQgMS40MjgtMS4zNDUgMy4zMTMtMy4wOTUgMy4wODItMS43NDgtLjIyNi0yLjE0My0xLjgyMy0xLjk3My0zLjQyNHpNOS40MjUgMWMxLjMwNyAwIDIuMzY0IDEuNTE5IDIuMzY0IDMuMzk4IDAgMS44NzktMS4wNTcgMy40LTIuMzY0IDMuNHMtMi4zNjctMS41MjEtMi4zNjctMy40QzcuMDU4IDIuNTE4IDguMTE4IDEgOS40MjUgMXoiIGZpbGw9IiMyOTMyRTEiIGZpbGwtcnVsZT0ibm9uemVybyI+PC9wYXRoPjwvc3ZnPg==" },
			"bailian": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkJhaUxpYW48L3RpdGxlPjxwYXRoIGQ9Ik02LjMzNiA4LjkxOXY2LjE2Mmw1LjMzNS0zLjA4M0w2LjMzNyA4LjkyeiIgZmlsbD0iIzFDNTRFMyI+PC9wYXRoPjxwYXRoIGQ9Ik0yMS4zOTQgNS4yODhzLS4wMDYtLjAwNi0uMDEtLjAwNkwxNy4wMSAyLjc1NCA2LjMzNiA4LjkybDUuMzM1IDMuMDgyIDkuNzAxLTUuNi4wMTYtLjAxYS42MzUuNjM1IDAgMDAuMDA2LTEuMXYtLjAwM3oiIGZpbGw9IiNBQTlBRkYiPjwvcGF0aD48cGF0aCBkPSJNMjEuNzEgMTIuNDY1YS42Mi42MiAwIDAwLS4zMTYuMDg1cy0uMDA2IDAtLjAwOS4wMDNsLTQuMzc1IDIuNTI4IDUuMDUgMi45MTVoLjAwNmEyLjA2IDIuMDYgMCAwMC4yOC0xLjA0di0zLjg1NWEuNjM3LjYzNyAwIDAwLS42MzYtLjYzNnoiIGZpbGw9IiMwMEVBRDEiPjwvcGF0aD48cGF0aCBkPSJNMjIuMDYgMTcuOTk2bC01LjA1LTIuOTE1TDYuMzQgMjEuMjQybDQuMjcgMi40NjVzLjAxNi4wMDYuMDIyLjAxMmEyLjEwMiAyLjEwMiAwIDAwMi4wOTMgMGMuMDA2LS4wMDMuMDE2LS4wMDYuMDIyLS4wMTJsOC41MzgtNC45M2MuMDAzIDAgLjAwNi0uMDAzLjAxLS4wMDYuMzIxLS4xODMuNTg5LS40NS43NzUtLjc3MmgtLjAwNmwtLjAwNC0uMDAzeiIgZmlsbD0iIzAwQ0VDOSI+PC9wYXRoPjxwYXRoIGQ9Ik0xMS42NzIgMTEuOTk4bC01LjMzNiAzLjA4My0xLjQ0NC44MzItMy42MDUgMi4wODNIMS4yOGMuMTczLjMwMy40MTYuNTU1LjcwOS43MzhsLjA3OC4wNDQuMDE2LjAxLjAyLjAxMiA0LjIzMiAyLjQ0MiAxMC42NzEtNi4xNjEtNS4zMzUtMy4wODJ6IiBmaWxsPSIjMDBFQUQxIj48L3BhdGg+PHBhdGggZD0iTTEyLjc0LjI5Yy0uMS0uMDYtLjIwOC0uMTA3LS4zMTUtLjE0OC0uMDItLjAwNi0uMDM4LS4wMTYtLjA1Ny0uMDIyYTIuMTIxIDIuMTIxIDAgMDAtLjctLjEyYy0uMjMzIDAtLjQ1Ny4wMzgtLjY2OC4xMWwtLjAzMS4wMWEyLjE5NiAyLjE5NiAwIDAwLS4zNzIuMTdMMi4wNjggNS4yMjJzLS4wMDMgMC0uMDA2LjAwM2MtLjMyNC4xODMtLjU5Mi40NTEtLjc4MS43NzNoLjAwNmw1LjA0OSAyLjkxOEwxNy4wMSAyLjc1OCAxMi43NC4yOXoiIGZpbGw9IiM3MzQ3RkYiPjwvcGF0aD48cGF0aCBkPSJNMS4yODcgNi4wMDFIMS4yOEEyLjA2IDIuMDYgMCAwMDEgNy4wNDF2OS45MTVjMCAuMzc4LjEuNzM1LjI4IDEuMDQzaC4wMDdsNS4wNDktMi45MThWOC45MTlsLTUuMDUtMi45MTh6IiBmaWxsPSIjMDQyM0RBIj48L3BhdGg+PC9zdmc+" },
			"cohere": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkNvaGVyZTwvdGl0bGU+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNOC4xMjggMTQuMDk5Yy41OTIgMCAxLjc3LS4wMzMgMy4zOTgtLjcwMyAxLjg5Ny0uNzgxIDUuNjcyLTIuMiA4LjM5NS0zLjY1NiAxLjkwNS0xLjAxOCAyLjc0LTIuMzY2IDIuNzQtNC4xOEE0LjU2IDQuNTYgMCAwMDE4LjEgMUg3LjU0OUE2LjU1IDYuNTUgMCAwMDEgNy41NWMwIDMuNjE3IDIuNzQ1IDYuNTQ5IDcuMTI4IDYuNTQ5eiIgZmlsbD0iIzM5NTk0RCIgZmlsbC1ydWxlPSJldmVub2RkIj48L3BhdGg+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNOS45MTIgMTguNjFhNC4zODcgNC4zODcgMCAwMTIuNzA1LTQuMDUybDMuMzIzLTEuMzhjMy4zNjEtMS4zOTQgNy4wNiAxLjA3NiA3LjA2IDQuNzE1YTUuMTA0IDUuMTA0IDAgMDEtNS4xMDUgNS4xMDRsLTMuNTk3LS4wMDFhNC4zODYgNC4zODYgMCAwMS00LjM4Ni00LjM4N3oiIGZpbGw9IiNEMThFRTIiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjxwYXRoIGQ9Ik00Ljc3NiAxNC45NjJBMy43NzUgMy43NzUgMCAwMDEgMTguNzM4di40ODlhMy43NzYgMy43NzYgMCAwMDcuNTUxIDB2LS40OWEzLjc3NSAzLjc3NSAwIDAwLTMuNzc1LTMuNzc1eiIgZmlsbD0iI0ZGNzc1OSI+PC9wYXRoPjwvc3ZnPg==" },
			"gemini": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkdlbWluaTwvdGl0bGU+PHBhdGggZD0iTTIwLjYxNiAxMC44MzVhMTQuMTQ3IDE0LjE0NyAwIDAxLTQuNDUtMy4wMDEgMTQuMTExIDE0LjExMSAwIDAxLTMuNjc4LTYuNDUyLjUwMy41MDMgMCAwMC0uOTc1IDAgMTQuMTM0IDE0LjEzNCAwIDAxLTMuNjc5IDYuNDUyIDE0LjE1NSAxNC4xNTUgMCAwMS00LjQ1IDMuMDAxYy0uNjUuMjgtMS4zMTguNTA1LTIuMDAyLjY3OGEuNTAyLjUwMiAwIDAwMCAuOTc1Yy42ODQuMTcyIDEuMzUuMzk3IDIuMDAyLjY3N2ExNC4xNDcgMTQuMTQ3IDAgMDE0LjQ1IDMuMDAxIDE0LjExMiAxNC4xMTIgMCAwMTMuNjc5IDYuNDUzLjUwMi41MDIgMCAwMC45NzUgMGMuMTcyLS42ODUuMzk3LTEuMzUxLjY3Ny0yLjAwM2ExNC4xNDUgMTQuMTQ1IDAgMDEzLjAwMS00LjQ1IDE0LjExMyAxNC4xMTMgMCAwMTYuNDUzLTMuNjc4LjUwMy41MDMgMCAwMDAtLjk3NSAxMy4yNDUgMTMuMjQ1IDAgMDEtMi4wMDMtLjY3OHoiIGZpbGw9IiMzMTg2RkYiPjwvcGF0aD48cGF0aCBkPSJNMjAuNjE2IDEwLjgzNWExNC4xNDcgMTQuMTQ3IDAgMDEtNC40NS0zLjAwMSAxNC4xMTEgMTQuMTExIDAgMDEtMy42NzgtNi40NTIuNTAzLjUwMyAwIDAwLS45NzUgMCAxNC4xMzQgMTQuMTM0IDAgMDEtMy42NzkgNi40NTIgMTQuMTU1IDE0LjE1NSAwIDAxLTQuNDUgMy4wMDFjLS42NS4yOC0xLjMxOC41MDUtMi4wMDIuNjc4YS41MDIuNTAyIDAgMDAwIC45NzVjLjY4NC4xNzIgMS4zNS4zOTcgMi4wMDIuNjc3YTE0LjE0NyAxNC4xNDcgMCAwMTQuNDUgMy4wMDEgMTQuMTEyIDE0LjExMiAwIDAxMy42NzkgNi40NTMuNTAyLjUwMiAwIDAwLjk3NSAwYy4xNzItLjY4NS4zOTctMS4zNTEuNjc3LTIuMDAzYTE0LjE0NSAxNC4xNDUgMCAwMTMuMDAxLTQuNDUgMTQuMTEzIDE0LjExMyAwIDAxNi40NTMtMy42NzguNTAzLjUwMyAwIDAwMC0uOTc1IDEzLjI0NSAxMy4yNDUgMCAwMS0yLjAwMy0uNjc4eiIgZmlsbD0idXJsKCNsb2JlLWljb25zLWdlbWluaS0wLV9SXzBfKSI+PC9wYXRoPjxwYXRoIGQ9Ik0yMC42MTYgMTAuODM1YTE0LjE0NyAxNC4xNDcgMCAwMS00LjQ1LTMuMDAxIDE0LjExMSAxNC4xMTEgMCAwMS0zLjY3OC02LjQ1Mi41MDMuNTAzIDAgMDAtLjk3NSAwIDE0LjEzNCAxNC4xMzQgMCAwMS0zLjY3OSA2LjQ1MiAxNC4xNTUgMTQuMTU1IDAgMDEtNC40NSAzLjAwMWMtLjY1LjI4LTEuMzE4LjUwNS0yLjAwMi42NzhhLjUwMi41MDIgMCAwMDAgLjk3NWMuNjg0LjE3MiAxLjM1LjM5NyAyLjAwMi42NzdhMTQuMTQ3IDE0LjE0NyAwIDAxNC40NSAzLjAwMSAxNC4xMTIgMTQuMTEyIDAgMDEzLjY3OSA2LjQ1My41MDIuNTAyIDAgMDAuOTc1IDBjLjE3Mi0uNjg1LjM5Ny0xLjM1MS42NzctMi4wMDNhMTQuMTQ1IDE0LjE0NSAwIDAxMy4wMDEtNC40NSAxNC4xMTMgMTQuMTEzIDAgMDE2LjQ1My0zLjY3OC41MDMuNTAzIDAgMDAwLS45NzUgMTMuMjQ1IDEzLjI0NSAwIDAxLTIuMDAzLS42Nzh6IiBmaWxsPSJ1cmwoI2xvYmUtaWNvbnMtZ2VtaW5pLTEtX1JfMF8pIj48L3BhdGg+PHBhdGggZD0iTTIwLjYxNiAxMC44MzVhMTQuMTQ3IDE0LjE0NyAwIDAxLTQuNDUtMy4wMDEgMTQuMTExIDE0LjExMSAwIDAxLTMuNjc4LTYuNDUyLjUwMy41MDMgMCAwMC0uOTc1IDAgMTQuMTM0IDE0LjEzNCAwIDAxLTMuNjc5IDYuNDUyIDE0LjE1NSAxNC4xNTUgMCAwMS00LjQ1IDMuMDAxYy0uNjUuMjgtMS4zMTguNTA1LTIuMDAyLjY3OGEuNTAyLjUwMiAwIDAwMCAuOTc1Yy42ODQuMTcyIDEuMzUuMzk3IDIuMDAyLjY3N2ExNC4xNDcgMTQuMTQ3IDAgMDE0LjQ1IDMuMDAxIDE0LjExMiAxNC4xMTIgMCAwMTMuNjc5IDYuNDUzLjUwMi41MDIgMCAwMC45NzUgMGMuMTcyLS42ODUuMzk3LTEuMzUxLjY3Ny0yLjAwM2ExNC4xNDUgMTQuMTQ1IDAgMDEzLjAwMS00LjQ1IDE0LjExMyAxNC4xMTMgMCAwMTYuNDUzLTMuNjc4LjUwMy41MDMgMCAwMDAtLjk3NSAxMy4yNDUgMTMuMjQ1IDAgMDEtMi4wMDMtLjY3OHoiIGZpbGw9InVybCgjbG9iZS1pY29ucy1nZW1pbmktMi1fUl8wXykiPjwvcGF0aD48ZGVmcz48bGluZWFyR3JhZGllbnQgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiIGlkPSJsb2JlLWljb25zLWdlbWluaS0wLV9SXzBfIiB4MT0iNyIgeDI9IjExIiB5MT0iMTUuNSIgeTI9IjEyIj48c3RvcCBzdG9wLWNvbG9yPSIjMDhCOTYyIj48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDhCOTYyIiBzdG9wLW9wYWNpdHk9IjAiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgaWQ9ImxvYmUtaWNvbnMtZ2VtaW5pLTEtX1JfMF8iIHgxPSI4IiB4Mj0iMTEuNSIgeTE9IjUuNSIgeTI9IjExIj48c3RvcCBzdG9wLWNvbG9yPSIjRjk0NTQzIj48L3N0b3A+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjk0NTQzIiBzdG9wLW9wYWNpdHk9IjAiPjwvc3RvcD48L2xpbmVhckdyYWRpZW50PjxsaW5lYXJHcmFkaWVudCBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgaWQ9ImxvYmUtaWNvbnMtZ2VtaW5pLTItX1JfMF8iIHgxPSIzLjUiIHgyPSIxNy41IiB5MT0iMTMuNSIgeTI9IjEyIj48c3RvcCBzdG9wLWNvbG9yPSIjRkFCQzEyIj48L3N0b3A+PHN0b3Agb2Zmc2V0PSIuNDYiIHN0b3AtY29sb3I9IiNGQUJDMTIiIHN0b3Atb3BhY2l0eT0iMCI+PC9zdG9wPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjwvc3ZnPg==" },
			"hunyuan": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPkh1bnl1YW48L3RpdGxlPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIGZpbGw9IiMwMDU1RTkiIHI9IjEyIj48L2NpcmNsZT48cGF0aCBkPSJNMTIgMGMuNTE4IDAgMS4wMjguMDMzIDEuNTI4LjA5NkE2LjE4OCA2LjE4OCAwIDAxMTIuMTIgMTIuMjhsLS4xMi4wMDFjLTIuOTkgMC01LjI0MiAyLjE3OS01LjU1NCA1LjExLS4yMjMgMi4wODYuMzUzIDQuNDEyIDIuMjQyIDYuMTQ2QzMuNjcyIDIyLjEgMCAxNy40NzkgMCAxMiAwIDUuMzczIDUuMzczIDAgMTIgMHoiIGZpbGw9IiNBOERGRjUiPjwvcGF0aD48cGF0aCBkPSJNNS4yODYgNWEyLjQzOCAyLjQzOCAwIDAxLjY4MiAzLjM4Yy0zLjk2MiA1Ljk2Ni0zLjIxNSAxMC43NDMgMi42NDggMTUuMTM2QzMuNjM2IDIyLjA1NiAwIDE3LjQ1MiAwIDEyYzAtMS43ODcuMzktMy40ODIgMS4wOS01LjAwNi4yNTMtLjQzNS41MjUtLjg3Mi44MTctMS4zMTFBMi40MzggMi40MzggMCAwMTUuMjg2IDV6IiBmaWxsPSIjMDA1NUU5Ij48L3BhdGg+PHBhdGggZD0iTTEyLjk4LjA0Yy4yNzIuMDIxLjU0My4wNTMuODEuMDkzLjU4My4xMDYgMS4xMTcuMjU0IDEuNTM4LjQ0IDYuNjM4IDIuOTI3IDguMDcgMTAuMDUyIDEuNzQ4IDE1LjY0MmE0LjEyNSA0LjEyNSAwIDAxLTUuODIyLS4zNThjLTEuNTEtMS43MDYtMS4zLTQuMTg0LjM1Ny01LjgyMi44NTgtLjg0OCAzLjEwOC0xLjIyMyA0LjA0NS0yLjQ0MSAxLjI1Ny0xLjYzNCAyLjEyMi02LjAwOS0yLjUyMy03LjUwNkwxMi45OC4wMzl6IiBmaWxsPSIjMDBCQ0ZGIj48L3BhdGg+PHBhdGggZD0iTTEzLjUyOC4wOTZBNi4xODcgNi4xODcgMCAwMTEyIDEyLjI4MWE1Ljc1IDUuNzUgMCAwMC0xLjcxLjI1NWMuMTQ3LS45MDUuNTk1LTEuNzg0IDEuMzIxLTIuNTAxLjg1OC0uODQ4IDMuMTA4LTEuMjIzIDQuMDQ1LTIuNDQxIDEuMjctMS42NTEgMi4xNC02LjEwNC0yLjY3Ni03LjU1NC4xODQuMDE0LjM2Ny4wMzMuNTQ4LjA1NnoiIGZpbGw9IiNFQ0VDRUUiPjwvcGF0aD48L3N2Zz4=" },
			"jina": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+SmluYTwvdGl0bGU+PHBhdGggZD0iTTYuNjA4IDIxLjQxNmE0LjYwOCA0LjYwOCAwIDEwMC05LjIxNyA0LjYwOCA0LjYwOCAwIDAwMCA5LjIxN3pNMjAuODk0IDIuMDE1Yy42MTQgMCAxLjEwNi40OTIgMS4xMDYgMS4xMDZ2OS4wMDJjMCA1LjEzLTQuMTQ4IDkuMzA5LTkuMjE3IDkuMzd2LTkuMzU1bC0uMDMtOS4wMzJjMC0uNjE0LjQ5MS0xLjEwNiAxLjEwNi0xLjEwNmg3LjE1OGwtLjEyMy4wMTV6Ij48L3BhdGg+PC9zdmc+" },
			"lmstudio": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+TE0gU3R1ZGlvPC90aXRsZT48cGF0aCBkPSJNMi44NCAyYTEuMjczIDEuMjczIDAgMTAwIDIuNTQ3aDE0LjEwN2ExLjI3MyAxLjI3MyAwIDEwMC0yLjU0N0gyLjg0ek03LjkzNSA1LjMzYTEuMjczIDEuMjczIDAgMDAwIDIuNTQ4SDIyLjA0YTEuMjc0IDEuMjc0IDAgMDAwLTIuNTQ3SDcuOTM1ek0zLjYyNCA5LjkzNWMwLS43MDQuNTctMS4yNzQgMS4yNzQtMS4yNzRoMTQuMTA2YTEuMjc0IDEuMjc0IDAgMDEwIDIuNTQ3SDQuODk4Yy0uNzAzIDAtMS4yNzQtLjU3LTEuMjc0LTEuMjczek0xLjI3MyAxMi4xODhhMS4yNzMgMS4yNzMgMCAxMDAgMi41NDdIMTUuMzhhMS4yNzQgMS4yNzQgMCAwMDAtMi41NDdIMS4yNzN6TTMuNjI0IDE2Ljc5MmMwLS43MDQuNTctMS4yNzQgMS4yNzQtMS4yNzRoMTQuMTA2YTEuMjczIDEuMjczIDAgMTEwIDIuNTQ3SDQuODk4Yy0uNzAzIDAtMS4yNzQtLjU3LTEuMjc0LTEuMjczek0xMy4wMjkgMTguODQ5YTEuMjczIDEuMjczIDAgMTAwIDIuNTQ3aDkuNjk4YTEuMjczIDEuMjczIDAgMTAwLTIuNTQ3aC05LjY5OHoiIGZpbGwtb3BhY2l0eT0iLjMiPjwvcGF0aD48cGF0aCBkPSJNMi44NCAyYTEuMjczIDEuMjczIDAgMTAwIDIuNTQ3aDEwLjI4N2ExLjI3NCAxLjI3NCAwIDAwMC0yLjU0N0gyLjg0ek03LjkzNSA1LjMzYTEuMjczIDEuMjczIDAgMDAwIDIuNTQ4SDE4LjIyYTEuMjc0IDEuMjc0IDAgMDAwLTIuNTQ3SDcuOTM1ek0zLjYyNCA5LjkzNWMwLS43MDQuNTctMS4yNzQgMS4yNzQtMS4yNzRoMTAuMjg2YTEuMjczIDEuMjczIDAgMDEwIDIuNTQ3SDQuODk4Yy0uNzAzIDAtMS4yNzQtLjU3LTEuMjc0LTEuMjczek0xLjI3MyAxMi4xODhhMS4yNzMgMS4yNzMgMCAxMDAgMi41NDdIMTEuNTZhMS4yNzQgMS4yNzQgMCAwMDAtMi41NDdIMS4yNzN6TTMuNjI0IDE2Ljc5MmMwLS43MDQuNTctMS4yNzQgMS4yNzQtMS4yNzRoMTAuMjg2YTEuMjczIDEuMjczIDAgMTEwIDIuNTQ3SDQuODk4Yy0uNzAzIDAtMS4yNzQtLjU3LTEuMjc0LTEuMjczek0xMy4wMjkgMTguODQ5YTEuMjczIDEuMjczIDAgMTAwIDIuNTQ3aDUuNzhhMS4yNzMgMS4yNzMgMCAxMDAtMi41NDdoLTUuNzh6Ij48L3BhdGg+PC9zdmc+" },
			"mistral": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk1pc3RyYWw8L3RpdGxlPjxwYXRoIGQ9Ik0zLjQyOCAzLjRoMy40Mjl2My40MjhIMy40MjhWMy40em0xMy43MTQgMGgzLjQzdjMuNDI4aC0zLjQzVjMuNHoiIGZpbGw9ImdvbGQiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggNi44MjhoNi44NTd2My40MjlIMy40MjlWNi44Mjh6bTEwLjI4NiAwaDYuODU3djMuNDI5aC02Ljg1N1Y2LjgyOHoiIGZpbGw9IiNGRkFGMDAiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggMTAuMjU4aDE3LjE0NHYzLjQyOEgzLjQyOHYtMy40Mjh6IiBmaWxsPSIjRkY4MjA1Ij48L3BhdGg+PHBhdGggZD0iTTMuNDI4IDEzLjY4NmgzLjQyOXYzLjQyOEgzLjQyOHYtMy40Mjh6bTYuODU4IDBoMy40Mjl2My40MjhoLTMuNDI5di0zLjQyOHptNi44NTYgMGgzLjQzdjMuNDI4aC0zLjQzdi0zLjQyOHoiIGZpbGw9IiNGQTUwMEYiPjwvcGF0aD48cGF0aCBkPSJNMCAxNy4xMTRoMTAuMjg2djMuNDI5SDB2LTMuNDI5em0xMy43MTQgMEgyNHYzLjQyOUgxMy43MTR2LTMuNDI5eiIgZmlsbD0iI0UxMDUwMCI+PC9wYXRoPjwvc3ZnPg==" },
			"ollama": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+T2xsYW1hPC90aXRsZT48cGF0aCBkPSJNNy45MDUgMS4wOWMuMjE2LjA4NS40MTEuMjI1LjU4OC40MS4yOTUuMzA2LjU0NC43NDQuNzM0IDEuMjYzLjE5MS41MjIuMzE1IDEuMS4zNjIgMS42OGE1LjA1NCA1LjA1NCAwIDAxMi4wNDktLjYzNmwuMDUxLS4wMDRjLjg3LS4wNyAxLjczLjA4NyAyLjQ4LjQ3NC4xMDEuMDUzLjIuMTEuMjk3LjE3LjA1LS41NjkuMTcyLTEuMTM0LjM2LTEuNjQ0LjE5LS41Mi40MzktLjk1Ny43MzMtMS4yNjRhMS42NyAxLjY3IDAgMDEuNTg5LS40MWMuMjU3LS4xLjUzLS4xMTguNzk2LS4wNDIuNDAxLjExNC43NDUuMzY4IDEuMDE2LjczNy4yNDguMzM3LjQzNC43NjkuNTYxIDEuMjg3LjIzLjkzNC4yNyAyLjE2My4xMTUgMy42NDVsLjA1My4wNC4wMjYuMDE5Yy43NTcuNTc2IDEuMjg0IDEuMzk3IDEuNTYzIDIuMzUuNDM1IDEuNDg3LjIxNiAzLjE1NS0uNTM0IDQuMDg4bC0uMDE4LjAyMS4wMDIuMDAzYy40MTcuNzYyLjY3IDEuNTY3LjcyNCAyLjRsLjAwMi4wM2MuMDY0IDEuMDY1LS4yIDIuMTM3LS44MTQgMy4xOWwtLjAwNy4wMS4wMS4wMjRjLjQ3MiAxLjE1Ny42MiAyLjMyMi40MzggMy40ODZsLS4wMDYuMDM5YS42NTEuNjUxIDAgMDEtLjc0Ny41MzYuNjQ4LjY0OCAwIDAxLS41NC0uNzQyYy4xNjctMS4wMzMuMDEtMi4wNjktLjQ4LTMuMTIzYS42NDMuNjQzIDAgMDEuMDQtLjYxN2wuMDA0LS4wMDZjLjYwNC0uOTI0Ljg1NC0xLjgzLjgtMi43Mi0uMDQ2LS43NzktLjMyNS0xLjU0NC0uOC0yLjI3M2EuNjQ0LjY0NCAwIDAxLjE4LS44ODZsLjAwOS0uMDA2Yy4yNDMtLjE1OS40NjctLjU2NS41OC0xLjEyYTQuMjI5IDQuMjI5IDAgMDAtLjA5NS0xLjk3NGMtLjIwNS0uNy0uNTgtMS4yODQtMS4xMDUtMS42ODMtLjU5NS0uNDU0LTEuMzgzLS42NzMtMi4zOC0uNjFhLjY1My42NTMgMCAwMS0uNjMyLS4zNzFjLS4zMTQtLjY2NS0uNzcyLTEuMTQxLTEuMzQzLTEuNDM2YTMuMjg4IDMuMjg4IDAgMDAtMS43NzItLjMzMmMtMS4yNDUuMDk5LTIuMzQzLjgwMS0yLjY3IDEuNjg2YS42NTIuNjUyIDAgMDEtLjYxLjQyNWMtMS4wNjcuMDAyLTEuODkzLjI1Mi0yLjQ5Ny43MDMtLjUyMi4zOS0uODc4LjkzNS0xLjA2NiAxLjU4OGE0LjA3IDQuMDcgMCAwMC0uMDY4IDEuODg2Yy4xMTIuNTU4LjMzMSAxLjAyLjU4MiAxLjI2OWwuMDA4LjAwN2MuMjEyLjIwNy4yNTcuNTMuMTA5Ljc4NS0uMzYuNjIyLS42MjkgMS41NDktLjY3MyAyLjQ0LS4wNSAxLjAxOC4xODYgMS45MDIuNzE5IDIuNTM2bC4wMTYuMDE5YS42NDMuNjQzIDAgMDEuMDk1LjY5Yy0uNTc2IDEuMjM2LS43NTMgMi4yNTItLjU2MiAzLjA1MmEuNjUyLjY1MiAwIDAxLTEuMjY5LjI5OGMtLjI0My0xLjAxOC0uMDc4LTIuMTg0LjQ3My0zLjQ5OGwuMDE0LS4wMzUtLjAwOC0uMDEyYTQuMzM5IDQuMzM5IDAgMDEtLjU5OC0xLjMwOWwtLjAwNS0uMDE5YTUuNzY0IDUuNzY0IDAgMDEtLjE3Ny0xLjc4NWMuMDQ0LS45MS4yNzgtMS44NDIuNjIyLTIuNTlsLjAxMi0uMDI2LS4wMDItLjAwMmMtLjI5My0uNDE4LS41MS0uOTUzLS42My0xLjU0NWwtLjAwNS0uMDI0YTUuMzUyIDUuMzUyIDAgMDEuMDkzLTIuNDljLjI2Mi0uOTE1Ljc3Ny0xLjcwMSAxLjUzNi0yLjI2OS4wNi0uMDQ1LjEyMy0uMDkuMTg2LS4xMzItLjE1OS0xLjQ5My0uMTE5LTIuNzMuMTEyLTMuNjcuMTI3LS41MTguMzE0LS45NS41NjItMS4yODcuMjctLjM2OC42MTQtLjYyMiAxLjAxNS0uNzM3LjI2Ni0uMDc2LjU0LS4wNTkuNzk3LjA0MnptNC4xMTYgOS4wOWMuOTM2IDAgMS44LjMxMyAyLjQ0Ni44NTUuNjMuNTI3IDEuMDA1IDEuMjM1IDEuMDA1IDEuOTQgMCAuODg4LS40MDYgMS41OC0xLjEzMyAyLjAyMi0uNjIuMzc1LTEuNDUxLjU1Ny0yLjQwMy41NTctMS4wMDkgMC0xLjg3MS0uMjU5LTIuNDkzLS43MzQtLjYxNy0uNDctLjk2My0xLjEzLS45NjMtMS44NDUgMC0uNzA3LjM5OC0xLjQxNyAxLjA1Ni0xLjk0Ni42NjgtLjUzNyAxLjU1LS44NDkgMi40ODUtLjg0OXptMCAuODk2YTMuMDcgMy4wNyAwIDAwLTEuOTE2LjY1Yy0uNDYxLjM3LS43MjIuODM1LS43MjIgMS4yNSAwIC40MjguMjEuODI5LjYxIDEuMTM0LjQ1NS4zNDcgMS4xMjQuNTQ4IDEuOTQzLjU0OC43OTkgMCAxLjQ3My0uMTQ3IDEuOTMyLS40MjYuNDYzLS4yOC43LS42ODYuNy0xLjI1NyAwLS40MjMtLjI0Ni0uODktLjY4My0xLjI1Ni0uNDg0LS40MDUtMS4xNC0uNjQzLTEuODY0LS42NDN6bS42NjIgMS4yMWwuMDA0LjAwNGMuMTIuMTUxLjA5NS4zNy0uMDU2LjQ5bC0uMjkyLjIzdi40NDZhLjM3NS4zNzUgMCAwMS0uMzc2LjM3My4zNzUuMzc1IDAgMDEtLjM3Ni0uMzczdi0uNDZsLS4yNzEtLjIxOGEuMzQ3LjM0NyAwIDAxLS4wNTItLjQ5LjM1My4zNTMgMCAwMS40OTQtLjA1MWwuMjE1LjE3Mi4yMi0uMTc0YS4zNTMuMzUzIDAgMDEuNDkuMDUxem0tNS4wNC0xLjkxOWMuNDc4IDAgLjg2Ny4zOS44NjcuODcxYS44Ny44NyAwIDAxLS44NjguODcxLjg3Ljg3IDAgMDEtLjg2Ny0uODcuODcuODcgMCAwMS44NjctLjg3MnptOC43MDYgMGMuNDggMCAuODY4LjM5Ljg2OC44NzFhLjg3Ljg3IDAgMDEtLjg2OC44NzEuODcuODcgMCAwMS0uODY3LS44Ny44Ny44NyAwIDAxLjg2Ny0uODcyek03LjQ0IDIuM2wtLjAwMy4wMDJhLjY1OS42NTkgMCAwMC0uMjg1LjIzOGwtLjAwNS4wMDZjLS4xMzguMTg5LS4yNTguNDY3LS4zNDguODMyLS4xNy42OTItLjIxNiAxLjYzMS0uMTI0IDIuNzgyLjQzLS4xMjguODk5LS4yMDggMS40MDQtLjIzN2wuMDEtLjAwMS4wMTktLjAzNGMuMDQ2LS4wODIuMDk1LS4xNjEuMTQ4LS4yMzkuMTIzLS43NzEuMDIyLTEuNjkyLS4yNTMtMi40NDQtLjEzNC0uMzY0LS4yOTctLjY1LS40NTMtLjgxM2EuNjI4LjYyOCAwIDAwLS4xMDctLjA5TDcuNDQgMi4zem05LjE3NC4wNGwtLjAwMi4wMDFhLjYyOC42MjggMCAwMC0uMTA3LjA5Yy0uMTU2LjE2My0uMzIuNDUtLjQ1My44MTQtLjI5Ljc5NC0uMzg3IDEuNzc2LS4yMyAyLjU3MmwuMDU4LjA5Ny4wMDguMDE0aC4wM2E1LjE4NCA1LjE4NCAwIDAxMS40NjYuMjEyYy4wODYtMS4xMjQuMDM4LTIuMDQzLS4xMjgtMi43MjItLjA5LS4zNjUtLjIxLS42NDMtLjM0OS0uODMybC0uMDA0LS4wMDZhLjY1OS42NTkgMCAwMC0uMjg1LS4yMzloLS4wMDR6Ij48L3BhdGg+PC9zdmc+" },
			"openai": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+T3BlbkFJPC90aXRsZT48cGF0aCBkPSJNOS4yMDUgOC42NTh2LTIuMjZjMC0uMTkuMDcyLS4zMzMuMjM4LS40MjhsNC41NDMtMi42MTZjLjYxOS0uMzU3IDEuMzU2LS41MjMgMi4xMTctLjUyMyAyLjg1NCAwIDQuNjYyIDIuMjEyIDQuNjYyIDQuNTY2IDAgLjE2NyAwIC4zNTctLjAyNC41NDdsLTQuNzEtMi43NTlhLjc5Ny43OTcgMCAwMC0uODU2IDBsLTUuOTcgMy40NzN6bTEwLjYwOSA4LjhWMTIuMDZjMC0uMzMzLS4xNDMtLjU3LS40MjktLjczN2wtNS45Ny0zLjQ3MyAxLjk1LTEuMTE4YS40MzMuNDMzIDAgMDEuNDc2IDBsNC41NDMgMi42MTdjMS4zMDkuNzYgMi4xODkgMi4zNzggMi4xODkgMy45NDggMCAxLjgwOC0xLjA3IDMuNDczLTIuNzYgNC4xNjN6TTcuODAyIDEyLjcwM2wtMS45NS0xLjE0MmMtLjE2Ny0uMDk1LS4yMzktLjIzOC0uMjM5LS40MjhWNS44OTljMC0yLjU0NSAxLjk1LTQuNDcyIDQuNTkxLTQuNDcyIDEgMCAxLjkyNy4zMzMgMi43MTIuOTI4TDguMjMgNS4wNjdjLS4yODUuMTY2LS40MjguNDA0LS40MjguNzM3djYuODk4ek0xMiAxNS4xMjhsLTIuNzk1LTEuNTd2LTMuMzNMMTIgOC42NThsMi43OTUgMS41N3YzLjMzTDEyIDE1LjEyOHptMS43OTYgNy4yM2MtMSAwLTEuOTI3LS4zMzItMi43MTItLjkyN2w0LjY4Ni0yLjcxMmMuMjg1LS4xNjYuNDI4LS40MDQuNDI4LS43Mzd2LTYuODk4bDEuOTc0IDEuMTQyYy4xNjcuMDk1LjIzOC4yMzguMjM4LjQyOHY1LjIzM2MwIDIuNTQ1LTEuOTc0IDQuNDcyLTQuNjE0IDQuNDcyem0tNS42MzctNS4zMDNsLTQuNTQ0LTIuNjE3Yy0xLjMwOC0uNzYxLTIuMTg4LTIuMzc4LTIuMTg4LTMuOTQ4QTQuNDgyIDQuNDgyIDAgMDE0LjIxIDYuMzI3djUuNDIzYzAgLjMzMy4xNDMuNTcxLjQyOC43MzhsNS45NDcgMy40NDktMS45NSAxLjExOGEuNDMyLjQzMiAwIDAxLS40NzYgMHptLS4yNjIgMy45Yy0yLjY4OCAwLTQuNjYyLTIuMDIxLTQuNjYyLTQuNTE5IDAtLjE5LjAyNC0uMzguMDQ3LS41N2w0LjY4NiAyLjcxYy4yODYuMTY3LjU3MS4xNjcuODU2IDBsNS45Ny0zLjQ0OHYyLjI2YzAgLjE5LS4wNy4zMzMtLjIzNy40MjhsLTQuNTQzIDIuNjE2Yy0uNjE5LjM1Ny0xLjM1Ni41MjMtMi4xMTcuNTIzem01Ljg5OSAyLjgzYTUuOTQ3IDUuOTQ3IDAgMDA1LjgyNy00Ljc1NkMyMi4yODcgMTguMzM5IDI0IDE1Ljg0IDI0IDEzLjI5NmMwLTEuNjY1LS43MTMtMy4yODItMS45OTgtNC40NDguMTE5LS41LjE5LS45OTkuMTktMS40OTggMC0zLjQwMS0yLjc1OS01Ljk0Ny01Ljk0Ni01Ljk0Ny0uNjQyIDAtMS4yNi4wOTUtMS44OC4zMUE1Ljk2MiA1Ljk2MiAwIDAwMTAuMjA1IDBhNS45NDcgNS45NDcgMCAwMC01LjgyNyA0Ljc1N0MxLjcxMyA1LjQ0NyAwIDcuOTQ1IDAgMTAuNDljMCAxLjY2Ni43MTMgMy4yODMgMS45OTggNC40NDgtLjExOS41LS4xOSAxLS4xOSAxLjQ5OSAwIDMuNDAxIDIuNzU5IDUuOTQ2IDUuOTQ2IDUuOTQ2LjY0MiAwIDEuMjYtLjA5NSAxLjg4LS4zMDlhNS45NiA1Ljk2IDAgMDA0LjE2MiAxLjcxM3oiPjwvcGF0aD48L3N2Zz4=" },
			"siliconcloud": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlNpbGljb25DbG91ZDwvdGl0bGU+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjIuOTU2IDYuNTIxSDEyLjUyMmMtLjU3NyAwLTEuMDQ0LjQ2OC0xLjA0NCAxLjA0NHYzLjEzYzAgLjU3Ny0uNDY2IDEuMDQ0LTEuMDQzIDEuMDQ0SDEuMDQ0Yy0uNTc3IDAtMS4wNDQuNDY3LTEuMDQ0IDEuMDQ0djQuMTc0QzAgMTcuNTMzLjQ2NyAxOCAxLjA0NCAxOGgxMC40MzRjLjU3NyAwIDEuMDQ0LS40NjcgMS4wNDQtMS4wNDN2LTMuMTNjMC0uNTc4LjQ2Ni0xLjA0NCAxLjA0My0xLjA0NGg5LjM5MWMuNTc3IDAgMS4wNDQtLjQ2NyAxLjA0NC0xLjA0NFY3LjU2NWMwLS41NzYtLjQ2Ny0xLjA0NC0xLjA0NC0xLjA0NHoiIGZpbGw9IiM2RTI5RjYiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjwvc3ZnPg==" },
			"volcengine": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlZvbGNlbmdpbmU8L3RpdGxlPjxwYXRoIGQ9Ik0xOS40NCAxMC4xNTNsLTIuOTM2IDExLjU4NmEuMjE1LjIxNSAwIDAwLjIxNC4yNjFoNS44N2EuMjE1LjIxNSAwIDAwLjIxNC0uMjYxbC0yLjk1LTExLjU4NmEuMjE0LjIxNCAwIDAwLS40MTIgMHpNMy4yOCAxMi43NzhsLTIuMjc1IDguOTZBLjIxNC4yMTQgMCAwMDEuMjIgMjJoNC41MzJhLjIxMi4yMTIgMCAwMC4yMTQtLjE2NS4yMTQuMjE0IDAgMDAwLS4wOTdsLTIuMjc2LTguOTZhLjIxNC4yMTQgMCAwMC0uNDEgMHoiIGZpbGw9IiMwMEU1RTUiPjwvcGF0aD48cGF0aCBkPSJNNy4yOSA1LjM1OUwzLjE0OCAyMS43MzhhLjIxNS4yMTUgMCAwMC4yMDMuMjYxaDguMjlhLjIxNC4yMTQgMCAwMC4yMTUtLjI2MUw3LjcgNS4zNThhLjIxNC4yMTQgMCAwMC0uNDEgMHoiIGZpbGw9IiMwMDZFRkYiPjwvcGF0aD48cGF0aCBkPSJNMTQuNDQuMTVhLjIxNC4yMTQgMCAwMC0uNDEgMEw4LjM2NiAyMS43MzlhLjIxNC4yMTQgMCAwMC4yMTQuMjYxSDE5LjlhLjIxNi4yMTYgMCAwMC4xNzEtLjA3OC4yMTQuMjE0IDAgMDAuMDQ0LS4xODNMMTQuNDM5LjE1eiIgZmlsbD0iIzAwNkVGRiI+PC9wYXRoPjxwYXRoIGQ9Ik0xMC4yNzggNy43NDFMNi42ODUgMjEuNzM2YS4yMTQuMjE0IDAgMDAuMjE0LjI2NGg3LjE3YS4yMTUuMjE1IDAgMDAuMjE0LS4yNjRMMTAuNjg4IDcuNzQxYS4yMTQuMjE0IDAgMDAtLjQxIDB6IiBmaWxsPSIjMDBFNUU1Ij48L3BhdGg+PC9zdmc+" },
			"zhipu": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlpoaXB1PC90aXRsZT48cGF0aCBkPSJNMTEuOTkxIDIzLjUwM2EuMjQuMjQgMCAwMC0uMjQ0LjI0OC4yNC4yNCAwIDAwLjI0NC4yNDkuMjQuMjQgMCAwMC4yNDUtLjI0OS4yNC4yNCAwIDAwLS4yMi0uMjQ3bC0uMDI1LS4wMDF6TTkuNjcxIDUuMzY1YTEuNjk3IDEuNjk3IDAgMDExLjA5OSAyLjEzMmwtLjA3MS4xNzItLjAxNi4wNC0uMDE4LjA1NGMtLjA3LjE2LS4xMDQuMzItLjEwNC40OTgtLjAzNS43MS40NyAxLjI3OSAxLjE4NiAxLjMxNGguMzY2YzEuMzA5LjA1MyAyLjMzOCAxLjE3MyAyLjI4NiAyLjUyMy0uMDUyIDEuMzMyLTEuMTUyIDIuMzgtMi40NzggMi4zMjdoLS4xNzRjLS43MTUuMDE4LTEuMjc0LjY0LTEuMjM5IDEuMzY4IDAgLjEyNC4wMTguMjMuMDUzLjMzNy4yMDkuMzczLjU0LjY1OC45Ni44Ljc1LjIzIDEuNTE3LS4xMjUgMS45LS43ODJsLjAxOC0uMDM1Yy40MDItLjY0IDEuMTctLjk2IDEuOTItLjcxMS44NTQuMjg0IDEuMzc4IDEuMjI2IDEuMDk5IDIuMTY3YTEuNjYxIDEuNjYxIDAgMDEtMi4wNzcgMS4xMDIgMS43MTEgMS43MTEgMCAwMS0uOTA3LS43MTFsLS4wMTctLjAzNWMtLjItLjMyMy0uNDYzLS41OC0uODUxLS43MTFsLS4wNTYtLjAxOGExLjY0NiAxLjY0NiAwIDAwLTEuOTU0Ljc0NiAxLjY2IDEuNjYgMCAwMS0xLjA2NS43NjQgMS42NzcgMS42NzcgMCAwMS0xLjk4OS0xLjI3OWMtLjIwOS0uOTA2LjMzMi0xLjgzIDEuMjU3LTIuMDQzYTEuNTEgMS41MSAwIDAxLjI5Ni0uMDM1aC4wMThjLjY4LS4wNzEgMS4xNTEtLjYyMiAxLjExNi0xLjMzM2ExLjMwNyAxLjMwNyAwIDAwLS4yMjctLjY5MyAyLjUxNSAyLjUxNSAwIDAxLS4zNjYtMS40MDMgMi4zOSAyLjM5IDAgMDEuMzY2LTEuMjA4Yy4xNC0uMTk1LjIxLS40NDQuMjI3LS42OTMuMDE4LS43MS0uNTA2LTEuMjYxLTEuMTg2LTEuMzMybC0uMDctLjAxOGExLjQzIDEuNDMgMCAwMS0uMjk5LS4wN2wtLjA1LS4wMTlhMS43IDEuNyAwIDAxLTEuMDQ3LTIuMTE0IDEuNjggMS42OCAwIDAxMi4wOTQtMS4xMDF6bS01LjU3NSAxMC4xMWMuMjYtLjI2NC42MzktLjM2Ny45OTQtLjI3LjM1NS4wOTYuNjMzLjM3OS43MjguNzQuMDk1LjM2Mi0uMDA3Ljc0OC0uMjY3IDEuMDEzLS40MDIuNDEtMS4wNTMuNDEtMS40NTUgMGExLjA2MiAxLjA2MiAwIDAxMC0xLjQ4MnptMTQuODQ1LS4yOTRjLjM1OS0uMDkuNzM4LjAyNC45OTIuMjk3LjI1NC4yNzQuMzQ0LjY2NS4yMzcgMS4wMjUtLjEwNy4zNi0uMzk2LjYzNC0uNzU2LjcxOC0uNTUxLjEyOC0xLjEtLjIyLTEuMjMtLjc4MWExLjA1IDEuMDUgMCAwMS43NTctMS4yNnptLS4wNjQtNC4zOWMuMzE0LjMyLjQ5Ljc1My40OSAxLjIwNiAwIC40NTItLjE3Ni44ODYtLjQ5IDEuMjA2LS4zMTUuMzItLjc0LjUtMS4xODUuNS0uNDQ0IDAtLjg3LS4xOC0xLjE4NC0uNWExLjcyNyAxLjcyNyAwIDAxMC0yLjQxMiAxLjY1NCAxLjY1NCAwIDAxMi4zNjkgMHptLTExLjI0My4xNjNjLjM2NC40ODQuNDQ3IDEuMTI4LjIxOCAxLjY5MWExLjY2NSAxLjY2NSAwIDAxLTIuMTg4LjkyM2MtLjg1NS0uMzYtMS4yNi0xLjM1OC0uOTA3LTIuMjI4YTEuNjggMS42OCAwIDAxMS4zMy0xLjAzOGMuNTkzLS4wOCAxLjE4My4xNjkgMS41NDcuNjUyem0xMS41NDUtNC4yMjFjLjM2OCAwIC43MDguMi44OTIuNTI0LjE4NC4zMjQuMTg0LjcyNCAwIDEuMDQ4YTEuMDI2IDEuMDI2IDAgMDEtLjg5Mi41MjRjLS41NjggMC0xLjAzLS40Ny0xLjAzLTEuMDQ4IDAtLjU3OS40NjItMS4wNDggMS4wMy0xLjA0OHptLTE0LjM1OCAwYy4zNjggMCAuNzA3LjIuODkxLjUyNC4xODQuMzI0LjE4NC43MjQgMCAxLjA0OGExLjAyNiAxLjAyNiAwIDAxLS44OTEuNTI0Yy0uNTY5IDAtMS4wMy0uNDctMS4wMy0xLjA0OCAwLS41NzkuNDYxLTEuMDQ4IDEuMDMtMS4wNDh6bTEwLjAzMS0xLjQ3NWMuOTI1IDAgMS42NzUuNzY0IDEuNjc1IDEuNzA2cy0uNzUgMS43MDUtMS42NzUgMS43MDUtMS42NzQtLjc2My0xLjY3NC0xLjcwNWMwLS45NDIuNzUtMS43MDYgMS42NzQtMS43MDZ6bS0yLjYyNi0uNjg0Yy4zNjItLjA4Mi42NTMtLjM1Ni43NjEtLjcxOGExLjA2MiAxLjA2MiAwIDAwLS4yMzgtMS4wMjggMS4wMTcgMS4wMTcgMCAwMC0uOTk2LS4yOTRjLS41NDcuMTQtLjg4MS43LS43NTIgMS4yNTcuMTMuNTU4LjY3NS45MDcgMS4yMjUuNzgzem0wIDE2Ljg3NmMuMzU5LS4wODcuNjQ0LS4zNi43NS0uNzJhMS4wNjIgMS4wNjIgMCAwMC0uMjM3LTEuMDE5IDEuMDE4IDEuMDE4IDAgMDAtLjk4NS0uMzAxIDEuMDM3IDEuMDM3IDAgMDAtLjc2Mi43MTdjLS4xMDguMzYxLS4wMTcuNzU0LjIzOSAxLjAyOC4yNDUuMjYzLjYwNi4zNzcuOTUzLjMwNWwuMDQzLS4wMXpNMTcuMTkgMy41YS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI3OS0uNjQtLjYyOC0uNjRhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjR6bS0xMC4zOCAwYS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI4LS42NC0uNjI4LS42NGEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjR6bS01LjE4MiA3Ljg1MmEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU0LjI4LjYzOS42MjguNjM5YS42My42MyAwIDAwLjYyNy0uNjA2bC4wMDEtLjAzNGEuNjIuNjIgMCAwMC0uNjI4LS42NHptNS4xODIgOS4xM2EuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0xMC4zOC4wMThhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjc5LS42NC0uNjI4LS42NHptNS4xODItOS4xNDhhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NC4yNzkuNjM5LjYyOC42MzlhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0tLjM4NC00Ljk5MmEuMjQuMjQgMCAwMC4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjE0Mi4xMjIuMjQ5LjI0NC4yNDl6TTExLjk5MS40OTdhLjI0LjI0IDAgMDAuMjQ1LS4yNDhBLjI0LjI0IDAgMDAxMS45OSAwYS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjEzMy4xMDguMjM2LjIyMy4yNDdsLjAyMS4wMDF6TTIuMDExIDYuMzZhLjI0LjI0IDAgMDAuMjQ1LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC4yNDl6bTAgMTEuMjYzYS4yNC4yNCAwIDAwLS4yNDMuMjQ4LjI0LjI0IDAgMDAuMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC0uMjQ5LjI1Mi4yNTIgMCAwMC0uMjQ0LS4yNDh6bTE5Ljk5NS0uMDE4YS4yNC4yNCAwIDAwLS4yNDUuMjQ4LjI0LjI0IDAgMDAuMjQ1LjI1LjI0LjI0IDAgMDAuMjQ0LS4yNS4yNTIuMjUyIDAgMDAtLjI0NC0uMjQ4eiIgZmlsbD0iIzM4NTlGRiIgZmlsbC1ydWxlPSJub256ZXJvIj48L3BhdGg+PC9zdmc+" }
		};
		var PROVIDERS = [
			{"id": "siliconflow", "name": "硅基流动", "en": "SiliconFlow", "icon": "siliconcloud", "url": "https://api.siliconflow.cn/v1", "models": ["BAAI/bge-m3", "Qwen/Qwen3-Embedding-8B", "Qwen/Qwen3-Embedding-4B", "Qwen/Qwen3-Embedding-0.6B", "netease-youdao/bce-embedding-base_v1"], "query": "?sub_type=embedding", "keyUrl": "https://cloud.siliconflow.cn/account/ak"},
			{"id": "bailian", "name": "阿里云百炼", "en": "Alibaba Bailian", "icon": "bailian", "url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "models": ["text-embedding-v4", "text-embedding-v3"], "keyUrl": "https://bailian.console.aliyun.com/?tab=model#/api-key"},
			{"id": "zhipu", "name": "智谱 BigModel", "en": "Zhipu BigModel", "icon": "zhipu", "url": "https://open.bigmodel.cn/api/paas/v4", "models": ["embedding-3", "embedding-2"], "keyUrl": "https://bigmodel.cn/usercenter/proj-mgmt/apikeys"},
			{"id": "volcengine", "name": "火山方舟", "en": "Volcengine Ark", "icon": "volcengine", "url": "https://ark.cn-beijing.volces.com/api/v3", "models": ["doubao-embedding-large-text-250515", "doubao-embedding-text-240715"], "keyUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey", "note": "modelNoteArk"},
			{"id": "hunyuan", "name": "腾讯混元", "en": "Tencent Hunyuan", "icon": "hunyuan", "url": "https://api.hunyuan.cloud.tencent.com/v1", "models": ["hunyuan-embedding"], "keyUrl": "https://console.cloud.tencent.com/hunyuan/api-key"},
			{"id": "qianfan", "name": "百度千帆", "en": "Baidu Qianfan", "icon": "baidu", "url": "https://qianfan.baidubce.com/v2", "models": ["embedding-v1", "bge-large-zh", "tao-8k"], "keyUrl": "https://console.bce.baidu.com/iam/#/iam/apikey/list"},
			{"id": "openai", "name": "OpenAI", "en": "OpenAI", "icon": "openai", "url": "https://api.openai.com/v1", "models": ["text-embedding-3-small", "text-embedding-3-large"], "keyUrl": "https://platform.openai.com/api-keys"},
			{"id": "gemini", "name": "Google Gemini", "en": "Google Gemini", "icon": "gemini", "url": "https://generativelanguage.googleapis.com/v1beta/openai", "models": ["gemini-embedding-001", "text-embedding-004"], "keyUrl": "https://aistudio.google.com/apikey"},
			{"id": "mistral", "name": "Mistral", "en": "Mistral", "icon": "mistral", "url": "https://api.mistral.ai/v1", "models": ["mistral-embed"], "keyUrl": "https://console.mistral.ai/api-keys"},
			{"id": "jina", "name": "Jina", "en": "Jina", "icon": "jina", "url": "https://api.jina.ai/v1", "models": ["jina-embeddings-v3", "jina-embeddings-v4"], "keyUrl": "https://jina.ai/api-dashboard/"},
			{"id": "cohere", "name": "Cohere", "en": "Cohere", "icon": "cohere", "url": "https://api.cohere.ai/compatibility/v1", "models": ["embed-multilingual-v3.0", "embed-v4.0"], "keyUrl": "https://dashboard.cohere.com/api-keys"},
			{"id": "ollama", "name": "Ollama（本机）", "en": "Ollama (local)", "icon": "ollama", "url": "http://127.0.0.1:11434/v1", "models": ["bge-m3", "nomic-embed-text"], "note": "modelNoteLocal"},
			{"id": "lmstudio", "name": "LM Studio（本机）", "en": "LM Studio (local)", "icon": "lmstudio", "url": "http://127.0.0.1:1234/v1", "models": [], "note": "modelNoteLocal"}
		];
		function normUrl(u) { return String(u || "").trim().replace(/\/+$/, "").toLowerCase(); }
		function providerOf(url, list) {
			var n = normUrl(url);
			list = list || PROVIDERS;
			for (var i = 0; i < list.length; i++) if (normUrl(list[i].url) === n) return list[i];
			return null;
		}
		function ProviderIcon(props) {
			var ic = props.icon ? PROVIDER_ICONS[props.icon] : null;
			if (!ic) return h("span", { className: "compc-pIcon compc-pIconText", "aria-hidden": true }, (props.name || "?").slice(0, 1));
			if (ic.mono) return h("span", { className: "compc-pIcon compc-pIconMono", "aria-hidden": true, style: { WebkitMaskImage: "url(" + ic.src + ")", maskImage: "url(" + ic.src + ")" } });
			return h("img", { className: "compc-pIcon", src: ic.src, alt: "", "aria-hidden": true });
		}
		function providerName(t, p) { return p ? (t("langIsEn") === "1" ? p.en : p.name) : t("providerCustom"); }
		/** 选服务商：点开后是带搜索的格子，选一家就填好接口地址（模型不在这家的常用列表里时换成第一个） */
		function ProviderField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var all = props.providers || PROVIDERS;
			var cur = providerOf(url, all);
			var [open, setOpen] = React.useState(false);
			var [q, setQ] = React.useState("");
			function choose(p) {
				setOpen(false); setQ("");
				if (!p) { props.onCustom && props.onCustom(); return; }
				props.edit(props.urlField, p.url);
				var model = props.state[props.modelField].text;
				if (p.models.length > 0 && p.models.indexOf(model) < 0) props.edit(props.modelField, p.models[0]);
				if (props.onPick) props.onPick(p);
			}
			var list = all.filter(function (p) { var s = q.trim().toLowerCase(); return !s || (p.name + " " + p.en + " " + p.id).toLowerCase().indexOf(s) >= 0; });
			return h("div", { className: "compc-field" },
				h("span", { className: "compc-label" }, h(Label, { text: t("provider"), hint: t("providerHint") })),
				h("div", { className: "compc-row" },
					h("button", { type: "button", className: "compc-pCurrent", disabled: props.disabled, "aria-expanded": open, onClick: function () { setOpen(!open); } },
						h(ProviderIcon, { icon: cur && cur.icon, name: cur ? providerName(t, cur) : "+" }),
						h("span", { className: "compc-pName" }, providerName(t, cur)),
						h("span", { className: "compc-pCaret", "aria-hidden": true }, open ? "▴" : "▾")),
					cur && cur.keyUrl ? h("a", { className: "compc-hint compc-link", href: cur.keyUrl, target: "_blank", rel: "noreferrer noopener" }, t("providerGetKey")) : null),
				open ? h("div", { className: "compc-pPanel", role: "dialog", "aria-label": t("provider") },
					h("input", { className: "compc-input compc-pSearch", type: "search", placeholder: t("providerSearch"), value: q, autoFocus: true, onChange: function (e) { setQ(e.target.value); } }),
					h("div", { className: "compc-pGrid", role: "listbox" },
						list.map(function (p) {
							return h("button", { key: p.id, type: "button", role: "option", "aria-selected": cur === p, className: "compc-pCard" + (cur === p ? " compc-pOn" : ""), onClick: function () { choose(p); } },
								h(ProviderIcon, { icon: p.icon, name: p.name }), h("span", { className: "compc-pName" }, providerName(t, p)));
						}),
						h("button", { type: "button", role: "option", "aria-selected": !cur, className: "compc-pCard" + (!cur ? " compc-pOn" : ""), onClick: function () { choose(null); } },
							h(ProviderIcon, { name: "+" }), h("span", { className: "compc-pName" }, t("providerCustom"))))) : null);
		}
		/** 模型：下拉里是拉到的模型（拉不到就用这家的常用模型），也能手动填 */
		function ModelField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var cur = providerOf(url, props.providers || PROVIDERS);
			var model = props.state[props.modelField].text;
			var [fetched, setFetched] = React.useState(null);
			var [msg, setMsg] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			var [manual, setManual] = React.useState(false);
			function fetchModels() {
				var typedKey = props.state[props.keyField] ? props.state[props.keyField].text : "";
				setBusy(true); setMsg(null);
				return fetch(new URL(props.apiPath, document.baseURI).href, {
					method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" },
					body: JSON.stringify(Object.assign({ apiUrl: url, apiKey: typedKey || "", query: (cur && cur.query) || "" }, props.extraBody || {}))
				}).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (r) {
						if (r.ok) { setFetched(r.models); setMsg({ tone: "ok", text: t(r.filtered ? "modelFetched" : "modelFetchedAll", { n: r.models.length }) }); }
						else { setFetched(null); setMsg({ tone: "error", text: t("modelFetchFailed", { error: r.error }) }); }
					}, function (e) { setMsg({ tone: "error", text: t("modelFetchFailed", { error: e && e.message || String(e) }) }); })
					.finally(function () { setBusy(false); });
			}
			// 换了服务商：清掉上一家拉到的列表；有 Key（保存过的或刚填的）就自动拉一次
			var lastUrl = React.useRef(url);
			React.useEffect(function () {
				if (lastUrl.current === url) return;
				lastUrl.current = url; setFetched(null); setMsg(null); setManual(false);
				var hasKey = (props.state.secretSet && props.state.secretSet[props.keyField]) || (props.state[props.keyField] && props.state[props.keyField].text);
				if (cur && (hasKey || /^http:\/\/127\.0\.0\.1/.test(cur.url))) fetchModels();
			}, [url]);
			var options = (fetched || (cur ? cur.models : [])).slice();
			if (model && options.indexOf(model) < 0) options.unshift(model);
			var MANUAL = "\u0000manual";
			var showSelect = !manual && options.length > 0;
			return h("div", { className: "compc-field" },
				h("span", { className: "compc-label" }, h(Label, { text: props.label, hint: t("pModelHint") })),
				h("div", { className: "compc-row" },
					showSelect ? h("select", { className: "compc-select compc-pModel", disabled: props.disabled, value: model, "aria-label": props.label, onChange: function (e) { if (e.target.value === MANUAL) setManual(true); else props.edit(props.modelField, e.target.value); } },
						options.map(function (m) { return h("option", { key: m, value: m }, m); }),
						h("option", { value: MANUAL }, t("modelManual"))) : null,
					h("button", { type: "button", className: "compc-pBtn", disabled: busy || props.disabled || !url, onClick: fetchModels }, busy ? t("modelFetching") : t("modelFetch")),
					showSelect ? null : (options.length > 0 ? h("button", { type: "button", className: "compc-pBtn", onClick: function () { setManual(false); } }, t("modelPickList")) : null)),
				showSelect ? null : h(Value, Object.assign({}, props.common, { field: props.modelField, label: t("modelManualLabel"), hint: t("pModelHint") })),
				cur && cur.note ? h("p", { className: "compc-hint" }, t(cur.note)) : null,
				msg ? h("p", { className: "compc-pill compc-result compc-" + msg.tone, role: "status" }, msg.text) : null);
		}
		// 压缩 / 整理 / 抽关系用别家模型时的服务商（OpenAI 兼容的 /chat/completions）
		var CHAT_PROVIDERS = [
			{"id": "siliconflow", "name": "硅基流动", "en": "SiliconFlow", "icon": "siliconcloud", "url": "https://api.siliconflow.cn/v1", "keyUrl": "https://cloud.siliconflow.cn/account/ak", "models": ["deepseek-ai/DeepSeek-V4.1-Flash", "zai-org/GLM-5.3-Flash", "Qwen/Qwen3-235B-A22B-Instruct-2507"]},
			{"id": "bailian", "name": "阿里云百炼", "en": "Alibaba Bailian", "icon": "bailian", "url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "keyUrl": "https://bailian.console.aliyun.com/?tab=model#/api-key", "models": ["qwen-flash", "qwen-plus", "qwen-max"]},
			{"id": "zhipu", "name": "智谱 BigModel", "en": "Zhipu BigModel", "icon": "zhipu", "url": "https://open.bigmodel.cn/api/paas/v4", "keyUrl": "https://bigmodel.cn/usercenter/proj-mgmt/apikeys", "models": ["glm-4.5-flash", "glm-4.6"]},
			{"id": "volcengine", "name": "火山方舟", "en": "Volcengine Ark", "icon": "volcengine", "url": "https://ark.cn-beijing.volces.com/api/v3", "keyUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey", "models": ["doubao-seed-1-6-flash-250828", "doubao-seed-1-6-250615"], "note": "modelNoteArk"},
			{"id": "moonshot", "name": "月之暗面 Kimi", "en": "Moonshot Kimi", "icon": "moonshot", "url": "https://api.moonshot.cn/v1", "keyUrl": "https://platform.moonshot.cn/console/api-keys", "models": ["kimi-k2-turbo-preview", "moonshot-v1-8k"]},
			{"id": "minimax", "name": "MiniMax", "en": "MiniMax", "icon": "minimax", "url": "https://api.minimaxi.com/v1", "keyUrl": "https://platform.minimaxi.com/user-center/basic-information/interface-key", "models": ["MiniMax-M2"]},
			{"id": "hunyuan", "name": "腾讯混元", "en": "Tencent Hunyuan", "icon": "hunyuan", "url": "https://api.hunyuan.cloud.tencent.com/v1", "keyUrl": "https://console.cloud.tencent.com/hunyuan/api-key", "models": ["hunyuan-turbos-latest", "hunyuan-lite"]},
			{"id": "qianfan", "name": "百度千帆", "en": "Baidu Qianfan", "icon": "baidu", "url": "https://qianfan.baidubce.com/v2", "keyUrl": "https://console.bce.baidu.com/iam/#/iam/apikey/list", "models": ["ernie-4.5-turbo-128k", "ernie-speed-128k"]},
			{"id": "openai", "name": "OpenAI", "en": "OpenAI", "icon": "openai", "url": "https://api.openai.com/v1", "keyUrl": "https://platform.openai.com/api-keys", "models": ["gpt-5-mini", "gpt-4.1-mini"]},
			{"id": "gemini", "name": "Google Gemini", "en": "Google Gemini", "icon": "gemini", "url": "https://generativelanguage.googleapis.com/v1beta/openai", "keyUrl": "https://aistudio.google.com/apikey", "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite"]},
			{"id": "mistral", "name": "Mistral", "en": "Mistral", "icon": "mistral", "url": "https://api.mistral.ai/v1", "keyUrl": "https://console.mistral.ai/api-keys", "models": ["mistral-small-latest", "mistral-medium-latest"]},
			{"id": "groq", "name": "Groq", "en": "Groq", "icon": "groq", "url": "https://api.groq.com/openai/v1", "keyUrl": "https://console.groq.com/keys", "models": ["llama-3.3-70b-versatile", "openai/gpt-oss-20b"]},
			{"id": "openrouter", "name": "OpenRouter", "en": "OpenRouter", "icon": "openrouter", "url": "https://openrouter.ai/api/v1", "keyUrl": "https://openrouter.ai/settings/keys", "models": ["google/gemini-2.5-flash", "deepseek/deepseek-chat-v3.1"]},
			{"id": "ollama", "name": "Ollama（本机）", "en": "Ollama (local)", "icon": "ollama", "url": "http://127.0.0.1:11434/v1", "models": ["qwen3:8b"], "note": "modelNoteLocal"},
			{"id": "lmstudio", "name": "LM Studio（本机）", "en": "LM Studio (local)", "icon": "lmstudio", "url": "http://127.0.0.1:1234/v1", "models": [], "note": "modelNoteLocal"}
		];
		/** 别家的思考开关写法（和服务端 chat.ts 的 THINK_STYLES 一致），决定能选哪些等级 */
		function thinkLevels(url) {
			var u = String(url || "");
			if (/api\.openai\.com|generativelanguage\.googleapis\.com|api\.groq\.com|openrouter\.ai|dashscope(-intl)?\.aliyuncs\.com|api\.siliconflow\.(cn|com)/i.test(u)) return ["off", "low", "medium", "high"];
			if (/open\.bigmodel\.cn|api\.z\.ai|volces\.com/i.test(u)) return ["off", "low"];
			return [];
		}
		var dshModelsCache = null;
		function loadDshModels() {
			if (!dshModelsCache) dshModelsCache = api("GET", "llm/dsh-models").catch(function (e) { dshModelsCache = null; throw e; });
			return dshModelsCache;
		}
		function effortLabel(t, id, name) {
			var key = "effort_" + id;
			var tr = t(key);
			return tr && tr !== key ? tr : (name || id);
		}
		/** 思考等级下拉（options：[{ id, name }]；没有可选的就说明一句） */
		function EffortSelect(props) {
			var t = props.t;
			var value = props.state[props.field].text || "low";
			if (!props.options || props.options.length === 0) return h("div", { className: "compc-field" },
				h("span", { className: "compc-label" }, h(Label, { text: t("effort"), hint: t("effortHint") })),
				h("p", { className: "compc-hint" }, props.emptyText || t("effortNone")));
			var opts = props.options.slice();
			var ids = opts.map(function (o) { return o.id; });
			if (ids.indexOf(value) < 0) opts.unshift({ id: value, name: value, missing: true });
			return h("div", { className: "compc-field" },
				h("label", { className: "compc-label", htmlFor: "companion-core-" + props.field }, h(Label, { text: t("effort"), hint: t("effortHint") })),
				h("select", { id: "companion-core-" + props.field, className: "compc-select", disabled: props.disabled, value: value, onChange: function (e) { props.edit(props.field, e.target.value); } },
					opts.map(function (o) { return h("option", { key: o.id, value: o.id }, effortLabel(t, o.id, o.name) + (o.missing ? t("effortUnsupported") : "")); })));
		}
		/** dsh 里配置的模型（按服务商分组），加上这个模型的思考等级 */
		function DshModelPick(props) {
			var t = props.t;
			var [list, setList] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var [eff, setEff] = React.useState(null);
			var value = props.state[props.modelField].text;
			React.useEffect(function () { loadDshModels().then(setList, function (e) { setErr(e && e.message || String(e)); }); }, []);
			var slash = value.indexOf("/");
			var provider = slash > 0 ? value.slice(0, slash) : "", model = slash > 0 ? value.slice(slash + 1) : "";
			React.useEffect(function () {
				setEff(null);
				if (!props.follow && !model) return;
				api("POST", "llm/efforts", props.follow ? { task: props.task } : { task: props.task, provider: provider, model: model }).then(setEff, function () { setEff({ efforts: [] }); });
			}, [value, props.follow]);
			var effortField = props.task + "Effort";
			if (props.follow) {
				var m = eff && eff.model;
				return h("div", { className: "compc-grid" },
					h("div", { className: "compc-field" },
						h("span", { className: "compc-label" }, t("followUses")),
						h("p", { className: "compc-hint" }, m ? m.provider + "/" + m.model : (eff ? t("followNone") : t("loading")))),
					h(EffortSelect, Object.assign({ field: effortField, options: eff ? eff.efforts : [] }, props.common)));
			}
			var groups = ((list && list.providers) || []).filter(function (g) { return g.models.length > 0; });
			var known = groups.some(function (g) { return g.models.some(function (mm) { return g.id + "/" + mm.id === value; }); });
			return h("div", { className: "compc-grid" },
				h("div", { className: "compc-field" },
					h("label", { className: "compc-label", htmlFor: "companion-core-" + props.modelField }, h(Label, { text: t("dshModel"), hint: t("dshModelHint") })),
					err ? h("p", { className: "compc-result compc-error" }, t("dshModelsFailed", { error: err })) : null,
					h("select", { id: "companion-core-" + props.modelField, className: "compc-select", disabled: props.disabled || !list, value: value, onChange: function (e) { props.edit(props.modelField, e.target.value); } },
						!value ? h("option", { value: "" }, list ? t("dshModelPick") : t("loading")) : null,
						value && !known ? h("option", { value: value }, value) : null,
						groups.map(function (g) {
							return h("optgroup", { key: g.id, label: g.name }, g.models.map(function (mm) { return h("option", { key: mm.id, value: g.id + "/" + mm.id }, mm.name + (mm.name !== mm.id ? "（" + mm.id + "）" : "")); }));
						}))),
				h(EffortSelect, Object.assign({ field: effortField, options: eff ? eff.efforts : [], emptyText: model ? t("effortNone") : t("effortPickModel") }, props.common)));
		}
		/** 写日记用的模型：就是和主人私聊用的那个（只显示，不在这里改），思考等级单独选 */
		function DiaryModel(props) {
			var t = props.t;
			var act = useAction();
			var [from, setFrom] = React.useState(null);
			React.useEffect(function () { api("POST", "llm/efforts", { task: "diary" }).then(function (r) { setFrom(r.from || null); }, function () {}); }, []);
			function test() {
				act.run(function () {
					return api("POST", "llm/test", { task: "diary" }).then(function (r) {
						act.setMsg(r.ok ? { tone: "ok", text: t("llmTestOk", { model: r.model, ms: r.ms, effort: r.effort ? effortLabel(t, r.effort) : t("effortDefault"), text: r.text }) } : { tone: "error", text: t("llmTestFailed", { error: r.error }) });
					});
				});
			}
			return h("div", { className: "compc-field compc-llm" },
				h("span", { className: "compc-label" }, h(Label, { text: t("diaryModel"), hint: t("diaryModelHint") })),
				h(DshModelPick, { t: t, state: props.state, common: props.common, disabled: props.disabled, task: "diary", modelField: "diaryEffort", follow: true }),
				from ? h("p", { className: "compc-hint" }, t("diaryModelFrom_" + from)) : null,
				h("div", { className: "compc-row" },
					h("button", { type: "button", className: "compc-testBtn", disabled: act.busy, onClick: test },
						h("span", { className: "compc-testIcon", "aria-hidden": true }, act.busy ? "…" : "⇄"), act.busy ? t("testing") : t("llmTest")),
					props.state.dirty ? h("span", { className: "compc-hint" }, t("testUsesSaved")) : null),
				act.msg ? h("p", { className: "compc-pill compc-result compc-" + act.msg.tone, role: "status" }, act.msg.text) : null);
		}
		/** 一个任务（压缩 / 整理 / 抽关系）用哪个模型 */
		function LlmField(props) {
			var t = props.t, task = props.task, common = props.common, state = props.state;
			var source = state[task + "Source"].text || "follow";
			var act = useAction();
			function test() {
				act.run(function () {
					return api("POST", "llm/test", { task: task }).then(function (r) {
						act.setMsg(r.ok ? { tone: "ok", text: t("llmTestOk", { model: r.model, ms: r.ms, effort: r.effort ? effortLabel(t, r.effort) : t("effortDefault"), text: r.text }) } : { tone: "error", text: t("llmTestFailed", { error: r.error }) });
					});
				});
			}
			var apiUrlField = task + "ApiUrl";
			var levels = thinkLevels(state[apiUrlField].text).map(function (id) { return { id: id }; });
			return h("div", { className: "compc-field compc-llm" },
				h("div", { className: "compc-field" },
					h("label", { className: "compc-label", htmlFor: "companion-core-" + task + "Source" }, h(Label, { text: props.label, hint: props.hint })),
					h("select", { id: "companion-core-" + task + "Source", className: "compc-select", disabled: props.disabled, value: source, onChange: function (e) { props.edit(task + "Source", e.target.value); } },
						h("option", { value: "follow" }, props.followLabel),
						h("option", { value: "dsh" }, t("sourceDsh")),
						h("option", { value: "api" }, t("sourceApi")))),
				source === "follow" && props.noFollowEffort ? h("p", { className: "compc-hint" }, props.followNote) : null,
				source === "follow" && !props.noFollowEffort ? h(DshModelPick, { t: t, state: state, common: common, disabled: props.disabled, task: task, modelField: task + "Model", follow: true }) : null,
				source === "dsh" ? h(DshModelPick, { t: t, state: state, common: common, disabled: props.disabled, task: task, modelField: task + "Model" }) : null,
				source === "api" ? h(ProviderField, Object.assign({ urlField: apiUrlField, modelField: task + "ApiModel", providers: CHAT_PROVIDERS }, common)) : null,
				source === "api" ? h(Secret, Object.assign({ field: task + "ApiKey", label: t("embedApiKey"), hint: t("embedApiKeyHint"), setLabel: t("apiKeySet"), unsetLabel: t("apiKeyUnset") }, common)) : null,
				source === "api" ? h(ModelField, Object.assign({ urlField: apiUrlField, modelField: task + "ApiModel", keyField: task + "ApiKey", apiPath: "api/companion/llm/models", extraBody: { task: task }, providers: CHAT_PROVIDERS, label: t("apiModel"), common: common }, common)) : null,
				source === "api" ? h("div", { className: "compc-grid" },
					h(Value, Object.assign({ field: apiUrlField, label: t("embedApiUrl"), hint: t("chatApiUrlHint") }, common)),
					h(EffortSelect, Object.assign({ field: task + "Effort", options: levels, emptyText: t("effortNoneApi") }, common))) : null,
				source === "follow" && props.noFollowEffort ? null : h("div", { className: "compc-row" },
					h("button", { type: "button", className: "compc-testBtn", disabled: act.busy, onClick: test },
						h("span", { className: "compc-testIcon", "aria-hidden": true }, act.busy ? "…" : "⇄"), act.busy ? t("testing") : t("llmTest")),
					state.dirty ? h("span", { className: "compc-hint" }, t("testUsesSaved")) : null),
				act.msg ? h("p", { className: "compc-pill compc-result compc-" + act.msg.tone, role: "status" }, act.msg.text) : null);
		}
		//#endregion

		/** 有改动还没保存时，贴在页面底部的保存栏（dsh 自带的保存按钮在整页最下面，改完上面的设置容易找不到） */
		function SaveBar(props) {
			var t = props.t, st = props.state;
			if (!st.dirty) return null;
			return h("div", { className: "compc-saveBar", role: "region", "aria-label": t("unsavedBar") },
				h("span", { className: "compc-saveText" }, t("unsavedBar")),
				h("div", { className: "compc-saveBtns" },
					h(P.Button, { size: "sm", disabled: st.saving, onClick: props.discard }, t("discardChanges")),
					h(P.Button, { size: "sm", disabled: st.saving || !st.writable, onClick: props.save }, st.saving ? t("saving") : t("save"))));
		}
		function SettingsPage(props) {
			var t = props.t;
			if (props.view === "summary") return t("summary");
			var state = props.useCompanionForm(function (s) { return s; });
			var disabled = !state.writable || state.saving;
			var common = { t: t, state: state, disabled: disabled, edit: props.edit, resetField: props.resetField };
			var [data, setData] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var [memVersion, setMemVersion] = React.useState(0);
			var [tab, setTab] = React.useState(readTab);
			function load() {
				setMemVersion(function (v) { return v + 1; });
				api("GET", "state").then(function (st) { setErr(null); setData(st); }, function (e) { setErr(e.message); });
			}
			React.useEffect(function () { load(); }, []);
			var docs = data ? data.docs : {};
			var stats = data && data.archive;
			var statusLines = err ? [h("p", { key: "e", className: "compc-result compc-error" }, t("loadFailed", { error: err }))]
				: !data ? [h("p", { key: "l", className: "compc-hint" }, t("loading"))]
				: [
					h("p", { key: "n", className: "compc-result " + (data.napcat ? "compc-ok" : "compc-warn") }, t(data.napcat ? "napcatOn" : "napcatOff")),
					stats ? h("p", { key: "a", className: "compc-hint" }, t("archiveCount", { total: stats.total, private: (stats.byKind && stats.byKind.private) || 0, group: (stats.byKind && stats.byKind.group) || 0 })) : null,
					h("p", { key: "d", className: "compc-hint" }, t("dataDir", { dir: data.dataDir }))
				];
			return h(React.Fragment, null, h(P.SettingsForm, {
				labels: { unavailable: t("unavailable"), readOnly: t("readOnly"), saveFailed: t("saveFailed"), save: t("save"), saving: t("saving") },
				state: state,
				onSave: props.save,
				onDiscard: props.discard
			},
				h(Section, { title: t("status"), hint: t("statusHint") },
					statusLines,
					h("div", { className: "compc-row" }, h(P.Button, { size: "sm", onClick: load }, t("refresh")))),
				h(Tabs, { t: t, cur: tab, onChange: setTab }),
				h(Section, { tab: "persona", cur: tab, title: t("scope"), hint: t("scopeHint") },
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "personaPresets", label: t("personaPresets"), hint: t("personaPresetsHint") }, common)),
						h(Value, Object.assign({ field: "excludedPresets", label: t("excludedPresets"), hint: t("excludedPresetsHint") }, common)),
						h(Select, Object.assign({ field: "pluginAccess", label: t("pluginAccess"), hint: t("pluginAccessHint"), fallback: "all", options: [{ value: "all", label: t("pluginAccessAll") }, { value: "public", label: t("pluginAccessPublic") }, { value: "off", label: t("pluginAccessOff") }] }, common))),
					h(Toggle, Object.assign({ field: "personaOnly", label: t("personaOnly"), hint: t("personaOnlyHint") }, common))),
				h(Section, { tab: "persona", cur: tab, title: t("persona"), hint: t("personaHint") },
					data ? h(DocEditor, { t: t, name: "persona", doc: docs.persona, ariaLabel: t("persona"), saveLabel: t("savePersona"), onState: setData }) : null,
					h(Toggle, Object.assign({ field: "selfEdit", label: t("selfEdit"), hint: t("selfEditHint") }, common)),
					h(Value, Object.assign({ field: "historyKeep", label: t("historyKeep"), hint: t("historyKeepHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
				h(Section, { tab: "persona", cur: tab, title: t("personaGuardSec"), hint: t("personaGuardHint") },
					h(Toggle, Object.assign({ field: "personaGuard", label: t("personaGuard"), hint: t("personaGuardHintField") }, common)),
					state.personaGuard.text === "true" ? h("div", { className: "compc-field" },
						h(Toggle, Object.assign({ field: "personaReview", label: t("personaReview"), hint: t("personaReviewHint") }, common)),
						h("div", { className: "compc-grid" },
							h(Value, Object.assign({ field: "personaEditMaxChars", label: t("personaEditMaxChars"), hint: t("personaEditMaxCharsHint"), numeric: true, invalidLabel: t("invalid") }, common)),
							h(Value, Object.assign({ field: "personaMaxChars", label: t("personaMaxChars"), hint: t("personaMaxCharsHint"), numeric: true, invalidLabel: t("invalid") }, common))),
						h(Lines, Object.assign({ t: t, field: "personaAllowed", label: t("personaAllowed"), hint: t("personaAllowedHint") }, common)),
						h(Lines, Object.assign({ t: t, field: "personaForbidden", label: t("personaForbidden"), hint: t("personaForbiddenHint") }, common))) : null),
				h(Section, { tab: "persona", cur: tab, title: t("core"), hint: t("coreHint") },
					data ? h(DocEditor, { t: t, name: "core-master", title: t("coreMaster"), small: true, doc: docs["core-master"], saveLabel: t("saveCore"), onState: setData }) : null,
					data ? h(DocEditor, { t: t, name: "core-public", title: t("corePublic"), small: true, doc: docs["core-public"], saveLabel: t("saveCore"), onState: setData }) : null,
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "coreMasterMaxChars", label: t("coreMasterMaxChars"), hint: t("coreMasterMaxCharsHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "corePublicMaxChars", label: t("corePublicMaxChars"), hint: t("corePublicMaxCharsHint"), numeric: true, invalidLabel: t("invalid") }, common)))),
				h(Section, { tab: "chat", cur: tab, title: t("context"), hint: t("contextHint") },
					h(Value, Object.assign({ field: "thresholdPercent", label: t("thresholdPercent"), hint: t("thresholdPercentHint"), numeric: true, invalidLabel: t("invalid") }, common)),
					h(ContextRow, { t: t, common: common, prefix: "master", title: t("masterRow"), fallback: "llm" }),
					h(ContextRow, { t: t, common: common, prefix: "private", title: t("privateRow"), fallback: "truncate" }),
					h(ContextRow, { t: t, common: common, prefix: "group", title: t("groupRow"), fallback: "truncate" }),
					h(Toggle, Object.assign({ field: "organizeBeforeCompact", label: t("organizeBeforeCompact"), hint: t("organizeBeforeCompactHint") }, common)),
					h(LlmField, { common: common, t: t, state: state, edit: props.edit, disabled: disabled, task: "summary", label: t("summaryModel"), hint: t("summaryModelHint"), followLabel: t("followSummary"), noFollowEffort: true, followNote: t("followSummaryNote") })),
				h(Section, { tab: "chat", cur: tab, title: t("rules"), hint: t("rulesHint") },
					h(RulesEditor, { t: t, state: state, edit: props.edit, disabled: disabled })),
				h(Section, { tab: "chat", cur: tab, title: t("archive"), hint: t("archiveHint") },
					h(Toggle, Object.assign({ field: "archiveEnabled", label: t("archiveEnabled"), hint: t("archiveEnabledHint") }, common)),
					h(Toggle, Object.assign({ field: "archiveUnwoken", label: t("archiveUnwokenAll"), hint: t("archiveUnwokenAllHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "archiveDaysMaster", label: t("archiveDaysMaster"), hint: t("archiveDaysMasterHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "archiveDaysOthers", label: t("archiveDaysOthers"), hint: t("archiveDaysOthersHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)))),
				h(Section, { tab: "chat", cur: tab, title: t("groupCtx"), hint: t("groupCtxHint") },
					state.archiveUnwoken.text === "false" ? h("p", { className: "compc-result compc-warn" }, t("groupCtxOff")) : null,
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({}, common, { field: "groupContextCount", label: t("groupContextCount"), hint: t("groupContextCountHint"), numeric: true, invalidLabel: t("invalidCount"), disabled: disabled || state.archiveUnwoken.text === "false" })),)),
				h(Section, { tab: "memory", cur: tab, title: t("memRecall"), hint: t("memRecallHint") },
					h(Toggle, Object.assign({ field: "recallEnabled", label: t("recallEnabled"), hint: t("recallEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "recallTopKMaster", label: t("recallTopKMaster"), hint: t("recallTopKMasterHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "recallTopK", label: t("recallTopK"), hint: t("recallTopKHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "halfLifeDays", label: t("halfLifeDays"), hint: t("halfLifeDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "keywordThreshold", label: t("keywordThreshold"), hint: t("keywordThresholdHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "vectorThreshold", label: t("vectorThreshold"), hint: t("vectorThresholdHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "keywordWeight", label: t("keywordWeight"), hint: t("keywordWeightHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "importanceWeight", label: t("importanceWeight"), hint: t("importanceWeightHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "recencyWeight", label: t("recencyWeight"), hint: t("recencyWeightHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "groupDiscount", label: t("groupDiscount"), hint: t("groupDiscountHint"), invalidLabel: t("invalidRatio") }, common)))),
				h(Section, { tab: "memory", cur: tab, title: t("vector"), hint: t("vectorHint") },
					h(Fold, { title: t("embedFold", { provider: providerName(t, providerOf(state.embedApiUrl.text)), model: state.embedModel.text || "—" }), openTitle: t("embedFoldClose") },
						h(ProviderField, Object.assign({ urlField: "embedApiUrl", modelField: "embedModel" }, common)),
						h(Secret, Object.assign({ field: "embedApiKey", label: t("embedApiKey"), hint: t("embedApiKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)),
						h(ModelField, Object.assign({ urlField: "embedApiUrl", modelField: "embedModel", keyField: "embedApiKey", apiPath: "api/companion/embed/models", label: t("embedModel"), common: common }, common)),
						h("div", { className: "compc-grid" },
							h(Value, Object.assign({ field: "embedApiUrl", label: t("embedApiUrl"), hint: t("embedApiUrlHint") }, common)),
							h(Value, Object.assign({ field: "embedBatch", label: t("embedBatch"), hint: t("embedBatchHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
						h(EmbedTest, { t: t, dirty: state.dirty })),
					h(IndexPanel, { t: t, initial: data ? data.index : null })),
				h(Section, { tab: "memory", cur: tab, title: t("graphSec"), hint: t("graphSecHint") },
					h(Toggle, Object.assign({ field: "graphEnabled", label: t("graphEnabled"), hint: t("graphEnabledHint") }, common)),
					h(LlmField, { common: common, t: t, state: state, edit: props.edit, disabled: disabled, task: "graph", label: t("graphModel"), hint: t("graphModelHint"), followLabel: t("followGraph"), noFollowEffort: true, followNote: t("followGraphNote") }),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "graphBatch", label: t("graphBatch"), hint: t("graphBatchHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "graphHops", label: t("graphHops"), hint: t("graphHopsHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(GraphPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("memGen"), hint: t("memGenHint") },
					h(Toggle, Object.assign({ field: "activeMemory", label: t("activeMemory"), hint: t("activeMemoryHint") }, common)),
					h(Toggle, Object.assign({ field: "organizeBeforeCompact", label: t("organizeBeforeCompact"), hint: t("organizeBeforeCompactHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "organizeEveryRounds", label: t("organizeEveryRounds"), hint: t("organizeEveryRoundsHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
					h(LlmField, { common: common, t: t, state: state, edit: props.edit, disabled: disabled, task: "memory", label: t("memoryModel"), hint: t("memoryModelHint"), followLabel: t("followMemory") }),
					h(OrganizePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("forget"), hint: t("forgetHint") },
					h("div", { className: "compc-grid" },
						h(Select, Object.assign({ field: "masterForget", label: t("masterForget"), hint: t("masterForgetHint"), fallback: "normal", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common)),
						h(Select, Object.assign({ field: "privateForget", label: t("privateForget"), hint: t("privateForgetHint"), fallback: "purge", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common)),
						h(Select, Object.assign({ field: "groupForget", label: t("groupForget"), hint: t("groupForgetHint"), fallback: "purge", options: [{ value: "normal", label: t("forgetNormal") }, { value: "purge", label: t("forgetPurge") }] }, common))),
					h(Toggle, Object.assign({ field: "cleanupEnabled", label: t("cleanupEnabled"), hint: t("cleanupEnabledHint") }, common)),
					state.cleanupEnabled.text === "true" ? h(Toggle, Object.assign({ field: "cleanupAutoPurge", label: t("cleanupAutoPurge"), hint: t("cleanupAutoPurgeHint") }, common)) : null,
					h(CleanupPanel, { t: t, data: data, enabled: state.cleanupEnabled.text === "true" && !state.dirty, onState: setData })),
				h(Section, { tab: "diary", cur: tab, title: t("diarySec"), hint: t("diarySecHint") },
					h(Toggle, Object.assign({ field: "diaryEnabled", label: t("diaryEnabled"), hint: t("diaryEnabledHint") }, common)),
					h(DiaryModel, { t: t, state: state, common: common, disabled: disabled }),
					h(Toggle, Object.assign({ field: "monthlyEnabled", label: t("monthlyEnabled"), hint: t("monthlyEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "diaryTime", label: t("diaryTime"), hint: t("diaryTimeHint") }, common)),
						h(Value, Object.assign({ field: "dayBoundaryHour", label: t("dayBoundaryHour"), hint: t("dayBoundaryHourHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "timezone", label: t("timezone"), hint: t("timezoneHint") }, common))),
					h(Toggle, Object.assign({ field: "diaryOnNewSession", label: t("diaryOnNewSession"), hint: t("diaryOnNewSessionHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "diaryDays", label: t("diaryDays"), hint: t("diaryDaysHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "overviewMonths", label: t("overviewMonths"), hint: t("overviewMonthsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "diaryBudgetPercent", label: t("diaryBudgetPercent"), hint: t("diaryBudgetPercentHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(DiaryPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "diary", cur: tab, title: t("diaryPage"), hint: t("diaryPageHint") },
					h(DiaryBook, { t: t, version: memVersion, onChanged: function () { api("GET", "state").then(setData, function () {}); } })),
				h(Section, { tab: "chat", cur: tab, title: t("expirySec"), hint: t("expirySecHint") },
					h(Toggle, Object.assign({ field: "rotateSessions", label: t("rotateSessions"), hint: t("rotateSessionsHint") }, common)),
					h(Toggle, Object.assign({ field: "deleteOldSessions", label: t("deleteOldSessions"), hint: t("deleteOldSessionsHint") }, common)),
					h(Toggle, Object.assign({ field: "archiveImages", label: t("archiveImages"), hint: t("archiveImagesHint") }, common)),
					h(Value, Object.assign({ field: "carryMessages", label: t("carryMessages"), hint: t("carryMessagesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
					h(ExpiryPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "proactive", cur: tab, title: t("proSec"), hint: t("proSecHint") },
					h(Toggle, Object.assign({ field: "proactiveEnabled", label: t("proactiveEnabled"), hint: t("proactiveEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "proactiveMinMinutes", label: t("proactiveMinMinutes"), hint: t("proactiveMinMinutesHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveMaxMinutes", label: t("proactiveMaxMinutes"), hint: t("proactiveMaxMinutesHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMinMinutes", label: t("proactiveOthersMinMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common)),
						h(Value, Object.assign({ field: "proactiveOthersMaxMinutes", label: t("proactiveOthersMaxMinutes"), hint: t("proIntervalHint"), numeric: true, invalidLabel: t("invalid") }, common))),
					h(Toggle, Object.assign({ field: "proactivePrivate", label: t("proactivePrivate"), hint: t("proactivePrivateHint") }, common)),
					h(Toggle, Object.assign({ field: "proactiveGroup", label: t("proactiveGroup"), hint: t("proactiveGroupHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "quietStart", label: t("quietStart"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "quietEnd", label: t("quietEnd"), hint: t("quietHint") }, common)),
						h(Value, Object.assign({ field: "proactiveRecentMinutes", label: t("proactiveRecentMinutes"), hint: t("proactiveRecentMinutesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveGroupContext", label: t("proactiveGroupContext"), hint: t("proactiveGroupContextHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "proactiveActiveDays", label: t("proactiveActiveDays"), hint: t("proactiveActiveDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "silenceToken", label: t("proSilence"), hint: t("proSilenceHint") }, common))),
					h(ProactivePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("careSec"), hint: t("careSecHint") },
					h(Toggle, Object.assign({ field: "autoCleanup", label: t("autoCleanup"), hint: t("autoCleanupHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "autoCleanupDays", label: t("autoCleanupDays"), hint: t("autoCleanupDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
						h(Value, Object.assign({ field: "autoCleanupImportance", label: t("autoCleanupImportance"), hint: t("autoCleanupImportanceHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "careIntervalDays", label: t("careIntervalDays"), hint: t("careIntervalDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(Toggle, Object.assign({ field: "purgeForgotten", label: t("purgeForgotten"), hint: t("purgeForgottenHint") }, common)),
					state.purgeForgotten.text === "true" ? h(Value, Object.assign({ field: "purgeForgottenDays", label: t("purgeForgottenDays"), hint: t("purgeForgottenDaysHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)) : null,
					h(Toggle, Object.assign({ field: "consolidateEnabled", label: t("consolidateEnabled"), hint: t("consolidateEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "consolidateOverlap", label: t("consolidateOverlap"), hint: t("consolidateOverlapHint"), invalidLabel: t("invalidRatio") }, common)),
						h(Value, Object.assign({ field: "consolidateGroups", label: t("consolidateGroups"), hint: t("consolidateGroupsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(CarePanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "backup", cur: tab, title: t("backupSec"), hint: t("backupSecHint") },
					h(Toggle, Object.assign({ field: "backupEnabled", label: t("backupEnabled"), hint: t("backupEnabledHint") }, common)),
					h("div", { className: "compc-grid" },
						h(Value, Object.assign({ field: "backupTime", label: t("backupTime"), hint: t("backupTimeHint") }, common)),
						h(Value, Object.assign({ field: "backupKeep", label: t("backupKeep"), hint: t("backupKeepHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					h(BackupItemsField, common),
					h(BackupPanel, { t: t, data: data, onState: setData, items: backupItemsOf(state) }),
					h("h4", { className: "compc-subtitle" }, h(Label, { text: t("selfCheck"), hint: t("selfCheckHint") })),
					h(Value, Object.assign({ field: "selfCheckQueries", label: t("selfCheckQueries"), hint: t("selfCheckQueriesHint") }, common)),
					h(SelfCheckPanel, { t: t, data: data, onState: setData })),
				h(Section, { tab: "memory", cur: tab, title: t("memList"), hint: t("memListHint") },
					h(Fold, { title: t("memListOpen"), openTitle: t("memListClose") },
						h(MemoryList, { t: t, version: memVersion, onChanged: function () { api("GET", "state").then(setData, function () {}); } }))),
				h(Section, { tab: "backup", cur: tab, title: t("log") },
					h(Select, Object.assign({ field: "logLevel", label: t("logLevel"), hint: t("logLevelHint"), fallback: "info", options: LOG_LEVELS.map(function (l) { return { value: l, label: l }; }) }, common)),
					h("details", { className: "compc-details" },
						h("summary", { className: "compc-summary" }, h("span", { className: "compc-chevron", "aria-hidden": true }, "›"), t("recentLogs")),
						h("div", { className: "compc-detailsBody" },
							data && data.logs && data.logs.length > 0
								? h("pre", { className: "compc-pre" }, data.logs.slice().reverse().map(function (l) { return fmtTime(l.time) + " [" + l.level + "] " + l.message; }).join("\n"))
								: h("p", { className: "compc-hint" }, t("noLogs")))))), h(SaveBar, { t: t, state: state, save: props.save, discard: props.discard }));
		}
		//#endregion

		//#region 入口
		var inject = ["slots", "locale", "configForms", "remote", "remote.settings"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "companion-core: dictionaries");
			var scope = ctx.configForms.get(SECTION);
			var model = createForm(scope);
			ctx.effect(function () { return function () { model.form.dispose(); }; }, "companion-core: form");
			var disposed = false;
			ctx.effect(function () { return function () { disposed = true; }; }, "companion-core: lifetime");
			function refreshSecrets() {
				ctx.remote.settings.describe().then(function (response) {
					if (disposed || !response.ok) return;
					var row = response.value.namespaces.find(function (n) { return n.ns === SECTION; });
					var next = {};
					((row && row.secrets) || []).forEach(function (x) { if (x.path.length === 1) next[x.path[0]] = x.set === true; });
					model.setSecrets(next);
				}, function () {});
			}
			refreshSecrets();
			ctx.effect(function () { return scope.subscribe(refreshSecrets); }, "companion-core: secret state");
			ctx.effect(function () {
				return ctx.configForms.whileServed([SECTION], function () {
					return ctx.slots.inject("plugins.bundle.config", function () {
						return ctx.slots.register({
							name: "plugins.bundle.config",
							key: PACKAGE,
							locale: NS,
							inject: function () { return Object.assign({ hooks: { companionForm: model.store } }, model.form.actions()); }
						}, SettingsPage);
					});
				});
			}, "companion-core: page");
		}
		//#endregion

		exports.inject = inject;
		exports.apply = apply;
		exports.SettingsPage = SettingsPage;
		return exports;
	}
});
