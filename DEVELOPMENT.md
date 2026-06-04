# 开发规范

## Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>: <简短描述>

[可选正文]

[可选脚注]
```

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
# 安装依赖
bun install

# 运行
bun run src/index.ts recipes.txt 赫铜块

# 类型检查
bun run --no-bundler tsc --noEmit
```

## 待办

- [ ] 多目标同时求解
- [ ] 按配方加权选最优路径（当前只选第一个）
- [ ] 分数/小数系数支持
- [ ] 单元测试
