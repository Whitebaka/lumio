import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const cache = new Map();

// Load the actual dictionaries, including intentional English fallback
// spreads. A line-based key scan cannot distinguish inherited keys from
// missing translations, and misses inline nested dictionaries.
export function loadTsModule(file) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, {
    exports,
    require: (specifier) => {
      if (!specifier.startsWith(".")) throw new Error(`Unexpected import: ${specifier}`);
      return loadTsModule(resolve(dirname(file), `${specifier}.ts`));
    },
  }, { filename: file });
  return exports;
}

export function flattenDictionary(dict, prefix = "", result = new Map()) {
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result.set(path, value);
    else flattenDictionary(value, path, result);
  }
  return result;
}
