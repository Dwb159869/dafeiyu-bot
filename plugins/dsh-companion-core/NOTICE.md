# NOTICE

dsh-companion-core is licensed under AGPL-3.0-or-later (see LICENSE). It uses or adapts the following third-party works.

## DeepSeek Harness (dsh) — MIT

- `cordis.patch.yml`: the tool rows of the "companion" preset are copied from `@deepseek-ai/dsh-web-app` 0.2.1-rc.2 `presets/standard.patch.yml` (persona row removed, compaction row replaced).
- `src/context.ts`: `CompanionContextEngine` extends `BasicCompactionEngine` from `@deepseek-ai/dsh-compaction-basic` 0.2.1-rc.2 and follows the structure of its `summarizeWithLlm()` for the summary call.

dsh packages are provided by the dsh host at runtime and are not bundled.

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## lobe-icons（服务商 logo）

设置页里服务商的 logo 取自 [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons)（npm 包 `@lobehub/icons-static-svg` 1.98.0），以 data: 图片内嵌在 `src/client/client.js` 里。这些 logo 是各厂商的商标，归各厂商所有，这里只用来在设置页里辨认服务商。

MIT License

Copyright (c) 2023 LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
