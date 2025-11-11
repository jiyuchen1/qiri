# 七日世界 - 收容物技能关系拓扑可视化

## 概要设计说明 (Concise Design Document)

### 项目架构
- **前端**: 单HTML文件，包含所有CSS和JavaScript
- **可视化库**: Cytoscape.js 配合 cola.js 布局引擎以支持WebGL性能
- **数据结构**: 基于JSON的两种主要实体类型（收容物和技能）
- **模块化设计**: 数据加载、图表构建、交互、统计分析等分离的JS模块

### 技术方法
1. **数据层**: JSON数据加载器，包含验证和通过`loadData(json)`方法进行动态替换
2. **图表层**: Cytoscape.js实例，具有用于双部图可视化的自定义样式
3. **交互层**: 点击、悬停和键盘交互的事件处理器
4. **UI层**: 控制面板用于布局切换、过滤和统计显示
5. **分析层**: Jaccard相似度计算和统计计算

### 性能策略
- 使用WebGL加速的Cytoscape.js处理大型图尺寸
- 在不同缩放级别实现细节层次（LOD）以隐藏标签和边
- 缓存昂贵计算的结果（相似度、度数计数）
- 使用Web Workers进行相似度计算以避免阻塞UI

## 示例数据 JSON

见 `data.json` 文件，包含12个收容物和25个技能，有意创建重叠以显示共同技能。

## 使用与自定义指南

### 如何运行
1. 确保已在本地Web服务器上托管文件，或直接在浏览器中打开`index.html`文件
2. 应用将自动加载`data.json`中的默认数据
3. 使用控制面板访问各种功能

### 如何替换数据
1. 准备一个新的JSON文件，格式与示例数据相同
2. 点击控制面板中的“加载数据”按钮
3. 选择您的JSON数据文件

或者，通过JavaScript API动态加载：
```javascript
// 从URL加载数据
loadData('path/to/your/data.json');

// 或直接传递JSON对象
loadData({
  containmentObjects: [...],
  skills: [...]
});
```

### 功能说明
- **布局切换**: 在双部图、力导向、圆形和网格布局之间切换
- **搜索过滤**: 按名称或标签搜索，按稀有度、类型等过滤
- **交互功能**: 悬停显示工具提示，点击节点高亮相关节点
- **高亮功能**: 
  - 高亮重合技能：突出显示被多个收容物引用的技能
  - 高亮热门技能：突出显示引用次数最多的技能
  - 显示相似度关系：计算并显示收容物之间的Jaccard相似度
- **统计面板**: 显示节点数、边数、平均度等统计信息
- **数据导入/导出**: 导出图形为PNG，导出数据为JSON
- **主题切换**: 在明暗主题之间切换

### 自定义
- 修改CSS变量来自定义颜色和样式
- 扩展JavaScript以添加新功能
- 修改HTML以重新排列UI元素

## 扩展建议与替代技术栈说明

### 扩展方向
- **技能协同推断**: 实现算法推断并可视化技能协同效应
- **社区检测**: 添加算法检测技能和收容物的社区结构
- **时间维度**: 添加对不同版本变更的比较功能
- **分布式数据源**: 实现从多个API端点聚合数据

### 替代技术栈
- **D3.js**: 更灵活但需要更多代码进行性能优化
- **Sigma.js**: 专为大型图优化的轻量级库
- **ECharts Graph GL**: 百度开发的WebGL加速图可视化库

### 性能优化说明
- 使用WebGL渲染以处理大型图（200-500个节点，150-400个技能）
- 实现LOD（细节层次）以在缩小时隐藏标签和弱边
- 使用缓存避免重复计算昂贵的指标
- 使用Worker线程处理相似度计算

## 文件结构
- `index.html`: 主应用程序文件
- `data.json`: 示例数据文件
- `large_data.json`: 用于性能测试的扩展数据文件
- `README.md`: 本使用指南
- `QWEN.md`: 项目上下文文件
## 版本化数据与导入/导出/清空（含快照回滚）改造说明

本项目保持纯静态 HTML/CSS/JS 技术栈（无后端/无打包），不引入第三方依赖。基于内置校验器与版本化信封数据格式，完成“加载数据”“清空数据（可撤销）”“导出 JSON（全量/子图）”的体系化改造。

关键模块与文件
- 版本与校验模块：scripts/modules/schema.js
- 导入导出与快照模块：scripts/modules/store.js
- 集成与按钮逻辑：scripts/inlined.js
- 页面脚本集成：index.html

一、统一的数据格式规范与版本化方案
- 顶层采用 Envelope（信封）结构：
  - version: 固定字符串，目前为 "1.0.0"
  - exportedAt: 导出时间 ISO8601 字符串
  - app: { name: "containment-skills-ui" }
  - data: 业务数据对象
- data 内部结构定义（最小可用，兼容现有页面）：
  - data.containmentObjects: 数组
    - id: string（必填，唯一）
    - name: string（必填）
    - rating: "B" | "A" | "S"（可选）
    - acquisition: "捕捉" | "融合"（可选）
    - skills: string[]（可选，技能 id 列表）
  - data.skills: 数组
    - id: string（必填，唯一）
    - name: string（必填）
    - quality: "蓝色" | "紫色"（可选）
    - cooldown: number（可选，秒）
    - effect: string（可选）
- 兼容策略
  - 兼容旧版裸数据（无 version/app/exportedAt，仅含 containmentObjects/skills 顶层）；导入时自动包装为 Envelope 并归一化。
- 示例（Envelope v1）：
  {
    "version": "1.0.0",
    "exportedAt": "2025-11-09T09:00:00.000Z",
    "app": { "name": "containment-skills-ui" },
    "data": {
      "containmentObjects": [
        { "id": "co_001", "name": "狼", "rating": "B", "acquisition": "捕捉", "skills": ["sk_howl"] }
      ],
      "skills": [
        { "id": "sk_howl", "name": "嚎叫", "quality": "蓝色", "cooldown": 5, "effect": "短时间提升队友士气" }
      ]
    }
  }

二、导入管道（加载数据）
- 入口（保持 ID 与交互不变）：
  - “加载数据”按钮会触发 file input，读取文本后交由 loadData 处理
- 处理流程
  - 解析：将文件内容转为对象
  - 迁移与校验：
    - 若为旧版裸数据，自动迁移为 Envelope v1
    - 进行 Envelope 结构校验与 data 内部项校验
    - 归一化：去重、字符串修整、数值规范化
  - 成功：更新运行态 currentData，并重建图、应用布局、刷新下拉、更新统计
  - 失败：展示用户可读错误（包含首批字段定位），不改变现有内存态
- 大文件策略
  - 当前目标 ≤5MB/≤1万条；如需扩展，可按需替换解析器为分块/流式解析（预留为后续可选项）

三、清空数据（安全与回滚）
- 操作保护：二次确认弹窗（confirm）
- 快照备份：
  - 清空之前自动将当前数据封装为 Envelope 并存入 localStorage 快照，默认有效期 24 小时
  - 清空后页面右下角出现“撤销”横幅（30 秒内可点击恢复）
- 恢复逻辑：
  - 若未过期且可解析快照存在，点击“撤销”可恢复至清空前数据并重建图
  - 快照过期或缺失时给出明确提示

四、导出功能（全量与选中子图）
- 全量导出：
  - 以 Envelope v1 结构导出当前内存态数据（pretty 格式）
  - 文件命名：containment-skills_v{version}_YYYYMMDD-HHmmss.json（本地时区，去除空格）
- 选中子图导出：
  - 以当前选中节点构造最小 data 子集（containmentObjects/skills），再封装为 Envelope 导出
  - 文件命名：containment-skills-selected_v{version}_YYYYMMDD-HHmmss.json
- 迷你化（minified）：
  - 默认 pretty，可在代码中将导出选项设置为 minified（无 UI 开关，避免界面复杂度）

五、代码结构与集成说明（最小侵入）
- 校验与迁移：scripts/modules/schema.js
  - CURRENT_VERSION、APP_NAME 可统一配置
  - 提供迁移（migrateToV1）、归一化（normalizeDataV1）、总入口（toEnvelopeV1）
- 导出与快照：scripts/modules/store.js
  - buildEnvelope（从纯 data 构建 Envelope）
  - exportEnvelopeToFile（下载 JSON 文件）
  - saveSnapshot/loadSnapshot/clearSnapshot（快照存取）
- 页面集成：scripts/inlined.js
  - 加载管道接入：processAndValidateData 使用上述模块校验+迁移+归一化后再入内存
  - 导出按钮：统一以 Envelope 导出
  - 选中子图导出：导出 Envelope 包装的子集
  - 清空按钮：清空前保存快照，显示 30s 撤销横幅，支持恢复
- 页面引入：index.html
  - 以 defer 方式引入 scripts/modules/schema.js 与 scripts/modules/store.js，避免阻塞

六、兼容性与迁移
- 旧 schema → v1 Envelope
  - 旧顶层 { containmentObjects, skills } 自动包装为 { version, exportedAt, app, data }
  - data 内部执行去重/规范化
  - 无法满足必填项（如 id/name 缺失）的条目将导致导入失败并给出定位（前若干条）
- 拒绝导入策略
  - 版本号与 app 名仅做基本校验；若 data 结构不合法则直接拒绝，保留原态

七、测试与验证建议（无测试框架情况下）
- 手动用例
  - 正常导入：包含收容物/技能/关联的完整 Envelope
  - 旧格式导入：仅有 containmentObjects/skills 顶层
  - 字段缺失：缺少 id/name/skills（应给出定位错误）
  - 清空后撤销：在 30s 内点击撤销应恢复；超时提示失败
  - 大数据：尝试 3–5MB 文件，观察加载性能与 UI 交互
- 自动化（可选拓展）
  - 后续可添加轻量脚本在浏览器控制台中运行校验函数对样本集批量验证

八、安全与隐私注意事项
- 白名单字段：仅接收 Envelope 结构与 data 内预定义字段，其他字段不影响运行也不会导出
- 阻止原型污染：仅以深拷贝和字段检查的方式处理对象
- XSS 防护：仅将数据写入 DOM 的文本，不注入 HTML 标记

九、可配置项（集中位置）
- 版本号与应用名：scripts/modules/schema.js
- 快照 TTL：scripts/modules/store.js（默认 24h，可按需调整）
- 导出文件命名规则：scripts/modules/store.js（makeFileName）

十、回滚方案
- 若导入/清空改造引入问题：
  - 将 index.html 移除对 scripts/modules/schema.js 与 scripts/modules/store.js 的引入
  - 在 scripts/inlined.js 内恢复旧实现（导入直接使用旧结构，导出直接导出 currentData）
  - 已导出的 Envelope 文件仍可通过当前导入管道识别并处理为 data

常见问题（FAQ）
- 旧 data.json 还能直接用吗？
  - 可以。导入时将自动迁移为 v1 Envelope，并进行字段校验与规范化。
- 导出为什么包含 version/exportedAt/app？
  - 便于追溯来源与版本，也方便未来兼容升级。
- 清空后能否长期撤销？
  - 页面提供 30 秒内的快速“撤销”按钮；本地快照默认保留 24 小时，过期后将无法恢复。

## 高亮算法

现在：当我点击技能节点的时候，会高亮与之相连的收容物节点，同时高亮这些收容物中2个及以上收容物共同拥有的技能，和与这些高亮收容物的连线（使用红色高亮）

我希望：共同拥有的技能和与这些高亮收容物的连线 每一组使用不同的颜色，比如：高亮收容物a和高亮收容物b 共同拥有技能1，技能1和收容物a、b 的连线使用红色高亮，高亮收容物c和高亮收容物d 共同拥有技能2，技能2和收容物c、d 的连线使用蓝色高亮。

<!-- 同时 这些高亮收容物之中，将 仅有点击的技能节点作为交集的 收容物 高亮颜色改为蓝色 -->