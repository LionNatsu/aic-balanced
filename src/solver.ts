import type { Recipe, RecipeStep, SolveResult, Term } from './types';

/** 从库存消费指定数量，返回剩余需求 */
function consume(map: Map<string, number>, key: string, amount: number): number {
  const stock = map.get(key) ?? 0;
  if (stock <= 0) return amount;
  const use = Math.min(amount, stock);
  const remain = stock - use;
  if (remain <= 0) map.delete(key);
  else map.set(key, remain);
  return amount - use;
}

/**
 * 购物清单法求解：
 * 已知原材料集合（不展开），从目标产物出发沿配方逆向推导。
 * 副产品库存自动抵扣后续需求。O(n) 复杂度，适合 DAG 配方图。
 */
export function solve(
  target: string,
  targetAmount: number,
  recipes: Recipe[],
  rawMaterialSet: Set<string>,
): SolveResult {
  // 需要获取的物品 → 数量
  const needed = new Map<string, number>();
  // 副产品库存
  const available = new Map<string, number>();
  // 配方调用记录 (raw → count)
  const steps = new Map<string, number>();
  // 最终原料消耗
  const rawMaterials = new Map<string, number>();

  // 建立 "产物 → 配方列表" 索引
  const producers = new Map<string, Recipe[]>();
  for (const r of recipes) {
    for (const out of r.outputs) {
      const list = producers.get(out.item) || [];
      list.push(r);
      producers.set(out.item, list);
    }
  }

  needed.set(target, targetAmount);

  let iterations = 0;
  const MAX_ITERATIONS = 20000;

  while (needed.size > 0) {
    if (++iterations > MAX_ITERATIONS) {
      const remaining = [...needed.entries()].map(([k, v]) => `${v}${k}`).join(', ');
      throw new Error(
        `求解超过 ${MAX_ITERATIONS} 轮，请检查配方是否存在循环依赖。剩余: ${remaining}`,
      );
    }

    // 选一个需求物品：优先选有库存可用的
    let item: string | undefined;
    for (const key of needed.keys()) {
      if ((available.get(key) ?? 0) > 0) {
        item = key;
        break;
      }
    }
    if (!item) {
      const next = needed.keys().next();
      if (next.done) break;
      item = next.value;
    }
    const needAmount = needed.get(item) ?? 0;
    if (needAmount <= 0) {
      needed.delete(item);
      continue;
    }

    // ---- 1. 使用库存 ----
    const remain = consume(available, item, needAmount);
    if (remain < needAmount) {
      if (remain <= 0) needed.delete(item);
      else needed.set(item, remain);
      continue;
    }

    // ---- 2. 原材料 → 记录消耗，不展开 ----
    if (
      rawMaterialSet.has(item) ||
      !producers.has(item) ||
      (producers.get(item)?.length ?? 0) === 0
    ) {
      rawMaterials.set(item, (rawMaterials.get(item) ?? 0) + needAmount);
      needed.delete(item);
      continue;
    }

    // ---- 3. 选配方展开 ----
    const candidates = producers.get(item);
    if (!candidates || candidates.length === 0) {
      rawMaterials.set(item, (rawMaterials.get(item) ?? 0) + needAmount);
      needed.delete(item);
      continue;
    }
    const recipe = selectRecipe(candidates, available, rawMaterialSet, item);
    const outputTerm = recipe.outputs.find((o) => o.item === item);
    if (!outputTerm) {
      rawMaterials.set(item, (rawMaterials.get(item) ?? 0) + needAmount);
      needed.delete(item);
      continue;
    }
    const batches = Math.ceil(needAmount / outputTerm.coeff);

    // 记录步骤
    steps.set(recipe.raw, (steps.get(recipe.raw) ?? 0) + batches);

    // 该物品需求已满足
    const produced = outputTerm.coeff * batches;
    const surplus = produced - needAmount;
    needed.delete(item);
    if (surplus > 0) {
      available.set(item, (available.get(item) ?? 0) + surplus);
    }

    // 配方的其他产出 → 库存
    for (const out of recipe.outputs) {
      if (out.item !== item) {
        available.set(out.item, (available.get(out.item) ?? 0) + out.coeff * batches);
      }
    }

    // 配方的投入 → 加入需求
    for (const inp of recipe.inputs) {
      const required = inp.coeff * batches;
      const toNeed = consume(available, inp.item, required);
      if (toNeed > 0) {
        needed.set(inp.item, (needed.get(inp.item) ?? 0) + toNeed);
      }
    }
  }

  // ---- 副产品回收 ----
  recycleByproducts(available, rawMaterials, recipes, rawMaterialSet, steps);

  // 构建结果
  const rawTerms: Term[] = [...rawMaterials.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, coeff]) => ({ item, coeff }));

  const byproductTerms: Term[] = [...available.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, coeff]) => ({ item, coeff }));

  const stepList: RecipeStep[] = [...steps.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([raw, count]) => ({ raw, count }));

  return {
    steps: stepList,
    rawMaterials: rawTerms,
    byproducts: byproductTerms,
    target: { item: target, coeff: targetAmount },
  };
}

/**
 * 从候选配方中选最优的。
 * 策略：优先选择输入项中已经有库存的配方。
 */
function selectRecipe(
  candidates: Recipe[],
  available: Map<string, number>,
  rawMaterialSet: Set<string>,
  targetItem: string,
): Recipe {
  // 评分：库存命中 > 产出系数大 > 总输入系数小 > 含原材料多 > 文件顺序
  let best = candidates[0];
  let bestStock = -1;
  let bestYield = -1;
  let bestCost = Infinity;
  let bestRaw = -1;
  for (const r of candidates) {
    let stock = 0;
    let cost = 0;
    let raw = 0;
    for (const inp of r.inputs) {
      if ((available.get(inp.item) ?? 0) > 0) stock++;
      cost += inp.coeff;
      if (rawMaterialSet.has(inp.item)) raw++;
    }
    const yld = r.outputs.find((o) => o.item === targetItem)?.coeff ?? 1;
    if (
      stock > bestStock ||
      (stock === bestStock && yld > bestYield) ||
      (stock === bestStock && yld === bestYield && cost < bestCost) ||
      (stock === bestStock && yld === bestYield && cost === bestCost && raw > bestRaw)
    ) {
      bestStock = stock;
      bestYield = yld;
      bestCost = cost;
      bestRaw = raw;
      best = r;
    }
  }
  return best;
}

function recycleByproducts(
  available: Map<string, number>,
  rawMaterials: Map<string, number>,
  recipes: Recipe[],
  rawMaterialSet: Set<string>,
  steps: Map<string, number>,
): void {
  // 建立 "消耗物 → 配方列表" 索引
  const consumers = new Map<string, Recipe[]>();
  for (const r of recipes) {
    for (const inp of r.inputs) {
      const list = consumers.get(inp.item) || [];
      list.push(r);
      consumers.set(inp.item, list);
    }
  }

  let changed = true;
  let ri = 0;
  while (changed) {
    if (++ri > 1000) break;
    changed = false;
    for (const [item, stock] of available) {
      if (stock <= 0) continue;
      const recs = consumers.get(item);
      if (!recs) continue;

      for (const r of recs) {
        // 仅回收产出含原材料的配方
        if (!r.outputs.some((o) => rawMaterialSet.has(o.item))) continue;

        const inputTerm = r.inputs.find((t) => t.item === item);
        if (!inputTerm) continue;
        const maxBatches = Math.floor(stock / inputTerm.coeff);
        if (maxBatches <= 0) continue;

        // 检查所有输入是否都有足够库存
        let batches = maxBatches;
        for (const inp of r.inputs) {
          if (inp.item === item) continue;
          const have = available.get(inp.item) ?? 0;
          batches = Math.min(batches, Math.floor(have / inp.coeff));
        }
        if (batches <= 0) continue;

        // 执行配方
        for (const inp of r.inputs) {
          consume(available, inp.item, inp.coeff * batches);
        }
        for (const out of r.outputs) {
          if (!rawMaterialSet.has(out.item)) continue;
          const produced = out.coeff * batches;
          const prev = rawMaterials.get(out.item) ?? 0;
          const deduct = Math.min(prev, produced);
          if (deduct >= prev) rawMaterials.delete(out.item);
          else rawMaterials.set(out.item, prev - deduct);
          const surplus = produced - deduct;
          if (surplus > 0) available.set(out.item, (available.get(out.item) ?? 0) + surplus);
        }
        steps.set(r.raw, (steps.get(r.raw) ?? 0) + batches);
        changed = true;
        break;
      }
    }
  }
}
