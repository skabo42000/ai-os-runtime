import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isHeldStatus, isRetiredStatus } from './project-lifecycle.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function within(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}
export function canonical(value) {
  let ancestor = path.resolve(value);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  return path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, path.resolve(value)));
}
export function contained(root, relative, { file = true, missing = false } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\')) throw Error('Expected a relative path.');
  if (/(^|\/)(?:\.env[^/]*|auth\.json|credentials[^/]*|\.codex|\.aws|secrets?)(\/|$)|\.(?:key|pem)$/i.test(relative)) throw Error('Credential source refused.');
  const base = fs.realpathSync(root), target = path.resolve(base, relative);
  if (!within(base, target)) throw Error('Path escapes scope.');
  let part = base;
  for (const segment of path.relative(base, target).split(path.sep).filter(Boolean)) {
    part = path.join(part, segment);
    if (fs.lstatSync(part, { throwIfNoEntry: false })?.isSymbolicLink()) throw Error('Symlink in scoped path refused.');
  }
  if (!within(base, canonical(target))) throw Error('Canonical path escapes scope.');
  if (!missing && (file ? !fs.statSync(target).isFile() : !fs.statSync(target).isDirectory())) throw Error('Wrong source type.');
  return target;
}
export function loadConfig({ file, env = process.env, overrides = {}, disposableFixture = false, readOnly = false } = {}) {
  const configFile = path.resolve(file || env.AI_OS_CONFIG || path.join(ROOT, 'config/runtime.example.json'));
  const raw = readJson(configFile), dir = path.dirname(configFile);
  for (const key of ['workspaceRoot','stateDir','reportDir','projectsFile','policyFile','timezone','provider','notifications','scheduling']) {
    if (!(key in raw)) throw Error(`Missing setting: ${key}`);
  }
  const values = { ...raw, ...overrides };
  const resolve = key => {
    const value = key === 'stateDir' ? env.AI_OS_STATE_DIR || values[key] : values[key];
    if (typeof value !== 'string' || !value.trim()) throw Error(`Missing setting: ${key}; supply a local path in an explicit config.`);
    return canonical(path.resolve(dir, value));
  };
  const config = { ...values, configFile, workspaceRoot: resolve('workspaceRoot'), stateDir: resolve('stateDir'),
    reportDir: resolve('reportDir'), projectsFile: resolve('projectsFile'), policyFile: resolve('policyFile'), disposableFixture };
  new Intl.DateTimeFormat('en', { timeZone: config.timezone }).format();
  if (config.scheduling !== false) throw Error('Scheduling is unavailable; use explicit bounded ticks.');
  if (!['fixture','codex'].includes(config.provider?.name)) throw Error('Provider unavailable.');
  if (config.provider.name === 'fixture' && (config.provider.model !== 'scripted-v1' || config.provider.effort !== 'none')) throw Error('Invalid fixture model/effort.');
  if (config.provider.name === 'codex' && (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(config.provider.model || '') || !['low','medium','high','xhigh'].includes(config.provider.effort))) throw Error('Explicit Codex model and effort required.');
  const n = config.notifications;
  if (!['noop','console','reminders'].includes(n?.adapter) || !Number.isInteger(n.dailyCap) || n.dailyCap < 1 || n.dailyCap > 20
      || ![n.quietStart,n.quietEnd].every(v => Number.isInteger(v) && v >= 0 && v < 24)
      || typeof n.list !== 'string' || !n.list.trim() || n.list.length > 100 || /[\x00-\x1f]/.test(n.list)) throw Error('Invalid notifications setting.');
  if (disposableFixture && (config.provider.name !== 'fixture' || !['noop','console'].includes(n.adapter))) throw Error('Disposable verification permits only scripted fixtures and local previews.');
  if (!fs.statSync(config.workspaceRoot).isDirectory()) throw Error('Missing workspaceRoot.');
  readJson(config.projectsFile); fs.readFileSync(config.policyFile);
  for (const [a,b] of [[config.workspaceRoot,config.stateDir],[config.workspaceRoot,config.reportDir],[config.stateDir,config.reportDir]]) {
    if (within(a,b) || within(b,a)) throw Error('Workspace, state and reports must be separate roots.');
  }
  if (!disposableFixture && (/OneDrive|CloudStorage|Dropbox|iCloud|Google Drive/i.test(config.stateDir) || within(canonical(ROOT), config.stateDir))) throw Error('SQLite state must be outside the repository and synced storage.');
  for (const key of ['stateDir','reportDir']) {
    if (!readOnly) fs.mkdirSync(config[key], { recursive: true, mode: 0o700 });
    if (fs.lstatSync(config[key], { throwIfNoEntry: false })?.isSymbolicLink()) throw Error('State/output symlink refused.');
  }
  return config;
}
export function resolveProject(config, id) {
  const record = readJson(config.projectsFile)[id];
  if (!record || typeof record.status !== 'string') throw Error('Unknown project or missing status.');
  if (isHeldStatus(record.status) || isRetiredStatus(record.status)) throw Error('Project is held or retired.');
  if (record.status !== 'active') throw Error('Project status unavailable.');
  return contained(config.workspaceRoot, record.path, { file: false });
}
export function configArgument(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--config');
  if (index >= 0 && !argv[index + 1]) throw Error('Missing --config value.');
  return index < 0 ? undefined : argv[index + 1];
}
