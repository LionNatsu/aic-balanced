import { parseRecipeFile } from "./parser";
import { solve } from "./solver";
import type { Term } from "./types";

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("用法: aic-balance <配方文件> <目标产物> [数量]");
    console.error("示例: aic-balance recipes.txt 赫铜块");
    console.error("      aic-balance recipes.txt 赫铜块 3");
    process.exit(1);
  }

  const [filePath, target, amountStr] = args;
  const amount = amountStr ? parseFloat(amountStr) : 1;

  if (isNaN(amount) || amount <= 0) {
    console.error("错误: 数量必须是正数");
    process.exit(1);
  }

  let text: string;
  try {
    text = require("fs").readFileSync(filePath, "utf-8") as string;
  } catch (e) {
    console.error(`错误: 无法读取文件 "${filePath}"`);
    console.error((e as Error).message);
    process.exit(1);
  }

  let recipeFile;
  try {
    recipeFile = parseRecipeFile(text);
  } catch (e) {
    console.error("解析配方文件失败:");
    console.error((e as Error).message);
    process.exit(1);
  }

  const { recipes, rawMaterials } = recipeFile;

  if (recipes.length === 0) {
    console.error("错误: 配方文件为空或格式不正确");
    process.exit(1);
  }

  const rawSet = new Set(rawMaterials);

  console.error(`已加载 ${recipes.length} 条配方`);
  console.error(`原材料: ${rawMaterials.join(", ")}`);
  console.error("正在求解...\n");

  let result;
  try {
    result = solve(target, amount, recipes, rawSet);
  } catch (e) {
    console.error("求解失败:");
    console.error((e as Error).message);
    process.exit(1);
  }

  printResult(result);
  console.log("");
  printEquation(result);
}

function printResult(result: {
  target: Term;
  rawMaterials: Term[];
  byproducts: Term[];
  steps: { recipe: { line: number; raw: string }; count: number }[];
}) {
  console.log("═══════════════════════════════════════");
  console.log(`  目标产物: ${formatTerm(result.target)}`);
  console.log("═══════════════════════════════════════");

  console.log("\n📦 所需原料:");
  if (result.rawMaterials.length === 0) {
    console.log("  （无）");
  } else {
    for (const r of result.rawMaterials) {
      console.log(`  ${formatTerm(r)}`);
    }
  }

  if (result.byproducts.length > 0) {
    console.log("\n♻️  副产品:");
    for (const b of result.byproducts) {
      console.log(`  ${formatTerm(b)}`);
    }
  }

  console.log("\n🔧 配方调用:");
  for (const s of result.steps) {
    console.log(`  ${s.count}×  ${s.recipe.raw}`);
  }
}

function printEquation(result: {
  target: Term;
  rawMaterials: Term[];
  byproducts: Term[];
}) {
  const inputs = result.rawMaterials.map(formatTerm).join(" + ");
  const outputs = [formatTerm(result.target)];
  if (result.byproducts.length > 0) {
    outputs.push(result.byproducts.map(formatTerm).join(" + "));
  }
  console.log("配平方程:");
  console.log(`  ${inputs || "∅"} = ${outputs.join(" + ")}`);
}

function formatTerm(t: Term): string {
  if (t.coeff === 1) return t.item;
  if (Number.isInteger(t.coeff)) return `${t.coeff}${t.item}`;
  return `${t.coeff}${t.item}`;
}

main();
