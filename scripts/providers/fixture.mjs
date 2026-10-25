// Scripted computation, not a model. It has no filesystem, process or network access.
export async function execute(task, inputManifest, sandbox, hooks = {}, signal) {
  signal?.throwIfAborted();
  const source = inputManifest.find(item => item.path === 'source/requests.json');
  if (!source) throw Error('Missing required requests source.');
  const priorities = { stopped: ['high',0], maintenance: ['normal',1], cosmetic: ['low',2] };
  const requests = JSON.parse(source.content);
  if (!Array.isArray(requests) || requests.some(r => !priorities[r.condition])) throw Error('Unsupported request input.');
  const rows = [...requests].sort((a,b) => priorities[a.condition][1] - priorities[b.condition][1] || a.id.localeCompare(b.id))
    .map(r => ({ id: r.id, asset: r.asset, priority: priorities[r.condition][0], source_id: r.id }));
  const report = { team: 'Harbor Workshop', date: '2026-01-15', requests: rows };
  return { provider: 'fixture (scripted)', report, usage: null, worker: {
    status: 'completed', summary: `Computed ${rows.length} fictional maintenance requests.`,
    evidence: ['source/requests.json'], changed_files: [], memory_updates: [], unresolved: [],
    verification: task.acceptance.map(criterion => ({ criterion, passed: rows.length === 3, details: `Computed ${rows.length} rows from explicit condition fields.` }))
  } };
}
