// French coverage: every English string the app runs through the dictionary
// has a French entry, with the same {placeholders}.
//
//   node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/check-i18n.mts
//
// Static: reads the source with the TypeScript parser, never runs the app.
// A string is "translated" when it reaches the dictionary as a literal:
//   - first argument of t() / tx() / tr() / a11y() / toast(), or the text of
//     translate(lang, …) / localizeLabel(lang, …);
//   - a literal child of the shared <Text> (unless `raw`);
//   - a literal prop of a component that sends that prop to one of the above
//     (Button label, SectionHeader title, Page title, Field placeholder,
//     PressableScale accessibilityLabel…). Which props those are is worked
//     out from the components themselves, so a new component is covered too.
// Strings built at run time (tx(item.label), `${a} b`) are out of reach.
//
// Also checked, so neither language leaks into the other:
//   - new Error('…') messages (they end up in toasts);
//   - every `raise exception '…'` of supabase/migrations has its sentence in
//     src/i18n/errors.ts, and that sentence its French entry;
//   - a member's name, username or bio never reaches the dictionary (a bio
//     reading "Coffee" would become « Café »): <Text raw> or no t();
//   - no UI literal sits in a <Text raw>, where it would stay English.
//
// --props lists the translated props found per component; --audit lists English
// literals given to props nothing translates (React Native a11y labels, Alert).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FR = path.join(SRC, 'i18n', 'fr.ts');
const I18N = path.join(SRC, 'i18n', 'index.ts');
const TEXT = path.join(SRC, 'components', 'ui', 'Text.tsx');

/**
 * Strings that are the same in French, so they need no entry. Keep each
 * one justified: anything else that reads the same in both languages
 * belongs in fr.ts with its (identical) value.
 */
const EXCEPTIONS = new Set<string>([
  // Words that read the same in French ('OK', 'Live', 'Match') have their
  // identical entry in fr.ts instead, as the dictionary already does.
  // Brand and product names, never translated.
  'IRLY',
  'IRLY Mixte',
  'IRLY Network',
  'Match IRLY',
  'IRLY Sport', // the sample community in the intro
  'IRLY 3.0', // design-system overline (version)
  'IRLY GIRL ·', // kicker in capitals, followed by a translated tagline
  '· BALI', // "IRLY GIRL · BALI" wordmark, the place name in capitals
  '@irlyofficial', // the Instagram handle
  // The app's words for "in real life" and live sessions, kept in English in French too.
  'IRL',
  'LIVE',
  // Other brands (Settings → Follow IRLY).
  'Instagram',
  'TikTok',
  // Units and symbols.
  '°C',
  'ms · ζ',
]);

/** Errors thrown for the code's own control flow, caught before anyone reads them. */
const INTERNAL_ERRORS = new Set<string>([
  'still stored', // sign-out: the session survived its removal, retried silently
]);

type Kind = 'text' | 'label';
type Use = { key: string; kind: Kind; at: string };

// ---------------------------------------------------------------- source files

function walkDir(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') && p !== FR) out.push(p);
  }
  return out;
}

const files = new Map<string, ts.SourceFile>();
for (const f of walkDir(SRC)) {
  files.set(f, ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
}

function resolveModule(from: string, spec: string): string | undefined {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return undefined;
  for (const ext of ['', '.tsx', '.ts', '/index.tsx', '/index.ts']) if (files.has(base + ext)) return base + ext;
  return undefined;
}

// ---------------------------------------------------------------- definitions
// A "definition" is a function (component or helper) whose parameters may end
// up in the dictionary. For a component the parameters are its props; for a
// helper, the positional arguments.

type Def = {
  id: string;
  file: string;
  body: ts.Node;
  /** local name → prop name (components) or argument index (helpers) */
  params: Map<string, string>;
  /** `props` object name, when props are read as props.x */
  propsName?: string;
  rest?: string;
  translated: Set<string>;
};

const defs = new Map<string, Def>();
/** file → local name → def id */
const local = new Map<string, Map<string, string>>();
/** file → exported name → def id ('default' for the default export) */
const exported = new Map<string, Map<string, string>>();
/** file → [local name, source file, imported name] */
const imports = new Map<string, Map<string, [string, string]>>();

function unwrapFn(e: ts.Expression | undefined): ts.FunctionLikeDeclaration | undefined {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e))) e = e.expression;
  if (!e) return undefined;
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
  // memo(function X() {}), forwardRef(…)
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && /^(memo|forwardRef)$/.test(e.expression.text)) return unwrapFn(e.arguments[0]);
  return undefined;
}

function addDef(file: string, name: string, fn: ts.FunctionLikeDeclaration, isExported: boolean, isDefault: boolean) {
  if (!fn.body) return;
  const id = `${path.relative(ROOT, file)}#${name}`;
  const params = new Map<string, string>();
  let propsName: string | undefined;
  let rest: string | undefined;
  const component = /^[A-Z]/.test(name);
  if (component) {
    const p = fn.parameters[0];
    if (p && ts.isObjectBindingPattern(p.name)) {
      for (const el of p.name.elements) {
        if (!ts.isIdentifier(el.name)) continue;
        if (el.dotDotDotToken) rest = el.name.text;
        else params.set(el.name.text, el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text);
      }
    } else if (p && ts.isIdentifier(p.name)) propsName = p.name.text;
  } else {
    fn.parameters.forEach((p, i) => {
      if (ts.isIdentifier(p.name)) params.set(p.name.text, String(i));
    });
  }
  defs.set(id, { id, file, body: fn.body, params, propsName, rest, translated: new Set() });
  if (!local.has(file)) local.set(file, new Map());
  local.get(file)!.set(name, id);
  if (isExported) {
    if (!exported.has(file)) exported.set(file, new Map());
    exported.get(file)!.set(isDefault ? 'default' : name, id);
  }
}

const hasMod = (n: ts.Node, k: ts.SyntaxKind) => !!ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some((m) => m.kind === k);

for (const [file, sf] of files) {
  const imp = new Map<string, [string, string]>();
  imports.set(file, imp);
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier)) {
      const target = resolveModule(file, st.moduleSpecifier.text);
      const c = st.importClause;
      if (!target || !c) continue;
      if (c.name) imp.set(c.name.text, [target, 'default']);
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
        for (const el of c.namedBindings.elements) imp.set(el.name.text, [target, (el.propertyName ?? el.name).text]);
      }
    }
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && st.exportClause && ts.isNamedExports(st.exportClause)) {
      // export { X } from './y': resolved lazily through imports
      const target = resolveModule(file, st.moduleSpecifier.text);
      if (target) for (const el of st.exportClause.elements) imp.set(`export:${el.name.text}`, [target, (el.propertyName ?? el.name).text]);
    }
  }
  // Every named function, at any depth (screens declare small components inline).
  const visit = (n: ts.Node) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      const top = n.parent === sf;
      addDef(file, n.name.text, n, top && hasMod(n, ts.SyntaxKind.ExportKeyword), top && hasMod(n, ts.SyntaxKind.DefaultKeyword));
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const fn = unwrapFn(n.initializer);
      if (fn) {
        const stmt = n.parent?.parent;
        addDef(file, n.name.text, fn, !!stmt && stmt.parent === sf && hasMod(stmt, ts.SyntaxKind.ExportKeyword), false);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

function resolveName(file: string, name: string, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  const own = local.get(file)?.get(name);
  if (own) return own;
  const im = imports.get(file)?.get(name);
  if (!im) return undefined;
  return resolveExport(im[0], im[1], depth + 1);
}
function resolveExport(file: string, name: string, depth = 0): string | undefined {
  const id = exported.get(file)?.get(name);
  if (id) return id;
  const re = imports.get(file)?.get(`export:${name}`);
  if (re) return resolveExport(re[0], re[1], depth + 1);
  // export { X } of a local declaration, or `export default X`
  return local.get(file)?.get(name);
}

// Sinks that are the dictionary itself.
const TR_ARG0 = new Set(['t', 'tx', 'tr', 'a11y']);
const TR_ARG1 = new Set(['translate', 'localizeLabel']);
const LABEL_FNS = new Set(['a11y', 'localizeLabel']);
const TEXT_ID = `${path.relative(ROOT, TEXT)}#Text`;
const TOAST_ID = resolveExport(path.join(SRC, 'components', 'ui', 'Toast.tsx'), 'toast');
// toast(title) runs t(readable(title)): the helper in between hides it from the scan.
if (TOAST_ID) defs.get(TOAST_ID)!.translated.add('0');
defs.get(TEXT_ID)?.translated.add('children');

/** The expressions an expression can evaluate to, as far as strings go. */
function outcomes(e: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) return outcomes(e.expression);
  if (ts.isConditionalExpression(e)) return [...outcomes(e.whenTrue), ...outcomes(e.whenFalse)];
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return [...outcomes(e.left), ...outcomes(e.right)];
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return outcomes(e.right);
  }
  return [e];
}

/** Calls to the dictionary and to helpers: [callee def id or sink name, argument index, label?] */
function callSinks(file: string, call: ts.CallExpression): { arg: ts.Expression; kind: Kind }[] {
  const out: { arg: ts.Expression; kind: Kind }[] = [];
  if (!ts.isIdentifier(call.expression)) return out;
  const name = call.expression.text;
  if (TR_ARG0.has(name) && call.arguments[0]) out.push({ arg: call.arguments[0], kind: LABEL_FNS.has(name) ? 'label' : 'text' });
  else if (TR_ARG1.has(name) && call.arguments[1]) out.push({ arg: call.arguments[1], kind: LABEL_FNS.has(name) ? 'label' : 'text' });
  else {
    const id = resolveName(file, name);
    const d = id ? defs.get(id) : undefined;
    if (d && !/^[A-Z]/.test(name)) d.translated.forEach((i) => call.arguments[+i] && out.push({ arg: call.arguments[+i], kind: 'text' }));
  }
  return out;
}

function tagName(t: ts.JsxTagNameExpression): string | undefined {
  return ts.isIdentifier(t) ? t.text : undefined;
}
function isRaw(attrs: ts.JsxAttributes): boolean {
  return attrs.properties.some((p) => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === 'raw' && (!p.initializer || (ts.isJsxExpression(p.initializer) && p.initializer.expression?.kind !== ts.SyntaxKind.FalseKeyword)));
}

/** Props of a JSX element that the target component translates, with their value expressions. */
function jsxSinks(file: string, el: ts.JsxOpeningLikeElement, parent?: ts.JsxElement): { arg: ts.Expression | ts.JsxText; kind: Kind; prop: string }[] {
  const out: { arg: ts.Expression | ts.JsxText; kind: Kind; prop: string }[] = [];
  const name = tagName(el.tagName);
  const id = name ? resolveName(file, name) : undefined;
  const d = id ? defs.get(id) : undefined;
  if (!d) return out;
  if (id === TEXT_ID && isRaw(el.attributes)) return out;
  for (const p of el.attributes.properties) {
    if (!ts.isJsxAttribute(p) || !ts.isIdentifier(p.name) || !p.initializer) continue;
    if (!d.translated.has(p.name.text)) continue;
    const kind: Kind = /accessibility/i.test(p.name.text) ? 'label' : 'text';
    if (ts.isStringLiteral(p.initializer)) out.push({ arg: p.initializer, kind, prop: p.name.text });
    else if (ts.isJsxExpression(p.initializer) && p.initializer.expression) out.push({ arg: p.initializer.expression, kind, prop: p.name.text });
  }
  if (parent && d.translated.has('children')) {
    for (const c of parent.children) {
      if (ts.isJsxText(c)) out.push({ arg: c, kind: 'text', prop: 'children' });
      else if (ts.isJsxExpression(c) && c.expression) out.push({ arg: c.expression, kind: 'text', prop: 'children' });
    }
  }
  return out;
}

// ---------------------------------------------------------------- props that reach the dictionary (fixpoint)

function paramOf(d: Def, e: ts.Expression): string | undefined {
  if (ts.isIdentifier(e) && d.params.has(e.text)) return d.params.get(e.text);
  if (d.propsName && ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === d.propsName) return e.name.text;
  return undefined;
}

for (let changed = true, round = 0; changed && round < 20; round++) {
  changed = false;
  for (const d of defs.values()) {
    const before = d.translated.size;
    const mark = (e: ts.Expression | ts.JsxText) => {
      if (ts.isJsxText(e)) return;
      for (const o of outcomes(e)) {
        const p = paramOf(d, o);
        if (p) d.translated.add(p);
      }
    };
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) callSinks(d.file, n).forEach((s) => mark(s.arg));
      if (ts.isJsxElement(n)) jsxSinks(d.file, n.openingElement, n).forEach((s) => mark(s.arg));
      if (ts.isJsxSelfClosingElement(n)) jsxSinks(d.file, n).forEach((s) => mark(s.arg));
      // {...rest} on a component: the props it did not name pass through.
      // {...props} passes them all.
      if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && (d.rest || d.propsName)) {
        for (const a of n.attributes.properties) {
          if (ts.isJsxSpreadAttribute(a) && ts.isIdentifier(a.expression) && (a.expression.text === d.rest || a.expression.text === d.propsName)) {
            const name = tagName(n.tagName);
            const id = name ? resolveName(d.file, name) : undefined;
            const target = id ? defs.get(id) : undefined;
            const named = new Set(d.params.values());
            target?.translated.forEach((p) => !named.has(p) && d.translated.add(p));
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(d.body);
    if (d.translated.size !== before) changed = true;
  }
}

// ---------------------------------------------------------------- literal strings

const decode = (s: string) =>
  s.replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

/** JSX text as React renders it: lines trimmed and joined by one space. */
const jsxText = (s: string) => decode(s.split('\n').map((l) => l.trim()).filter(Boolean).join(' '));

const uses: Use[] = [];
let dynamic = 0;
/** What separates the parts of a label (as localizeLabel splits it), plus the edges of a template's text. */
const LABEL_PARTS = /, |\. |: | · |^[\s,.:·–-]+|[\s,.:·–-]+$/;
function collect(file: string, sf: ts.SourceFile, e: ts.Expression | ts.JsxText, kind: Kind, trim: boolean) {
  const at = (n: ts.Node) => `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  if (ts.isJsxText(e)) {
    const s = jsxText(e.text);
    if (/[A-Za-z]/.test(s)) uses.push({ key: s, kind, at: at(e) });
    return;
  }
  for (const o of outcomes(e)) {
    if (ts.isStringLiteral(o) || ts.isNoSubstitutionTemplateLiteral(o)) {
      // <Text> trims what it looks up; t() takes the string as it is.
      const key = trim ? o.text.trim() : o.text;
      if (/[A-Za-z]/.test(key)) uses.push({ key, kind, at: at(o) });
    } else if (ts.isTemplateExpression(o)) {
      dynamic++;
      // `${title}, unread`: the words written around the values are looked up
      // on their own (labels are translated part by part), so they need entries.
      if (kind === 'label') {
        const inner = o.templateSpans.flatMap((s) => outcomes(s.expression)).filter((x) => ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) as ts.StringLiteral[];
        for (const part of [o.head.text, ...o.templateSpans.map((s) => s.literal.text), ...inner.map((x) => x.text)]) {
          for (const piece of part.split(LABEL_PARTS)) {
            const key = piece.trim();
            if (/[A-Za-z]{2}/.test(key)) uses.push({ key, kind, at: at(o) });
          }
        }
      }
    }
  }
}

for (const [file, sf] of files) {
  if (file === I18N) continue;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) callSinks(file, n).forEach((s) => collect(file, sf, s.arg, s.kind, false));
    // new Error('…'): its message ends up in a toast or an error line, through t().
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Error' && n.arguments?.[0]) {
      const a = n.arguments[0];
      if ((ts.isStringLiteral(a) || ts.isNoSubstitutionTemplateLiteral(a)) && !INTERNAL_ERRORS.has(a.text)) collect(file, sf, a, 'text', false);
    }
    if (ts.isJsxElement(n)) jsxSinks(file, n.openingElement, n).forEach((s) => collect(file, sf, s.arg, s.kind, s.kind === 'text'));
    if (ts.isJsxSelfClosingElement(n)) jsxSinks(file, n).forEach((s) => collect(file, sf, s.arg, s.kind, s.kind === 'text'));
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// ---------------------------------------------------------------- user content kept as written
// What members write is shown as typed, in the language they wrote it in:
// never looked up in the dictionary, where a bio that reads "Coffee" would
// come out as « Café ». A member's name, username or bio reaching a
// translating <Text> (without `raw`) or t() is reported. So is UI text given
// to a <Text raw>, which would stay English in French.
/** Words a <Text raw> may hold as they are: the brand's own, the same in both languages. */
const RAW_OK = new Set<string>([
  'IN REAL LIFE', // the wordmark's tagline on the welcome screen
  'MATCH', // "MATCH IRLY" in the tab bar
  '[INFORMATION JURIDIQUE REQUISE]', // the French side of a lang === 'fr' switch
]);
const USER_FIELDS = /^(bio|firstName|first_name|lastName|last_name|fullName|full_name|displayName|display_name|username)$/;
const userContent: string[] = [];
const rawLiterals: string[] = [];
for (const [file, sf] of files) {
  if (file === I18N) continue;
  const at = (n: ts.Node) => `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  const check = (e: ts.Expression | ts.JsxText) => {
    if (ts.isJsxText(e)) return;
    for (const o of outcomes(e)) {
      const name = ts.isPropertyAccessExpression(o) ? o.name.text : undefined;
      if (name && USER_FIELDS.test(name)) userContent.push(`${at(o)}  ${o.getText(sf).slice(0, 60)}`);
    }
  };
  const uiText = (s: string) => /[A-Za-z]{2}/.test(s) && !EXCEPTIONS.has(s.trim()) && !RAW_OK.has(s.trim());
  // raw={!c.deleted}: only what the member wrote is raw, the rest is translated.
  const alwaysRaw = (attrs: ts.JsxAttributes) =>
    attrs.properties.some((p) => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === 'raw' && (!p.initializer || (ts.isJsxExpression(p.initializer) && p.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword)));
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) callSinks(file, n).forEach((s) => check(s.arg));
    if (ts.isJsxElement(n)) {
      jsxSinks(file, n.openingElement, n).forEach((s) => s.prop === 'children' && check(s.arg));
      const name = tagName(n.openingElement.tagName);
      if (name && resolveName(file, name) === TEXT_ID && alwaysRaw(n.openingElement.attributes)) {
        for (const c of n.children) {
          if (ts.isJsxText(c) && uiText(jsxText(c.text))) rawLiterals.push(`${at(c)}  ${jsxText(c.text).slice(0, 60)}`);
          if (ts.isJsxExpression(c) && c.expression) {
            for (const o of outcomes(c.expression)) {
              if ((ts.isStringLiteral(o) || ts.isNoSubstitutionTemplateLiteral(o)) && uiText(o.text)) rawLiterals.push(`${at(o)}  ${o.text.slice(0, 60)}`);
            }
          }
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// ---------------------------------------------------------------- the dictionary

const frSf = ts.createSourceFile(FR, fs.readFileSync(FR, 'utf8'), ts.ScriptTarget.Latest, true);
const fr = new Map<string, string>();
const duplicates: string[] = [];
const empties: string[] = [];
const literalText = (e: ts.Node): string | undefined => (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : undefined);
ts.forEachChild(frSf, function visit(n) {
  if (ts.isPropertyAssignment(n)) {
    const k = ts.isStringLiteral(n.name) || ts.isIdentifier(n.name) ? n.name.text : undefined;
    const v = literalText(n.initializer);
    const line = frSf.getLineAndCharacterOfPosition(n.getStart(frSf)).line + 1;
    if (k === undefined || v === undefined) return;
    if (fr.has(k)) duplicates.push(`fr.ts:${line}  ${JSON.stringify(k)}`);
    if (!v.trim()) empties.push(`fr.ts:${line}  ${JSON.stringify(k)}`);
    fr.set(k, v);
    return;
  }
  ts.forEachChild(n, visit);
});

// Singular forms and sentence patterns, read from the i18n module.
const one = new Map<string, string>();
const patterns: RegExp[] = [];
ts.forEachChild(files.get(I18N)!, function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
    if (n.name.text === 'ONE' && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name)) one.set(p.name.text, literalText(p.initializer) ?? '');
      }
    }
    if (n.name.text === 'PATTERNS' && ts.isArrayLiteralExpression(n.initializer)) {
      for (const row of n.initializer.elements) {
        const re = ts.isArrayLiteralExpression(row) ? row.elements[0] : undefined;
        if (re && ts.isRegularExpressionLiteral(re)) {
          const m = /^\/(.*)\/([a-z]*)$/s.exec(re.text);
          if (m) patterns.push(new RegExp(m[1], m[2]));
        }
      }
    }
  }
  ts.forEachChild(n, visit);
});

// ---------------------------------------------------------------- server refusals
// Every `raise exception '…'` of the migrations reaches a member as an error
// message: src/i18n/errors.ts turns it into a sentence of the app, which
// needs its French entry like any other.
const ERRORS = path.join(SRC, 'i18n', 'errors.ts');
const serverKeys = new Map<string, string>();
const serverPatterns: RegExp[] = [];
ts.forEachChild(files.get(ERRORS)!, function visit(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
    if (n.name.text === 'SERVER_ERRORS' && ts.isObjectLiteralExpression(n.initializer)) {
      for (const p of n.initializer.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isStringLiteral(p.name)) continue;
        const v = literalText(p.initializer);
        serverKeys.set(p.name.text, v ?? '');
        if (v) uses.push({ key: v, kind: 'text', at: `src/i18n/errors.ts (${JSON.stringify(p.name.text)})` });
      }
    }
    if (n.name.text === 'SERVER_PATTERNS' && ts.isArrayLiteralExpression(n.initializer)) {
      for (const row of n.initializer.elements) {
        if (!ts.isArrayLiteralExpression(row)) continue;
        const [re, text] = row.elements;
        const m = re && ts.isRegularExpressionLiteral(re) ? /^\/(.*)\/([a-z]*)$/s.exec(re.text) : null;
        if (m) serverPatterns.push(new RegExp(m[1], m[2]));
        const v = text ? literalText(text) : undefined;
        if (v) uses.push({ key: v, kind: 'text', at: 'src/i18n/errors.ts (SERVER_PATTERNS)' });
      }
    }
  }
  ts.forEachChild(n, visit);
});
const unmapped: string[] = [];
const sqlFiles = [path.join(ROOT, 'supabase', 'setup.sql'), ...fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).map((f) => path.join(ROOT, 'supabase', 'migrations', f))].filter((f) => f.endsWith('.sql') && fs.existsSync(f));
const raised = new Map<string, string>();
for (const f of sqlFiles) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/raise exception '((?:[^']|'')*)'/g)) {
    const msg = m[1].replace(/''/g, "'");
    if (!raised.has(msg)) raised.set(msg, path.relative(ROOT, f));
  }
}
for (const [msg, where] of raised) {
  // '% is at most % characters' is tried as '9 is at most 9 characters'.
  const sample = msg.replace(/%/g, '9');
  if (serverKeys.has(msg) || serverPatterns.some((re) => re.test(sample)) || fr.has(msg)) continue;
  unmapped.push(`${JSON.stringify(msg)}  ← ${where}`);
}

// ---------------------------------------------------------------- checks

const excepted = new Set<string>();
const known = (k: string) => fr.has(k) || (EXCEPTIONS.has(k) && !!excepted.add(k)) || patterns.some((re) => re.test(k)) || !/[A-Za-z]/.test(k);
const LABEL_SEP = /(, |\. |: | · )/;
const missing = new Map<string, string[]>();
const need = (k: string, at: string) => {
  if (known(k)) return;
  if (!missing.has(k)) missing.set(k, []);
  missing.get(k)!.push(at);
};
const checked = new Set<string>();
for (const u of uses) {
  checked.add(u.key);
  if (u.kind === 'label' && !known(u.key)) {
    // Screen-reader labels fall back to their parts ("Close. Tap to leave").
    u.key.split(LABEL_SEP).filter((_, i) => i % 2 === 0).forEach((part) => need(part, u.at));
  } else need(u.key, u.at);
  // French uses the singular for 0 and 1.
  const single = one.get(u.key);
  if (single) {
    checked.add(single);
    need(single, u.at);
  }
}

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const mismatches: string[] = [];
for (const [k, v] of fr) {
  if (holes(k) !== holes(v)) mismatches.push(`${JSON.stringify(k)} {${holes(k)}} → ${JSON.stringify(v)} {${holes(v)}}`);
}

const list = (title: string, rows: string[]) => {
  if (!rows.length) return;
  console.log(`\n${title} (${rows.length})`);
  for (const r of rows) console.log(`  ${r}`);
};
list(
  'Missing from fr.ts',
  [...missing].sort(([a], [b]) => a.localeCompare(b)).map(([k, at]) => `${JSON.stringify(k)}  ← ${at[0]}${at.length > 1 ? ` (+${at.length - 1})` : ''}`),
);
list('Placeholders differ', mismatches);
list('Member content sent to the dictionary (show it with <Text raw>, keep it out of t())', userContent);
list('UI text in a <Text raw>, never translated (use t() or drop raw)', rawLiterals);
list('Server refusals with no sentence in src/i18n/errors.ts', unmapped);
list('Empty translations', empties);
list('Duplicate keys', duplicates);

const stale = [...EXCEPTIONS].filter((k) => !excepted.has(k) && !fr.has(k));
if (stale.length) console.log(`\nExceptions no longer used (remove them): ${stale.map((k) => JSON.stringify(k)).join(', ')}`);
const shadowed = [...EXCEPTIONS].filter((k) => fr.has(k));
if (shadowed.length) console.log(`\nExceptions that also have an entry in fr.ts: ${shadowed.map((k) => JSON.stringify(k)).join(', ')}`);

console.log(`\nKeys checked: ${checked.size} (${uses.length} uses; ${dynamic} built at run time, not checked)`);
console.log(`Dictionary entries: ${fr.size}`);
console.log(`Missing: ${missing.size}`);
console.log(`Server refusals: ${raised.size} (${unmapped.length} unmapped)`);
console.log(`Member content sent to the dictionary: ${userContent.length}  UI text in <Text raw>: ${rawLiterals.length}`);
console.log(`Placeholder mismatches: ${mismatches.length}`);
console.log(`Empty: ${empties.length}  Duplicates: ${duplicates.length}`);
if (process.argv.includes('--props')) {
  for (const d of defs.values()) if (d.translated.size && /^[A-Z]/.test(d.id.split('#')[1])) console.log(`  ${d.id}: ${[...d.translated].join(', ')}`);
}
if (process.argv.includes('--audit')) {
  // Report only: English literals handed to something that does not translate
  // them (a React Native prop, Alert.alert). Not every one is UI text.
  const UI_PROPS = /^(accessibilityLabel|accessibilityHint|placeholder|title|label|subtitle|body|hint)$/;
  for (const [file, sf] of files) {
    const at = (n: ts.Node) => `${path.relative(ROOT, file)}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
    const visit = (n: ts.Node) => {
      if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
        const name = tagName(n.tagName);
        const d = name ? defs.get(resolveName(file, name) ?? '') : undefined;
        for (const a of n.attributes.properties) {
          if (!ts.isJsxAttribute(a) || !ts.isIdentifier(a.name) || !UI_PROPS.test(a.name.text) || !a.initializer || d?.translated.has(a.name.text)) continue;
          const e = ts.isStringLiteral(a.initializer) ? a.initializer : ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined;
          for (const o of e ? outcomes(e) : []) {
            if ((ts.isStringLiteral(o) || ts.isNoSubstitutionTemplateLiteral(o) || ts.isTemplateExpression(o)) && /[A-Za-z]{2}/.test(o.getText(sf))) console.log(`  ${at(o)}  <${name} ${a.name.text}=${o.getText(sf).slice(0, 80)}>`);
          }
        }
      }
      if (ts.isCallExpression(n) && n.expression.getText(sf) === 'Alert.alert') {
        for (const o of n.arguments.flatMap((x) => outcomes(x))) if (ts.isStringLiteral(o)) console.log(`  ${at(o)}  Alert.alert ${o.getText(sf).slice(0, 80)}`);
        const buttons = n.arguments[2];
        if (buttons && ts.isArrayLiteralExpression(buttons)) {
          for (const b of buttons.elements) {
            if (!ts.isObjectLiteralExpression(b)) continue;
            for (const p of b.properties) if (ts.isPropertyAssignment(p) && p.name.getText(sf) === 'text' && ts.isStringLiteral(p.initializer)) console.log(`  ${at(p)}  Alert.alert button ${p.initializer.getText(sf)}`);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
}
process.exit(missing.size + mismatches.length + empties.length + duplicates.length + unmapped.length + userContent.length + rawLiterals.length ? 1 : 0);
