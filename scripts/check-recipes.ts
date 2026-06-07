// 对比源数据与 recipes.txt，列出缺失的替代配方
// 用法: bun run scripts/check-recipes.ts

const items: Record<string, string> = JSON.parse(await Bun.file("scripts/items.json").text());
const recipeText = await Bun.file("scripts/recipes.ts").text();

function cn(id: string): string {
  const key = `item_${id.replace(/^ITEM_/, '').toLowerCase()}`;
  return items[key] ?? `?${id}?`;
}

const ourText = await Bun.file("recipes.txt").text();
const ourProduced = new Set<string>();
const ourSet = new Set<string>();

for (const line of ourText.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || t.startsWith("@")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const parseSide = (s: string) => {
    const terms: string[] = [];
    for (const part of s.split("+")) {
      const pm = part.trim().match(/^(\d*)\s*(.+)$/);
      if (pm) terms.push(`${pm[1] || "1"} ${pm[2].trim()}`);
    }
    return terms.sort().join(",");
  };
  ourSet.add(parseSide(t.slice(0, eq)) + "|" + parseSide(t.slice(eq + 1)));
  for (const part of t.slice(eq + 1).split("+")) {
    const pm = part.trim().match(/^(\d*)\s*(.+)$/);
    if (pm) ourProduced.add(pm[2].trim());
  }
}

const blocks = recipeText.split(/\n  \{\n/);
let n = 0;
for (const block of blocks) {
  const ridM = block.match(/id:\s*RecipeId\.(\w+)/);
  if (!ridM) continue;
  const rid = ridM[1];
  if (rid.includes("DISMANTLER") || rid.includes("FLUID_CONSUME")) continue;
  if (/_2$/.test(rid)) continue;
  if (rid.includes("SEEDCOLLECTOR")) continue;

  const inB = block.match(/inputs:\s*\[([\s\S]*?)\]/);
  const outB = block.match(/outputs:\s*\[([\s\S]*?)\]/);
  if (!inB || !outB) continue;

  const inIds = [...inB[1].matchAll(/ItemId\.(\w+)/g)].map(m => m[1]);
  const inAmts = [...inB[1].matchAll(/amount:\s*(\d+)/g)].map(m => parseInt(m[1]));
  const outIds = [...outB[1].matchAll(/ItemId\.(\w+)/g)].map(m => m[1]);
  const outAmts = [...outB[1].matchAll(/amount:\s*(\d+)/g)].map(m => parseInt(m[1]));

  const outNames = outIds.map((id, i) => cn(id));
  if (!outNames.every(nm => ourProduced.has(nm))) continue;
  if (outNames.every(nm => nm.startsWith("实验") || nm.includes("葫芦"))) continue;
  // 跳过同名瓶灌装（游戏里瓶和装填瓶中文名相同）
  const inNames = inIds.map((id, i) => cn(id));
  if (outNames.every(nm => inNames.includes(nm))) continue;

  const inTerms = inIds.map((id, i) => `${inAmts[i] || 1} ${cn(id)}`).sort().join(",");
  const outTerms = outIds.map((id, i) => `${outAmts[i] || 1} ${cn(id)}`).sort().join(",");
  if (ourSet.has(inTerms + "|" + outTerms)) continue;

  const ins = inIds.map((id, i) => `${inAmts[i] > 1 ? inAmts[i] : ""}${cn(id)}`).join(" + ");
  const outs = outIds.map((id, i) => `${outAmts[i] > 1 ? outAmts[i] : ""}${cn(id)}`).join(" + ");
  console.log(`  ${ins} = ${outs}`);
  n++;
}
if (n === 0) console.log("  (无缺失)");
else console.log(`\n${n} 条替代配方缺失`);
