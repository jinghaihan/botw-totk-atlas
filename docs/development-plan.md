# Zelda Notes 开发计划

一个项目、一个在线网页，支持 BOTW 普通模式、BOTW 大师模式及 TOTK 的多个独立 Profile。浏览器本地读取用户导入的存档，将已完成和未完成的项目对应到地图；地图与点位数据由网站提供，使用者无需安装 Recomp 或提供游戏资源。

当前已实现双游戏只读导入、独立 Profile、地图与清单、神庙宝箱筛选、手动记录、备份恢复和简繁英国际化。命令行验证已覆盖核心规则；之后已按用户许可，在隔离无头环境检查地图、详情、手机布局和无障碍，未打开用户的浏览器。下面保留原有阶段划分作为工作范围记录。所有提交使用英文 Conventional Commits，每个提交围绕一个可独立检查的改动，并完成相关验证。现阶段仅本地提交，推送和发布留待用户查看效果后另行安排。

## 架构与依赖

| 范围       | 选择                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| 应用       | 沿用 starter-vue 的 Vue 3、TypeScript、Vite、UnoCSS、VueUse 和国际化能力 |
| 页面与状态 | 单页应用，使用 Vue composables；初版移除 Vue Router、Pinia 和路由进度条  |
| 持久化     | Dexie 管理 IndexedDB、索引、事务和数据库版本迁移                         |
| 简单偏好   | VueUse 的 storage utilities，保存当前 Profile、筛选及显示设置            |
| 地图       | Leaflet 稳定版，游戏地图使用自定义坐标系和分层资源                       |
| 输入校验   | Zod 校验备份文件、目录数据与导入后的结构                                 |
| 游戏逻辑   | 各游戏单独实现只读解析器、点位目录、完成规则和坐标转换                   |

依赖在实际需要的提交中引入，并锁定版本。二进制读取使用浏览器 DataView / BigInt；数据库、地图、持久化和结构校验优先复用成熟库。

建议目录：

```text
src/
  app/                 应用外壳与主题
  domain/              Profile、点位、状态及游戏适配器契约
  storage/             Dexie 数据库及数据访问
  games/
    botw/              存档解析、版本、目录和完成规则
    totk/              存档解析、版本、目录和完成规则
  features/
    profiles/          Profile 管理
    imports/           导入预览、历史和变化比较
    map/               地图、图层、筛选与详情
    collections/       收集清单及统计
    backup/            导出与恢复
  data/                共享目录结构及来源说明
```

## 数据与交互规则

- Profile 绑定游戏和模式，具有独立名称、导入历史、自动进度、手动标记及地图视图。
- 自动识别结果与手动记录分别保存。状态包含已完成、未完成和未知，并保留判断来源。
- “不打算做”属于用户偏好。它可以隐藏点位，但不改变存档中的真实完成数。
- 导入文件先校验和预览，再以数据库事务写入。再次导入时保留手动完成记录。
- 默认存储解析结果和必要导入元信息。真实存档留在仓库外，仅用于本地验证。
- 神庙通关与宝箱领取独立判断，并建立神庙和内部宝箱的父子关系。可获得精确数量时显示已领／总数；只有整座全领标记时保留该语义。
- 洞窟、洞窟入口和魔犹伊分别建模；TOTK 呀哈哈点位数与种子数分别统计。
- 地图官方完成度与工具清单完成度分开显示；目录中的未使用条目不纳入正常收集总数。
- 神庙宝箱与野外宝箱分别核实判断规则。TOTK 神庙使用独立开启标记，不能统一套用全局 GUID 列表。
- 莱尼尔可显示位置；永久击败记录仅在确认存档存在相应标记后启用自动追踪。
- 目录按游戏、模式、版本和地图层加载。每批数据记录来源、版本、授权、数量以及已验证范围。

## 阶段一 基础与可视预览

先确认页面布局和双游戏主题，让用户尽早看到效果。演示数据明确标识，与真实导入结果区分。

- `chore: bootstrap botw-totk-atlas from starter-vue`
- `refactor: remove unused routing and state management`
- `docs: define development milestones and visual direction`
- `feat: define game and collection contracts`
- `feat: add the atlas application shell`
- `feat: add Sheikah and Purah interface themes`

验收：桌面地图区、筛选侧栏、点位详情和移动端抽屉布局可预览；主题可切换，主内容保持清晰。

## 阶段二 Profile 与本地持久化

- `feat: add versioned Dexie storage`
- `feat: add profile creation and switching`
- `feat: add profile rename and deletion`
- `feat: persist profile view preferences`

验收：创建多个同游戏或不同游戏的 Profile；切换、刷新和重开网页后，各自的进度及偏好独立。删除流程显示实际影响。

## 阶段三 游戏目录与存档解析

- `feat: add the BOTW collection catalog`
- `feat: add the TOTK collection catalog`
- `feat: parse BOTW save progress`
- `feat: parse TOTK save progress`

每款游戏的目录与解析分开提交，各自携带来源说明和必要的规则验证。优先覆盖神庙、呀哈哈、宝箱、塔／树根、探索地点和大型敌人，随后扩展其余类别。

验收：识别游戏和支持的存档版本；错误文件不会写入 Profile。使用合成样本检查关键规则，并在仓库外用用户的三个真实档作只读比对。普通／大师模式、DLC、版本新增项、神庙宝箱和正常通关回档状态都有明确处理。

## 阶段四 导入与进度更新

- `feat: add save import preview and validation`
- `feat: apply imported progress to profiles`
- `feat: compare successive save imports`

验收：显示文件、游戏、版本、目标 Profile 和识别范围；确认导入后更新自动状态。再次导入可以查看新增完成项与手动记录冲突。

## 阶段五 真实地图与查漏

- `feat: add Leaflet map rendering`
- `feat: add game-specific map layers`
- `feat: add collection markers and point details`
- `feat: add category and progress filters`
- `feat: filter cleared shrines with unopened chests`
- `feat: search chest rewards and locations`

验收：BOTW 地图与 TOTK 天空／地表／地底均可切换；点位详情显示状态来源、位置和奖励。神庙可显示对应宝箱，并筛选已通关但宝箱未全领的项目。大量点位保持流畅，按需加载目录与图片。

## 阶段六 手动追踪与补充清单

- `feat: add manual point completion`
- `feat: add collection summaries and checklist views`

补充内容包括任务、图鉴、服装，以及 TOTK 食谱、布料和无腐朽武器刷新资格。服装追踪获取记录。地图类别扩展至回忆／龙之泪、设施、古旧地图、贤者的遗志、依盖队设计图、蓝图石板、广告牌和古代石碑。

验收：用户可以手动记录完成状态，重新导入后保留记录。

## 阶段七 备份与完整验收

- `feat: export profile and workspace backups`
- `feat: restore validated progress backups`
- `fix: resolve cross-game import and tracking discrepancies`

验收：单 Profile 和全部数据可导出；恢复时校验结构、版本与冲突，失败时保持原数据。核对三个档的实际结果、移动端交互和浏览器重开后的持久化。

## 验证与提交粒度

常规检查沿用模板的 lint、typecheck 和 build。数据库隔离、事务恢复、关键二进制解析与导入冲突需要针对性的验证；必要检查跟随相关功能提交完成。视觉改动通过实际页面检查，演示数值不作为解析成功的证据。

一个提交只解决一个独立问题；界面、目录、解析器和持久化不攒成一个大型提交。测试文件和验证材料不包含用户的真实存档。

## 参考

- [Dexie Vue documentation](https://dexie.org/docs/Tutorial/Vue)
- [Leaflet stable API](https://leafletjs.com/reference-1.9.4.html)
- [Zod](https://zod.dev/)
- [Visual direction](visual-direction.md)
