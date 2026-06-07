# 开发规范

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>: <简短描述>

[可选正文]

[可选脚注]
```

**提交前必须同步更新相关文档**（README、DEVELOPMENT 等），不允许文档落后于代码。

### Type 类型

| type       | 说明                   |
| ---------- | ---------------------- |
| `feat`     | 新功能                 |
| `fix`      | 修复 bug               |
| `docs`     | 文档变更               |
| `refactor` | 重构（不改变功能）     |
| `perf`     | 性能优化               |
| `test`     | 测试相关               |
| `chore`    | 构建、依赖、工程配置   |

### 示例

```
feat: 支持多目标产物同时求解
fix: 单输入配方解析错误
docs: 补充配方文件格式说明
refactor: 提取 parseSide 为独立函数
```

## 代码风格

- TypeScript + ESNext 模块
- 严格模式 (`strict: true`)
- 不使用 `any`，用明确的类型或 `unknown`
- 函数单一职责，保持简短
- 注释使用中文（面向中文玩家社区）

## 算法设计

### 购物清单回溯法

从目标产物出发，沿配方图逆向展开：

```
needed = {目标: 数量}
while needed 非空:
  取一个需求物品
  ├─ 有库存 → 优先抵扣
  ├─ 是原材料（@raw 或自动检测）→ 记录消耗，不展开
  └─ 否则 → 选配方展开：
       配方产出 → 冲减需求 + 溢出进库存
       配方投入 → 加入需求列表
```

### 配方选择

同一物品有多个配方时，三级评分：

1. **库存命中数**：输入项在 available 中有库存 → +1（累加）
2. **总输入系数**：越小越好（`sum(inp.coeff)`），省料优先
3. **原材料数**：输入中含 `@raw` 标记的物品多者优先

同分最终以文件顺序兜底，但正常不应到达此级。

### 副产品

多余产物原样保留在副产品列表中，不做额外转化。

### 原材料判定

1. 自动：未在任何配方 `=` 右侧出现过的物品
2. 手动：文件中的 `@raw 物品名` 指令

### 已知局限

- 贪心算法，不保证全局最优（多配方分支选错可能走远路）
- 配方图中存在循环且循环内产物非原材料时，会触及 20000 轮上限报错

## 项目结构

```
src/
├── index.ts     # CLI 入口，参数解析与输出格式化
├── types.ts     # 共享类型定义
├── parser.ts    # 配方文件解析
└── solver.ts    # 求解算法
```

## 配方文件格式

格式说明见 [README.md](./README.md) 中「配方文件格式」一节。

解析器实现在 `src/parser.ts`，如需扩展语法应先更新该文件。

## 运行

```bash
bun install          # 安装依赖
bun start            # 运行（需传参，见 README）
bun run src/index.ts recipes.txt 赫铜块
```

## 代码质量

```bash
bun check            # Biome: lint + format + organize imports
bun typecheck        # tsc --noEmit 类型检查
```

配置：`biome.jsonc`（2 空格缩进、单引号、行宽 100）

## 待办

- [x] 多目标同时求解
- [ ] 全局最优化配方选择（当前贪心 + 三级评分，非全局最优）
- [ ] 单元测试
- [ ] 配方验证：检测悬空引用（非 raw 且无配方的物品）
