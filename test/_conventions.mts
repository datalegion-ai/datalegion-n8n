// Vendored from the website repository's __tests__/_conventions.ts. Do not edit: re-copy it; the upgrade sweep diffs it.
/*
 * The test-suite conventions every Data Legion repo holds, checked from a repo's tracked files.
 * The TypeScript twin of the shared Python library's test conventions: the same three rules.
 *
 * 1. Every test can fail: it calls expect / assert / fail, a testing-library getBy* / findBy*
 *    query, or throws, itself or through a helper anywhere in the tests (followed transitively).
 *    A test whose whole claim is that valid input runs says so in its name ("... does not
 *    throw") and can fail by throwing.
 * 2. No test swallows an error with an empty catch (`catch {}`, `.catch(() => {})`): it passes
 *    whatever happened.
 * 3. No two tests share a body (their .each table included): the second name's behavior goes
 *    untested. A body includes the declarations it reads from its enclosing describe blocks and
 *    its module, so person and company twins that differ only there are no duplicates.
 *
 * One source, in the website's repository; the other TypeScript repos keep byte-identical
 * copies, which the upgrade sweep diffs. Only node: modules and typescript, which every one of
 * those repos has.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

export const TEST_FILES = ['*.test.ts', '*.test.tsx', '*.test.mts', '*.test.js', '*.test.mjs', '*.spec.ts', '*.spec.tsx', '*.spec.mts', '*.spec.js', '*.spec.mjs'];
export const HELPER_FILES = ['*tests/*.ts', '*tests/*.tsx', '*tests/*.mts', '*tests/*.js', '*tests/*.mjs', '*test/*.ts', '*test/*.mts', '*test/*.js', '*test/*.mjs', '*__tests__/*.ts', '*__tests__/*.tsx', '*__tests__/*.mts', '*__tests__/*.js', '*__tests__/*.mjs'];
const NO_THROW_SUFFIXES = ['does not throw', 'do not throw'];
const TEST_NAMES = new Set(['it', 'test']);
const DESCRIBE_NAMES = new Set(['describe', 'suite']);
const MODIFIERS = new Set(['only', 'skip', 'concurrent', 'sequential', 'fails', 'each', 'for', 'skipIf', 'runIf', 'describe']);

type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;
interface Test { file: string; fn: ts.Node; scopes: ts.Node[]; table: string; where: string }

const printer = ts.createPrinter({ removeComments: true });

const scriptKind = (name: string): ts.ScriptKind => {
  if (name.endsWith('x')) {
    return ts.ScriptKind.TSX;
  }
  return /\.[cm]?ts$/.test(name) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
};

const tracked = (root: string, patterns: string[]): Map<string, ts.SourceFile> => {
  const names = execFileSync('git', ['ls-files', '--', ...patterns], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const files = new Map<string, ts.SourceFile>();
  for (const name of [...new Set(names)].sort()) {
    files.set(name, ts.createSourceFile(name, readFileSync(join(root, name), 'utf8'), ts.ScriptTarget.Latest, true, scriptKind(name)));
  }
  return files;
};

const walk = (node: ts.Node, visit: (n: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

/** The chain under a call's callee: `it.concurrent.each(table)(...)` gives ['it', 'concurrent', 'each']. */
const calleeChain = (expr: ts.Expression): string[] | undefined => {
  if (ts.isIdentifier(expr)) {
    return [expr.text];
  }
  if (ts.isPropertyAccessExpression(expr)) {
    const base = calleeChain(expr.expression);
    return base && [...base, expr.name.text];
  }
  if (ts.isCallExpression(expr)) {
    return calleeChain(expr.expression);
  }
  return undefined;
};

const kindOf = (call: ts.CallExpression): 'test' | 'describe' | undefined => {
  const chain = calleeChain(call.expression);
  if (!chain || !chain.slice(1).every((part) => MODIFIERS.has(part))) {
    return undefined;
  }
  const [head = ''] = chain;
  if (chain.includes('describe') || DESCRIBE_NAMES.has(head)) {
    return 'describe';
  }
  if (TEST_NAMES.has(head) && !chain.includes('todo')) {
    return 'test';
  }
  return undefined;
};

const label = (call: ts.CallExpression): string => {
  const first = call.arguments[0];
  if (!first) {
    return '?';
  }
  return ts.isStringLiteralLike(first) ? first.text : first.getText();
};

const body = (call: ts.CallExpression): ts.Node | undefined =>
  [...call.arguments].reverse().find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a) || ts.isIdentifier(a));

/** The .each / .for table a test or describe is called with (the callee's own call arguments). */
const table = (call: ts.CallExpression): string =>
  (ts.isCallExpression(call.expression) ? call.expression.arguments.map((a) => a.getText()).join(',') : '');

const tests = (file: string, source: ts.SourceFile): Test[] => {
  const found: Test[] = [];
  const visit = (node: ts.Node, path: string[], scopes: ts.Node[], tables: string[]): void => {
    if (ts.isCallExpression(node)) {
      const kind = kindOf(node);
      const fn = body(node);
      if (kind === 'test' && fn) {
        found.push({
          file, fn, scopes, table: [...tables, table(node)].join('|'), where: [file, ...path, label(node)].join('::'),
        });
        return; // a test defined inside a test is no test
      }
      if (kind === 'describe' && fn) {
        for (const arg of node.arguments) {
          if (arg === fn) {
            visit(arg, [...path, label(node)], [fn, ...scopes], [...tables, table(node)]);
          } else {
            visit(arg, path, scopes, tables);
          }
        }
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, path, scopes, tables));
  };
  visit(source, [], [], []);
  return found;
};

const isFn = (node: ts.Node): node is Fn =>
  ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node);

/** Named functions: declarations, `const f = () => ...`, methods. */
const functions = (source: ts.SourceFile): Map<string, ts.Node> => {
  const named = new Map<string, ts.Node>();
  walk(source, (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      named.set(node.name.text, node);
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isFn(node.initializer)) {
      named.set(node.name.text, node.initializer);
    }
  });
  return named;
};

const checksDirectly = (node: ts.Node): boolean => {
  let checks = false;
  walk(node, (n) => {
    if (ts.isThrowStatement(n)) {
      checks = true;
    }
    if (ts.isCallExpression(n)) {
      const chain = calleeChain(n.expression) ?? [];
      const [head = ''] = chain;
      const last = chain[chain.length - 1] ?? '';
      if (['assert', 'expect', 'expectTypeOf'].includes(head) || last.startsWith('assert') || last === 'fail') {
        checks = true;
      }
      // testing-library's getBy* / findBy* throw when nothing matches (Playwright's page.getBy* only builds a locator)
      if (/^(get|find)(All)?By[A-Z]/.test(last) && head !== 'page') {
        checks = true;
      }
    }
  });
  return checks;
};

const calledNames = (node: ts.Node): Set<string> => {
  const names = new Set<string>();
  walk(node, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      names.add(n.expression.text);
    }
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      names.add(n.expression.name.text);
    }
    // a helper passed as a callback
    if (ts.isIdentifier(n) && n.parent && ts.isCallExpression(n.parent) && n.parent.arguments.includes(n)) {
      names.add(n.text);
    }
  });
  return names;
};

const meets = (a: Set<string>, b: Set<string>) => [...a].some((x) => b.has(x));

export const silentTests = (root: string, testFiles = TEST_FILES, helperFiles = HELPER_FILES): string[] => {
  const trees = tracked(root, testFiles);
  const byName = new Map<string, ts.Node>();
  for (const source of [...tracked(root, helperFiles).values(), ...trees.values()]) {
    for (const [name, fn] of functions(source)) {
      byName.set(name, fn);
    }
  }
  const checking = new Set([...byName].filter(([, fn]) => checksDirectly(fn)).map(([name]) => name));
  for (let grew = true; grew;) {
    // a helper calling a checking helper checks too
    const more = [...byName].filter(([name, fn]) => !checking.has(name) && meets(calledNames(fn), checking)).map(([name]) => name);
    more.forEach((name) => checking.add(name));
    grew = more.length > 0;
  }
  return [...trees].flatMap(([file, source]) => tests(file, source))
    .filter((t) => !checksDirectly(t.fn) && !meets(calledNames(t.fn), checking))
    .filter((t) => !NO_THROW_SUFFIXES.some((s) => t.where.endsWith(s)))
    .map((t) => t.where);
};

const isEmptyHandler = (node: ts.Node): boolean => {
  if (ts.isBlock(node)) {
    return node.statements.every((s) => ts.isExpressionStatement(s) && ts.isLiteralExpression(s.expression));
  }
  return ts.isLiteralExpression(node) || node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined');
};

const swallows = (n: ts.Node): boolean => {
  if (ts.isCatchClause(n)) {
    return isEmptyHandler(n.block);
  }
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'catch' || n.arguments.length !== 1) {
    return false;
  }
  const [handler] = n.arguments;
  return !!handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) && isEmptyHandler(handler.body);
};

export const swallowingTests = (root: string, testFiles = TEST_FILES): string[] =>
  [...tracked(root, testFiles)].flatMap(([file, source]) => tests(file, source).flatMap((t) => {
    const lines: string[] = [];
    walk(t.fn, (n) => {
      if (swallows(n)) {
        lines.push(`${t.where}:${source.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
      }
    });
    return lines;
  }));

/** Whether a statement declares (or imports) one of `names`. */
const declaresOneOf = (statement: ts.Statement, names: Set<string>): boolean => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && names.has(d.name.text));
  }
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return !!statement.name && names.has(statement.name.text);
  }
  if (!ts.isImportDeclaration(statement)) {
    return false;
  }
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  if (clause?.name && names.has(clause.name.text)) {
    return true;
  }
  if (!bindings) {
    return false;
  }
  return ts.isNamespaceImport(bindings) ? names.has(bindings.name.text) : bindings.elements.some((e) => names.has(e.name.text));
};

/**
 * The declarations of the names a test body reads, from its enclosing describe blocks and its
 * module (imports included): a vitest test's scope, as a pytest method's is its class. Person and
 * company twins share bodies but read their own schema, component or route there.
 */
const scopeMembersUsed = (t: Test): string[] => {
  const used = new Set<string>();
  walk(t.fn, (n) => {
    if (ts.isIdentifier(n)) {
      used.add(n.text);
    }
  });
  const source = t.fn.getSourceFile();
  const blocks = [...t.scopes.flatMap((scope) => (isFn(scope) && scope.body && ts.isBlock(scope.body) ? [scope.body.statements] : [])), source.statements];
  return blocks.flatMap((statements) => statements.filter((s) => declaresOneOf(s, used)).map((s) => printer.printNode(ts.EmitHint.Unspecified, s, source)));
};

export const duplicateTestBodies = (root: string, testFiles = TEST_FILES): string[][] => {
  const byBody = new Map<string, string[]>();
  for (const [file, source] of tracked(root, testFiles)) {
    for (const t of tests(file, source)) {
      const key = [t.table, printer.printNode(ts.EmitHint.Unspecified, t.fn, source), ...scopeMembersUsed(t)].join('\n');
      byBody.set(key, [...(byBody.get(key) ?? []), t.where]);
    }
  }
  return [...byBody.values()].filter((names) => names.length > 1);
};
