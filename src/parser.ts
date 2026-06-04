import type { Recipe, RecipeFile, Term } from "./types";

/**
 * 解析配方文件。
 *
 * 格式：
 *   每行一条配方：`输入项 + 输入项 + ... = 输出项 + 输出项 + ...`
 *   数字前缀表示系数（省略 = 1）
 *   `#` 开头 = 注释
 *   `# @raw 物品A, 物品B` = 将指定物品标记为原材料（外部可得，求解时不展开）
 *
 * 自动原材料：未在任何配方右侧出现的物品自动视为原材料。
 */
export function parseRecipeFile(text: string): RecipeFile {
  const lines = text.split(/\r?\n/);
  const recipes: Recipe[] = [];
  const explicitRaw = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // 注释行 / 指令行
    if (raw.startsWith("#") || raw.startsWith("//") || raw.startsWith("@")) {
      const m = raw.match(/^(?:[#\/]+\s*)?@raw\s+([\w\u4e00-\u9fff]+(?:\s*[,，]\s*[\w\u4e00-\u9fff]+)*)\s*$/i);
      if (m) {
        for (const name of m[1].split(/[,，]+/)) {
          const t = name.trim();
          if (t) explicitRaw.add(t);
        }
      }
      continue;
    }

    const eqIdx = raw.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`第 ${i + 1} 行缺少等号 "=": ${raw}`);
    }

    const left = raw.slice(0, eqIdx).trim();
    const right = raw.slice(eqIdx + 1).trim();

    if (!left || !right) {
      throw new Error(`第 ${i + 1} 行等号两边不能为空: ${raw}`);
    }

    recipes.push({
      inputs: parseSide(left),
      outputs: parseSide(right),
      line: i + 1,
      raw,
    });
  }

  // 自动原材料：未被任何配方产出的物品
  const produced = new Set<string>();
  for (const r of recipes) {
    for (const o of r.outputs) produced.add(o.item);
  }
  for (const r of recipes) {
    for (const t of r.inputs) {
      if (!produced.has(t.item)) explicitRaw.add(t.item);
    }
  }

  return { recipes, rawMaterials: [...explicitRaw] };
}

/** 解析等号一侧，按 "+" 分割 */
function parseSide(side: string): Term[] {
  return side.split("+").map((s) => {
    const trimmed = s.trim();
    const match = trimmed.match(/^(\d*)\s*(.+)$/);
    if (!match) throw new Error(`无法解析项: "${trimmed}"`);
    const coeff = match[1] ? parseInt(match[1], 10) : 1;
    const item = match[2].trim();
    if (!item) throw new Error(`项名为空: "${trimmed}"`);
    return { coeff, item };
  });
}
