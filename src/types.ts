/** 配方：一行原始文本解析结果 */
export interface Recipe {
  /** 输入项列表 */
  inputs: Term[];
  /** 输出项列表 */
  outputs: Term[];
  /** 原始行号（用于报错） */
  line: number;
  /** 原始文本 */
  raw: string;
}

/** 配方中的一项，如 "4赤铜溶液" → coeff=4, item="赤铜溶液" */
export interface Term {
  coeff: number;
  item: string;
}

/** 解析后的配方文件 */
export interface RecipeFile {
  recipes: Recipe[];
  /** 用户显式标注的原材料（即使某些配方会产出，也视为外部可得） */
  rawMaterials: string[];
}

/** 求解结果 */
export interface SolveResult {
  /** 生产目标所需调用的配方及次数 */
  steps: RecipeStep[];
  /** 净消耗的原料 */
  rawMaterials: Term[];
  /** 净产出的副产品（除目标外多余的产出） */
  byproducts: Term[];
  /** 目标产物 */
  target: Term;
}

export interface RecipeStep {
  recipe: Recipe;
  count: number;
}
