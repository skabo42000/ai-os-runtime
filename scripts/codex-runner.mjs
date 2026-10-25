// Host-owned task contracts and verification; no auth inspection or provider selection at import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, contained, readJson, resolveProject } from './project-paths.mjs';

export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const taskFingerprint = task => hash(JSON.stringify(task));
export function atomicJson(file, value) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}
const sameKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join() === [...keys].sort().join();
export function validateTask(config, task) {
  if (!sameKeys(task, ['id','project','role','goal','sources','acceptance','artifact','edit','outbound','timeoutMs'])
    || !/^[a-z0-9-]{1,80}$/.test(task.id) || !/^[a-z0-9-]{1,80}$/.test(task.project)
    || !['researcher','engineer','reviewer'].includes(task.role) || typeof task.goal !== 'string' || !task.goal.trim()
    || task.edit !== false || task.outbound !== false || task.artifact !== 'report.json'
    || !Number.isInteger(task.timeoutMs) || task.timeoutMs < 10 || task.timeoutMs > 3_600_000
    || !Array.isArray(task.acceptance) || !task.acceptance.length || new Set(task.acceptance).size !== task.acceptance.length
    || task.acceptance.some(c => typeof c !== 'string' || !c.trim())
    || !Array.isArray(task.sources) || task.sources.length !== 3 || new Set(task.sources).size !== 3
    || !['source/requests.json','source/policy.md','source/injection.txt'].every(p => task.sources.includes(p))) throw Error('Invalid bounded task contract.');
  const project = resolveProject(config, task.project);
  return project;
}
export function sourceManifest(config, task) {
  const root = validateTask(config, task);
  return task.sources.map(relative => {
    const data = fs.readFileSync(contained(root, relative));
    if (data.length > 1_000_000) throw Error('Source too large.');
    return { path: relative, sha256: hash(data), content: data.toString('utf8') };
  });
}
export function policyRevision(config) {
  return hash(JSON.stringify([
    fs.readFileSync(config.policyFile, 'utf8'), fs.readFileSync(config.projectsFile, 'utf8'),
    fs.readFileSync(path.join(ROOT, 'config/worker-result.schema.json'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'config/agent-roles.json'), 'utf8'),
    ...['procedures/worker-rules.md','procedures/engineering.md','procedures/research.md','procedures/review.md'].map(p => fs.readFileSync(path.join(ROOT,p),'utf8')),
    config.provider, config.notifications, config.timezone
  ]));
}
export function validateResult(worker, acceptance) {
  if (!sameKeys(worker, ['status','summary','evidence','changed_files','verification','memory_updates','unresolved'])
    || !['completed','partial','blocked','failed'].includes(worker.status) || typeof worker.summary !== 'string') throw Error('Invalid worker result schema.');
  for (const key of ['evidence','changed_files','memory_updates','unresolved']) {
    if (!Array.isArray(worker[key]) || worker[key].some(v => typeof v !== 'string')) throw Error('Invalid worker result arrays.');
  }
  if (!Array.isArray(worker.verification) || worker.verification.some(v => !sameKeys(v,['criterion','passed','details'])
    || typeof v.criterion !== 'string' || typeof v.passed !== 'boolean' || typeof v.details !== 'string')) throw Error('Invalid verification schema.');
  if (worker.status !== 'completed' || !worker.summary.trim() || worker.changed_files.length || worker.unresolved.length || !worker.evidence.some(e => e.trim())
    || worker.verification.length !== acceptance.length || acceptance.some(c => {
      const matches = worker.verification.filter(v => v.criterion === c);
      return matches.length !== 1 || matches[0].passed !== true || !matches[0].details.trim();
    })) throw Error('Worker evidence incomplete, contradictory or outside read-only scope.');
  return worker;
}
export function verifyReport(config, task, report, manifest) {
  // Independent fixed fixture plus independent source linkage, never worker-generated expectations.
  const expected = readJson(contained(config.workspaceRoot, 'expected/report.json'));
  if (!isDeepStrictEqual(report, expected)) throw Error('Report differs from independent expected fixture.');
  const requests = JSON.parse(manifest.find(m => m.path === 'source/requests.json').content);
  if (!Array.isArray(requests) || requests.length !== 3 || new Set(requests.map(r => r.id)).size !== 3) throw Error('Source count/identity mismatch.');
  const priority = { stopped: 'high', maintenance: 'normal', cosmetic: 'low' };
  for (const row of report.requests) {
    const source = requests.find(r => r.id === row.source_id);
    if (!source || row.id !== source.id || row.asset !== source.asset || row.priority !== priority[source.condition]
        || source.date !== report.date) throw Error('Report source linkage failed.');
  }
  if (report.requests.map(r => r.priority).join() !== 'high,normal,low') throw Error('Priority order failed.');
  return true;
}
export function taskDirectory(config, event) {
  const name = hash(event);
  const dir = contained(config.reportDir, name, { file: false, missing: true });
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
export function verifyReceipt(config, task, event, receiptSha, expectedManifest, revision) {
  const dir = taskDirectory(config, event), file = contained(dir, 'receipt.json');
  if (!receiptSha || hash(fs.readFileSync(file)) !== receiptSha) throw Error('Saved result missing or modified.');
  const receipt = readJson(file);
  const current = sourceManifest(config, task).map(({path,sha256}) => ({path,sha256}));
  if (receipt.task_sha256 !== taskFingerprint(task) || receipt.policy_sha256 !== revision
    || policyRevision(config) !== revision || !isDeepStrictEqual(receipt.sources, expectedManifest)
    || !isDeepStrictEqual(current, expectedManifest)) throw Error('Source, policy or task evidence changed.');
  validateResult(receipt.response.worker, task.acceptance);
  const artifact = contained(dir, task.artifact);
  if (hash(fs.readFileSync(artifact)) !== receipt.artifact_sha256) throw Error('Artifact hash changed.');
  const report = readJson(artifact);
  if (!isDeepStrictEqual(report, receipt.response.report)) throw Error('Saved report differs from worker response.');
  verifyReport(config, task, report, sourceManifest(config, task));
  return receipt;
}
export async function runTask(config, task, event, execute, hooks = {}, signal) {
  const manifest = sourceManifest(config, task), revision = policyRevision(config);
  const dir = taskDirectory(config, event), artifact = contained(dir, task.artifact, { missing: true });
  const sandbox = { directory: dir, readOnly: true, network: false };
  const response = await execute(task, manifest, sandbox, hooks, signal);
  signal?.throwIfAborted();
  if (!sameKeys(response,['provider','usage','report','worker']) || typeof response.provider !== 'string'
      || !response.provider.startsWith(config.provider.name)) throw Error('Invalid provider envelope.');
  // Keep failed progress locally, but it can never become a successful receipt.
  atomicJson(contained(dir,'progress.json',{missing:true}), response);
  validateResult(response.worker, task.acceptance);
  verifyReport(config, task, response.report, manifest);
  atomicJson(artifact, response.report);
  const receipt = { task_sha256: taskFingerprint(task), policy_sha256: revision,
    sources: manifest.map(({path,sha256}) => ({path,sha256})), response,
    artifact: task.artifact, artifact_sha256: hash(fs.readFileSync(artifact)) };
  const output = contained(dir,'receipt.json',{missing:true});
  if (fs.existsSync(output)) throw Error('Result already exists; no overwrite or automatic retry.');
  atomicJson(output, receipt);
  return hash(fs.readFileSync(output));
}
