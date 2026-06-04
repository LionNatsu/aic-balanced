import type { Recipe, Term, SolveResult, RecipeStep } from "./types";

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
      const remaining = [...needed.entries()]
        .map(([k, v]) => `${v}${k}`)
        .join(", ");
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
    if (!item) item = needed.keys().next().value!;
    const needAmount = needed.get(item)!;

    // ---- 1. 使用库存 ----
    const stock = available.get(item) ?? 0;
    if (stock > 0) {
      const use = Math.min(needAmount, stock);
      const remainNeed = needAmount - use;
      const remainStock = stock - use;
      if (remainNeed <= 0) needed.delete(item);
      else needed.set(item, remainNeed);
      if (remainStock <= 0) available.delete(item);
      else available.set(item, remainStock);
      continue;
    }

    // ---- 2. 原材料 → 记录消耗，不展开 ----
    if (rawMaterialSet.has(item) || !producers.has(item) || producers.get(item)!.length === 0) {
      rawMaterials.set(item, (rawMaterials.get(item) ?? 0) + needAmount);
      needed.delete(item);
      continue;
    }

    // ---- 3. 选配方展开 ----
    const candidates = producers.get(item)!;
    const recipe = selectRecipe(candidates, available);
    const outputTerm = recipe.outputs.find((o) => o.item === item)!;
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
        available.set(
          out.item,
          (available.get(out.item) ?? 0) + out.coeff * batches,
        );
      }
    }

    // 配方的投入 → 加入需求
    for (const inp of recipe.inputs) {
      const required = inp.coeff * batches;
      const have = available.get(inp.item) ?? 0;
      let toNeed = required;
      if (have > 0) {
        const useStock = Math.min(required, have);
        toNeed = required - useStock;
        const remainAvail = have - useStock;
        if (remainAvail <= 0) available.delete(inp.item);
        else available.set(inp.item, remainAvail);
      }
      if (toNeed > 0) {
        needed.set(inp.item, (needed.get(inp.item) ?? 0) + toNeed);
      }
    }
  }

  // 构建结果
  const rawTerms: Term[] = [...rawMaterials.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, coeff]) => ({ item, coeff: simplifyNumber(coeff) }));

  const byproductTerms: Term[] = [...available.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, coeff]) => ({ item, coeff: simplifyNumber(coeff) }));

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
): Recipe {
  if (candidates.length === 1) return candidates[0];

  let best = candidates[0];
  let bestScore = -1;
  for (const r of candidates) {
    let score = 0;
    for (const inp of r.inputs) {
      if ((available.get(inp.item) ?? 0) > 0) score += inp.coeff;
    }
    // 输入项越少越好（简单优先）
    score -= r.inputs.length * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

function simplifyNumber(n: number): number {
  if (Math.abs(n - Math.round(n)) < 1e-9) return Math.round(n);
  return Math.round(n * 100) / 100;
}
