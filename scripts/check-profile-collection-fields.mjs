import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractPath = path.join(rootDir, 'packages/types/src/index.ts');
const portalPath = path.join(rootDir, 'apps/portal/src/collect.js');
const [contractText, portalText] = await Promise.all([
  readFile(contractPath, 'utf8'),
  readFile(portalPath, 'utf8'),
]);
const contractSource = ts.createSourceFile(contractPath, contractText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const portalSource = ts.createSourceFile(portalPath, portalText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

const expected = readArrayVariable(contractSource, 'PROFILE_COLLECTION_FIELDS');
const allowed = readSetVariable(portalSource, 'ALLOWED_FIELDS');
const rendered = readRequestedFields(portalSource, 'renderForm');
const collected = readRequestedFields(portalSource, 'collectAnswers');

assertSameFields('网页允许字段', expected, allowed);
assertSameFields('网页表单渲染', expected, rendered);
assertSameFields('网页答案采集', expected, collected);
console.log(`资料收集字段一致：${expected.join(', ')}`);

function readArrayVariable(source, name) {
  const declaration = findNode(source, (node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name);
  const initializer = unwrapExpression(declaration?.initializer);
  if (!initializer || !ts.isArrayLiteralExpression(initializer)) throw new Error(`无法读取 ${name}`);
  return initializer.elements.map((element) => {
    if (!ts.isStringLiteral(element)) throw new Error(`${name} 只能包含字符串`);
    return element.text;
  });
}

function readSetVariable(source, name) {
  const declaration = findNode(source, (node) => ts.isVariableDeclaration(node) && node.name.getText(source) === name);
  const initializer = unwrapExpression(declaration?.initializer);
  if (!initializer || !ts.isNewExpression(initializer) || initializer.expression.getText(source) !== 'Set' || initializer.arguments?.length !== 1) throw new Error(`无法读取 ${name}`);
  const values = unwrapExpression(initializer.arguments[0]);
  if (!values || !ts.isArrayLiteralExpression(values)) throw new Error(`${name} 必须由字符串数组创建`);
  return values.elements.map((element) => {
    if (!ts.isStringLiteral(element)) throw new Error(`${name} 只能包含字符串`);
    return element.text;
  });
}

function readRequestedFields(source, functionName) {
  const declaration = findNode(source, (node) => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  if (!declaration) throw new Error(`无法读取 ${functionName}`);
  const fields = [];
  visit(declaration.body, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'includes') return;
    if (node.expression.expression.getText(source) !== 'request.f' || node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0])) return;
    fields.push(node.arguments[0].text);
  });
  return [...new Set(fields)];
}

function assertSameFields(label, expected, actual) {
  const missing = expected.filter((field) => !actual.includes(field));
  const extra = actual.filter((field) => !expected.includes(field));
  if (!missing.length && !extra.length) return;
  const details = [missing.length ? `缺少 ${missing.join(', ')}` : '', extra.length ? `多出 ${extra.join(', ')}` : ''].filter(Boolean).join('；');
  throw new Error(`${label}与 PROFILE_COLLECTION_FIELDS 不一致：${details}`);
}

function unwrapExpression(expression) {
  let current = expression;
  while (current && (ts.isAsExpression(current) || ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression(current))) current = current.expression;
  return current;
}

function findNode(root, predicate) {
  let result;
  visit(root, (node) => {
    if (!result && predicate(node)) result = node;
  });
  return result;
}

function visit(node, callback) {
  if (!node) return;
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}
