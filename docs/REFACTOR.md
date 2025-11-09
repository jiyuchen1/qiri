# 可逐步落地的零构建重构方案（保持功能与布局不变）

本方案遵循你的约束：零构建纯静态、现代浏览器（Chrome/Edge/Firefox 最新版与移动端 Chrome/Safari）、第三方库继续使用 CDN、允许新增目录与文件拆分但保持入口引用不变。目标是在不引入视觉回归与功能变更的前提下，显著提升可维护性、可扩展性与性能，并提供低风险、可回滚、可渐进迁移的路径。

---

## 一、现状专业评估

- 单文件体量与职责过载
  - [index.html](index.html) 超 1200 行，内联脚本占据主体逻辑（图谱初始化、数据处理、布局、交互、导入导出、统计、主题、筛选、提示、侧栏等）。
  - 典型全局标识与状态变量：`cy、originalData、currentData、jaccardSimilarities、degreeCounts、isDarkTheme、isBipartiteLayout`，位于 [全局区](index.html:242)。
  - 事件集中绑定在 [bindEventHandlers()](index.html:532)，覆盖了加载/导出、布局切换、添加/关联、搜索/筛选、按钮与 LOD 缩放等。

- 重复与内联
  - 样式文件 [assets/styles.css](assets/styles.css) 中存在明显的重复块（自 67 行起重复了上方样式段），需要去重与合并。
  - index.html 中存在较多模板字符串拼接生成 HTML（节点详情/tooltip），适合抽离为模板函数。

- 依赖与加载顺序
  - 外部依赖：Cytoscape 主库与布局插件基于 CDN（必须保留）。
  - 本地工具：已有 [scripts/utils.js](scripts/utils.js) 的存取封装；新增模块已按 defer 顺序引入，位于 Cytoscape 之后，保证运行时依赖可用。

- 选择器、数据属性与耦合点
  - JS 强依赖 id 选择器与 data 字段，如侧栏 `#sidebar`、`#nodeDetails`、表单控件与多个按钮 id、图容器 `#cy` 等；图节点数据字段（`type、rarity、rating、acquisition、skills、quality、cooldown...`）与 UI/样式绑定关系紧密。
  - Cytoscape 样式 selector 基于 data 属性（如 `node[type="skill"]`），不可随意调整。

- SEO 与可访问性（a11y）
  - 语义化结构尚可，但侧栏、tooltip 等动态内容建议补充 aria 属性与可聚焦管理（本期不强制修改 DOM 结构，优先稳定性；可在渐进阶段增强）。

- 主要风险点
  - 将内联脚本直接重写为模块易引入初始化时序/作用域变化风险（事件未绑定、cy 未就绪）。
  - 对关键 id/类名/选择器的任意改动会破坏现有交互与样式。
  - 图数据字段的结构契约（schema）变动会破坏统计、筛选、tooltip、详情等功能。

---

## 二、目标架构与选型（零构建静态）

- 选型约束
  - 零构建纯静态：保留 index.html 为入口，不增加打包链路。
  - 依赖边界：第三方继续 CDN；本地 JS 采用 IIFE 模式向 `window.Modules.*`/`window.*` 暴露，避免模块加载器耦合。
  - 目录结构清晰、职责分层，便于后续渐进式抽取。

- 目标目录结构（增量）
  - 已创建
    - scripts/modules/state.js：全局 UI/主题/布局偏好的状态读写兼容层
    - scripts/modules/dom.js：通用 DOM 查询、侧栏标题设置、下拉刷新（与 index.html 兼容）
  - 规划新增（可按阶段逐步创建与迁移）
    - scripts/modules/graph.js：图初始化、布局切换、相似度计算、统计与高亮等图相关逻辑
    - scripts/modules/data.js：数据加载/验证、度数计算、元素构建、导出/子图导出封装
    - scripts/modules/events.js：事件统一绑定与解绑（先提供接口，避免与现有 bindEventHandlers 重复绑定）

- 命名约定
  - JS 命名空间：`window.Modules.{State,DOM,Graph,Data,Events}` 与兼容别名（如 `window.refreshLinkSelects`）；
  - CSS：沿用现有类与 id，不进行破坏性改名；新增类采用 BEM 或约定式命名：`block__elem--mod`；
  - 文件名：kebab-case。

---

## 三、两套可行路径与取舍

1) 零构建纯静态（本期实施）
   - 优点：无构建依赖、部署与本地预览简单、符合既有约束、风险最低。
   - 缺点：代码分割与缓存粒度较粗，跨文件依赖通过全局命名空间维护。
   - 迁移成本：低；可阶段化迁移函数，不改变入口与 DOM/选择器。

2) 构建方案（仅供未来参考，暂不实施）
   - ESM + 轻量打包（Vite/Rollup）+ 模板分片；
   - 优点：Tree-shaking、代码分割、缓存优化、类型支持；
   - 缺点：引入工具链与部署变更，需团队共识与时间窗口；
   - 迁移成本：中高；需将全局 API 收敛为模块导出、替换全局变量与脚本标签。

---

## 四、组件化与分层策略（零构建）

- 结构拆分（UI 组件视角）
  - 控制面板（数据管理/布局切换/筛选/可视化控制）
  - 顶部工具栏（缩放/适配）
  - 主题切换按钮
  - 统计面板
  - 图例
  - Tooltip 提示
  - 侧栏（节点详情）
- JS 分层
  - State：主题/布局/本地存储持久化（已上线 [setTheme()](scripts/modules/state.js:29)、[persistUI()](scripts/modules/state.js:48)）
  - DOM：选择器工具、侧栏标题设置、下拉刷新（已上线 [refreshLinkSelects()](scripts/modules/dom.js:14)）
  - Data：加载/校验/导出与子图导出、度数统计（规划）
  - Graph：Cytoscape 初始化、布局应用、相似度、热门/重合高亮、统计（规划）
  - Events：事件集中化绑定（规划，避免与 [bindEventHandlers()](index.html:532) 重复，先提供 attach 接口）

- 输入输出与依赖关系
  - Graph/Events 依赖 State（主题、布局偏好）与 Data（currentData）；
  - DOM 模块仅提供视图辅助，不直接修改数据；
  - 所有模块通过 `window.Modules.*` 访问，避免模块加载器依赖。

---

## 五、CSS 重构规划（保持选择器不变）

- 去重与合并
  - 清理 [assets/styles.css](assets/styles.css) 67 行后的重复样式段，合并为单一声明块，按原顺序保留关键渲染路径样式。
- 拆分建议（渐进）
  - assets/css/base.css（reset、排版、主题）
  - assets/css/layout.css（布局容器、侧栏/面板/工具栏）
  - assets/css/components/*.css（legend、tooltip、stats 等）
  - 首期保持 styles.css 入口不变，逐步将规则移动到新文件，并在 index.html 中用 link 标签追加引用；为避免顺序问题，保持 styles.css 最后引入，保证现有特异性与覆盖顺序一致。
- 命名与特异性
  - 不修改现有 id/类名；新增类采用 BEM，避免全局污染；
  - 提升一致性：引入 CSS 变量（色板/间距）可作为后续增量，不影响现状。

---

## 六、JS 重构规划（保持 API/数据契约不变）

- 现已完成
  - 防御性修复：空值保护、`cy.autoungrabify(true)`、新增节点数据字段同步，修复“新节点悬浮/详情不显示与黏附拖拽”问题（详见 [initializeApp() 插入](index.html:392)、新增节点处的 `ungrabify()`）。
  - 下拉同步：在加载/清空/新增后调用 [refreshLinkSelects()](index.html:669, index.html:700, index.html:441, index.html:397)。
  - 侧栏标题与字段顺序重构：收容物/技能详情的标题与字段显示已按要求调整（[showNodeDetails()](index.html:871)）。

- 渐进迁移清单（建议分 4 PR 执行）
  1) 将 `persistUIState()/restoreUIState()` 迁移至 Modules.State，保留原函数对外名，内部调用模块方法（兼容层）；目标参考 [persistUIState()](index.html:1182)、[restoreUIState()](index.html:1201)。
  2) 将 `createBipartiteLayout()/applyLayout()` 迁移至 Modules.Graph，index.html 调用转发。
  3) 将 `calculateDegreeCounts()/buildGraphData()` 迁移至 Modules.Data，保持 `window.loadData` 入口不变。
  4) 将 `bindEventHandlers()` 中各子域事件拆为 Events 子模块方法，并在 index.html 中依次调用以保持时序。

- 加载策略
  - 按照 index.html 现有顺序以 `defer` 加载模块，确保 DOMReady 前后逻辑顺序不变；
  - 非关键模块保持惰性（仅暴露 API，不主动绑定），避免双重绑定。

---

## 七、性能与资源优化计划（不改变体验）

- JS/CSS
  - 去重样式、拆分为多个文件后仍通过浏览器并发/HTTP2 加载；控制文件数量，保留缓存友好命名。
  - 使用 `defer`（已用）与必要的逻辑分摊到用户交互后（如相似度线计算）；
- 第三方脚本
  - 保持 CDN；可添加 `dns-prefetch/preconnect` 指向 cdn 域名以优化握手（可选，默认不改动）。
- 图片/SVG/字体
  - 导出的 PNG/SVG 不影响首屏；项目内若引入图标可优先使用系统字体或本地图标字体（后续增量）。
- 缓存与代码分割
  - 零构建下通过文件拆分与长期缓存头（由服务器配置）提升缓存命中；
- 验证指标与方法
  - Lighthouse（桌面/移动）：确保 LCP/CLS/FID 不回退；
  - 粗略基线：首次交互（TTI）变化 < 5%、LCP 不回退 > 50ms；
  - 对比法：重构前后在同一数据集与机器上跑 3 次取均值。

---

## 八、兼容与降级策略

- 目标范围：现代浏览器与主流移动端；
- 降级：
  - 若 `cy.svg()` 不存在已经有 alert 兜底；
  - 拖拽禁用已通过 `cy.autoungrabify(true)` 全局设定；如需临时拖动，可增加开关按钮（后续增量，默认不改）。

---

## 九、SEO 与可访问性

- 保留现有 meta 与标题；
- 建议（不强制）：为侧栏与 tooltip 增加 aria 标签与 role，tab 索引控制与焦点管理（后续增量）；
- 社交预览（OpenGraph/Twitter）：若项目需要分享，可在不变更 UI 的前提下扩展 head。

---

## 十、交付物与文件职责

- 新增模块（已交付）
  - [scripts/modules/state.js](scripts/modules/state.js)：
    - 提供 `AppState.init/getState/setTheme/setBipartite/persistUI/restoreUI`，兼容现有本地存储与主题切换逻辑；
  - [scripts/modules/dom.js](scripts/modules/dom.js)：
    - 提供 `Modules.DOM.$/$$/setSidebarTitle/refreshLinkSelects`，并注入全局兼容别名 `window.refreshLinkSelects`；

- 规划新增模块（后续 PR 逐步交付）
  - scripts/modules/graph.js：布局/统计/相似度/高亮等图操作 API
  - scripts/modules/data.js：数据加载/校验/导出/构建元素 API
  - scripts/modules/events.js：绑定/解绑/分域事件 API

- 入口改动
  - [index.html](index.html) 已追加模块脚本标签顺序（保留原 main.js），不改变已有功能时序。

- 现有文件保留
  - [assets/styles.css](assets/styles.css)、[scripts/utils.js](scripts/utils.js)、[scripts/main.js](scripts/main.js)

---

## 十一、本地与生产运行（零构建）

- 本地预览
  - 直接双击打开 [index.html](index.html) 或
  - `python -m http.server 8080` 然后访问 http://localhost:8080/
- 生产部署
  - 作为静态资源部署到任意静态服务（CDN/对象存储等），无需构建流程。

---

## 十二、迁移步骤与回滚策略

- 步骤（建议按 PR 顺序）
  1) 引入 modules 脚本标签（已完成），创建 state/dom 模块（已完成）；
  2) 将 UI 状态持久化函数转发到 Modules.State（保持对外函数名）；
  3) 迁移布局函数到 Modules.Graph，并将 index.html 调用指向新 API；
  4) 迁移数据构建/度数计算到 Modules.Data；
  5) 迁移事件子域到 Modules.Events；
  6) 去重 CSS，拆分文件并按顺序追加到 head（styles.css 保持在最后覆盖）。

- 回滚
  - 任一步出现问题，可撤销对应 PR，因入口与对外 API 未变更，快速恢复；
  - 每步迁移后运行冒烟测试（见下）。

---

## 十三、回归测试清单与验证步骤

- 视觉一致性
  - 控制面板、工具栏、主题切换、统计、图例、tooltip、侧栏显示一致，Dark/Light 主题一致；
- 交互流程
  - 加载默认 data.json；悬浮 tooltip 显示；点击节点侧栏详情显示；右键清除高亮；
  - 添加收容物/技能；“关联：选择收容物/技能” 下拉可选择并建立边；
  - 各布局按钮可用；重置/适配生效；搜索/筛选可用；
  - 高亮重合/热门/相似度开关可用；导出全量/选中子图/PNG/SVG 可用；
- 表单与校验
  - 名称长度校验、重复名称校验、JSON 载入错误提示；
- 焦点与滚动
  - 侧栏展示时滚动正常；tooltip 不遮挡主要区域；
- 第三方脚本时序
  - Cytoscape 与插件加载成功，无控制台异常；
- 存储与主题
  - 主题切换与标签显隐状态持久化（本地存储键保持不变）；
- 性能
  - Lighthouse 与交互流畅度无显著回退；

---

## 十四、风险点与缓解措施

- 双重事件绑定
  - 模块不主动绑定，提供 attach 接口，由 index.html 单点调用；
- 作用域污染
  - 模块用 IIFE 暴露到 `window.Modules`，避免全局命名冲突；
- 样式覆盖顺序
  - 保持 styles.css 在最后引入，新增 CSS 放在其前面；先去重再拆分；
- 数据契约
  - `currentData` 等对外约定不变；节点 data 字段保持原名与含义；

---

## 十五、评审关注点与协作建议

- 统一代码风格（2 空格缩进、命名一致、注释完整）；
- 分阶段提交：小步迭代、可回滚；
- 评审重点：初始化时序、事件绑定边界、选择器与 data 字段保持不变、错误处理与空值保护充足；

---

## 十六、提交拆分策略与示例消息（Conventional Commits）

- `chore(structure): add zero-build module scaffolding (state/dom) and script tags`
- `refactor(state): migrate persist/restore UI state to Modules.State with compatibility`
- `refactor(graph): extract layout & stats APIs to Modules.Graph`
- `refactor(data): move degree counts & element build to Modules.Data`
- `refactor(events): split bindEventHandlers into domain-specific attach methods`
- `fix(ui): refresh link selects on data changes and file load`
- `style(css): deduplicate styles, prepare component-level partials`
- `docs(refactor): add docs/REFACTOR.md with plan and migration steps`

---

## 十七、已交付与下一步

- 已交付
  - 脚本标签改造（不改变入口与顺序）
  - 模块： [scripts/modules/state.js](scripts/modules/state.js)，[scripts/modules/dom.js](scripts/modules/dom.js)
  - Bug 修复与易用性改进：拖拽禁用、防御性空值、下拉联动与初始化

- 下一步（建议立刻执行）
  - 新建空壳：`scripts/modules/graph.js、data.js、events.js`（仅暴露 API，不做绑定）
  - 第二阶段迁移：将 UI 状态持久化转发至 Modules.State，保持 `persistUIState/restoreUIState` 对外不变
  - 去重 styles.css 中重复块并提交对比截图与 Lighthouse 报告
