import { parseRecipeFile } from "./parser";
import { solve } from "./solver";
import type { Term } from "./types";

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("usage: aic-balance <recipe-file> <target> [amount]");
    console.error("  e.g. aic-balance recipes.txt 赫铜块");
    console.error("       aic-balance recipes.txt 赫铜块 3");
    process.exit(1);
  }

  const [filePath, target, amountStr] = args;
  const amount = amountStr ? parseFloat(amountStr) : 1;

  if (isNaN(amount) || amount <= 0) {
    console.error("error: amount must be positive");
    process.exit(1);
  }

  let text: string;
  try {
    text = require("fs").readFileSync(filePath, "utf-8") as string;
  } catch (e) {
    console.error(`error: cannot read "${filePath}"`);
    console.error((e as Error).message);
    process.exit(1);
  }

  let recipeFile;
  try {
    recipeFile = parseRecipeFile(text);
  } catch (e) {
    console.error("error: parse failed");
    console.error((e as Error).message);
    process.exit(1);
  }

  const { recipes, rawMaterials } = recipeFile;

  if (recipes.length === 0) {
    console.error("error: no recipes found");
    process.exit(1);
  }

  const rawSet = new Set(rawMaterials);

  console.error(`recipes: ${recipes.length}`);
  console.error(`raw: ${rawMaterials.join(", ")}`);

  let result;
  try {
    result = solve(target, amount, recipes, rawSet);
  } catch (e) {
    console.error("error:", (e as Error).message);
    process.exit(1);
  }

  // stderr: 配方调用明细
  console.error("steps:");
  for (const s of result.steps) {
    console.error(`  ${s.count}x ${s.recipe.raw}`);
  }

  // stdout: 配平方程（可被管道消费）
  const inputs = result.rawMaterials.map(formatTerm).join(" + ");
  const outputs = [formatTerm(result.target)];
  if (result.byproducts.length > 0) {
    outputs.push(result.byproducts.map(formatTerm).join(" + "));
  }
  console.log(`${inputs || "0"} = ${outputs.join(" + ")}`);
}

function formatTerm(t: Term): string {
  if (t.coeff === 1) return t.item;
  if (Number.isInteger(t.coeff)) return `${t.coeff}${t.item}`;
  return `${t.coeff}${t.item}`;
}

main();
