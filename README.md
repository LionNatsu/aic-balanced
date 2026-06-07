# AIC Balanced — 生产配平工具

根据游戏配方文件，反向推导生产目标产物所需的原料。类似化学方程式配平。

## 安装

```bash
bun install
```

## 用法

```bash
bun run src/index.ts <配方文件> <目标>...
```

目标格式：`[数量]物品名`，数量省略为 1。

### 示例

```bash
# 单个目标
bun run src/index.ts recipes.txt 赫铜块

# 带数量
bun run src/index.ts recipes.txt 3赫铜块

# 多目标联产
bun run src/index.ts recipes.txt 3赫铜块 2蓝铁瓶
```

输出（stderr=步骤明细，stdout=配平方程）：

```
$ bun run src/index.ts recipes.txt 赫铜块

steps:
  8x 赤铜粉末 + 沉积酸    = 赤铜溶液
  8x 赤铜块               = 赤铜粉末
  8x 赤铜矿 + 清水        = 赤铜块 + 污水
  2x 4赤铜溶液            = 赫铜溶液 + 沉积酸
  1x 2赫铜溶液 + 蓝铁粉末 = 赫铜块 + 污水
  1x 蓝铁块               = 蓝铁粉末
  1x 蓝铁矿               = 蓝铁块
6沉积酸 + 8赤铜矿 + 蓝铁矿 + 8清水 = 赫铜块 + 9污水
```

stdout 为纯方程，可被管道消费：

```bash
bun run src/index.ts recipes.txt 赫铜块 2>/dev/null
# 6沉积酸 + 8赤铜矿 + 蓝铁矿 + 8清水 = 赫铜块 + 9污水
```

## 配方文件格式

```
@raw 沉积酸

赤铜矿 + 清水 = 赤铜块 + 污水
赤铜块 = 赤铜粉末
赤铜粉末 + 沉积酸 = 赤铜溶液
4赤铜溶液 = 赫铜溶液 + 沉积酸
2赫铜溶液 + 蓝铁粉末 = 赫铜块 + 污水
蓝铁矿 = 蓝铁块
蓝铁块 = 蓝铁粉末
```

- 等号左边是输入，右边是输出
- 数字前缀表示系数（省略则为 1）
- `#` 开头为注释
- `@raw 物品名` 标注原材料（外部可得，即使有配方产出也不展开）
- 未在任何配方右侧出现的物品自动视为原材料，无需标注
- 允许多个 `@raw` 行，建议就近标注在相关配方之前

## 开发

详见 [DEVELOPMENT.md](./DEVELOPMENT.md)
