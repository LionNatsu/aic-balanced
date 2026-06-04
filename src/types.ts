export interface Recipe {
  inputs: Term[];
  outputs: Term[];
  line: number;
  raw: string;
}

export interface Term {
  coeff: number;
  item: string;
}

export interface RecipeFile {
  recipes: Recipe[];
  rawMaterials: string[];
}

/** 求解结果 */
export interface SolveResult {
  steps: RecipeStep[];
  rawMaterials: Term[];
  byproducts: Term[];
  target: Term;
}

export interface RecipeStep {
  raw: string;
  count: number;
}
