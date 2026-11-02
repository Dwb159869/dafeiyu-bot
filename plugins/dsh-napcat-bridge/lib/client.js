// dsh-napcat-bridge 设置页（浏览器一侧）。
// 注册到 dsh「插件」页的 plugins.bundle.config 扩展点：在插件页打开本插件即可看到。
// 表单读写 dsh 设置服务里本插件的配置行（id: napcat-bridge），保存后插件立即读到新值。
// 只用 dsh 自带的表单组件和 --dsw-* 颜色变量，外观随 dsh 的主题（深色/浅色）变化。
// 这个文件不经过打包，构建时原样复制到 lib/client.js。
window.__ModuleLoader__.load({
	id: "dsh-napcat-bridge",
	factory: (require) => {
		var exports = {};
		var reactModule = require("react");
		var React = typeof reactModule.createElement === "function" ? reactModule : reactModule.default;
		var P = require("@deepseek-ai/dsh-client-ui-primitives");
		var h = React.createElement;

		/** 词条命名空间 */
		var NS = "napcatBridge";
		/** 插件包名（plugins.bundle.config 的 key） */
		var PACKAGE = "dsh-napcat-bridge";
		/** 设置服务里的配置行 id（cordis.patch.yml 里的 id） */
		var SECTION = "napcat-bridge";

		var zh = {
			nudgeOnEmpty: "她只想没说时提醒她说出来",
			nudgeOnEmptyHint: "正式模型一轮结束但未生成正文时，自动追加一次提示，要求输出回复或静默标记。默认开启，每轮最多提醒一次；被 /stop 中止的回复不提醒。启用后可能增加一次模型调用。",
			alertTestUsesForm: "用的是现在页面上填的（还没保存也行），记得保存。",
			unsavedBar: "有改动还没保存：点「保存」才生效，离开这个页面会丢掉",
			discardChanges: "放弃改动",
			watchSec: "掉线提醒",
			watchSecHint: "监测 QQ 账号在线状态及 NapCat 连接状态，并通过已配置的邮件或微信推送渠道发送异常通知。通知依赖 dsh 进程正常运行；dsh 自身停止运行时，本插件无法发送通知。",
			watchLoading: "正在读取…",
			watchBot: "QQ 小号",
			watchState_ok: "{who} 在线",
			watchState_offline: "{who} 掉线了（{since} 起）",
			watchState_disconnected: "NapCat 没连上本插件（{since} 起）",
			watchState_unknown: "还不知道 {who} 在不在线（{since} 起）",
			watchReason: "。原因：{reason}",
			watchLastAlert: "上次提醒：{time} · {kind} · {results}",
			watchKindProblem: "掉线提醒",
			watchKindRecovered: "恢复提醒",
			watchNoChannel: "没有设置提醒渠道",
			watchCheckNow: "现在检查一次",
			watchBannerHint: "账号可能需要重新登录。请在 NapCat 管理页面确认登录状态；连接与通知配置见“连接和权限 → 掉线提醒”。",
			watchEnabled: "检测掉线",
			watchEnabledHint: "启用后综合下线通知、心跳状态及定期接口查询检测异常。关闭后不发送掉线或恢复通知。",
			watchInterval: "每几分钟问一次",
			watchGrace: "持续几分钟才提醒",
			watchGraceHint: "异常持续达到此时间后发送通知，用于过滤短暂断连。插件启动后也使用此宽限时间；启动宽限结束后，明确的下线状态可立即触发通知。",
			alertRepeat: "没恢复时每几小时再提醒",
			alertRepeatHint: "异常未恢复时，按此间隔重复通知，单位为小时。设为 0 表示同一次异常仅通知一次。",
			alertOnRecover: "恢复后再发一条「恢复了」",
			mailSub: "邮件",
			mailEnabled: "用邮件提醒",
			mailPreset: "邮箱",
			mailPresetHint: "选择邮箱服务预设后自动填入 SMTP 服务器和端口。身份验证信息仍需手动配置；支持授权码的邮箱应填写 SMTP 授权码。",
			mailPresetCustom: "自定义",
			mailGetCode: "去拿授权码 ↗",
			smtpHost: "发信服务器（SMTP）",
			smtpPort: "端口",
			smtpPortHint: "SMTP 服务端口，须与邮箱服务商要求一致。465 使用隐式 TLS；其他端口按 SMTP 服务协商加密，587 通常用于 STARTTLS。",
			smtpUser: "发信邮箱",
			mailTo: "收件人",
			mailToHint: "通知邮件的收件邮箱。留空时使用“发信邮箱”作为收件地址。",
			smtpPass: "授权码",
			smtpPassHint: "用于 SMTP 身份验证的密码或授权码。已保存的凭据不回显；输入框留空时保留现有值。",
			secretSet: "已设置。",
			secretUnset: "还没设置。",
			mailTest: "发一封测试邮件",
			pushSub: "微信推送",
			pushService: "推送服务",
			pushServiceHint: "选择 Server酱或 PushPlus 发送微信通知，并填写该服务要求的 SendKey 或 Token。通知内容将经所选第三方服务传递；额度与使用规则以服务商说明为准。",
			pushOff: "不用",
			pushGetKey: "去拿 Key ↗",
			pushKeyHint: "填写所选推送服务的 SendKey 或 Token。已保存的凭据不回显；输入框留空时保留现有值。",
			pushTest: "发一条测试推送",
			reasoningMinimal: "最少（minimal）",
			reasoningMedium: "中（medium）",
			reasoningUnsupported: "（这个模型不支持）",
			reasoningNone: "这个模型不能调思考等级。",
			dshModelsFailed: "读不到 dsh 的模型列表：{error}",
			loadingModels: "正在读取…",
			modelBlankDefault: "不单独设（用 dsh 的默认模型）",
			modelBlankAdmin: "不单独设（用「其他私聊」的设置，再空就用 dsh 默认模型）",
			modelPickHint: "选择已在 dsh“设置 → 模型”中配置的模型。保存后，在该类会话下一次空闲时应用；正在生成的回复结束后再切换，既有对话记录保留。",
			langIsEn: "0",
			provider: "服务商",
			providerHint: "选择预设服务商以填入接口地址和常用模型。选择“自定义”时，请填写所需服务的 OpenAI 兼容基础地址；通常填写至 /v1，不附加具体接口路径。",
			providerSearch: "搜索服务商",
			providerCustom: "自定义（OpenAI 兼容）",
			providerGetKey: "去这家拿 Key ↗",
			pModelHint: "使用当前填写或已保存的凭据获取服务端模型列表。无法获取时保留预设模型选项；也可手动输入模型标识。列出模型不代表当前账号具有调用权限。",
			modelFetch: "获取模型列表",
			modelFetching: "正在获取…",
			modelFetched: "拿到 {n} 个可用的模型，在下拉里选。",
			modelFetchedAll: "拿到 {n} 个模型（从名字看不出哪些能用在这里，全列出来了）。",
			modelFetchFailed: "没拉到模型列表：{error}。下拉里是这家常用的模型。",
			modelManual: "手动填写…",
			modelManualLabel: "模型名（手动填写）",
			modelPickList: "从列表选",
			summary: "把 NapCat（OneBot v11）接到 dsh，照搬 AstrBot 的 aiocqhttp 适配器。",
			connection: "连接",
			connectionHint: "本插件作为反向 WebSocket 服务端。请在 NapCat 中创建 WebSocket 客户端，连接 ws://<地址>:<端口>/ws，并使用一致的 Token。保存监听地址或端口后会重新监听，现有连接需重新建立。",
			host: "监听地址",
			hostHint: "反向 WebSocket 的绑定地址，默认 0.0.0.0，表示监听所有本机网络接口。仅允许同机连接时可使用 127.0.0.1；实际可访问范围还取决于防火墙和安全组。",
			port: "端口",
			portHint: "反向 WebSocket 的监听端口，默认 6199，可填写 1～65535 的整数。该端口必须未被其他服务占用，并与 NapCat 客户端地址一致。",
			token: "Token",
			tokenHint: "反向 WebSocket 连接的身份验证凭据，须与 NapCat 配置一致。输入框留空会保留已保存的 Token；尚未设置 Token 时不进行此项验证。",
			napcatSetupHint: "在 NapCat“网络配置”中新建 WebSocket 客户端，URL 填写 {url}，消息格式选择 Array，并配置与本插件一致的 Token。使用部署脚本安装时，请核实已有配置。",
			tokenGenerate: "随机生成 Token",
			tokenCopy: "复制",
			tokenCopied: "已复制",
			tokenGenerated: "已经填进上面的框：先点「保存」，再把它填进 NapCat 的 WebSocket 客户端。离开页面后不会再显示。",
			tokenSet: "已设置 Token。",
			tokenUnset: "没有设置 Token，连接不校验。",
			platformId: "平台 ID",
			platformIdHint: "用于生成会话标识的首段，格式为“平台 ID:消息类型:会话 ID”。修改后同一 QQ 对话会映射到另一组 dsh 会话，请保持标识稳定。",
			wake: "唤醒",
			wakeHint: "群聊通过以下方式触发正式回复流程：@机器人、引用机器人的消息、正文包含唤醒词，或以唤醒前缀开头。仅 @全体成员不会触发；私聊默认无需唤醒。所有触发仍须遵守访问控制及相关限频规则，不额外调用独立判断模型。",
			wakePrefix: "唤醒前缀",
			wakePrefixHint: "消息以任一前缀开头时触发唤醒，默认前缀为 /。例如“/你好”会向模型提交“你好”；“/help”执行内置指令。多个前缀用空格或逗号分隔。清空后关闭前缀唤醒及依赖前缀的内置指令入口，@、引用和唤醒词仍可生效。",
			wakeKeywords: "唤醒词（群里）",
			wakeKeywordsHint: "群消息正文包含任一唤醒词时触发唤醒，无需额外 @。默认“大肥鱼、肥鱼”；多个词用空格或逗号分隔，英文不区分大小写。仅匹配真实正文，不匹配 @对象的昵称或 QQ 号，也不跨非正文消息段拼接。清空后关闭关键词唤醒，私聊规则不变。",
			friendNeedsPrefix: "私聊也需要唤醒前缀",
			ignoreSelf: "忽略她自己发出的消息",
			model: "交给模型的内容",
			identifier: "群消息前面加 [昵称(QQ号)]",
			identifierHint: "在提交给模型的群消息前附加发送者昵称和 QQ 号，格式为 [昵称(QQ号)]，用于区分发言人。此标识不改变消息权限，也不会作为额外内容发送到 QQ。",
			imageToModel: "图片交给模型",
			imageToModelHint: "将当前消息、引用消息及转发记录中的可读取图片提交给模型，包括以图片形式发送的商城表情。需要模型和宿主支持图片输入；图片数量受下方上限约束。",
			maxImages: "每条消息最多几张图片",
			maxImagesHint: "限制单条来信提交给模型的图片总数，包含正文图片、引用或转发图片及视频抽帧。0 表示不设数量上限；增加图片可能提高请求体积及模型用量。",
			session: "会话",
			workspacePath: "工作目录",
			workspacePathHint: "QQ 会话在 dsh 中使用的工作目录，应填写运行 dsh 的机器上的绝对路径。留空时使用 dsh 进程的当前目录；现有会话通常需重新创建才能应用。",
			agentPreset: "默认的 Agent 预设",
			agentPresetHint: "新建 QQ 会话使用的默认预设 ID。留空时跟随 dsh 默认预设；按会话类型设置的专用预设优先。现有会话可通过 /new 应用新的预设选择。",
			log: "日志",
			logLevel: "日志级别",
			logLevelHint: "控制插件运行日志的详细程度，默认 info。debug 包含原始消息及处理细节，可能包含聊天内容和账号标识，适用于临时排查问题。",
			friendNeedsPrefixHint: "启用后，私聊不再默认逐条触发模型，需满足唤醒前缀或其他已有唤醒条件。默认关闭。启用前请确保已配置可用前缀。",
			ignoreSelfHint: "忽略由机器人自身 QQ 账号发送并经 NapCat 回传的消息，例如同一账号在其他设备上的发言。启用后此类消息不触发回复。",
			test: "测试连接",
			testing: "测试中…",
			testUsesSaved: "测试用的是已保存的设置。",
			testOk: "已连接：{who}，Token 校验通过。",
			testOkNoToken: "已连接：{who}。没有设置 Token，任何人都能连。",
			testConnectedApiFailed: "NapCat 已连上，但调用接口没有成功：{error}",
			testRejectedMissing: "{minutes} 分钟内有 NapCat 来连接，但没带 Token。请在 NapCat 里填上和这里一致的 Token。",
			testRejectedWrong: "{minutes} 分钟内有 NapCat 来连接，但 Token 不对。请检查 NapCat 里填的 Token。",
			testNoClient: "插件正在监听 {address}，但还没有 NapCat 连上来。请在 NapCat 里新建 WebSocket 客户端并填对地址和 Token。",
			testNotListening: "插件没有在监听 {address}，可能端口被占用，请换一个端口。",
			testFailed: "测试失败：{error}",
			access: "访问控制",
			accessHint: "管理员在私聊及群内真实发言时自动豁免回复白名单和消息限频。普通群成员按群聊名单检查，其他人的私聊按私聊名单检查；群主动聊天和群存档不能继承管理员的豁免。",
			admins: "管理员 QQ 号",
			adminsHint: "填写拥有管理权限的 QQ 号，多个号码用空格或逗号分隔。管理员私聊和群内真实发言不受回复白名单及消息限频限制，无需加入白名单；名单外群聊仍不得存档。",
			whitelistEnabled: "启用白名单",
			whitelistEnabledHint: "默认开启。普通群消息仅允许群聊白名单中的群，普通私聊仅允许私聊白名单中的用户；对应名单为空时全部拒绝。管理员回复自动豁免。存档也遵守名单边界，名单外群包括管理员收发均不存档；关闭后取消名单限制。",
			groupWhitelist: "群聊白名单",
			groupWhitelistHint: "填写允许接收普通群成员消息及主动聊天的群号或完整群会话标识，多个值用空格或逗号分隔。白名单开启且列表为空时，不允许普通群回复或群主动聊天。管理员可触发回复，但名单外群的双方消息均不存档。",
			privateWhitelist: "其他人私聊白名单",
			privateWhitelistHint: "填写允许普通私聊的 QQ 号或完整私聊会话标识，多个值用空格或逗号分隔。管理员无需添加；白名单开启且列表为空时，仅管理员私聊可通过。",
			wlAdminGroup: "管理员始终豁免。群主动聊天仍查群白名单，不会因为管理员之前在群里说过话就放行。",
			wlLog: "不在白名单时记日志",
			wlLogHint: "记录因回复白名单检查而被拒绝的会话标识，便于核对访问配置。仅影响日志输出，不改变消息处理权限。",
			rateCount: "频率限制：最多几条",
			rateCountHint: "单个会话在指定时间窗口内允许进入回复流程的普通来信数量。默认 30 条，0 表示关闭此项入站限频；管理员来信自动豁免。",
			rateSeconds: "频率限制：时间窗口（秒）",
			rateSecondsHint: "入站限频的统计窗口，单位为秒，默认 60。与“最多几条”配合使用，不控制回复的发送间隔。",
			rateStrategy: "超出以后",
			rateStrategyHint: "达到入站限频上限后的处理方式。“排队”会等待窗口释放后继续处理；“丢弃”会跳过当前来信，不触发模型回复。",
			rateStall: "排队等",
			rateDiscard: "丢弃",
			invalidPositive: "请填正整数",
			emptyWaiting: "只 @ 她不说话时等下一条",
			emptyWaitingHint: "默认开启。收到仅 @机器人或仅包含唤醒前缀的消息时，等待同一发送者在 60 秒内发送下一条非空消息，并将其视为对机器人的继续发言。",
			emptyReply: "只 @ 她时先让她问一句",
			emptyReplyHint: "仅在“只 @ 她不说话时等下一条”开启时生效。收到仅 @或仅前缀的消息后，先请求模型生成一句询问；随后仍保留 60 秒的继续发言等待。",
			markAdmin: "告诉模型管理员身份",
			markAdminHint: "发送者为已配置管理员时，在模型输入中附加管理员身份说明。此项仅影响模型所见提示，实际管理员权限由账号配置决定。",
			markWake: "告诉模型「这条是在叫你」",
			markWakeHint: "群消息通过 @机器人或引用机器人消息触发时，向模型说明该消息指向机器人，并附上自身 QQ 号及可获取的群名片。仅补充身份和指向信息，不执行额外模型判断。",
			groupName: "告诉模型群名",
			groupNameHint: "在群消息的模型输入中附加当前群名称，帮助识别聊天场景。私聊不附加群名称。",
			datetime: "告诉模型当前时间",
			datetimeHint: "在模型输入中附加当前日期、时间和星期，按下方配置的时区生成。此项不会改变操作系统时间。",
			timezone: "时区",
			timezoneHint: "日期时间提示使用的 IANA 时区标识，默认 Asia/Shanghai。示例：Asia/Tokyo、Europe/London。请使用有效时区名称。",
			stt: "语音转文字",
			sttHint: "将已触发回复流程的语音消息转换为文字后提交给模型。可使用本机识别命令或 OpenAI 兼容转录接口；关闭时仅保留语音类型标记。语音转录本身不额外触发唤醒词匹配。",
			sttMode: "方式",
			sttOff: "关闭",
			sttCommandMode: "本机命令",
			sttOpenai: "OpenAI 兼容接口",
			sttCommand: "命令",
			sttCommandHint: "在 dsh 所在机器上执行的语音识别命令。{file} 会替换为已转换的 WAV 文件路径；标准输出作为识别文本。请确保命令已安装，并可由运行 dsh 的用户执行。",
			sttApiUrl: "接口地址",
			sttApiUrlHint: "语音转录服务的 OpenAI 兼容基础地址，通常填写至 /v1。插件会追加 /audio/transcriptions；无需填写完整转录接口路径。",
			sttApiKey: "接口 Key",
			sttApiKeyHint: "语音转录服务的 API Key。已保存的密钥不回显；留空保留现有值。请使用具有目标转录模型调用权限的凭据。",
			keySet: "已设置 Key。",
			keyUnset: "没有设置 Key。",
			sttModel: "模型",
			video: "视频",
			videoHint: "通过 ffmpeg 从视频中提取静态画面，并附加视频说明后提交给支持图片输入的模型。抽帧数量计入当前消息的图片上限；未启用或处理失败时保留视频类型标记。",
			videoFrames: "视频抽帧",
			videoFramesHint: "启用视频抽帧处理，需要可用的 ffmpeg 及图片输入能力。无法找到 ffmpeg 时跳过抽帧，不影响文字消息处理。",
			videoMaxFrames: "每个视频最多截几张",
			videoMaxFramesHint: "单个视频的抽帧数量上限，默认 4 张。实际数量还受视频时长、每帧时间间隔及消息图片总数限制；更多画面可能增加模型输入用量。",
			videoSecondsPerFrame: "短视频少截：每多少秒最多一张",
			videoSecondsPerFrameHint: "按视频时长限制抽帧密度，默认每 5 秒最多 1 张。例如约 10 秒的视频最多提取 2 张，仍受单视频抽帧上限约束。",
			videoMaxEdge: "截图最长边（像素）",
			videoMaxEdgeHint: "抽取画面缩放后的最长边，单位为像素，默认 1024。保持原始宽高比；更高分辨率会增加图片体积，实际识别效果取决于模型。",
			videoMaxMB: "超过多大只截封面（MB）",
			videoMaxMBHint: "视频文件大小阈值，默认 100 MB。超过阈值时仅尝试提取一张代表画面，以限制处理开销。",
			videoMaxMinutes: "超过多长只截封面（分钟）",
			videoMaxMinutesHint: "视频时长阈值，单位为分钟，默认 10。超过阈值时仅尝试提取一张代表画面。",
			videoTimeout: "处理超时（秒）",
			videoTimeoutHint: "单个视频处理允许的最长时间，单位为秒。超时后停止处理，并以视频类型标记继续构建模型输入。",
			ffmpegPath: "ffmpeg 位置",
			ffmpegPathHint: "可选的 ffmpeg 可执行文件绝对路径。留空时依次查找插件安装的版本和系统 PATH 中的版本；路径必须可由运行 dsh 的用户执行。",
			ffmpegChecking: "正在查找 ffmpeg…",
			ffmpegFound: "已找到 ffmpeg（{source}）：{path} · {version}",
			ffmpegPathAuto: "留空，自动用：{path}",
			ffmpegSourceConfigured: "上面填的位置",
			ffmpegSourceBundled: "插件目录",
			ffmpegSourceSystem: "系统里的",
			ffmpegMissing: "没找到 ffmpeg，视频只会写成「[视频]」。可以点下面的「安装 ffmpeg」（要能连上 GitHub）；服务器连不上 GitHub 时，用有管理员权限的用户运行 sudo apt install -y ffmpeg，再点「重新查找」。",
			ffmpegInstall: "安装 ffmpeg",
			ffmpegInstallConfirm: "从 GitHub（BtbN/FFmpeg-Builds）下载独立版 ffmpeg，大约 140MB，核对 SHA256 后放进插件目录，不需要管理员权限，也不改系统。现在安装吗？",
			ffmpegInstallYes: "确认安装",
			ffmpegInstallNo: "取消",
			ffmpegUnsupported: "一键安装只支持 Linux（x64 / arm64），这台机器是 {platform}。请自己安装 ffmpeg，例如 Mac 上运行 brew install ffmpeg。",
			ffmpegDownloading: "正在下载 {asset}：{percent}（{received} / {total} MB）",
			ffmpegVerifying: "正在核对 SHA256…",
			ffmpegExtracting: "正在解压…",
			ffmpegDone: "安装完成：{version}",
			ffmpegFailed: "安装失败：{error}",
			ffmpegRecheck: "重新查找",
			sessionHint: "工作目录和预设选择主要在创建会话时应用，现有会话可通过 /new 更新。模型及思考等级保存后，在会话下一次空闲时应用；正在生成的回复不立即切换。",
			tabsLabel: "设置分类",
			tab_conn: "连接和权限",
			tab_session: "会话和模型",
			tab_content: "消息内容",
			tab_send: "发消息",
			tab_log: "日志",
			tab_voice: "语音回复",
			ttsSec: "文字转语音",
			ttsSecHint: "将符合范围和触发条件的回复转换为 QQ 语音。每次合成优先使用 BreezeBlue，失败时尝试 Inworld；合成不可用时回退为文字。需要为服务配置有效凭据和音色。",
			ttsEnabled: "启用文字转语音",
			ttsMode: "什么时候用语音",
			ttsModeHint: "“她自己决定”依据模型输出中的 [语音] 标记选择语音；“每条都用语音”和“按概率”由插件选择。所有模式仍受会话范围、文本长度及服务可用性限制。",
			ttsModeTag: "她自己决定",
			ttsModeAlways: "每条都用语音",
			ttsModeChance: "按概率",
			ttsChance: "用语音的概率（%）",
			ttsChanceHint: "概率模式下，每次回复被选为语音输出的概率，范围 0～100%。按一次回复选择，不按字数分别抽样。",
			ttsWhereSub: "在哪些聊天里发语音",
			ttsAdminPrivate: "主人私聊",
			ttsPrivate: "其他私聊",
			ttsGroup: "群聊",
			ttsMaxChars: "一条语音最多几个字",
			ttsMaxCharsHint: "单段语音合成文本的字数上限。超过上限时发送文字，不执行该段语音合成。此项用于控制单条语音长度与合成用量。",
			ttsSpeed: "语速（%）",
			ttsSpeedHint: "语音合成速度百分比，范围 50～150，100 表示标准速度。具体效果取决于所选语音服务和音色。",
			ttsAlsoText: "发语音后再发一条文字",
			ttsStripParens: "念之前去掉括号里的动作",
			ttsStripParensHint: "合成前移除括号或动作标记中的描述，例如“（点头）”“*微笑*”，以减少动作文字被朗读。仅调整合成文本，不修改普通文字回复。",
			breezeSub: "BreezeBlue（先用这家）",
			inworldSub: "Inworld（BreezeBlue 这一条不行时用）",
			ttsApiKey: "API Key",
			breezeKeyHint: "BreezeBlue 账号的 API Key，用于语音合成身份验证。已保存的密钥不回显，留空保留现有值。",
			inworldKeyHint: "Inworld API Keys 页面提供的 Basic 身份验证凭据。填写服务提供的 Base64 字符串，无需再次编码；留空保留已保存的凭据。",
			ttsVoiceId: "音色 id",
			breezeVoiceHint: "BreezeBlue 音色标识，可使用账号有权访问的预设或克隆音色。音色须与所填 API Key 的权限匹配。",
			inworldVoiceHint: "Inworld 音色标识，可使用当前工作区有权访问的音色。音色须与身份验证凭据所属工作区匹配。",
			ttsModel: "模型",
			breezeModelHint: "BreezeBlue 语音合成模型标识。默认 breeze-tts-2；需要多语言合成时使用服务支持的多语言模型，并同时核对语言代码。",
			inworldModelHint: "Inworld 语音合成模型标识，须使用服务当前支持且账号有权访问的模型，例如 inworld-tts-2-flash 或 inworld-tts-2。",
			breezeLanguage: "语言代码",
			breezeLanguageHint: "BreezeBlue 合成语言代码，默认 zh。auto 表示自动识别，并使用多语言模型；其他语言代码应符合服务接口要求。",
			ttsTestText: "试听的句子",
			ttsTestDefault: "你好呀，这是语音测试。",
			ttsTestBreeze: "试听 BreezeBlue",
			ttsTestInworld: "试听 Inworld",
			ttsTestOk: "能用：{ms} 毫秒合成好。",
			ttsTestUsesForm: "试听使用当前页面填写的参数，无需先保存；密钥输入框为空时使用已保存的凭据。试听成功不代表未保存的修改已生效。",
			ttsTodaySub: "今天的情况",
			ttsToday: "BreezeBlue 念了 {breeze} 条（{breezeChars} 字），Inworld 念了 {inworld} 条（{inworldChars} 字），没念成改发文字 {failed} 条。",
			ttsFallback: "最近一次 BreezeBlue 没成功、改用了 Inworld：{time}，{text}",
			ttsLastError: "最近一次没念成：{time}，{text}",
			ttsRefresh: "刷新",
			ttsNeedKey: "两家都还没填全 Key 和音色 id，开了也不会发语音。",
			rateSub: "频率限制",
			presetSub: "预设",
			modelSub: "模型和思考等级",
			silenceSub: "主动唤醒",
			typingSub: "模拟打字",
			groupReplySub: "群聊回复对象",
			groupReplyMention: "回复时 @ 对方",
			groupReplyQuote: "回复时引用原消息",
			groupReplyHint: "两个选项默认均关闭，可独立启用。@对象及引用目标取自实际触发本轮的发送者和消息，分段时仅附加在首条文字。适用于群聊文字回复及内置指令，不附加到私聊、主动聊天或纯语音。",
			segmentSub: "分段发送",
			groupRateSub: "群里的发言频率",
			sttTest: "测试语音转文字",
			sttTestOk: "能用：{ms} 毫秒有回应（测试用的是一秒静音，转出来：{text}）。",
			sttTestEmpty: "空的，正常",
			silenceToken: "「不发」暗号",
			paceSec: "发消息节奏",
			paceHint: "控制正式回复及主动聊天回复的发送节奏，包括模拟打字等待、群消息间隔及窗口内数量限制。同一会话按顺序发送；其他插件直接代发的消息不经过此流程，管理员真实来信的回复豁免群限频。",
			typingPrivate: "私聊里模拟打字",
			typingGroup: "群里模拟打字",
			typingCharsPerMinute: "打字速度（每分钟几个字）",
			typingCharsPerMinuteHint: "按回复中非空白字符数计算模拟打字等待，默认每分钟 100 字；设为 0 时不等待。结果受最短和最长等待时间限制，分段发送还受分段等待上限约束。",
			typingMinSeconds: "最少等几秒",
			typingMaxSeconds: "最多等几秒",
			typingMaxSecondsHint: "单条文字回复的模拟打字等待上限，默认 10 秒。仅约束打字延迟，不包含模型生成时间或群限频等待；小于最短等待时按最短等待处理。",
			groupMinGapSeconds: "群里两条之间至少隔几秒",
			groupMaxPerWindow: "群里一段时间最多发几条",
			groupWindowSeconds: "这段时间是几秒",
			sendMaxWaitSeconds: "最多排队等几秒",
			sendMaxWaitSecondsHint: "为满足群发送频率限制允许等待的最长时间，默认 120 秒，不包含模拟打字时间。所需限频等待超过该值时跳过该条消息并记录日志；0 表示不接受额外限频等待。",
			segmentAdminPrivate: "管理员私聊分段发送",
			segmentPrivate: "其他私聊分段发送",
			segmentGroup: "群聊分段发送",
			segmentHint: "将一轮文字回复按换行拆分为多条 QQ 消息，代码块保持完整。各段分别应用发送节奏；超过分段数量上限的内容合并到最后一段。按会话类型分别启用。",
			segmentMax: "一次最多拆成几条",
			segmentMaxSeconds: "分段时每条最多等几秒",
			segmentMaxSecondsHint: "分段发送时，每段模拟打字等待的上限，默认 3 秒。仍受打字开关和最短等待约束；不包含模型生成或群限频等待时间。",
			segmentMaxHint: "单次回复拆分后的消息数量上限，默认 10。超过上限的剩余内容合并到最后一条，不直接删除正文。",
			silenceTokenHint: "模型回复去除首尾空白后，若以此标记开头，则整条回复不发送到 QQ。默认 [不发]，用于模型选择保持静默，也适用于主动聊天。留空关闭此标记过滤；本设置不会增加模型调用。",
			uniqueSession: "群里每人单独一个会话",
			uniqueSessionHint: "启用后，同一群内按发送者分别映射 dsh 会话，使各成员的正式对话历史分开。群聊消息存档及补充群上下文仍按群组织。",
			adminPrivatePreset: "管理员私聊用的预设",
			privatePreset: "私聊用的预设",
			groupPreset: "群聊用的预设",
			presetOverrideHint: "专用预设仅影响新建会话。管理员私聊依次回退至私聊预设、默认 QQ 预设、dsh 默认预设；其他私聊及群聊依次回退至默认 QQ 预设和 dsh 默认预设。留空表示继续回退。",
			adminPrivateModel: "管理员私聊用的模型",
			privateModel: "私聊用的模型",
			groupModel: "群聊用的模型",
			adminPrivateReasoning: "管理员私聊的思考等级",
			privateReasoning: "其他私聊的思考等级",
			groupReasoning: "群聊的思考等级",
			reasoningHint: "选择当前模型支持的思考等级。较高等级通常增加生成时间及思考用量，具体行为由模型决定。保存后在会话下一次空闲时应用，正在生成的回复结束后再切换。",
			reasoningOff: "不思考（off）",
			reasoningLow: "低（low）",
			reasoningHigh: "高（high）",
			reasoningMax: "最高（max）",
			commands: "指令",
			commandsHint: "启用后，通过已配置的唤醒前缀调用内置指令：/help 查看帮助、/sid 查看标识、/new 或 /reset 创建新会话、/stop 中止当前回复。示例使用默认前缀 /；群内新建或重置会话需要机器人管理员、群主或群管理员权限。",
			commandsEnabled: "启用 QQ 里的指令",
			noPermissionReply: "没有权限时回一句",
			noPermissionReplyHint: "无权限执行受限指令时，是否发送权限不足说明。关闭后静默忽略此类指令，不改变实际权限检查。",
			overridden: "已修改",
			reset: "恢复默认",
			invalid: "格式不对",
			invalidPort: "请填 1–65535 的整数",
			invalidCount: "请填 0 或正整数",
			readOnly: "本部署的设置为只读。",
			unavailable: "插件当前没有加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "没有保存成功，修改已保留，请检查后重试。",
			watchIntervalMinutesHint: "主动查询 NapCat 在线状态的间隔，单位为分钟，默认 2。下线通知和心跳事件仍会在收到时更新状态。",
			alertOnRecoverHint: "已报告的异常恢复后，通过已配置的通知渠道发送恢复通知。仅影响通知，不负责重新登录或修复连接。",
			mailEnabledHint: "启用邮件通知渠道。需配置可用的 SMTP 服务器、账号和授权凭据；仅启用本开关不会自动完成邮箱身份验证。",
			smtpHostHint: "发送通知邮件的 SMTP 服务器域名，不包含协议前缀或端口。例如 smtp.example.com；应与邮箱服务商配置一致。",
			smtpUserHint: "SMTP 身份验证账号，通常为完整发信邮箱地址；同时用作邮件发件人，且在未配置收件人时作为默认收件地址。",
			ttsEnabledHint: "文字转语音总开关，默认关闭。启用后仍需满足会话范围、语音模式、长度限制，并配置至少一个可用的合成服务。",
			ttsAlsoTextHint: "语音成功发送后，额外发送对应文字。关闭时成功合成的内容仅以语音发送；合成失败仍可回退文字。",
			ttsAdminPrivateHint: "允许管理员私聊使用语音回复。需同时启用文字转语音，并满足语音模式和长度限制。",
			ttsPrivateHint: "允许非管理员私聊使用语音回复。此项不影响管理员私聊的独立范围设置。",
			ttsGroupHint: "允许群聊回复使用语音。纯语音消息不附加群回复的 @或引用；同时发送文字时，文字部分可使用对应设置。",
			commandsEnabledHint: "启用内置 QQ 指令处理。关闭后不执行内置命令；仍满足唤醒条件的消息可按普通内容提交给模型。",
			sttModeHint: "选择语音转录方式：关闭、本机命令或 OpenAI 兼容接口。本机命令在 dsh 主机执行；接口方式会向所配置的服务发送音频。",
			typingPrivateHint: "对私聊回复应用按文字长度计算的模拟打字延迟。关闭后跳过此项延迟，不影响模型生成时间。",
			typingGroupHint: "对群聊回复应用模拟打字延迟。关闭后群发送频率限制仍可生效。",
			typingMinSecondsHint: "启用模拟打字且速度大于 0 时，单条文字的最短等待时间，默认 1 秒。分段发送也使用此下限。",
			segmentPrivateHint: "对非管理员私聊启用按换行分段发送。管理员私聊由其独立选项控制。",
			segmentGroupHint: "对群聊文字回复启用按换行分段发送。各段仍遵守适用的打字延迟和群发送频率限制。",
			groupMinGapSecondsHint: "同一群内普通回复消息的最短发送间隔，默认 5 秒，0 表示不限制此间隔。管理员真实来信的回复豁免群限频。",
			groupMaxPerWindowHint: "同一群在发送统计窗口内最多发送的普通回复消息数，默认 5 条，0 表示关闭数量限制。分段消息按实际发送条数计数。",
			groupWindowSecondsHint: "群发送数量限制的统计窗口，单位为秒，默认 60。与“群里一段时间最多发几条”配合使用。",
		};
		var en = {
			nudgeOnEmpty: "Nudge her when she says nothing",
			nudgeOnEmptyHint: "When a model turn ends without reply text, send one follow-up requesting a reply or the silence token. Enabled by default; cancelled turns are excluded. This may add one model call.",
			alertTestUsesForm: "Uses what is on the page now (saved or not); remember to save.",
			unsavedBar: "Unsaved changes: click Save to apply; leaving the page discards them",
			discardChanges: "Discard",
			watchSec: "Offline alerts",
			watchSecHint: "Monitor QQ availability and the NapCat connection, and notify configured email or push channels. Notifications require the dsh process to remain running.",
			watchLoading: "Loading…",
			watchBot: "QQ account",
			watchState_ok: "{who} is online",
			watchState_offline: "{who} is offline (since {since})",
			watchState_disconnected: "NapCat is not connected (since {since})",
			watchState_unknown: "Unknown whether {who} is online (since {since})",
			watchReason: ". Reason: {reason}",
			watchLastAlert: "Last alert: {time} · {kind} · {results}",
			watchKindProblem: "offline",
			watchKindRecovered: "recovered",
			watchNoChannel: "no alert channel set",
			watchCheckNow: "Check now",
			watchBannerHint: "Check the account login in the NapCat management page. Connection and notification settings are under Connection and permissions → Offline alerts.",
			watchEnabled: "Detect offline",
			watchEnabledHint: "Combine offline notices, heartbeats, and scheduled API queries to detect problems. Disabling this setting stops outage and recovery alerts.",
			watchInterval: "Check every (minutes)",
			watchGrace: "Alert after (minutes)",
			watchGraceHint: "Wait this many minutes before alerting on a persistent connection problem. The same grace applies at startup; explicit offline states can alert immediately after startup grace.",
			alertRepeat: "Repeat every (hours)",
			alertRepeatHint: "Repeat alerts at this interval in hours while a problem persists. Set to 0 to alert only once per outage.",
			alertOnRecover: "Send a \"recovered\" message",
			mailSub: "Email",
			mailEnabled: "Email alerts",
			mailPreset: "Mailbox",
			mailPresetHint: "Selecting a mail preset fills the SMTP host and port. Configure authentication separately, using an SMTP authorization code where required.",
			mailPresetCustom: "Custom",
			mailGetCode: "Get a code ↗",
			smtpHost: "SMTP server",
			smtpPort: "Port",
			smtpPortHint: "Use the port required by the SMTP service. Port 465 uses implicit TLS; port 587 typically negotiates STARTTLS.",
			smtpUser: "Sender address",
			mailTo: "Recipient",
			mailToHint: "Recipient address for alert emails. Leave blank to send alerts to the sender address.",
			smtpPass: "Authorization code",
			smtpPassHint: "Password or authorization code for SMTP authentication. Stored credentials are not displayed; leaving the input blank retains the saved value.",
			secretSet: "Set.",
			secretUnset: "Not set.",
			mailTest: "Send a test email",
			pushSub: "WeChat push",
			pushService: "Push service",
			pushServiceHint: "Select ServerChan or PushPlus and provide its SendKey or token. Notifications pass through that service; quotas and terms are defined by the provider.",
			pushOff: "Off",
			pushGetKey: "Get a key ↗",
			pushKeyHint: "Enter the SendKey or token required by the selected push service. Stored credentials are not displayed; blank retains the saved value.",
			pushTest: "Send a test push",
			reasoningMinimal: "Minimal",
			reasoningMedium: "Medium",
			reasoningUnsupported: " (not supported)",
			reasoningNone: "This model's reasoning cannot be adjusted.",
			dshModelsFailed: "Could not read dsh models: {error}",
			loadingModels: "Loading…",
			modelBlankDefault: "Not set (dsh's default model)",
			modelBlankAdmin: "Not set (use the other-private setting, then dsh default)",
			modelPickHint: "Select a model configured in dsh Settings → Models. Changes apply when the affected session is next idle; an active reply finishes first and conversation history is retained.",
			langIsEn: "1",
			provider: "Provider",
			providerHint: "Select a provider preset to fill the base URL and common models. For a custom OpenAI-compatible service, enter its base URL, usually ending in /v1, without an endpoint suffix.",
			providerSearch: "Search providers",
			providerCustom: "Custom (OpenAI compatible)",
			providerGetKey: "Get a key ↗",
			pModelHint: "Fetch models using the current or saved credentials. Presets remain available if fetching fails, and model IDs may be entered manually. Listing a model does not guarantee access.",
			modelFetch: "Fetch models",
			modelFetching: "Fetching…",
			modelFetched: "Found {n} usable models.",
			modelFetchedAll: "Found {n} models (could not tell which fit, showing all).",
			modelFetchFailed: "Could not list models: {error}. Showing common ones.",
			modelManual: "Type a model…",
			modelManualLabel: "Model name",
			modelPickList: "Pick from list",
			summary: "Connect NapCat (OneBot v11) to dsh, a port of AstrBot's aiocqhttp adapter.",
			connection: "Connection",
			connectionHint: "This plugin hosts the reverse WebSocket server. Configure a NapCat WebSocket client for ws://<host>:<port>/ws with a matching token. Changing the host or port restarts the listener and requires reconnection.",
			host: "Listen address",
			hostHint: "Reverse WebSocket bind address. The default 0.0.0.0 listens on all local interfaces; 127.0.0.1 limits access to this machine. Firewall and security-group rules also apply.",
			port: "Port",
			portHint: "Reverse WebSocket port, default 6199. Enter an unused integer from 1 to 65535 and use the same port in NapCat.",
			token: "Token",
			tokenHint: "Authentication token for the reverse WebSocket connection; it must match NapCat. A blank input retains the saved token. No token authentication is performed if none is configured.",
			napcatSetupHint: "Create a WebSocket client in NapCat Network settings with URL {url}, Array message format, and a matching token. Verify existing settings if installed by a deployment script.",
			tokenGenerate: "Generate token",
			tokenCopy: "Copy",
			tokenCopied: "Copied",
			tokenGenerated: "Put into the field above: click Save, then paste it into NapCat's WebSocket client. It is not shown again after you leave.",
			tokenSet: "A token is set.",
			tokenUnset: "No token: connections are not checked.",
			platformId: "Platform ID",
			platformIdHint: "First component of conversation IDs, formatted as platform:type:conversation. Changing it maps existing QQ conversations to a different set of dsh sessions; keep it stable.",
			wake: "Wake",
			wakeHint: "Group messages enter the reply flow by mentioning the bot, quoting its message, containing a wake word in text, or starting with a wake prefix. Mentioning everyone alone does not wake it. Private messages wake by default. Access and rate rules still apply; there is no separate judgment model.",
			wakePrefix: "Wake prefixes",
			wakeKeywords: "Wake words (groups)",
			wakeKeywordsHint: "Any configured word in group-message text wakes the bot without a mention. Defaults are 大肥鱼 and 肥鱼. Separate words with spaces or commas; matching is case-insensitive. Mention names and QQ IDs are excluded, and words are not joined across non-text segments. Clearing the list disables keyword wake only.",
			wakePrefixHint: "A message starting with a configured prefix wakes the bot; the default is /. For example, /hello submits hello, while /help invokes a command. Separate prefixes with spaces or commas. Clearing the list disables prefix wake and prefixed commands; mentions, quotes, and wake words remain available.",
			friendNeedsPrefix: "Private chats need a wake prefix too",
			ignoreSelf: "Ignore messages she sent herself",
			model: "What the model receives",
			identifier: "Prefix group messages with [nickname(QQ)]",
			identifierHint: "Prefix group input to the model with [nickname(QQ ID)] to identify the sender. This does not change permissions or add text to the QQ reply.",
			imageToModel: "Send images to the model",
			imageToModelHint: "Submit readable images from the current message, quotes, and forwarded records, including image-based stickers. The model and host must support images; the image limit below applies.",
			maxImages: "Max images per message",
			maxImagesHint: "Limit images submitted per incoming message, including direct, quoted, forwarded, and video-frame images. Set to 0 for no count limit. More images can increase request size and model usage.",
			session: "Sessions",
			workspacePath: "Working directory",
			workspacePathHint: "Absolute workspace path on the machine running dsh. Blank uses the process working directory. Existing sessions generally need to be recreated to adopt a new path.",
			agentPreset: "Agent preset",
			agentPresetHint: "Default preset ID for new QQ sessions. Blank follows the dsh default; per-conversation-type overrides take priority. Use /new to apply a new preset to an existing conversation.",
			log: "Logging",
			logLevel: "Log level",
			logLevelHint: "Set runtime log verbosity; the default is info. Debug includes raw messages and processing details, potentially including chat content and account IDs, and is intended for troubleshooting.",
			friendNeedsPrefixHint: "When enabled, private messages no longer wake the model automatically and must satisfy a prefix or another existing wake condition. Disabled by default; configure a usable prefix first.",
			ignoreSelfHint: "Ignore messages sent by the bot's own QQ account and relayed by NapCat, including messages from another device using that account. They will not trigger replies.",
			test: "Test connection",
			testing: "Testing…",
			testUsesSaved: "The test uses the saved settings.",
			testOk: "Connected: {who}; token accepted.",
			testOkNoToken: "Connected: {who}. No token is set, so anyone can connect.",
			testConnectedApiFailed: "NapCat is connected but the API call failed: {error}",
			testRejectedMissing: "Within {minutes} min a NapCat tried to connect without a token. Set the same token in NapCat.",
			testRejectedWrong: "Within {minutes} min a NapCat tried to connect with a wrong token. Check the token in NapCat.",
			testNoClient: "Listening on {address}, but no NapCat has connected. Add a WebSocket client in NapCat with this address and token.",
			testNotListening: "Not listening on {address}; the port may be in use. Try another port.",
			testFailed: "Test failed: {error}",
			access: "Access control",
			accessHint: "Administrators' direct messages and actual group messages bypass reply allowlists and message rate limits. Ordinary group and private messages use separate allowlists; proactive group activity and group archiving do not inherit administrator exemptions.",
			admins: "Admin QQ numbers",
			adminsHint: "QQ IDs with administrative privileges, separated by spaces or commas. Their direct and actual group messages bypass reply allowlists and rate limits without allowlist entries. Unlisted groups still cannot be archived.",
			whitelistEnabled: "Enable allowlist",
			whitelistEnabledHint: "Enabled by default. Ordinary group and private messages require their respective allowlist entries; an empty list denies that category. Administrator replies are exempt. Archiving also follows these lists, with no administrator exemption for unlisted groups. Disabling removes allowlist restrictions.",
			groupWhitelist: "Group allowlist",
			groupWhitelistHint: "Group IDs or full group conversation IDs allowed for ordinary replies and proactive chat, separated by spaces or commas. With allowlists enabled, an empty list denies both. Administrators may trigger replies in unlisted groups, but neither side is archived there.",
			privateWhitelist: "Other private chats allowlist",
			privateWhitelistHint: "QQ IDs or full private conversation IDs allowed for non-administrator private chats, separated by spaces or commas. Administrators need no entry. With allowlists enabled, an empty list permits administrator private chats only.",
			wlAdminGroup: "Admins always bypass. Proactive group chats still need the group allowlist and cannot inherit a previous admin message.",
			wlLog: "Log blocked chats",
			wlLogHint: "Log conversation IDs rejected by reply allowlist checks. This helps verify access settings and does not alter permissions.",
			rateCount: "Rate limit: max messages",
			rateCountHint: "Maximum ordinary incoming messages processed per conversation within the configured window. Default: 30. Set to 0 to disable this inbound limit. Administrator messages are exempt.",
			rateSeconds: "Rate limit: window (seconds)",
			rateSecondsHint: "Inbound rate-limit window in seconds, default 60. Used with the message-count limit; it does not set reply delivery spacing.",
			rateStrategy: "When exceeded",
			rateStrategyHint: "Action when the inbound limit is reached. Queue waits for capacity; discard skips the incoming message without invoking the reply model.",
			rateStall: "Queue",
			rateDiscard: "Drop",
			invalidPositive: "Enter a positive integer",
			emptyWaiting: "Wait after an empty mention",
			emptyWaitingHint: "Enabled by default. After a bare bot mention or wake prefix, treat the same sender's next nonempty message within 60 seconds as a continuation directed to the bot.",
			emptyReply: "Ask back on an empty mention",
			emptyReplyHint: "Applies only when waiting after a bare mention is enabled. Request a brief inquiry from the model after a bare mention or prefix, while retaining the 60-second continuation window.",
			markAdmin: "Tell the model about admins",
			markAdminHint: "Add an administrator-role note to model input for configured administrators. This affects the prompt only; account configuration determines permissions.",
			markWake: "Tell the model it was called",
			markWakeHint: "For group messages mentioning or quoting the bot, state that the message addresses it and include its QQ ID and available group card. This adds prompt context without a separate judgment call.",
			groupName: "Tell the model the group name",
			groupNameHint: "Include the current group name in group-message input to identify the conversation setting. Not applied to private chats.",
			datetime: "Tell the model the time",
			datetimeHint: "Include the current date, time, and weekday using the configured timezone. This does not modify the operating-system clock.",
			timezone: "Time zone",
			timezoneHint: "IANA timezone used for date and time notes, default Asia/Shanghai. Examples include Asia/Tokyo and Europe/London. Use a valid timezone identifier.",
			stt: "Speech to text",
			sttHint: "Transcribe voice messages already admitted to the reply flow using a local command or an OpenAI-compatible API. When disabled, only a voice placeholder remains. Transcription does not add another wake-word check.",
			sttMode: "Method",
			sttOff: "Off",
			sttCommandMode: "Local command",
			sttOpenai: "OpenAI-compatible API",
			sttCommand: "Command",
			sttCommandHint: "Speech-recognition command run on the dsh host. {file} is replaced with the converted WAV path; standard output becomes the transcript. The command must be installed and executable by the dsh user.",
			sttApiUrl: "API base URL",
			sttApiUrlHint: "OpenAI-compatible transcription base URL, usually ending in /v1. The plugin appends /audio/transcriptions; omit the endpoint suffix.",
			sttApiKey: "API key",
			sttApiKeyHint: "API key for the transcription service, with access to the selected model. Saved keys are not displayed; blank retains the stored value.",
			keySet: "A key is set.",
			keyUnset: "No key is set.",
			sttModel: "Model",
			video: "Video",
			videoHint: "Extract still frames with ffmpeg and submit them with a video description to an image-capable model. Frames count toward the per-message image limit. Disabled or failed processing leaves a video placeholder.",
			videoFrames: "Grab video frames",
			videoFramesHint: "Enable video-frame extraction. Requires ffmpeg and image-input support. If ffmpeg is unavailable, extraction is skipped without affecting text messages.",
			videoMaxFrames: "Max frames per video",
			videoMaxFramesHint: "Maximum extracted frames per video, default 4. Duration, seconds-per-frame, and the message image limit may reduce the count. More frames may increase model input usage.",
			videoSecondsPerFrame: "Short videos: at most one frame per N seconds",
			videoSecondsPerFrameHint: "Limit extraction density by duration, default one frame per 5 seconds. A roughly 10-second video yields at most 2 frames, subject to the per-video maximum.",
			videoMaxEdge: "Frame long edge (px)",
			videoMaxEdgeHint: "Longest edge of extracted frames in pixels, default 1024, preserving aspect ratio. Higher resolution increases image size; recognition quality depends on the model.",
			videoMaxMB: "Cover only above (MB)",
			videoMaxMBHint: "Video size threshold, default 100 MB. Above this threshold, extraction is limited to one representative frame to bound processing cost.",
			videoMaxMinutes: "Cover only above (minutes)",
			videoMaxMinutesHint: "Video duration threshold in minutes, default 10. Longer videos are limited to one representative frame.",
			videoTimeout: "Timeout (seconds)",
			videoTimeoutHint: "Maximum video-processing time in seconds. On timeout, processing stops and model input retains a video placeholder.",
			ffmpegPath: "ffmpeg path",
			ffmpegPathHint: "Optional absolute path to the ffmpeg executable. Blank searches the plugin-installed version, then system PATH. The executable must be accessible to the dsh user.",
			ffmpegChecking: "Looking for ffmpeg…",
			ffmpegFound: "ffmpeg found ({source}): {path} · {version}",
			ffmpegPathAuto: "Blank, using: {path}",
			ffmpegSourceConfigured: "configured path",
			ffmpegSourceBundled: "plugin directory",
			ffmpegSourceSystem: "system",
			ffmpegMissing: "ffmpeg not found; videos become [视频]. Use Install below (needs GitHub access), or run sudo apt install -y ffmpeg on the server and click Check again.",
			ffmpegInstall: "Install ffmpeg",
			ffmpegInstallConfirm: "Download a static ffmpeg (about 140 MB) from GitHub BtbN/FFmpeg-Builds, verify its SHA256 and put it in the plugin directory. No admin rights needed and the system is not changed. Install now?",
			ffmpegInstallYes: "Install",
			ffmpegInstallNo: "Cancel",
			ffmpegUnsupported: "One-click install supports Linux (x64 / arm64) only; this machine is {platform}. Install ffmpeg yourself, e.g. brew install ffmpeg on a Mac.",
			ffmpegDownloading: "Downloading {asset}: {percent} ({received} / {total} MB)",
			ffmpegVerifying: "Verifying SHA256…",
			ffmpegExtracting: "Extracting…",
			ffmpegDone: "Installed: {version}",
			ffmpegFailed: "Install failed: {error}",
			ffmpegRecheck: "Check again",
			sessionHint: "Workspace and preset settings mainly apply at session creation; use /new for existing sessions. Saved model and reasoning changes apply when a session is next idle, after any current reply finishes.",
			tabsLabel: "Settings sections",
			tab_conn: "Connection & access",
			tab_session: "Sessions & models",
			tab_content: "Message content",
			tab_send: "Sending",
			tab_log: "Log",
			tab_voice: "Voice replies",
			ttsSec: "Text to speech",
			ttsSecHint: "Convert eligible replies into QQ voice messages. Each synthesis tries BreezeBlue first, then Inworld on failure; unavailable synthesis falls back to text. Valid credentials and voice IDs are required.",
			ttsEnabled: "Enable text to speech",
			ttsMode: "When to use voice",
			ttsModeHint: "Model-directed mode uses the [语音] marker; always and probability modes are chosen by the plugin. All modes respect conversation scope, text length, and service availability.",
			ttsModeTag: "She decides",
			ttsModeAlways: "Every reply",
			ttsModeChance: "By chance",
			ttsChance: "Chance of voice (%)",
			ttsChanceHint: "Probability of selecting a reply for voice output in probability mode, from 0 to 100 percent. Selection is made per reply, not per character.",
			ttsWhereSub: "Where to send voice",
			ttsAdminPrivate: "Admin private chat",
			ttsPrivate: "Other private chats",
			ttsGroup: "Groups",
			ttsMaxChars: "Max characters per voice message",
			ttsMaxCharsHint: "Maximum text length for one voice-synthesis segment. Longer segments are sent as text without synthesis, limiting voice duration and usage.",
			ttsSpeed: "Speed (%)",
			ttsSpeedHint: "Synthesis speed from 50 to 150 percent; 100 is normal speed. The result depends on the service and voice.",
			ttsAlsoText: "Also send the text after the voice",
			ttsStripParens: "Skip actions in brackets",
			ttsStripParensHint: "Remove parenthesized or action-marked descriptions such as （nods） or *smiles* before synthesis. Applies to speech text only, not ordinary text replies.",
			breezeSub: "BreezeBlue (tried first)",
			inworldSub: "Inworld (fallback)",
			ttsApiKey: "API key",
			breezeKeyHint: "BreezeBlue account API key for speech synthesis. Stored keys are not displayed; blank retains the saved value.",
			inworldKeyHint: "Basic authentication credentials from Inworld API Keys. Enter the supplied Base64 string without encoding it again. Blank retains the saved value.",
			ttsVoiceId: "Voice ID",
			breezeVoiceHint: "BreezeBlue voice ID for a preset or cloned voice accessible to the account. Access must match the configured API key.",
			inworldVoiceHint: "Inworld voice ID accessible to the current workspace. It must match the workspace authorized by the credentials.",
			ttsModel: "Model",
			breezeModelHint: "BreezeBlue synthesis model ID, default breeze-tts-2. For multilingual synthesis, use a supported multilingual model and verify the language setting.",
			inworldModelHint: "Inworld synthesis model ID. Use a currently supported model available to the account, such as inworld-tts-2-flash or inworld-tts-2.",
			breezeLanguage: "Language code",
			breezeLanguageHint: "BreezeBlue language code, default zh. Auto detects the language and uses the multilingual model. Other codes must be supported by the service.",
			ttsTestText: "Sentence to preview",
			ttsTestDefault: "你好呀，这是语音测试。",
			ttsTestBreeze: "Preview BreezeBlue",
			ttsTestInworld: "Preview Inworld",
			ttsTestOk: "Works: synthesized in {ms} ms.",
			ttsTestUsesForm: "Preview uses current form values without requiring a save; blank key inputs use saved credentials. A successful preview does not save pending edits.",
			ttsTodaySub: "Today",
			ttsToday: "BreezeBlue spoke {breeze} ({breezeChars} chars), Inworld {inworld} ({inworldChars} chars), {failed} fell back to text.",
			ttsFallback: "Last time BreezeBlue failed and Inworld was used: {time}, {text}",
			ttsLastError: "Last failure: {time}, {text}",
			ttsRefresh: "Refresh",
			ttsNeedKey: "Neither provider has both a key and a voice ID yet, so no voice will be sent.",
			rateSub: "Rate limit",
			presetSub: "Presets",
			modelSub: "Models & reasoning",
			silenceSub: "Wake-ups",
			typingSub: "Typing",
			groupReplySub: "Group reply target",
			groupReplyMention: "Mention the sender in replies",
			groupReplyQuote: "Quote the original message",
			groupReplyHint: "Both options default to off and are independent. Mention and quote targets come from the actual triggering sender and message, on the first text segment only. Applies to group text replies and built-in commands, not private, proactive, or voice-only output.",
			segmentSub: "Splitting",
			groupRateSub: "Group message rate",
			sttTest: "Test speech-to-text",
			sttTestOk: "Works: answered in {ms} ms (tested with one second of silence; result: {text}).",
			sttTestEmpty: "empty, as expected",
			silenceToken: "Silence token",
			paceSec: "Sending rhythm",
			paceHint: "Control delivery pacing for model and proactive replies: typing delay, group spacing, and window limits. Each conversation is queued in order. Direct service sends bypass this flow; replies to actual administrator messages bypass group rate limits.",
			typingPrivate: "Simulate typing in private chats",
			typingGroup: "Simulate typing in groups",
			typingCharsPerMinute: "Typing speed (chars/min)",
			typingCharsPerMinuteHint: "Typing delay is calculated from non-whitespace characters, default 100 per minute. Set to 0 for no typing delay. Minimum, maximum, and per-segment caps also apply.",
			typingMinSeconds: "Minimum wait (s)",
			typingMaxSeconds: "Maximum wait (s)",
			typingMaxSecondsHint: "Maximum simulated typing delay per text reply, default 10 seconds. Excludes model generation and group rate waiting. Values below the minimum are treated as the minimum.",
			groupMinGapSeconds: "Min gap between group messages (s)",
			groupMaxPerWindow: "Max group messages per window",
			groupWindowSeconds: "Window (s)",
			sendMaxWaitSeconds: "Max queue wait (s)",
			sendMaxWaitSecondsHint: "Maximum wait for group delivery rate limits, default 120 seconds, excluding typing delay. Messages requiring a longer rate wait are skipped and logged. Zero permits no additional rate wait.",
			segmentAdminPrivate: "Split replies in admin private chats",
			segmentPrivate: "Split replies in other private chats",
			segmentGroup: "Split replies in groups",
			segmentHint: "Split reply text at line breaks into multiple QQ messages while preserving code blocks. Apply pacing to each segment; overflow is merged into the final segment. Enable separately for each conversation category.",
			segmentMax: "Max messages per reply",
			segmentMaxSeconds: "Max wait per part (s)",
			segmentMaxSecondsHint: "Maximum typing delay for each split segment, default 3 seconds. Typing switches and the minimum delay still apply. Excludes model generation and group rate waiting.",
			segmentMaxHint: "Maximum messages produced from a split reply, default 10. Remaining content is merged into the final message rather than removed.",
			silenceTokenHint: "Suppress the entire QQ reply when trimmed model text starts with this token. Default: [不发], also used for proactive silence. Blank disables token filtering. This setting adds no model call.",
			uniqueSession: "One session per person in groups",
			uniqueSessionHint: "Map each sender in a group to a separate dsh session, separating formal conversation histories. Group archives and supplementary group context remain organized by group.",
			adminPrivatePreset: "Preset for admin private chats",
			privatePreset: "Preset for private chats",
			groupPreset: "Preset for group chats",
			presetOverrideHint: "Preset overrides apply to new sessions. Administrator private chats fall back through private, default QQ, then dsh defaults; other private and group chats fall back through default QQ and dsh defaults. Blank continues fallback.",
			adminPrivateModel: "Model for admin private chats",
			privateModel: "Model for private chats",
			groupModel: "Model for group chats",
			adminPrivateReasoning: "Reasoning for admin private chats",
			privateReasoning: "Reasoning for other private chats",
			groupReasoning: "Reasoning for group chats",
			reasoningHint: "Select a reasoning effort supported by the model. Higher effort typically increases latency and reasoning usage, depending on the model. Changes apply when the session is next idle after any current reply.",
			reasoningOff: "Off",
			reasoningLow: "Low",
			reasoningHigh: "High",
			reasoningMax: "Max",
			commands: "Commands",
			commandsHint: "Enable commands through a configured wake prefix: /help for help, /sid for IDs, /new or /reset for a new session, and /stop to cancel a reply. Examples use the default /. Creating or resetting a group session requires bot-administrator, group-owner, or group-administrator privileges.",
			commandsEnabled: "Enable QQ commands",
			noPermissionReply: "Reply when not permitted",
			noPermissionReplyHint: "Send an explanation when a restricted command is denied. When disabled, denied commands are ignored silently; permission checks remain in effect.",
			overridden: "Changed",
			reset: "Reset",
			invalid: "Invalid value",
			invalidPort: "Enter an integer from 1 to 65535",
			invalidCount: "Enter 0 or a positive integer",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "The plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "Not saved; your edits are kept for you to correct.",
			watchIntervalMinutesHint: "Scheduled NapCat status-query interval in minutes, default 2. Offline notices and heartbeat events still update state as they arrive.",
			alertOnRecoverHint: "Send a recovery notice through configured channels after an alerted outage ends. This setting does not repair the connection or log the account in.",
			mailEnabledHint: "Enable email notifications. Requires a valid SMTP server, account, and credentials; this switch does not configure authentication.",
			smtpHostHint: "SMTP host for alert emails, without a protocol prefix or port, such as smtp.example.com. Use the host specified by the mail provider.",
			smtpUserHint: "SMTP authentication account, usually the full sender email address. It is also used as the sender and as the default recipient when none is configured.",
			ttsEnabledHint: "Master text-to-speech switch, disabled by default. Enabled output still requires an allowed conversation scope, mode, length, and a usable synthesis service.",
			ttsAlsoTextHint: "Send corresponding text after a voice message succeeds. When disabled, successfully synthesized content is voice-only; synthesis failures may still fall back to text.",
			ttsAdminPrivateHint: "Allow voice replies in administrator private chats, subject to the master TTS switch, mode, and length limit.",
			ttsPrivateHint: "Allow voice replies in non-administrator private chats. Administrator private chats use their separate scope setting.",
			ttsGroupHint: "Allow voice replies in groups. Voice-only messages do not carry mention or quote prefixes; accompanying text may use the configured prefixes.",
			commandsEnabledHint: "Enable built-in QQ commands. When disabled, commands are not executed; messages satisfying wake rules may still be submitted as ordinary input.",
			sttModeHint: "Choose disabled, local-command, or OpenAI-compatible transcription. Local commands run on the dsh host; API mode sends audio to the configured service.",
			typingPrivateHint: "Apply length-based simulated typing delay to private replies. Disabling skips this delay without affecting model generation time.",
			typingGroupHint: "Apply simulated typing delay to group replies. Group delivery rate limits can still apply when this is disabled.",
			typingMinSecondsHint: "Minimum typing delay per text message when typing simulation is enabled and speed is positive, default 1 second. Also applies to split segments.",
			segmentPrivateHint: "Enable line-based message splitting for non-administrator private chats. Administrator private chats use their separate switch.",
			segmentGroupHint: "Enable line-based splitting for group text replies. Each segment still follows applicable typing and group delivery limits.",
			groupMinGapSecondsHint: "Minimum spacing between ordinary reply messages in a group, default 5 seconds. Zero disables spacing. Replies to actual administrator messages are exempt from group rate limits.",
			groupMaxPerWindowHint: "Maximum ordinary reply messages per group delivery window, default 5. Zero disables the count limit. Split messages count individually.",
			groupWindowSecondsHint: "Group delivery-count window in seconds, default 60. Used with the maximum messages per window setting.",
		};

		var CSS = [
			".napcatb-section{display:grid;gap:12px;padding:4px 0 8px}",
			".napcatb-section,.napcatb-details+.napcatb-section{border-top:.5px solid var(--dsw-alias-border-l3);padding-top:16px}",
			".napcatb-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;margin:0}",
			".napcatb-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}",
			".napcatb-tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;border-bottom:.5px solid var(--dsw-alias-border-l3);margin:0 0 4px;position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,inherit))}",
			".napcatb-tabs::-webkit-scrollbar{display:none}",
			".napcatb-tab{flex:none;padding:9px 12px 8px;border:none;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer;border-radius:0}",
			".napcatb-tab:hover{color:var(--dsw-alias-label-primary)}",
			".napcatb-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-label-primary)}",
			".napcatb-tab:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:-2px}",
			".napcatb-tabs + .napcatb-section,.napcatb-tabs + .napcatb-details{border-top:none;margin-top:8px}",
			".napcatb-subtitle{color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600;margin:6px 0 0}",
			".napcatb-banner{display:grid;gap:4px;margin:0 0 12px;padding:10px 12px;border-radius:12px;border:.5px solid var(--dsw-alias-state-error-primary,#e03131);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e03131) 12%,transparent);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:1.5}",
			".napcatb-banner .napcatb-hint{font-weight:400}",
			".napcatb-modelRow{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:12px 16px;align-items:end}",
			"@media (max-width:520px){.napcatb-modelRow{grid-template-columns:1fr}}",
			".napcatb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 16px;align-items:end}",
			".napcatb-grid>*{padding-top:0!important;padding-bottom:0!important;border-top:none!important;margin:0!important;min-width:0}",
			".napcatb-grid>*>:first-child{flex-wrap:wrap;row-gap:2px}",
			".napcatb-grid .napcatb-select{width:100%;min-width:0}",
			".napcatb-labelText{display:inline-flex;align-items:center;gap:3px;line-height:20px}",
			".napcatb-tip{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;margin-top:0;border-radius:50%;border:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary);font-size:9px;font-weight:600;line-height:1;cursor:help;user-select:none}",
			".napcatb-tip:hover,.napcatb-tip:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary);outline:none}",
			".napcatb-toggleRow{color:var(--dsw-alias-label-primary);justify-content:space-between;align-items:center;gap:16px;font-size:13px;line-height:1.5;display:flex}",
			".napcatb-field{display:grid;gap:6px}",
			".napcatb-label{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;min-height:20px}",
			".napcatb-select{justify-self:start;min-width:160px;height:35px;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;padding:0 12px;font:inherit;font-size:13px}",
			".napcatb-details{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px);padding:0 14px}",
			".napcatb-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 0;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}",
			".napcatb-summary::-webkit-details-marker{display:none}",
			".napcatb-chevron{display:inline-block;color:var(--dsw-alias-label-tertiary);transition:transform .15s ease;font-size:16px;line-height:1}",
			".napcatb-details[open] .napcatb-chevron{transform:rotate(90deg)}",
			".napcatb-detailsBody{display:grid;gap:12px;padding:4px 0 16px}",
			".napcatb-test{display:grid;gap:6px;margin-top:-4px}",
			".napcatb-testRow{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".napcatb-testBtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:10px;border:1px solid var(--dsw-alias-label-primary);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:600;cursor:pointer}",
			".napcatb-testBtn:hover:not(:disabled){background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#fff))}",
			".napcatb-testBtn:disabled{opacity:.55;cursor:default}",
			".napcatb-testBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:2px}",
			".napcatb-testIcon{font-size:14px;line-height:1}",
			".napcatb-row{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
			".napcatb-audio{height:36px;max-width:100%}",
			".napcatb-input{height:35px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}",
			".napcatb-input:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".napcatb-pCurrent{display:inline-flex;align-items:center;gap:10px;min-width:220px;max-width:100%;height:38px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer}",
			".napcatb-pCurrent:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pCurrent .napcatb-pName{flex:1;text-align:left}",
			".napcatb-pCaret{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".napcatb-pIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;width:22px;height:22px;border-radius:6px;object-fit:contain}",
			".napcatb-pIconMono{background-color:var(--dsw-alias-label-primary);-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}",
			".napcatb-pIconText{background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.18));color:var(--dsw-alias-label-secondary,var(--dsw-alias-label-primary));font-size:12px;font-weight:600}",
			".napcatb-pPanel{display:grid;gap:10px;margin-top:4px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,12px);background:var(--dsw-alias-bg-layer-1,transparent)}",
			".napcatb-pSearch{width:100%;box-sizing:border-box}",
			".napcatb-pGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}",
			".napcatb-pCard{display:flex;align-items:center;gap:10px;min-width:0;height:46px;padding:0 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;text-align:left;cursor:pointer}",
			".napcatb-pCard:hover{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pCard.napcatb-pOn{border-color:var(--dsw-alias-label-primary);font-weight:600}",
			".napcatb-pCard .napcatb-pName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".napcatb-pCard:focus-visible,.napcatb-pCurrent:focus-visible,.napcatb-pBtn:focus-visible{outline:2px solid var(--dsw-alias-border-focus,var(--dsw-alias-label-tertiary));outline-offset:1px}",
			".napcatb-pModel{min-width:240px;max-width:100%;flex:1 1 240px}",
			".napcatb-pBtn{height:35px;padding:0 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}",
			".napcatb-pBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}",
			".napcatb-pBtn:disabled{opacity:.55;cursor:default}",
			".napcatb-link{text-decoration:underline;text-underline-offset:2px}",
			"@media (max-width:520px){.napcatb-pCurrent{width:100%}.napcatb-pGrid{grid-template-columns:1fr 1fr}}",
			".napcatb-saveBar{position:sticky;bottom:12px;z-index:5;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:16px;padding:10px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:12px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#1e1e1e));box-shadow:0 4px 18px rgba(0,0,0,.25);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}",
			".napcatb-saveBtns{display:flex;gap:8px}",
			".napcatb-pill{display:inline-block;margin:0;padding:6px 10px;border-radius:8px;font-size:12px;line-height:1.5;overflow-wrap:anywhere}",
			".napcatb-pill.napcatb-ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 14%,transparent)}",
			".napcatb-pill.napcatb-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e03131) 14%,transparent)}",
			".napcatb-confirm{display:grid;gap:8px;padding:10px 12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px)}",
			".napcatb-result,.napcatb-hint{overflow-wrap:anywhere}",
			".napcatb-code{display:block;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;font-size:12px;overflow-wrap:anywhere;user-select:all;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}",
			".napcatb-result{margin:0;font-size:12px;line-height:1.5}",
			".napcatb-ok{color:var(--dsw-alias-state-success-primary,#2f9e44)}",
			".napcatb-warn{color:var(--dsw-alias-state-warning-primary,#d97706)}",
			".napcatb-error{color:var(--dsw-alias-state-error-primary)}",
			"@media (prefers-reduced-motion:reduce){.napcatb-chevron{transition:none}}"
		].join("\n");
		var CSS_ID = "dsh-napcat-bridge/settings.css";
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
				parse: function (text) {
					return { kind: "set", value: text.split(/[\s,，]+/).filter(function (x) { return x !== ""; }) };
				}
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
		var LOG_LEVELS = ["debug", "info", "warn", "error"];
		var RATE_STRATEGIES = ["stall", "discard"];
		var STT_MODES = ["off", "command", "openai"];
		var PUSH_SERVICES = ["off", "serverchan", "pushplus"];
		var TTS_MODES = ["tag", "always", "chance"];
		var BOOLS = [
			"nudgeOnEmpty", "groupReplyMention", "groupReplyQuote",
			"watchEnabled", "alertOnRecover", "mailEnabled",
			"friend_message_needs_wake_prefix", "ignore_bot_self_message", "identifier", "imageToModel",
			"whitelistEnabled", "whitelistLog",
			"emptyMentionWaiting", "emptyMentionNeedReply", "uniqueSession",
			"datetimeReminder", "groupNameDisplay", "markAdmin", "markWake", "commandsEnabled", "noPermissionReply",
			"videoFrames", "typingPrivate", "typingGroup", "segmentAdminPrivate", "segmentPrivate", "segmentGroup",
			"ttsEnabled", "ttsAdminPrivate", "ttsPrivate", "ttsGroup", "ttsAlsoText", "ttsStripParens"
		];
		var TEXTS = [
			"ws_reverse_host", "id", "workspacePath", "agentPreset", "timezone",
			"privateAgentPreset", "groupAgentPreset", "adminPrivateAgentPreset",
			"privateModel", "groupModel", "adminPrivateModel", "adminPrivateReasoning", "privateReasoning", "groupReasoning",
			"sttCommand", "sttApiUrl", "sttModel", "ffmpegPath", "silenceToken", "smtpHost", "smtpUser", "mailTo",
			"breezeVoiceId", "breezeModel", "breezeLanguage", "inworldVoiceId", "inworldModel"
		];
		/** 整数字段：[字段, 最小值] */
		var INTS = [
			["ws_reverse_port", 1, 65535], ["maxImages", 0], ["rateLimitCount", 0], ["rateLimitSeconds", 1],
			["videoMaxFrames", 1], ["videoSecondsPerFrame", 1], ["videoMaxEdge", 64], ["videoMaxMB", 1],
			["videoMaxMinutes", 1], ["videoTimeoutSeconds", 5],
			["typingCharsPerMinute", 0], ["typingMinSeconds", 0], ["typingMaxSeconds", 0], ["groupMinGapSeconds", 0], ["groupMaxPerWindow", 0], ["groupWindowSeconds", 1], ["sendMaxWaitSeconds", 0], ["segmentMax", 1], ["segmentMaxSeconds", 1],
			["watchIntervalMinutes", 1], ["watchGraceMinutes", 0], ["alertRepeatHours", 0], ["smtpPort", 1, 65535],
			["ttsChance", 0, 100], ["ttsMaxChars", 1], ["ttsSpeed", 50, 150]
		];
		var LISTS = ["wake_prefix", "wakeKeywords", "admins", "groupWhitelist", "privateWhitelist"];
		var SECRETS = ["ws_reverse_token", "sttApiKey", "smtpPass", "pushKey", "breezeApiKey", "inworldApiKey"];
		//#endregion

		//#region 表单模型
		function createForm(scope) {
			var specs = INTS.map(function (x) { return intField(x[0], x[1], x[2] === undefined ? Number.MAX_SAFE_INTEGER : x[2]); }).concat([
				enumField("logLevel", LOG_LEVELS),
				enumField("rateLimitStrategy", RATE_STRATEGIES),
				enumField("sttMode", STT_MODES),
				enumField("pushService", PUSH_SERVICES),
				enumField("ttsMode", TTS_MODES)
			], LISTS.map(listField), BOOLS.map(boolField), TEXTS.map(function (f) { return P.settingsTextField(f); }));
			var secrets = SECRETS.map(function (field) {
				return { field: field, write: function (text) { return scope.mutate([{ op: "set", path: [field], value: text }]); } };
			});
			var form = new P.SettingsFormModel(scope, specs, secrets);
			var all = INTS.map(function (x) { return x[0]; }).concat(["logLevel", "rateLimitStrategy", "sttMode", "pushService", "ttsMode"], LISTS, BOOLS, TEXTS, SECRETS);
			// 设置服务不把密钥发给浏览器，只告诉它有没有设置；由 refreshSecrets 向服务查询
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

		//#region 页面
		/** 名称 + 右上角的小角标；鼠标移上去（或键盘聚焦）显示说明。 */
		function Label(props) {
			if (!props.hint) return props.text;
			return h("span", { className: "napcatb-labelText" },
				props.text,
				h(P.Tooltip, { label: props.hint, side: "top", delayMs: 150, maxWidth: 320 },
					h("span", { className: "napcatb-tip", tabIndex: 0, role: "img", "aria-label": props.hint }, "?")));
		}

		var TAB_IDS = ["conn", "session", "content", "send", "voice", "log"];
		function readTab() {
			try { var v = window.localStorage.getItem("napcat-bridge:tab"); return TAB_IDS.indexOf(v) >= 0 ? v : "conn"; } catch (e) { return "conn"; }
		}
		function Tabs(props) {
			var t = props.t;
			return h("div", { className: "napcatb-tabs", role: "tablist", "aria-label": t("tabsLabel") },
				TAB_IDS.map(function (id) {
					return h("button", {
						key: id, type: "button", role: "tab", className: "napcatb-tab",
						"aria-selected": props.cur === id,
						onClick: function () { props.onChange(id); try { window.localStorage.setItem("napcat-bridge:tab", id); } catch (e) { /* 存不了就算了 */ } }
					}, t("tab_" + id));
				}));
		}
		/** 几个相关的输入框排成一行（窄窗口自动换行） */
		function G() { return h("div", { className: "napcatb-grid" }, Array.prototype.slice.call(arguments)); }
		function Sub(text) { return h("h4", { className: "napcatb-subtitle" }, text); }
		function Section(props) {
			return h("section", { className: "napcatb-section" },
				h("h3", { className: "napcatb-title" }, h(Label, { text: props.title, hint: props.hint })),
				props.children);
		}

		function Toggle(props) {
			var field = props.state[props.field];
			return h("div", { className: "napcatb-toggleRow" },
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
				id: "napcat-bridge-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: props.invalidLabel || t("invalid"),
				numeric: props.numeric === true,
				placeholder: props.placeholder,
				disabled: props.disabled
			}, props.state[props.field], {
				onEdit: function (text) { props.edit(props.field, text); },
				onReset: function () { props.resetField(props.field); }
			}));
		}

		/** 把状态接口的结果写成一句话和语气（ok / warn / error）。 */
		function describeStatus(t, st) {
			if (!st.listening) return { tone: "error", text: t("testNotListening", { address: st.address }) };
			var conns = st.connections || [];
			if (conns.length > 0) {
				if (st.login && st.login.user_id !== undefined && st.login.user_id !== null) {
					var who = (st.login.nickname ? st.login.nickname + " " : "") + "(" + st.login.user_id + ")";
					return { tone: "ok", text: t(st.tokenSet ? "testOk" : "testOkNoToken", { who: who }) };
				}
				return { tone: "warn", text: t("testConnectedApiFailed", { error: st.loginError || "?" }) };
			}
			if (st.lastRejected) {
				var minutes = Math.max(1, Math.round((Date.now() - st.lastRejected.at) / 60000));
				var key = String(st.lastRejected.status).indexOf("401") === 0 ? "testRejectedMissing" : "testRejectedWrong";
				return { tone: "error", text: t(key, { minutes: minutes }) };
			}
			return { tone: "warn", text: t("testNoClient", { address: st.address }) };
		}

		/** 测试按钮：比普通小按钮显眼（描边、加粗、带图标） */
		function TestButton(props) {
			return h("button", { type: "button", className: "napcatb-testBtn", disabled: props.busy, onClick: props.onClick },
				h("span", { className: "napcatb-testIcon", "aria-hidden": true }, props.busy ? "…" : "⇄"), props.label);
		}
		function ConnectionTest(props) {
			var t = props.t;
			var [result, setResult] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			function run() {
				setBusy(true);
				var url = new URL("api/napcat-bridge/status", document.baseURI).href;
				fetch(url, { credentials: "same-origin", cache: "no-store" })
					.then(function (res) {
						if (!res.ok) throw new Error("HTTP " + res.status);
						return res.json();
					})
					.then(function (st) { setResult(describeStatus(t, st)); },
						function (error) { setResult({ tone: "error", text: t("testFailed", { error: error && error.message || String(error) }) }); })
					.finally(function () { setBusy(false); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" },
					h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : t("test") }),
					props.dirty ? h("span", { className: "napcatb-hint" }, t("testUsesSaved")) : null),
				result ? h("div", null, h("p", { className: "napcatb-pill napcatb-result napcatb-" + result.tone, role: "status" }, result.text)) : null);
		}

		/** 语音转文字的「测试」（POST <dsh>/api/napcat-bridge/stt/test，用保存过的设置拿一段静音试）。 */
		function SttTest(props) {
			var t = props.t;
			var [result, setResult] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			function run() {
				setBusy(true);
				fetch(new URL("api/napcat-bridge/stt/test", document.baseURI).href, { method: "POST", credentials: "same-origin", cache: "no-store" })
					.then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (r) {
						setResult(r.ok ? { tone: "ok", text: t("sttTestOk", { ms: r.ms, text: r.text || t("sttTestEmpty") }) } : { tone: "error", text: t("testFailed", { error: r.error }) });
					}, function (error) { setResult({ tone: "error", text: t("testFailed", { error: error && error.message || String(error) }) }); })
					.finally(function () { setBusy(false); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" },
					h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : t("sttTest") }),
					props.dirty ? h("span", { className: "napcatb-hint" }, t("testUsesSaved")) : null),
				result ? h("div", null, h("p", { className: "napcatb-pill napcatb-result napcatb-" + result.tone, role: "status" }, result.text)) : null);
		}

		/** ffmpeg 状态和一键安装（GET/POST <dsh>/api/napcat-bridge/ffmpeg[/install]）。 */
		function FfmpegStatus(props) {
			var t = props.t;
			var [st, setSt] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var url = function (path) { return new URL("api/napcat-bridge/" + path, document.baseURI).href; };
			function load(method, path) {
				return fetch(url(path), { method: method, credentials: "same-origin", cache: "no-store" })
					.then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
					.then(function (next) { setErr(null); setSt(next); if (props.onFound) props.onFound(next && next.found ? next.found.path : null); return next; },
						function (error) { setErr(error && error.message || String(error)); });
			}
			React.useEffect(function () { load("GET", "ffmpeg"); }, []);
			var busy = st && st.install && ["downloading", "verifying", "extracting"].indexOf(st.install.state) >= 0;
			React.useEffect(function () {
				if (!busy) return void 0;
				var timer = setInterval(function () { load("GET", "ffmpeg"); }, 1000);
				return function () { clearInterval(timer); };
			}, [busy]);
			// 页面内确认（不用 window.confirm：dsh 桌面端里浏览器弹窗可能不显示）
			var [asking, setAsking] = React.useState(false);
			function install() {
				setAsking(false);
				load("POST", "ffmpeg/install");
			}
			var mb = function (n) { return typeof n === "number" ? (n / 1048576).toFixed(0) : "?"; };
			var lines = [];
			if (err) lines.push({ tone: "error", text: t("testFailed", { error: err }) });
			else if (!st) lines.push({ tone: "hint", text: t("ffmpegChecking") });
			else {
				if (st.found) {
					var source = t(st.found.source === "configured" ? "ffmpegSourceConfigured" : st.found.source === "bundled" ? "ffmpegSourceBundled" : "ffmpegSourceSystem");
					lines.push({ tone: "ok", text: t("ffmpegFound", { source: source, path: st.found.path, version: st.found.version }) });
				} else {
					lines.push({ tone: "warn", text: t("ffmpegMissing") });
					if (!st.installSupported) lines.push({ tone: "hint", text: t("ffmpegUnsupported", { platform: st.platform }) });
				}
				var ins = st.install || { state: "idle" };
				if (ins.state === "downloading") {
					var percent = ins.total ? Math.floor((ins.received || 0) * 100 / ins.total) + "%" : "…";
					lines.push({ tone: "hint", text: t("ffmpegDownloading", { asset: ins.asset || "ffmpeg", percent: percent, received: mb(ins.received), total: mb(ins.total) }) });
				} else if (ins.state === "verifying") lines.push({ tone: "hint", text: t("ffmpegVerifying") });
				else if (ins.state === "extracting") lines.push({ tone: "hint", text: t("ffmpegExtracting") });
				else if (ins.state === "done") lines.push({ tone: "ok", text: t("ffmpegDone", { version: ins.version || "" }) });
				else if (ins.state === "failed") lines.push({ tone: "error", text: t("ffmpegFailed", { error: ins.error || "?" }) });
			}
			var canInstall = st && !st.found && st.installSupported && !busy;
			return h("div", { className: "napcatb-test" },
				canInstall && asking ? h("div", { className: "napcatb-confirm", role: "group", "aria-label": t("ffmpegInstall") },
					h("p", { className: "napcatb-hint" }, t("ffmpegInstallConfirm")),
					h("div", { className: "napcatb-testRow" },
						h(P.Button, { size: "sm", onClick: install }, t("ffmpegInstallYes")),
						h(P.Button, { size: "sm", onClick: function () { setAsking(false); } }, t("ffmpegInstallNo")))) : null,
				h("div", { className: "napcatb-testRow" },
					canInstall && !asking ? h(P.Button, { size: "sm", onClick: function () { setAsking(true); } }, t("ffmpegInstall")) : null,
					h(P.Button, { size: "sm", disabled: busy, onClick: function () { load("GET", "ffmpeg"); } }, t("ffmpegRecheck"))),
				lines.map(function (line, i) {
					return h("p", { key: i, className: line.tone === "hint" ? "napcatb-hint" : "napcatb-result napcatb-" + line.tone, role: i === 0 ? "status" : void 0 }, line.text);
				}));
		}

		function Select(props) {
			var field = props.state[props.field];
			return h("div", { className: "napcatb-field" },
				h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.field }, h(Label, { text: props.label, hint: props.hint })),
				h("select", {
					id: "napcat-bridge-" + props.field,
					className: "napcatb-select",
					value: field.text || props.fallback,
					disabled: props.disabled,
					onChange: function (event) { props.edit(props.field, event.target.value); }
				}, props.options.map(function (o) { return h("option", { key: o.value, value: o.value }, o.label); })));
		}

		function Secret(props) {
			var set = props.state.secretSet[props.field] === true;
			return h(P.SettingsSecretField, {
				id: "napcat-bridge-" + props.field,
				label: h(Label, { text: props.label, hint: props.hint }),
				disabled: props.disabled,
				text: props.state[props.field].text,
				configured: set,
				stateLabel: set ? props.setLabel : props.unsetLabel,
				onEdit: function (text) { props.edit(props.field, text); }
			});
		}

		/** 手动部署时用：随机生成一个 Token（填进上面的框，保存后生效），并告诉你 NapCat 里该填什么 */
		function NapcatSetup(props) {
			var t = props.t;
			var [made, setMade] = React.useState("");
			var [copied, setCopied] = React.useState(false);
			var port = (props.state.ws_reverse_port && props.state.ws_reverse_port.text) || "6199";
			var wsUrl = "ws://127.0.0.1:" + port + "/ws";
			function generate() {
				var bytes = new Uint8Array(32);
				window.crypto.getRandomValues(bytes);
				var tok = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
				props.edit("ws_reverse_token", tok);
				setMade(tok); setCopied(false);
			}
			function copy() {
				function done() { setCopied(true); }
				if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(made).then(done, function () {});
				else {
					// 不是 https 时浏览器不给用剪贴板接口，退回到选中文字再复制
					var ta = document.createElement("textarea"); ta.value = made; ta.style.position = "fixed"; ta.style.opacity = "0";
					document.body.appendChild(ta); ta.select();
					try { if (document.execCommand("copy")) done(); } catch (e) { /* 复制不了就让用户自己选 */ }
					ta.remove();
				}
			}
			return h("div", { className: "napcatb-test" },
				h("p", { className: "napcatb-hint" }, t("napcatSetupHint", { url: wsUrl })),
				h("div", { className: "napcatb-testRow" },
					h(P.Button, { size: "sm", disabled: props.disabled, onClick: generate }, t("tokenGenerate")),
					made ? h(P.Button, { size: "sm", onClick: copy }, copied ? t("tokenCopied") : t("tokenCopy")) : null),
				made ? h("code", { className: "napcatb-code" }, made) : null,
				made ? h("p", { className: "napcatb-result napcatb-warn" }, t("tokenGenerated")) : null);
		}

		//#region 服务商预设（地址、常用模型、logo）和模型列表
		// logo 来自 LobeHub 的 lobe-icons（MIT，见 NOTICE.md），以 data: 图片内嵌，不从外网加载；商标归各厂商所有。
		// 单色的 logo 用 CSS 遮罩染成文字颜色，深色、浅色主题都看得清。
		var PROVIDER_ICONS = {
			"groq": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+R3JvcTwvdGl0bGU+PHBhdGggZD0iTTEyLjAzNiAyYy0zLjg1My0uMDM1LTcgMy03LjAzNiA2Ljc4MS0uMDM1IDMuNzgyIDMuMDU1IDYuODcyIDYuOTA4IDYuOTA3aDIuNDJ2LTIuNTY2aC0yLjI5MmMtMi40MDcuMDI4LTQuMzgtMS44NjYtNC40MDgtNC4yMy0uMDI5LTIuMzYyIDEuOTAxLTQuMjk4IDQuMzA4LTQuMzI2aC4xYzIuNDA3IDAgNC4zNTggMS45MTUgNC4zNjUgNC4yNzh2Ni4zMDVjMCAyLjM0Mi0xLjk0NCA0LjI1LTQuMzIzIDQuMjc5YTQuMzc1IDQuMzc1IDAgMDEtMy4wMzMtMS4yNTJsLTEuODUxIDEuODE4QTcgNyAwIDAwMTIuMDI5IDIyaC4wOTJjMy44MDMtLjA1NiA2Ljg1OC0zLjA4MyA2Ljg3OS02LjgxNnYtNi41QzE4LjkwNyA0Ljk2MyAxNS44MTcgMiAxMi4wMzYgMnoiPjwvcGF0aD48L3N2Zz4=" },
			"mistral": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPk1pc3RyYWw8L3RpdGxlPjxwYXRoIGQ9Ik0zLjQyOCAzLjRoMy40Mjl2My40MjhIMy40MjhWMy40em0xMy43MTQgMGgzLjQzdjMuNDI4aC0zLjQzVjMuNHoiIGZpbGw9ImdvbGQiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggNi44MjhoNi44NTd2My40MjlIMy40MjlWNi44Mjh6bTEwLjI4NiAwaDYuODU3djMuNDI5aC02Ljg1N1Y2LjgyOHoiIGZpbGw9IiNGRkFGMDAiPjwvcGF0aD48cGF0aCBkPSJNMy40MjggMTAuMjU4aDE3LjE0NHYzLjQyOEgzLjQyOHYtMy40Mjh6IiBmaWxsPSIjRkY4MjA1Ij48L3BhdGg+PHBhdGggZD0iTTMuNDI4IDEzLjY4NmgzLjQyOXYzLjQyOEgzLjQyOHYtMy40Mjh6bTYuODU4IDBoMy40Mjl2My40MjhoLTMuNDI5di0zLjQyOHptNi44NTYgMGgzLjQzdjMuNDI4aC0zLjQzdi0zLjQyOHoiIGZpbGw9IiNGQTUwMEYiPjwvcGF0aD48cGF0aCBkPSJNMCAxNy4xMTRoMTAuMjg2djMuNDI5SDB2LTMuNDI5em0xMy43MTQgMEgyNHYzLjQyOUgxMy43MTR2LTMuNDI5eiIgZmlsbD0iI0UxMDUwMCI+PC9wYXRoPjwvc3ZnPg==" },
			"openai": { mono: true, src: "data:image/svg+xml;base64,PHN2ZyBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+T3BlbkFJPC90aXRsZT48cGF0aCBkPSJNOS4yMDUgOC42NTh2LTIuMjZjMC0uMTkuMDcyLS4zMzMuMjM4LS40MjhsNC41NDMtMi42MTZjLjYxOS0uMzU3IDEuMzU2LS41MjMgMi4xMTctLjUyMyAyLjg1NCAwIDQuNjYyIDIuMjEyIDQuNjYyIDQuNTY2IDAgLjE2NyAwIC4zNTctLjAyNC41NDdsLTQuNzEtMi43NTlhLjc5Ny43OTcgMCAwMC0uODU2IDBsLTUuOTcgMy40NzN6bTEwLjYwOSA4LjhWMTIuMDZjMC0uMzMzLS4xNDMtLjU3LS40MjktLjczN2wtNS45Ny0zLjQ3MyAxLjk1LTEuMTE4YS40MzMuNDMzIDAgMDEuNDc2IDBsNC41NDMgMi42MTdjMS4zMDkuNzYgMi4xODkgMi4zNzggMi4xODkgMy45NDggMCAxLjgwOC0xLjA3IDMuNDczLTIuNzYgNC4xNjN6TTcuODAyIDEyLjcwM2wtMS45NS0xLjE0MmMtLjE2Ny0uMDk1LS4yMzktLjIzOC0uMjM5LS40MjhWNS44OTljMC0yLjU0NSAxLjk1LTQuNDcyIDQuNTkxLTQuNDcyIDEgMCAxLjkyNy4zMzMgMi43MTIuOTI4TDguMjMgNS4wNjdjLS4yODUuMTY2LS40MjguNDA0LS40MjguNzM3djYuODk4ek0xMiAxNS4xMjhsLTIuNzk1LTEuNTd2LTMuMzNMMTIgOC42NThsMi43OTUgMS41N3YzLjMzTDEyIDE1LjEyOHptMS43OTYgNy4yM2MtMSAwLTEuOTI3LS4zMzItMi43MTItLjkyN2w0LjY4Ni0yLjcxMmMuMjg1LS4xNjYuNDI4LS40MDQuNDI4LS43Mzd2LTYuODk4bDEuOTc0IDEuMTQyYy4xNjcuMDk1LjIzOC4yMzguMjM4LjQyOHY1LjIzM2MwIDIuNTQ1LTEuOTc0IDQuNDcyLTQuNjE0IDQuNDcyem0tNS42MzctNS4zMDNsLTQuNTQ0LTIuNjE3Yy0xLjMwOC0uNzYxLTIuMTg4LTIuMzc4LTIuMTg4LTMuOTQ4QTQuNDgyIDQuNDgyIDAgMDE0LjIxIDYuMzI3djUuNDIzYzAgLjMzMy4xNDMuNTcxLjQyOC43MzhsNS45NDcgMy40NDktMS45NSAxLjExOGEuNDMyLjQzMiAwIDAxLS40NzYgMHptLS4yNjIgMy45Yy0yLjY4OCAwLTQuNjYyLTIuMDIxLTQuNjYyLTQuNTE5IDAtLjE5LjAyNC0uMzguMDQ3LS41N2w0LjY4NiAyLjcxYy4yODYuMTY3LjU3MS4xNjcuODU2IDBsNS45Ny0zLjQ0OHYyLjI2YzAgLjE5LS4wNy4zMzMtLjIzNy40MjhsLTQuNTQzIDIuNjE2Yy0uNjE5LjM1Ny0xLjM1Ni41MjMtMi4xMTcuNTIzem01Ljg5OSAyLjgzYTUuOTQ3IDUuOTQ3IDAgMDA1LjgyNy00Ljc1NkMyMi4yODcgMTguMzM5IDI0IDE1Ljg0IDI0IDEzLjI5NmMwLTEuNjY1LS43MTMtMy4yODItMS45OTgtNC40NDguMTE5LS41LjE5LS45OTkuMTktMS40OTggMC0zLjQwMS0yLjc1OS01Ljk0Ny01Ljk0Ni01Ljk0Ny0uNjQyIDAtMS4yNi4wOTUtMS44OC4zMUE1Ljk2MiA1Ljk2MiAwIDAwMTAuMjA1IDBhNS45NDcgNS45NDcgMCAwMC01LjgyNyA0Ljc1N0MxLjcxMyA1LjQ0NyAwIDcuOTQ1IDAgMTAuNDljMCAxLjY2Ni43MTMgMy4yODMgMS45OTggNC40NDgtLjExOS41LS4xOSAxLS4xOSAxLjQ5OSAwIDMuNDAxIDIuNzU5IDUuOTQ2IDUuOTQ2IDUuOTQ2LjY0MiAwIDEuMjYtLjA5NSAxLjg4LS4zMDlhNS45NiA1Ljk2IDAgMDA0LjE2MiAxLjcxM3oiPjwvcGF0aD48L3N2Zz4=" },
			"siliconcloud": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlNpbGljb25DbG91ZDwvdGl0bGU+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjIuOTU2IDYuNTIxSDEyLjUyMmMtLjU3NyAwLTEuMDQ0LjQ2OC0xLjA0NCAxLjA0NHYzLjEzYzAgLjU3Ny0uNDY2IDEuMDQ0LTEuMDQzIDEuMDQ0SDEuMDQ0Yy0uNTc3IDAtMS4wNDQuNDY3LTEuMDQ0IDEuMDQ0djQuMTc0QzAgMTcuNTMzLjQ2NyAxOCAxLjA0NCAxOGgxMC40MzRjLjU3NyAwIDEuMDQ0LS40NjcgMS4wNDQtMS4wNDN2LTMuMTNjMC0uNTc4LjQ2Ni0xLjA0NCAxLjA0My0xLjA0NGg5LjM5MWMuNTc3IDAgMS4wNDQtLjQ2NyAxLjA0NC0xLjA0NFY3LjU2NWMwLS41NzYtLjQ2Ny0xLjA0NC0xLjA0NC0xLjA0NHoiIGZpbGw9IiM2RTI5RjYiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PC9wYXRoPjwvc3ZnPg==" },
			"zhipu": { mono: false, src: "data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPlpoaXB1PC90aXRsZT48cGF0aCBkPSJNMTEuOTkxIDIzLjUwM2EuMjQuMjQgMCAwMC0uMjQ0LjI0OC4yNC4yNCAwIDAwLjI0NC4yNDkuMjQuMjQgMCAwMC4yNDUtLjI0OS4yNC4yNCAwIDAwLS4yMi0uMjQ3bC0uMDI1LS4wMDF6TTkuNjcxIDUuMzY1YTEuNjk3IDEuNjk3IDAgMDExLjA5OSAyLjEzMmwtLjA3MS4xNzItLjAxNi4wNC0uMDE4LjA1NGMtLjA3LjE2LS4xMDQuMzItLjEwNC40OTgtLjAzNS43MS40NyAxLjI3OSAxLjE4NiAxLjMxNGguMzY2YzEuMzA5LjA1MyAyLjMzOCAxLjE3MyAyLjI4NiAyLjUyMy0uMDUyIDEuMzMyLTEuMTUyIDIuMzgtMi40NzggMi4zMjdoLS4xNzRjLS43MTUuMDE4LTEuMjc0LjY0LTEuMjM5IDEuMzY4IDAgLjEyNC4wMTguMjMuMDUzLjMzNy4yMDkuMzczLjU0LjY1OC45Ni44Ljc1LjIzIDEuNTE3LS4xMjUgMS45LS43ODJsLjAxOC0uMDM1Yy40MDItLjY0IDEuMTctLjk2IDEuOTItLjcxMS44NTQuMjg0IDEuMzc4IDEuMjI2IDEuMDk5IDIuMTY3YTEuNjYxIDEuNjYxIDAgMDEtMi4wNzcgMS4xMDIgMS43MTEgMS43MTEgMCAwMS0uOTA3LS43MTFsLS4wMTctLjAzNWMtLjItLjMyMy0uNDYzLS41OC0uODUxLS43MTFsLS4wNTYtLjAxOGExLjY0NiAxLjY0NiAwIDAwLTEuOTU0Ljc0NiAxLjY2IDEuNjYgMCAwMS0xLjA2NS43NjQgMS42NzcgMS42NzcgMCAwMS0xLjk4OS0xLjI3OWMtLjIwOS0uOTA2LjMzMi0xLjgzIDEuMjU3LTIuMDQzYTEuNTEgMS41MSAwIDAxLjI5Ni0uMDM1aC4wMThjLjY4LS4wNzEgMS4xNTEtLjYyMiAxLjExNi0xLjMzM2ExLjMwNyAxLjMwNyAwIDAwLS4yMjctLjY5MyAyLjUxNSAyLjUxNSAwIDAxLS4zNjYtMS40MDMgMi4zOSAyLjM5IDAgMDEuMzY2LTEuMjA4Yy4xNC0uMTk1LjIxLS40NDQuMjI3LS42OTMuMDE4LS43MS0uNTA2LTEuMjYxLTEuMTg2LTEuMzMybC0uMDctLjAxOGExLjQzIDEuNDMgMCAwMS0uMjk5LS4wN2wtLjA1LS4wMTlhMS43IDEuNyAwIDAxLTEuMDQ3LTIuMTE0IDEuNjggMS42OCAwIDAxMi4wOTQtMS4xMDF6bS01LjU3NSAxMC4xMWMuMjYtLjI2NC42MzktLjM2Ny45OTQtLjI3LjM1NS4wOTYuNjMzLjM3OS43MjguNzQuMDk1LjM2Mi0uMDA3Ljc0OC0uMjY3IDEuMDEzLS40MDIuNDEtMS4wNTMuNDEtMS40NTUgMGExLjA2MiAxLjA2MiAwIDAxMC0xLjQ4MnptMTQuODQ1LS4yOTRjLjM1OS0uMDkuNzM4LjAyNC45OTIuMjk3LjI1NC4yNzQuMzQ0LjY2NS4yMzcgMS4wMjUtLjEwNy4zNi0uMzk2LjYzNC0uNzU2LjcxOC0uNTUxLjEyOC0xLjEtLjIyLTEuMjMtLjc4MWExLjA1IDEuMDUgMCAwMS43NTctMS4yNnptLS4wNjQtNC4zOWMuMzE0LjMyLjQ5Ljc1My40OSAxLjIwNiAwIC40NTItLjE3Ni44ODYtLjQ5IDEuMjA2LS4zMTUuMzItLjc0LjUtMS4xODUuNS0uNDQ0IDAtLjg3LS4xOC0xLjE4NC0uNWExLjcyNyAxLjcyNyAwIDAxMC0yLjQxMiAxLjY1NCAxLjY1NCAwIDAxMi4zNjkgMHptLTExLjI0My4xNjNjLjM2NC40ODQuNDQ3IDEuMTI4LjIxOCAxLjY5MWExLjY2NSAxLjY2NSAwIDAxLTIuMTg4LjkyM2MtLjg1NS0uMzYtMS4yNi0xLjM1OC0uOTA3LTIuMjI4YTEuNjggMS42OCAwIDAxMS4zMy0xLjAzOGMuNTkzLS4wOCAxLjE4My4xNjkgMS41NDcuNjUyem0xMS41NDUtNC4yMjFjLjM2OCAwIC43MDguMi44OTIuNTI0LjE4NC4zMjQuMTg0LjcyNCAwIDEuMDQ4YTEuMDI2IDEuMDI2IDAgMDEtLjg5Mi41MjRjLS41NjggMC0xLjAzLS40Ny0xLjAzLTEuMDQ4IDAtLjU3OS40NjItMS4wNDggMS4wMy0xLjA0OHptLTE0LjM1OCAwYy4zNjggMCAuNzA3LjIuODkxLjUyNC4xODQuMzI0LjE4NC43MjQgMCAxLjA0OGExLjAyNiAxLjAyNiAwIDAxLS44OTEuNTI0Yy0uNTY5IDAtMS4wMy0uNDctMS4wMy0xLjA0OCAwLS41NzkuNDYxLTEuMDQ4IDEuMDMtMS4wNDh6bTEwLjAzMS0xLjQ3NWMuOTI1IDAgMS42NzUuNzY0IDEuNjc1IDEuNzA2cy0uNzUgMS43MDUtMS42NzUgMS43MDUtMS42NzQtLjc2My0xLjY3NC0xLjcwNWMwLS45NDIuNzUtMS43MDYgMS42NzQtMS43MDZ6bS0yLjYyNi0uNjg0Yy4zNjItLjA4Mi42NTMtLjM1Ni43NjEtLjcxOGExLjA2MiAxLjA2MiAwIDAwLS4yMzgtMS4wMjggMS4wMTcgMS4wMTcgMCAwMC0uOTk2LS4yOTRjLS41NDcuMTQtLjg4MS43LS43NTIgMS4yNTcuMTMuNTU4LjY3NS45MDcgMS4yMjUuNzgzem0wIDE2Ljg3NmMuMzU5LS4wODcuNjQ0LS4zNi43NS0uNzJhMS4wNjIgMS4wNjIgMCAwMC0uMjM3LTEuMDE5IDEuMDE4IDEuMDE4IDAgMDAtLjk4NS0uMzAxIDEuMDM3IDEuMDM3IDAgMDAtLjc2Mi43MTdjLS4xMDguMzYxLS4wMTcuNzU0LjIzOSAxLjAyOC4yNDUuMjYzLjYwNi4zNzcuOTUzLjMwNWwuMDQzLS4wMXpNMTcuMTkgMy41YS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI3OS0uNjQtLjYyOC0uNjRhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjR6bS0xMC4zOCAwYS42MzEuNjMxIDAgMDAuNjI4LS42NGMwLS4zNTUtLjI4LS42NC0uNjI4LS42NGEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjR6bS01LjE4MiA3Ljg1MmEuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU0LjI4LjYzOS42MjguNjM5YS42My42MyAwIDAwLjYyNy0uNjA2bC4wMDEtLjAzNGEuNjIuNjIgMCAwMC0uNjI4LS42NHptNS4xODIgOS4xM2EuNjMxLjYzMSAwIDAwLS42MjguNjRjMCAuMzU1LjI3OS42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0xMC4zOC4wMThhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NS4yOC42NC42MjguNjRhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjc5LS42NC0uNjI4LS42NHptNS4xODItOS4xNDhhLjYzMS42MzEgMCAwMC0uNjI4LjY0YzAgLjM1NC4yNzkuNjM5LjYyOC42MzlhLjYzMS42MzEgMCAwMC42MjgtLjY0YzAtLjM1NS0uMjgtLjY0LS42MjgtLjY0em0tLjM4NC00Ljk5MmEuMjQuMjQgMCAwMC4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQtLjI0OS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjE0Mi4xMjIuMjQ5LjI0NC4yNDl6TTExLjk5MS40OTdhLjI0LjI0IDAgMDAuMjQ1LS4yNDhBLjI0LjI0IDAgMDAxMS45OSAwYS4yNC4yNCAwIDAwLS4yNDQuMjQ5YzAgLjEzMy4xMDguMjM2LjIyMy4yNDdsLjAyMS4wMDF6TTIuMDExIDYuMzZhLjI0LjI0IDAgMDAuMjQ1LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LS4yNDkuMjQuMjQgMCAwMC0uMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC4yNDl6bTAgMTEuMjYzYS4yNC4yNCAwIDAwLS4yNDMuMjQ4LjI0LjI0IDAgMDAuMjQ0LjI0OS4yNC4yNCAwIDAwLjI0NC0uMjQ5LjI1Mi4yNTIgMCAwMC0uMjQ0LS4yNDh6bTE5Ljk5NS0uMDE4YS4yNC4yNCAwIDAwLS4yNDUuMjQ4LjI0LjI0IDAgMDAuMjQ1LjI1LjI0LjI0IDAgMDAuMjQ0LS4yNS4yNTIuMjUyIDAgMDAtLjI0NC0uMjQ4eiIgZmlsbD0iIzM4NTlGRiIgZmlsbC1ydWxlPSJub256ZXJvIj48L3BhdGg+PC9zdmc+" }
		};
		var PROVIDERS = [
			{"id": "siliconflow", "name": "硅基流动", "en": "SiliconFlow", "icon": "siliconcloud", "url": "https://api.siliconflow.cn/v1", "models": ["FunAudioLLM/SenseVoiceSmall", "TeleAI/TeleSpeechASR"], "query": "?sub_type=speech-to-text", "keyUrl": "https://cloud.siliconflow.cn/account/ak"},
			{"id": "zhipu", "name": "智谱 BigModel", "en": "Zhipu BigModel", "icon": "zhipu", "url": "https://open.bigmodel.cn/api/paas/v4", "models": ["glm-asr-2512", "glm-asr"], "keyUrl": "https://bigmodel.cn/usercenter/proj-mgmt/apikeys"},
			{"id": "openai", "name": "OpenAI", "en": "OpenAI", "icon": "openai", "url": "https://api.openai.com/v1", "models": ["gpt-4o-mini-transcribe", "gpt-4o-transcribe", "whisper-1"], "keyUrl": "https://platform.openai.com/api-keys"},
			{"id": "groq", "name": "Groq", "en": "Groq", "icon": "groq", "url": "https://api.groq.com/openai/v1", "models": ["whisper-large-v3-turbo", "whisper-large-v3"], "keyUrl": "https://console.groq.com/keys"},
			{"id": "mistral", "name": "Mistral", "en": "Mistral", "icon": "mistral", "url": "https://api.mistral.ai/v1", "models": ["voxtral-mini-latest"], "keyUrl": "https://console.mistral.ai/api-keys"}
		];
		function normUrl(u) { return String(u || "").trim().replace(/\/+$/, "").toLowerCase(); }
		function providerOf(url) {
			var n = normUrl(url);
			for (var i = 0; i < PROVIDERS.length; i++) if (normUrl(PROVIDERS[i].url) === n) return PROVIDERS[i];
			return null;
		}
		function ProviderIcon(props) {
			var ic = props.icon ? PROVIDER_ICONS[props.icon] : null;
			if (!ic) return h("span", { className: "napcatb-pIcon napcatb-pIconText", "aria-hidden": true }, (props.name || "?").slice(0, 1));
			if (ic.mono) return h("span", { className: "napcatb-pIcon napcatb-pIconMono", "aria-hidden": true, style: { WebkitMaskImage: "url(" + ic.src + ")", maskImage: "url(" + ic.src + ")" } });
			return h("img", { className: "napcatb-pIcon", src: ic.src, alt: "", "aria-hidden": true });
		}
		function providerName(t, p) { return p ? (t("langIsEn") === "1" ? p.en : p.name) : t("providerCustom"); }
		/** 选服务商：点开后是带搜索的格子，选一家就填好接口地址（模型不在这家的常用列表里时换成第一个） */
		function ProviderField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var cur = providerOf(url);
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
			var list = PROVIDERS.filter(function (p) { var s = q.trim().toLowerCase(); return !s || (p.name + " " + p.en + " " + p.id).toLowerCase().indexOf(s) >= 0; });
			return h("div", { className: "napcatb-field" },
				h("span", { className: "napcatb-label" }, h(Label, { text: t("provider"), hint: t("providerHint") })),
				h("div", { className: "napcatb-row" },
					h("button", { type: "button", className: "napcatb-pCurrent", disabled: props.disabled, "aria-expanded": open, onClick: function () { setOpen(!open); } },
						h(ProviderIcon, { icon: cur && cur.icon, name: cur ? providerName(t, cur) : "+" }),
						h("span", { className: "napcatb-pName" }, providerName(t, cur)),
						h("span", { className: "napcatb-pCaret", "aria-hidden": true }, open ? "▴" : "▾")),
					cur && cur.keyUrl ? h("a", { className: "napcatb-hint napcatb-link", href: cur.keyUrl, target: "_blank", rel: "noreferrer noopener" }, t("providerGetKey")) : null),
				open ? h("div", { className: "napcatb-pPanel", role: "dialog", "aria-label": t("provider") },
					h("input", { className: "napcatb-input napcatb-pSearch", type: "search", placeholder: t("providerSearch"), value: q, autoFocus: true, onChange: function (e) { setQ(e.target.value); } }),
					h("div", { className: "napcatb-pGrid", role: "listbox" },
						list.map(function (p) {
							return h("button", { key: p.id, type: "button", role: "option", "aria-selected": cur === p, className: "napcatb-pCard" + (cur === p ? " napcatb-pOn" : ""), onClick: function () { choose(p); } },
								h(ProviderIcon, { icon: p.icon, name: p.name }), h("span", { className: "napcatb-pName" }, providerName(t, p)));
						}),
						h("button", { type: "button", role: "option", "aria-selected": !cur, className: "napcatb-pCard" + (!cur ? " napcatb-pOn" : ""), onClick: function () { choose(null); } },
							h(ProviderIcon, { name: "+" }), h("span", { className: "napcatb-pName" }, t("providerCustom"))))) : null);
		}
		/** 模型：下拉里是拉到的模型（拉不到就用这家的常用模型），也能手动填 */
		function ModelField(props) {
			var t = props.t;
			var url = props.state[props.urlField].text;
			var cur = providerOf(url);
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
					body: JSON.stringify({ apiUrl: url, apiKey: typedKey || "", query: (cur && cur.query) || "" })
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
			return h("div", { className: "napcatb-field" },
				h("span", { className: "napcatb-label" }, h(Label, { text: props.label, hint: t("pModelHint") })),
				h("div", { className: "napcatb-row" },
					showSelect ? h("select", { className: "napcatb-select napcatb-pModel", disabled: props.disabled, value: model, "aria-label": props.label, onChange: function (e) { if (e.target.value === MANUAL) setManual(true); else props.edit(props.modelField, e.target.value); } },
						options.map(function (m) { return h("option", { key: m, value: m }, m); }),
						h("option", { value: MANUAL }, t("modelManual"))) : null,
					h("button", { type: "button", className: "napcatb-pBtn", disabled: busy || props.disabled || !url, onClick: fetchModels }, busy ? t("modelFetching") : t("modelFetch")),
					showSelect ? null : (options.length > 0 ? h("button", { type: "button", className: "napcatb-pBtn", onClick: function () { setManual(false); } }, t("modelPickList")) : null)),
				showSelect ? null : h(Value, Object.assign({}, props.common, { field: props.modelField, label: t("modelManualLabel"), hint: t("pModelHint") })),
				msg ? h("p", { className: "napcatb-pill napcatb-result napcatb-" + msg.tone, role: "status" }, msg.text) : null);
		}
		//#endregion


		//#region 聊天用的模型：从 dsh 里配置的模型里选，思考等级按这个模型支持的列
		var dshModelsCache = null;
		function napcatApi(method, path, body) {
			var init = { method: method, credentials: "same-origin", cache: "no-store" };
			if (body !== void 0) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(body); }
			return fetch(new URL("api/napcat-bridge/" + path, document.baseURI).href, init).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); });
		}
		function loadDshModels() {
			if (!dshModelsCache) dshModelsCache = napcatApi("GET", "llm/dsh-models").catch(function (e) { dshModelsCache = null; throw e; });
			return dshModelsCache;
		}
		function effortName(t, id, name) {
			var key = "reasoning" + id.charAt(0).toUpperCase() + id.slice(1);
			var tr = t(key);
			return tr && tr !== key ? tr : (name || id);
		}
		/** 一类聊天（主人私聊 / 其他私聊 / 群聊）：模型下拉 + 思考等级下拉 */
		function ChatModelPick(props) {
			var t = props.t;
			var [list, setList] = React.useState(null);
			var [err, setErr] = React.useState(null);
			var [eff, setEff] = React.useState(null);
			var value = props.state[props.modelField].text;
			var effort = props.state[props.effortField].text || props.effortFallback;
			React.useEffect(function () { loadDshModels().then(setList, function (e) { setErr(e && e.message || String(e)); }); }, []);
			var shown = value || props.inherited || "";
			React.useEffect(function () {
				setEff(null);
				var slash = shown.indexOf("/");
				napcatApi("POST", "llm/efforts", slash > 0 ? { provider: shown.slice(0, slash), model: shown.slice(slash + 1) } : {}).then(setEff, function () { setEff({ efforts: [] }); });
			}, [shown]);
			var groups = ((list && list.providers) || []).filter(function (g) { return g.models.length > 0; });
			var known = groups.some(function (g) { return g.models.some(function (m) { return g.id + "/" + m.id === value; }); });
			var opts = eff ? eff.efforts.slice() : [];
			if (opts.length > 0 && opts.every(function (o) { return o.id !== effort; })) opts.unshift({ id: effort, name: effort, missing: true });
			return h("div", { className: "napcatb-modelRow" },
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.modelField }, h(Label, { text: props.label, hint: t("modelPickHint") })),
					err ? h("p", { className: "napcatb-result napcatb-error" }, t("dshModelsFailed", { error: err })) : null,
					h("select", { id: "napcat-bridge-" + props.modelField, className: "napcatb-select", disabled: props.disabled || !list, value: value, onChange: function (e) { props.edit(props.modelField, e.target.value); } },
						h("option", { value: "" }, list ? props.blankLabel : t("loadingModels")),
						value && !known ? h("option", { value: value }, value) : null,
						groups.map(function (g) {
							return h("optgroup", { key: g.id, label: g.name }, g.models.map(function (m) { return h("option", { key: m.id, value: g.id + "/" + m.id }, m.name + (m.name !== m.id ? "（" + m.id + "）" : "")); }));
						}))),
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-" + props.effortField }, h(Label, { text: props.effortLabel, hint: t("reasoningHint") })),
					opts.length === 0 ? h("p", { className: "napcatb-hint" }, eff ? t("reasoningNone") : t("loadingModels")) :
					h("select", { id: "napcat-bridge-" + props.effortField, className: "napcatb-select", disabled: props.disabled, value: effort, onChange: function (e) { props.edit(props.effortField, e.target.value); } },
						opts.map(function (o) { return h("option", { key: o.id, value: o.id }, effortName(t, o.id, o.name) + (o.missing ? t("reasoningUnsupported") : "")); }))));
		}
		//#endregion

		//#region 掉线检测和提醒
		/** 常见邮箱的发信服务器（选了就填好服务器和端口） */
		var MAIL_PRESETS = [
			{ id: "qq", name: "QQ 邮箱", host: "smtp.qq.com", port: 465, keyUrl: "https://wx.mail.qq.com/" },
			{ id: "163", name: "网易 163 邮箱", host: "smtp.163.com", port: 465, keyUrl: "https://mail.163.com/" },
			{ id: "126", name: "网易 126 邮箱", host: "smtp.126.com", port: 465, keyUrl: "https://mail.126.com/" },
			{ id: "outlook", name: "Outlook / Hotmail", host: "smtp-mail.outlook.com", port: 587, keyUrl: "https://account.live.com/proofs/AppPassword" },
			{ id: "gmail", name: "Gmail", host: "smtp.gmail.com", port: 465, keyUrl: "https://myaccount.google.com/apppasswords" }
		];
		var PUSH_KEY_URLS = { serverchan: "https://sct.ftqq.com/sendkey", pushplus: "https://www.pushplus.plus/uc.html" };
		function watchStateText(t, st) {
			if (!st) return t("watchLoading");
			var who = st.account ? (st.account.nickname ? st.account.nickname + "（" + st.account.userId + "）" : st.account.userId) : t("watchBot");
			return t("watchState_" + st.state, { who: who, since: new Date(st.since).toLocaleString() }) + (st.reason && st.state !== "ok" ? t("watchReason", { reason: st.reason }) : "");
		}
		/** 设置页最上面：小号有问题时醒目地提示 */
		function WatchBanner(props) {
			var t = props.t;
			var [st, setSt] = React.useState(null);
			React.useEffect(function () {
				var alive = true;
				function load() { napcatApi("GET", "watch").then(function (r) { if (alive) setSt(r); }, function () {}); }
				load();
				var timer = setInterval(load, 30000);
				return function () { alive = false; clearInterval(timer); };
			}, []);
			if (!st || !st.enabled || st.state === "ok" || (st.state === "unknown" && !st.lastCheck)) return null;
			return h("div", { className: "napcatb-banner", role: "alert" }, "⚠ " + watchStateText(t, st), h("span", { className: "napcatb-hint" }, t("watchBannerHint")));
		}
		/** 测试提醒时带上页面上现在填的值（没保存的也算；密钥框没填就用保存过的） */
		function formValues(state) {
			var v = function (f) { return state[f] ? state[f].text : ""; };
			return { smtpHost: v("smtpHost"), smtpPort: v("smtpPort"), smtpUser: v("smtpUser"), mailTo: v("mailTo"), smtpPass: v("smtpPass"), pushService: v("pushService"), pushKey: v("pushKey") };
		}
		function AlertTest(props) {
			var t = props.t;
			var [r, setR] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			function run() {
				setBusy(true); setR(null);
				napcatApi("POST", "alert/test", { channel: props.channel, form: formValues(props.state) })
					.then(function (x) { setR({ tone: x.ok ? "ok" : "error", text: (x.results || []).join("；") }); }, function (e) { setR({ tone: "error", text: t("testFailed", { error: e && e.message || String(e) }) }); })
					.finally(function () { setBusy(false); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" },
					h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : props.label }),
					h("span", { className: "napcatb-hint" }, t("alertTestUsesForm"))),
				r ? h("div", null, h("p", { className: "napcatb-pill napcatb-result napcatb-" + r.tone, role: "status" }, r.text)) : null);
		}
		/** 掉线提醒这一块 */
		function WatchSection(props) {
			var t = props.t, common = props.common, state = props.state;
			var [st, setSt] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			function load(fresh) { setBusy(true); return napcatApi("GET", "watch" + (fresh ? "?fresh=1" : "")).then(setSt, function () {}).finally(function () { setBusy(false); }); }
			React.useEffect(function () { load(false); }, []);
			var host = state.smtpHost.text, preset = MAIL_PRESETS.filter(function (m) { return m.host === host; })[0];
			var push = state.pushService.text || "off";
			var tone = !st ? "hint" : st.state === "ok" ? "ok" : st.state === "unknown" ? "warn" : "error";
			return h(Section, { title: t("watchSec"), hint: t("watchSecHint") },
				h("div", { className: "napcatb-test" },
					h("p", { className: "napcatb-pill napcatb-result napcatb-" + tone, role: "status" }, watchStateText(t, st)),
					st && st.lastAlert ? h("p", { className: "napcatb-hint" }, t("watchLastAlert", { time: new Date(st.lastAlert.at).toLocaleString(), kind: t(st.lastAlert.kind === "problem" ? "watchKindProblem" : "watchKindRecovered"), results: (st.lastAlert.results || []).join("；") || t("watchNoChannel") })) : null,
					h("div", { className: "napcatb-testRow" }, h(P.Button, { size: "sm", disabled: busy, onClick: function () { load(true); } }, busy ? t("testing") : t("watchCheckNow")))),
				h(Toggle, Object.assign({ field: "watchEnabled", label: t("watchEnabled"), hint: t("watchEnabledHint") }, common)),
				G(h(Value, Object.assign({ field: "watchIntervalMinutes", label: t("watchInterval"), hint: t("watchIntervalMinutesHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
					h(Value, Object.assign({ field: "watchGraceMinutes", label: t("watchGrace"), hint: t("watchGraceHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
					h(Value, Object.assign({ field: "alertRepeatHours", label: t("alertRepeat"), hint: t("alertRepeatHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
				h(Toggle, Object.assign({ field: "alertOnRecover", label: t("alertOnRecover"), hint: t("alertOnRecoverHint") }, common)),
				Sub(t("mailSub")),
				h(Toggle, Object.assign({ field: "mailEnabled", label: t("mailEnabled"), hint: t("mailEnabledHint") }, common)),
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-mailPreset" }, h(Label, { text: t("mailPreset"), hint: t("mailPresetHint") })),
					h("div", { className: "napcatb-row" },
						h("select", { id: "napcat-bridge-mailPreset", className: "napcatb-select", disabled: props.disabled, value: preset ? preset.id : "", onChange: function (e) {
							var m = MAIL_PRESETS.filter(function (x) { return x.id === e.target.value; })[0];
							if (m) { props.edit("smtpHost", m.host); props.edit("smtpPort", String(m.port)); }
						} },
							h("option", { value: "" }, t("mailPresetCustom")),
							MAIL_PRESETS.map(function (m) { return h("option", { key: m.id, value: m.id }, m.name + "（" + m.host + "）"); })),
						preset ? h("a", { className: "napcatb-hint napcatb-link", href: preset.keyUrl, target: "_blank", rel: "noreferrer noopener" }, t("mailGetCode")) : null)),
				G(h(Value, Object.assign({ field: "smtpHost", label: t("smtpHost"), hint: t("smtpHostHint") }, common)),
					h(Value, Object.assign({ field: "smtpPort", label: t("smtpPort"), hint: t("smtpPortHint"), numeric: true, invalidLabel: t("invalidPort") }, common)),
					h(Value, Object.assign({ field: "smtpUser", label: t("smtpUser"), hint: t("smtpUserHint") }, common)),
					h(Value, Object.assign({ field: "mailTo", label: t("mailTo"), hint: t("mailToHint") }, common))),
				h(Secret, Object.assign({ field: "smtpPass", label: t("smtpPass"), hint: t("smtpPassHint"), setLabel: t("secretSet"), unsetLabel: t("secretUnset") }, common)),
				h(AlertTest, { t: t, channel: "mail", label: t("mailTest"), state: state }),
				Sub(t("pushSub")),
				h("div", { className: "napcatb-row" },
					h(Select, Object.assign({ field: "pushService", label: t("pushService"), hint: t("pushServiceHint"), fallback: "off", options: [{ value: "off", label: t("pushOff") }, { value: "serverchan", label: "Server酱" }, { value: "pushplus", label: "PushPlus" }] }, common)),
					PUSH_KEY_URLS[push] ? h("a", { className: "napcatb-hint napcatb-link", href: PUSH_KEY_URLS[push], target: "_blank", rel: "noreferrer noopener" }, t("pushGetKey")) : null),
				push !== "off" ? h(Secret, Object.assign({ field: "pushKey", label: push === "serverchan" ? "SendKey" : "Token", hint: t("pushKeyHint"), setLabel: t("secretSet"), unsetLabel: t("secretUnset") }, common)) : null,
				push !== "off" ? h(AlertTest, { t: t, channel: "push", label: t("pushTest"), state: state }) : null);
		}
		//#endregion
		//#region 文字转语音
		/** 试听：只用一家念一句，页面上直接播放（POST <dsh>/api/napcat-bridge/tts/test） */
		function TtsTest(props) {
			var t = props.t;
			var [r, setR] = React.useState(null);
			var [busy, setBusy] = React.useState(false);
			function run() {
				var st = props.state, v = function (f) { return st[f] ? st[f].text : ""; };
				var form = {};
				["breezeApiKey", "breezeVoiceId", "breezeModel", "breezeLanguage", "inworldApiKey", "inworldVoiceId", "inworldModel", "ttsSpeed", "ttsStripParens"].forEach(function (f) { form[f] = v(f); });
				setBusy(true); setR(null);
				napcatApi("POST", "tts/test", { provider: props.provider, text: props.text, form: form })
					.then(function (x) { setR(x.ok ? { tone: "ok", text: t("ttsTestOk", { ms: x.ms }), audio: "data:audio/mpeg;base64," + x.audio } : { tone: "error", text: t("testFailed", { error: x.error }) }); },
						function (e) { setR({ tone: "error", text: t("testFailed", { error: e && e.message || String(e) }) }); })
					.finally(function () { setBusy(false); props.onDone(); });
			}
			return h("div", { className: "napcatb-test" },
				h("div", { className: "napcatb-testRow" }, h(TestButton, { busy: busy, onClick: run, label: busy ? t("testing") : props.label })),
				r ? h("div", { className: "napcatb-row" },
					h("p", { className: "napcatb-pill napcatb-result napcatb-" + r.tone, role: "status" }, r.text),
					r.audio ? h("audio", { className: "napcatb-audio", controls: true, autoPlay: true, src: r.audio }) : null) : null);
		}
		function TtsSection(props) {
			var t = props.t, common = props.common, state = props.state;
			var [st, setSt] = React.useState(null);
			var [text, setText] = React.useState("");
			function load() { napcatApi("GET", "tts/status").then(setSt, function () {}); }
			React.useEffect(load, []);
			var mode = state.ttsMode.text || "tag";
			var has = function (key, voice) { return (state.secretSet[key] === true || state[key].text !== "") && state[voice].text !== ""; };
			var ready = has("breezeApiKey", "breezeVoiceId") || has("inworldApiKey", "inworldVoiceId");
			var time = function (ms) { return new Date(ms).toLocaleString(); };
			var sample = text.trim() || t("ttsTestDefault");
			return h(Section, { title: t("ttsSec"), hint: t("ttsSecHint") },
				h(Toggle, Object.assign({ field: "ttsEnabled", label: t("ttsEnabled"), hint: t("ttsEnabledHint") }, common)),
				state.ttsEnabled.text === "true" && !ready ? h("p", { className: "napcatb-pill napcatb-result napcatb-warn", role: "status" }, t("ttsNeedKey")) : null,
				st ? h("div", { className: "napcatb-test" },
					h("p", { className: "napcatb-hint" }, t("ttsTodaySub") + "：" + t("ttsToday", st.today)),
					st.lastFallback ? h("p", { className: "napcatb-hint" }, t("ttsFallback", { time: time(st.lastFallback.at), text: st.lastFallback.text })) : null,
					st.lastError ? h("p", { className: "napcatb-hint" }, t("ttsLastError", { time: time(st.lastError.at), text: st.lastError.text })) : null,
					h("div", { className: "napcatb-testRow" }, h(P.Button, { size: "sm", onClick: load }, t("ttsRefresh")))) : null,
				G(h(Select, Object.assign({ field: "ttsMode", label: t("ttsMode"), hint: t("ttsModeHint"), fallback: "tag", options: [{ value: "tag", label: t("ttsModeTag") }, { value: "always", label: t("ttsModeAlways") }, { value: "chance", label: t("ttsModeChance") }] }, common)),
					mode === "chance" ? h(Value, Object.assign({ field: "ttsChance", label: t("ttsChance"), hint: t("ttsChanceHint"), numeric: true, invalidLabel: t("invalid") }, common)) : null,
					h(Value, Object.assign({ field: "ttsMaxChars", label: t("ttsMaxChars"), hint: t("ttsMaxCharsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
					h(Value, Object.assign({ field: "ttsSpeed", label: t("ttsSpeed"), hint: t("ttsSpeedHint"), numeric: true, invalidLabel: t("invalid") }, common))),
				h(Toggle, Object.assign({ field: "ttsStripParens", label: t("ttsStripParens"), hint: t("ttsStripParensHint") }, common)),
				h(Toggle, Object.assign({ field: "ttsAlsoText", label: t("ttsAlsoText"), hint: t("ttsAlsoTextHint") }, common)),
				Sub(t("ttsWhereSub")),
				h(Toggle, Object.assign({ field: "ttsAdminPrivate", label: t("ttsAdminPrivate"), hint: t("ttsAdminPrivateHint") }, common)),
				h(Toggle, Object.assign({ field: "ttsPrivate", label: t("ttsPrivate"), hint: t("ttsPrivateHint") }, common)),
				h(Toggle, Object.assign({ field: "ttsGroup", label: t("ttsGroup"), hint: t("ttsGroupHint") }, common)),
				h("div", { className: "napcatb-field" },
					h("label", { className: "napcatb-label", htmlFor: "napcat-bridge-ttsTestText" }, h(Label, { text: t("ttsTestText"), hint: t("ttsTestUsesForm") })),
					h("input", { id: "napcat-bridge-ttsTestText", className: "napcatb-input", type: "text", maxLength: 200, placeholder: t("ttsTestDefault"), value: text, onChange: function (e) { setText(e.target.value); } })),
				Sub(t("breezeSub")),
				h(Secret, Object.assign({ field: "breezeApiKey", label: t("ttsApiKey"), hint: t("breezeKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)),
				G(h(Value, Object.assign({ field: "breezeVoiceId", label: t("ttsVoiceId"), hint: t("breezeVoiceHint") }, common)),
					h(Value, Object.assign({ field: "breezeModel", label: t("ttsModel"), hint: t("breezeModelHint") }, common)),
					h(Value, Object.assign({ field: "breezeLanguage", label: t("breezeLanguage"), hint: t("breezeLanguageHint") }, common))),
				h(TtsTest, { t: t, provider: "breeze", label: t("ttsTestBreeze"), state: state, text: sample, onDone: load }),
				Sub(t("inworldSub")),
				h(Secret, Object.assign({ field: "inworldApiKey", label: t("ttsApiKey"), hint: t("inworldKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)),
				G(h(Value, Object.assign({ field: "inworldVoiceId", label: t("ttsVoiceId"), hint: t("inworldVoiceHint") }, common)),
					h(Value, Object.assign({ field: "inworldModel", label: t("ttsModel"), hint: t("inworldModelHint") }, common))),
				h(TtsTest, { t: t, provider: "inworld", label: t("ttsTestInworld"), state: state, text: sample, onDone: load }));
		}
		//#endregion
		/** 有改动还没保存时，贴在页面底部的保存栏（dsh 自带的保存按钮在整页最下面，改完上面的设置容易找不到） */
		function SaveBar(props) {
			var t = props.t, st = props.state;
			if (!st.dirty) return null;
			return h("div", { className: "napcatb-saveBar", role: "region", "aria-label": t("unsavedBar") },
				h("span", { className: "napcatb-saveText" }, t("unsavedBar")),
				h("div", { className: "napcatb-saveBtns" },
					h(P.Button, { size: "sm", disabled: st.saving, onClick: props.discard }, t("discardChanges")),
					h(P.Button, { size: "sm", disabled: st.saving || !st.writable, onClick: props.save }, st.saving ? t("saving") : t("save"))));
		}
		function SettingsPage(props) {
			var t = props.t;
			if (props.view === "summary") return t("summary");
			var state = props.useNapcatForm(function (s) { return s; });
			var disabled = !state.writable || state.saving;
			var common = { t: t, state: state, disabled: disabled, edit: props.edit, resetField: props.resetField };
			var sttMode = state.sttMode.text || "off";
			var [tab, setTab] = React.useState(readTab);
			// 找到的 ffmpeg 在哪（「ffmpeg 位置」留空时显示在框里）
			var [ffmpegAt, setFfmpegAt] = React.useState(null);
			return h(React.Fragment, null, h(P.SettingsForm, {
				labels: { unavailable: t("unavailable"), readOnly: t("readOnly"), saveFailed: t("saveFailed"), save: t("save"), saving: t("saving") },
				state: state,
				onSave: props.save,
				onDiscard: props.discard
			},
				h(WatchBanner, { t: t }),
				h(Tabs, { t: t, cur: tab, onChange: setTab }),
				tab === "conn" ? [
					h("details", { key: "c", className: "napcatb-details" },
						h("summary", { className: "napcatb-summary" },
							h("span", { className: "napcatb-chevron", "aria-hidden": true }, "›"),
							h(Label, { text: t("connection"), hint: t("connectionHint") })),
						h("div", { className: "napcatb-detailsBody" },
							G(h(Value, Object.assign({ field: "ws_reverse_host", label: t("host"), hint: t("hostHint") }, common)),
								h(Value, Object.assign({ field: "ws_reverse_port", label: t("port"), hint: t("portHint"), numeric: true, invalidLabel: t("invalidPort") }, common)),
								h(Value, Object.assign({ field: "id", label: t("platformId"), hint: t("platformIdHint") }, common))),
							h(Secret, Object.assign({ field: "ws_reverse_token", label: t("token"), hint: t("tokenHint"), setLabel: t("tokenSet"), unsetLabel: t("tokenUnset") }, common)),
							h(NapcatSetup, { t: t, state: state, edit: props.edit, disabled: disabled }),
							h(ConnectionTest, { t: t, dirty: state.dirty }))),
					h(Section, { key: "a", title: t("access"), hint: t("accessHint") },
						G(h(Value, Object.assign({ field: "admins", label: t("admins"), hint: t("adminsHint") }, common)),
							h(Value, Object.assign({ field: "groupWhitelist", label: t("groupWhitelist"), hint: t("groupWhitelistHint") }, common)),
							h(Value, Object.assign({ field: "privateWhitelist", label: t("privateWhitelist"), hint: t("privateWhitelistHint") }, common))),
						h(Toggle, Object.assign({ field: "whitelistEnabled", label: t("whitelistEnabled"), hint: t("whitelistEnabledHint") }, common)),
						h("p", { className: "napcatb-hint" }, t("wlAdminGroup")),
						h(Toggle, Object.assign({ field: "whitelistLog", label: t("wlLog"), hint: t("wlLogHint") }, common)),
						Sub(t("rateSub")),
						G(h(Value, Object.assign({ field: "rateLimitCount", label: t("rateCount"), hint: t("rateCountHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
							h(Value, Object.assign({ field: "rateLimitSeconds", label: t("rateSeconds"), hint: t("rateSecondsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Select, Object.assign({ field: "rateLimitStrategy", label: t("rateStrategy"), hint: t("rateStrategyHint"), fallback: "stall", options: [{ value: "stall", label: t("rateStall") }, { value: "discard", label: t("rateDiscard") }] }, common)))),
					h(WatchSection, { key: "w", t: t, common: common, state: state, edit: props.edit, disabled: disabled }),
					h(Section, { key: "w", title: t("wake"), hint: t("wakeHint") },
						G(h(Value, Object.assign({ field: "wakeKeywords", label: t("wakeKeywords"), hint: t("wakeKeywordsHint") }, common)),
							h(Value, Object.assign({ field: "wake_prefix", label: t("wakePrefix"), hint: t("wakePrefixHint") }, common))),
						h(Toggle, Object.assign({ field: "friend_message_needs_wake_prefix", label: t("friendNeedsPrefix"), hint: t("friendNeedsPrefixHint") }, common)),
						h(Toggle, Object.assign({ field: "ignore_bot_self_message", label: t("ignoreSelf"), hint: t("ignoreSelfHint") }, common)),
						h(Toggle, Object.assign({ field: "emptyMentionWaiting", label: t("emptyWaiting"), hint: t("emptyWaitingHint") }, common)),
						h(Toggle, Object.assign({ field: "emptyMentionNeedReply", label: t("emptyReply"), hint: t("emptyReplyHint") }, common))),
					h(Section, { key: "m", title: t("commands"), hint: t("commandsHint") },
						h(Toggle, Object.assign({ field: "commandsEnabled", label: t("commandsEnabled"), hint: t("commandsEnabledHint") }, common)),
						h(Toggle, Object.assign({ field: "noPermissionReply", label: t("noPermissionReply"), hint: t("noPermissionReplyHint") }, common)))
				] : null,
				tab === "session" ? h(Section, { title: t("session"), hint: t("sessionHint") },
					h(Value, Object.assign({ field: "workspacePath", label: t("workspacePath"), hint: t("workspacePathHint") }, common)),
					h(Toggle, Object.assign({ field: "uniqueSession", label: t("uniqueSession"), hint: t("uniqueSessionHint") }, common)),
					Sub(t("presetSub")),
					G(h(Value, Object.assign({ field: "agentPreset", label: t("agentPreset"), hint: t("agentPresetHint") }, common)),
						h(Value, Object.assign({ field: "adminPrivateAgentPreset", label: t("adminPrivatePreset"), hint: t("presetOverrideHint") }, common)),
						h(Value, Object.assign({ field: "privateAgentPreset", label: t("privatePreset"), hint: t("presetOverrideHint") }, common)),
						h(Value, Object.assign({ field: "groupAgentPreset", label: t("groupPreset"), hint: t("presetOverrideHint") }, common))),
					Sub(t("modelSub")),
					h(ChatModelPick, Object.assign({ modelField: "adminPrivateModel", effortField: "adminPrivateReasoning", label: t("adminPrivateModel"), effortLabel: t("adminPrivateReasoning"), effortFallback: "high", blankLabel: t("modelBlankAdmin") }, common)),
					h(ChatModelPick, Object.assign({ modelField: "privateModel", effortField: "privateReasoning", label: t("privateModel"), effortLabel: t("privateReasoning"), effortFallback: "low", blankLabel: t("modelBlankDefault") }, common)),
					h(ChatModelPick, Object.assign({ modelField: "groupModel", effortField: "groupReasoning", label: t("groupModel"), effortLabel: t("groupReasoning"), effortFallback: "low", blankLabel: t("modelBlankDefault") }, common)),
					Sub(t("silenceSub")),
					h(Value, Object.assign({ field: "silenceToken", label: t("silenceToken"), hint: t("silenceTokenHint") }, common)),
					h(Toggle, Object.assign({ field: "nudgeOnEmpty", label: t("nudgeOnEmpty"), hint: t("nudgeOnEmptyHint") }, common))) : null,
				tab === "content" ? [
					h(Section, { key: "m", title: t("model") },
						h(Toggle, Object.assign({ field: "identifier", label: t("identifier"), hint: t("identifierHint") }, common)),
						h(Toggle, Object.assign({ field: "markAdmin", label: t("markAdmin"), hint: t("markAdminHint") }, common)),
						h(Toggle, Object.assign({ field: "markWake", label: t("markWake"), hint: t("markWakeHint") }, common)),
						h(Toggle, Object.assign({ field: "groupNameDisplay", label: t("groupName"), hint: t("groupNameHint") }, common)),
						h(Toggle, Object.assign({ field: "datetimeReminder", label: t("datetime"), hint: t("datetimeHint") }, common)),
						h(Toggle, Object.assign({ field: "imageToModel", label: t("imageToModel"), hint: t("imageToModelHint") }, common)),
						G(h(Value, Object.assign({ field: "timezone", label: t("timezone"), hint: t("timezoneHint") }, common)),
							h(Value, Object.assign({ field: "maxImages", label: t("maxImages"), hint: t("maxImagesHint"), numeric: true, invalidLabel: t("invalidCount") }, common)))),
					h(Section, { key: "s", title: t("stt"), hint: t("sttHint") },
						h(Select, Object.assign({ field: "sttMode", label: t("sttMode"), hint: t("sttModeHint"), fallback: "off", options: [{ value: "off", label: t("sttOff") }, { value: "command", label: t("sttCommandMode") }, { value: "openai", label: t("sttOpenai") }] }, common)),
						sttMode === "command" ? h(Value, Object.assign({ field: "sttCommand", label: t("sttCommand"), hint: t("sttCommandHint") }, common)) : null,
						sttMode === "openai" ? h(ProviderField, Object.assign({ urlField: "sttApiUrl", modelField: "sttModel" }, common)) : null,
						sttMode === "openai" ? h(Secret, Object.assign({ field: "sttApiKey", label: t("sttApiKey"), hint: t("sttApiKeyHint"), setLabel: t("keySet"), unsetLabel: t("keyUnset") }, common)) : null,
						sttMode === "openai" ? h(ModelField, Object.assign({ urlField: "sttApiUrl", modelField: "sttModel", keyField: "sttApiKey", apiPath: "api/napcat-bridge/stt/models", label: t("sttModel"), common: common }, common)) : null,
						sttMode === "openai" ? h(Value, Object.assign({ field: "sttApiUrl", label: t("sttApiUrl"), hint: t("sttApiUrlHint") }, common)) : null,
						sttMode !== "off" ? h(SttTest, { t: t, dirty: state.dirty }) : null),
					h(Section, { key: "v", title: t("video"), hint: t("videoHint") },
						h(Toggle, Object.assign({ field: "videoFrames", label: t("videoFrames"), hint: t("videoFramesHint") }, common)),
						h(FfmpegStatus, { t: t, onFound: setFfmpegAt }),
						G(h(Value, Object.assign({ field: "videoMaxFrames", label: t("videoMaxFrames"), hint: t("videoMaxFramesHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoSecondsPerFrame", label: t("videoSecondsPerFrame"), hint: t("videoSecondsPerFrameHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoMaxEdge", label: t("videoMaxEdge"), hint: t("videoMaxEdgeHint"), numeric: true, invalidLabel: t("invalid") }, common)),
							h(Value, Object.assign({ field: "videoMaxMB", label: t("videoMaxMB"), hint: t("videoMaxMBHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoMaxMinutes", label: t("videoMaxMinutes"), hint: t("videoMaxMinutesHint"), numeric: true, invalidLabel: t("invalidPositive") }, common)),
							h(Value, Object.assign({ field: "videoTimeoutSeconds", label: t("videoTimeout"), hint: t("videoTimeoutHint"), numeric: true, invalidLabel: t("invalid") }, common))),
						h(Value, Object.assign({ field: "ffmpegPath", label: t("ffmpegPath"), hint: t("ffmpegPathHint"), placeholder: ffmpegAt ? t("ffmpegPathAuto", { path: ffmpegAt }) : void 0 }, common)))
				] : null,
				tab === "send" ? h(Section, { title: t("paceSec"), hint: t("paceHint") },
					Sub(t("typingSub")),
					h(Toggle, Object.assign({ field: "typingPrivate", label: t("typingPrivate"), hint: t("typingPrivateHint") }, common)),
					h(Toggle, Object.assign({ field: "typingGroup", label: t("typingGroup"), hint: t("typingGroupHint") }, common)),
					G(h(Value, Object.assign({ field: "typingCharsPerMinute", label: t("typingCharsPerMinute"), hint: t("typingCharsPerMinuteHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "typingMinSeconds", label: t("typingMinSeconds"), hint: t("typingMinSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "typingMaxSeconds", label: t("typingMaxSeconds"), hint: t("typingMaxSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common))),
					Sub(t("groupReplySub")),
					h(Toggle, Object.assign({ field: "groupReplyMention", label: t("groupReplyMention"), hint: t("groupReplyHint") }, common)),
					h(Toggle, Object.assign({ field: "groupReplyQuote", label: t("groupReplyQuote"), hint: t("groupReplyHint") }, common)),
					Sub(t("segmentSub")),
					h(Toggle, Object.assign({ field: "segmentAdminPrivate", label: t("segmentAdminPrivate"), hint: t("segmentHint") }, common)),
					h(Toggle, Object.assign({ field: "segmentPrivate", label: t("segmentPrivate"), hint: t("segmentPrivateHint") }, common)),
					h(Toggle, Object.assign({ field: "segmentGroup", label: t("segmentGroup"), hint: t("segmentGroupHint") }, common)),
					G(h(Value, Object.assign({ field: "segmentMax", label: t("segmentMax"), hint: t("segmentMaxHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "segmentMaxSeconds", label: t("segmentMaxSeconds"), hint: t("segmentMaxSecondsHint"), numeric: true, invalidLabel: t("invalidPositive") }, common))),
					Sub(t("groupRateSub")),
					G(h(Value, Object.assign({ field: "groupMinGapSeconds", label: t("groupMinGapSeconds"), hint: t("groupMinGapSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "groupMaxPerWindow", label: t("groupMaxPerWindow"), hint: t("groupMaxPerWindowHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "groupWindowSeconds", label: t("groupWindowSeconds"), hint: t("groupWindowSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)),
						h(Value, Object.assign({ field: "sendMaxWaitSeconds", label: t("sendMaxWaitSeconds"), hint: t("sendMaxWaitSecondsHint"), numeric: true, invalidLabel: t("invalidCount") }, common)))) : null,
				tab === "voice" ? h(TtsSection, { t: t, common: common, state: state }) : null,
				tab === "log" ? h(Section, { title: t("log") },
					h(Select, Object.assign({ field: "logLevel", label: t("logLevel"), hint: t("logLevelHint"), fallback: "info", options: LOG_LEVELS.map(function (l) { return { value: l, label: l }; }) }, common))) : null), h(SaveBar, { t: t, state: state, save: props.save, discard: props.discard }));
		}
		//#endregion

		//#region 入口
		var inject = ["slots", "locale", "configForms", "remote", "remote.settings"];

		function apply(ctx) {
			ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "napcat-bridge: dictionaries");
			var scope = ctx.configForms.get(SECTION);
			var model = createForm(scope);
			ctx.effect(function () { return function () { model.form.dispose(); }; }, "napcat-bridge: form");
			var disposed = false;
			ctx.effect(function () { return function () { disposed = true; }; }, "napcat-bridge: lifetime");
			function refreshToken() {
				ctx.remote.settings.describe().then(function (response) {
					if (disposed || !response.ok) return;
					var row = response.value.namespaces.find(function (n) { return n.ns === SECTION; });
					var next = {};
					((row && row.secrets) || []).forEach(function (x) { if (x.path.length === 1) next[x.path[0]] = x.set === true; });
					model.setSecrets(next);
				}, function () {});
			}
			refreshToken();
			ctx.effect(function () { return scope.subscribe(refreshToken); }, "napcat-bridge: token state");
			ctx.effect(function () {
				return ctx.configForms.whileServed([SECTION], function () {
					return ctx.slots.inject("plugins.bundle.config", function () {
						return ctx.slots.register({
							name: "plugins.bundle.config",
							key: PACKAGE,
							locale: NS,
							inject: function () { return Object.assign({ hooks: { napcatForm: model.store } }, model.form.actions()); }
						}, SettingsPage);
					});
				});
			}, "napcat-bridge: page");
		}
		//#endregion

		exports.inject = inject;
		exports.apply = apply;
		exports.SettingsPage = SettingsPage;
		return exports;
	}
});
