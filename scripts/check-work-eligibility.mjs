import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configArgument, loadConfig, resolveProject } from './project-paths.mjs';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const id = process.argv[2];
    resolveProject(loadConfig({ file: configArgument() }), id);
    console.log(JSON.stringify({ project: id, eligible: true, note: 'Read-only selection only; no worker launched.' }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
