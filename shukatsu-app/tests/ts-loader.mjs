// テスト用: .ts をプロジェクトの typescript で変換して Node で実行する（拡張子なしの import も解決）
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('.') || specifier.startsWith('/')) && context.parentURL?.startsWith('file:')) {
    for (const suffix of ['', '.ts', '.tsx', '/index.ts']) {
      const url = new URL(specifier + suffix, context.parentURL);
      const p = fileURLToPath(url);
      if (existsSync(p) && statSync(p).isFile()) return next(url.href, context);
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        rewriteRelativeImportExtensions: false,
        jsx: ts.JsxEmit.ReactJSX,
      },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return next(url, context);
}
