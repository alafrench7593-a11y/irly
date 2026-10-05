// Lets plain Node run app modules in tests: resolves "@/x" to src/x and
// adds the .ts extension the app's bundler would add.
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

export async function resolve(specifier, context, next) {
  let target = null;
  if (specifier.startsWith('@/')) target = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !path.extname(specifier)) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (fs.existsSync(target + ext)) return next(pathToFileURL(target + ext).href, context);
    }
  }
  return next(specifier, context);
}
