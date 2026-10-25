import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ROOT,readJson,loadConfig } from './project-paths.mjs';
import { WorkController } from './work-controller.mjs';
import { taskDirectory,hash } from './codex-runner.mjs';
import { execute as scripted } from './providers/fixture.mjs';
import { flushNotifications } from './work-service.mjs';
import { notify as preview } from './notifications/console.mjs';

export function createDemo({base,disposableFixture=false}={}) {
  if(base)fs.mkdirSync(path.resolve(base),{recursive:true});
  const directory=fs.mkdtempSync(path.join(base ? path.resolve(base) : os.tmpdir(),'runtime demo '));
  const workspace=path.join(directory,'workspace');
  fs.cpSync(path.join(ROOT,'fixtures/demo'),workspace,{recursive:true});
  const registry=path.join(directory,'registry.json'),policy=path.join(directory,'policy.md');
  fs.copyFileSync(path.join(ROOT,'config/projects.example.json'),registry);
  fs.copyFileSync(path.join(ROOT,'config/policy.md'),policy);
  const config=loadConfig({env:{},disposableFixture,overrides:{workspaceRoot:workspace,stateDir:path.join(directory,'state'),
    reportDir:path.join(directory,'output'),projectsFile:registry,policyFile:policy}});
  const task=readJson(path.join(workspace,'brief.json'));
  return {directory,config,task,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
export async function failureCase(name,options={}) {
  const env=createDemo(options),{config,task}=env;
  const c=new WorkController(config);let launches=0;
  const execute=async(...args)=>{
    launches++;
    if(['quota','unknown-auth'].includes(name))throw Error(name);
    const value=await scripted(...args);
    if(name==='malformed-check')value.worker.verification[0].passed='true';
    if(name==='contradictory-check')value.worker.verification.push({...value.worker.verification[0],passed:false});
    return value;
  };
  try {
    if(name==='held-project')task.project='held-workshop';
    const event=`demo:${name}:001`;c.enqueue(event,task);
    if(name==='missing-source')fs.unlinkSync(path.join(config.workspaceRoot,'source/requests.json'));
    if(name==='source-tamper')fs.appendFileSync(path.join(config.workspaceRoot,'source/injection.txt'),'\nChanged data.');
    if(name==='policy-tamper')fs.appendFileSync(config.policyFile,'\nPolicy revision.');
    if(name==='interrupted-worker')c.db.prepare("UPDATE tasks SET state='running' WHERE event=?").run(event);
    await c.tick({execute});
    if(name==='modified-artifact'){
      assert.equal(c.snapshot().workflows[0].state,'prepared');
      fs.appendFileSync(path.join(taskDirectory(config,event),'report.json'),' ');
      await c.tick({execute});
    }
    assert.equal(c.snapshot().workflows[0].state,'blocked',`${name} must block`);
    const before=launches;await c.tick({execute});assert.equal(launches,before,'No retry of failed or interrupted work');
    if(['missing-source','held-project','source-tamper','policy-tamper','interrupted-worker'].includes(name))assert.equal(launches,0);
    return {name,state:'blocked',task_criteria:'unavailable; not passed',launches,reason:c.snapshot().workflows[0].reason};
  } finally {c.close();env.cleanup();}
}
export async function runDemo({failures=false,write=console.log,...options}={}) {
  const started=performance.now(), env=createDemo(options), {config,task}=env;
  let c=new WorkController(config),launches=0;
  const execute=async(...args)=>{launches++;return scripted(...args);};
  try {
    write('Fictional Harbor Workshop inputs; fixture worker = scripted; real SQLite queue and independent file verification.');
    write('No model/network calls. Notification delivery is disabled or a local console preview.');
    if(options.disposableFixture)write('Disposable sandbox verification: synced scratch state permitted for fixtures only; live providers and OS notifications refused.');
    write('workspace=<temporary workspace>; state=<temporary local state>; output=<temporary output>');
    const cases=readJson(path.join(config.workspaceRoot,'cases.json'));
    const event=cases.normal;
    assert.equal(c.enqueue(event,task).state,'queued');
    await c.tick({execute});
    assert.equal(c.snapshot().workflows[0].state,'prepared');
    const stages=c.snapshot().timeline.map(row=>row.state);
    assert.deepEqual(stages,readJson(path.join(config.workspaceRoot,'expected/timeline.json')));
    write(`Queue: ${stages.join(' -> ')}`);
    const dir=taskDirectory(config,event),report=readJson(path.join(dir,'report.json'));
    const artifactHash=hash(fs.readFileSync(path.join(dir,'report.json')));
    write(`Verified artifact: <temporary output>/<event hash>/report.json; SHA-256=${artifactHash}`);
    for(const row of report.requests)write(`${row.priority}: ${row.asset}; source_id=${row.source_id}`);
    for(const criterion of task.acceptance)write(`Host verified: ${criterion}`);
    assert.equal(c.enqueue(cases.duplicate,task).reused,true);
    await c.tick({execute});assert.equal(launches,1);
    c.close();c=new WorkController(config);await c.tick({execute});assert.equal(launches,1);
    assert.equal(hash(fs.readFileSync(path.join(dir,'report.json'))),artifactHash);
    write('Duplicate suppressed; reopened SQLite and reverified evidence; worker invocations=1, extra launches=0.');
    const previewConfig={...config,notifications:{...config.notifications,adapter:'console',quietStart:0,quietEnd:0}};
    c.config=previewConfig;
    // The preview is an outbox operation only. It does not rewrite execution evidence.
    await flushNotifications(c,event=>preview(event,write),new Date('2026-01-15T12:00:00Z'));
    assert.equal(c.snapshot().delivery[0].state,'preview');c.config=config;
    const recovery=createDemo(options);let recovered=new WorkController(recovery.config),recoveryLaunches=0;
    try {
      recovered.enqueue('demo:saved-result:001',recovery.task);
      await assert.rejects(recovered.tick({execute:async(...args)=>{recoveryLaunches++;return scripted(...args);},afterSave:()=>{throw Error('Synthetic process interruption after saved result');}}));
      recovered.close();recovered=new WorkController(recovery.config);
      await recovered.tick({execute:()=>{throw Error('Must not launch again');}});
      assert.equal(recovered.snapshot().workflows[0].state,'prepared');assert.equal(recoveryLaunches,1);
      write('Restart after saved worker result: running -> verifying -> prepared; extra worker launches=0.');
    } finally {recovered.close();recovery.cleanup();}
    let failuresChecked=0;
    if(failures)for(const name of cases.failures){
      const result=await failureCase(name,options);failuresChecked++;
      write(`Controlled failure ${name}: ${result.state}; task criteria=${result.task_criteria}; launches=${result.launches}; no automatic retry.`);
    }
    write('Injection sample remained source data; no outbound action or permission change.');
    write(`Demo assertions passed; controlled failure scenarios=${failuresChecked}; elapsed_ms=${Math.round(performance.now()-started)}.`);
    return {artifactHash,launches,failuresChecked};
  } finally {c.close();env.cleanup();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const base=process.env.AI_OS_DEMO_TMP;
    await runDemo({failures:process.argv.includes('--failures'),base,disposableFixture:!!base});
  } catch(error){console.error(`Demo failed: ${error.message}`);process.exitCode=1;}
}
