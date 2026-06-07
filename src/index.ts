import { parseRecipeFile } from './parser';
import { solve } from './solver';
import type { RecipeFile, SolveResult, Term } from './types';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('usage: aic-balance <recipe-file> <target>...');
    console.error('  e.g. aic-balance recipes.txt 赫铜块');
    console.error('       aic-balance recipes.txt 3赫铜块 2蓝铁瓶');
    process.exit(1);
  }

  const [filePath, ...targetArgs] = args;
  const targets: Term[] = [];
  for (const arg of targetArgs) {
    const m = arg.match(/^(\d*)(.+)$/);
    if (!m) {
      console.error(`error: invalid target "${arg}"`);
      process.exit(1);
    }
    const coeff = m[1] ? parseFloat(m[1]) : 1;
    const item = m[2];
    if (Number.isNaN(coeff) || coeff <= 0 || !item) {
      console.error(`error: invalid target "${arg}"`);
      process.exit(1);
    }
    targets.push({ coeff, item });
  }

  let text: string;
  try {
    text = await Bun.file(filePath).text();
  } catch (e) {
    console.error(`error: cannot read "${filePath}"`);
    console.error((e as Error).message);
    process.exit(1);
  }

  let recipeFile: RecipeFile;
  try {
    recipeFile = parseRecipeFile(text);
  } catch (e) {
    console.error('error: parse failed');
    console.error((e as Error).message);
    process.exit(1);
  }

  const { recipes, rawMaterials } = recipeFile;

  if (recipes.length === 0) {
    console.error('error: no recipes found');
    process.exit(1);
  }

  const rawSet = new Set(rawMaterials);

  let result: SolveResult;
  try {
    result = solve(targets, recipes, rawSet);
  } catch (e) {
    console.error('error:', (e as Error).message);
    process.exit(1);
  }

  // stderr: 配方调用明细（= 对齐）
  const stepLines = result.steps.map((s) => {
    const prefix = `${s.count}x `;
    const [left, right] = s.raw.split(/\s*=\s*/, 2);
    return { prefix, left: left ?? '', right: right ?? '' };
  });
  const maxLeft = stepLines.reduce((m, sl) => Math.max(m, displayWidth(sl.prefix + sl.left)), 0);
  console.error('steps:');
  for (const sl of stepLines) {
    const pad = maxLeft - displayWidth(sl.prefix + sl.left);
    const padStr = ' '.repeat(pad);
    console.error(`  ${sl.prefix}${sl.left}${padStr} = ${sl.right}`);
  }

  // stdout: 配平方程（可被管道消费）
  const inputs = result.rawMaterials.map(formatTerm).join(' + ');
  const outputs = result.target.map(formatTerm);
  if (result.byproducts.length > 0) {
    outputs.push(result.byproducts.map(formatTerm).join(' + '));
  }
  console.log(`${inputs || '0'} = ${outputs.join(' + ')}`);
}

function formatTerm(t: Term): string {
  if (t.coeff === 1) return t.item;
  if (Number.isInteger(t.coeff)) return `${t.coeff}${t.item}`;
  return `${t.coeff}${t.item}`;
}

/** 显示宽度：ASCII=1，CJK/全角=2 */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    w +=
      (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
      (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK Radicals .. Yi
      (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility
      (cp >= 0xfe10 && cp <= 0xfe19) || // Vertical forms
      (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK Compatibility Forms
      (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth Forms
      (cp >= 0xffe0 && cp <= 0xffe6) || // Fullwidth Signs
      (cp >= 0x20000 && cp <= 0x2ffff) // CJK Extension B+
        ? 2
        : 1;
  }
  return w;
}

main();
