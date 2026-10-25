import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/project-paths.mjs';
import { createDemo,failureCase } from '../scripts/demo.mjs';
import { WorkController } from '../scripts/work-controller.mjs';
import { taskDirectory } from '../scripts/codex-runner.mjs';
import { execute } from '../scripts/providers/fixture.mjs';
const options={base:path.join(ROOT,'.verification'),disposableFixture:true};
const setup=t=>{const e=createDemo(options);t.after(e.cleanup);return e;};
for(const name of ['missing-source','held-project','modified-artifact','interrupted-worker','source-tamper','policy-tamper','malformed-check','contradictory-check','quota','unknown-auth'])test(`durable failure isolation: ${name}`,async()=>assert.equal((await failureCase(name,options)).state,'blocked'));
test('event duplicate, conflict and global task identity prevent double execution',async t=>{
  const {config,task}=setup(t),c=new WorkController(config);t.after(()=>c.close());let n=0;
  c.enqueue('event:1',task);assert.equal(c.enqueue('event:1',task).reused,true);
  assert.throws(()=>c.enqueue('event:1',{...task,goal:'changed'}),/different/);
  assert.throws(()=>c.enqueue('event:2',task),/UNIQUE/);
  await c.tick({execute:async(...args)=>{n++;return execute(...args);}});await c.tick({execute:()=>{n++;}});
  assert.equal(n,1);assert.equal(c.snapshot().workflows[0].state,'prepared');
});
test('receipt tampering revokes preparation without executing again',async t=>{
  const {config,task}=setup(t),c=new WorkController(config);t.after(()=>c.close());c.enqueue('event:1',task);await c.tick({execute});
  fs.appendFileSync(path.join(taskDirectory(config,'event:1'),'receipt.json'),' ');
  await c.tick({execute:()=>{throw Error('No launch');}});assert.equal(c.snapshot().workflows[0].state,'blocked');
  assert.equal(c.snapshot().delivery.find(r=>r.outcome==='prepared').state,'superseded');
});
test('source changes after preparation revoke earlier evidence',async t=>{
  const {config,task}=setup(t),c=new WorkController(config);t.after(()=>c.close());c.enqueue('event:1',task);await c.tick({execute});
  fs.appendFileSync(path.join(config.workspaceRoot,'source/policy.md'),'\nChanged');await c.tick({execute});assert.equal(c.snapshot().workflows[0].state,'blocked');
});
test('current project hold revokes prepared evidence',async t=>{
  const {config,task}=setup(t),c=new WorkController(config);t.after(()=>c.close());c.enqueue('event:1',task);await c.tick({execute});
  fs.writeFileSync(config.projectsFile,JSON.stringify({harbor:{path:'.',status:'held'}}));await c.tick({execute});assert.equal(c.snapshot().workflows[0].state,'blocked');
});
test('pause persists on disk, stops new work and can be explicitly cleared',async t=>{
  const {config,task}=setup(t);let c=new WorkController(config);c.enqueue('event:1',task);c.pause();c.close();c=new WorkController(config);t.after(()=>c.close());
  assert.equal((await c.tick({execute:()=>{throw Error('Paused');}})).advanced,0);assert.equal(c.snapshot().workflows[0].state,'queued');
  c.pause(false);await c.tick({execute});assert.equal(c.snapshot().workflows[0].state,'prepared');
});
test('live/foreign/unknown coordinator ownership refuses takeover',t=>{
  const {config}=setup(t),one=new WorkController(config);t.after(()=>one.close());one.claim();
  for(const overrides of [{},{host:'foreign'},{isAlive:()=>true}]){
    const other=new WorkController(config,overrides);assert.throws(()=>other.claim(),/takeover/);other.close();
  }
});
test('real child exits after saved result; a fresh owner recovers with zero new launches',async t=>{
  const {config,task,directory}=setup(t),c=new WorkController(config);c.enqueue('event:1',task);c.close();
  const childFile=path.join(directory,'interrupt.mjs');
  fs.writeFileSync(childFile,`import {WorkController} from ${JSON.stringify(new URL('../scripts/work-controller.mjs',import.meta.url).href)};\nimport {execute} from ${JSON.stringify(new URL('../scripts/providers/fixture.mjs',import.meta.url).href)};\nconst c=new WorkController(${JSON.stringify(config)});await c.tick({execute,afterSave:()=>process.exit(42)});`);
  const child=spawnSync(process.execPath,[childFile],{encoding:'utf8'});assert.equal(child.status,42,child.stderr);
  const recovered=new WorkController(config);t.after(()=>recovered.close());let launches=0;
  await recovered.tick({execute:()=>{launches++;throw Error('Do not relaunch');}});
  assert.equal(launches,0);assert.equal(recovered.snapshot().workflows[0].state,'prepared');
});
test('tick bounds and idle ticks never create work',async t=>{
  const {config}=setup(t),c=new WorkController(config);t.after(()=>c.close());
  for(const maxStages of [0,3,NaN])await assert.rejects(c.tick({maxStages}));
  assert.equal((await c.tick({execute:()=>{throw Error('Idle');}})).advanced,0);
});
test('timed-out uncooperative fixture cannot write late completion',async t=>{
  const {config,task}=setup(t);task.timeoutMs=10;const c=new WorkController(config);t.after(()=>c.close());c.enqueue('event:1',task);
  await c.tick({execute:async(...args)=>{await new Promise(r=>setTimeout(r,40));return execute(...args);}});
  await new Promise(r=>setTimeout(r,60));assert.equal(c.snapshot().workflows[0].state,'blocked');
  assert.equal(fs.existsSync(path.join(taskDirectory(config,'event:1'),'receipt.json')),false);
});
