# 第三方来源与许可

本插件是自研整合层，但其中有几块能力来自别的开源项目，按 MIT 的要求在此署名：

- **取稿能力（`vendor/bili-whale/`、`lib/feed/bili.js`）**
  - 来源：`Alterssss/dsh-bili-whale`（MIT）
  - 用途：B 站视频的元信息、字幕、弹幕、热评、抽帧与账号限流
  - 方式：整个包原样 vendor 进本插件，通过 `tools/bili.mjs` 调用；未修改其代码

- **证据手账 / human-world 的设计（`lib/mind/journal.js`、`lib/mind/self.js`）**
  - 参考：`InariNGT-Ofiicial/dsh-bili-humanism`（MIT，v1.11.3）
  - 借用的设计：事实 / 作者观点 / 我的推测 三栏；每天最多一句、必须带来源、可修订可撤回
  - 方式：按设计重新实现（未复制其源码）

- **生活状态、日程、梦、主动消息（`lib/body/`、`lib/speak/`）**
  - 来源：本项目自研 `dsh-dafeiyu-life`（MIT）
  - 方式：原样迁入，逻辑未变


## dsh-daily-schedule（日程规划参考）

- 上游：https://github.com/aa1355721445-lgtm/dsh-daily-schedule · MIT
- 用了它的**设计**：日子类型 + 权重挑选、时段补空档与"改一段挤开邻居"的规则、模型提示词里"只输出一个 JSON"的结构、注入里"别说按照日程"的说话方式约束、傍晚预告明天。
- 代码按 mind 的库（mind.db）和注入方式**重写**在 `lib/body/planner.js`、`lib/body/planner-llm.js`、`lib/body/plan-inject.js`、`lib/body/wardrobe.js`；没有复制它的 store/http/runner/client。
- 没有沿用它的文件存储（`<DSH_HOME>/daily-schedule/`）和设置页。

以上项目的原始版权归各自作者所有。
