import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/project-paths.mjs';
import { createDemo } from '../scripts/demo.mjs';
import { WorkController } from '../scripts/work-controller.mjs';
import { serviceTick,flushNotifications } from '../scripts/work-service.mjs';
import { readStatus } from '../scripts/work-service-status.mjs';
import { notify as noop } from '../scripts/notifications/noop.mjs';
import { notify as preview } from '../scripts/notifications/console.mjs';
import { remindersAdapter } from '../scripts/work-reminders.mjs';
const setup=t=>{const e=createDemo({base:path.join(ROOT,'.verification'),disposableFixture:true});t.after(e.cleanup);return e;};
const noon=new Date('2026-01-15T12:00:00Z');
test('idle service does not invoke worker; status is a read-only database observation',async t=>{
  const {config}=setup(t);await serviceTick(config,{execute:()=>{throw Error('Idle');}});
  const before=fs.statSync(path.join(config.stateDir,'queue.sqlite')).mtimeMs;
  const status=readStatus(config);assert.equal(status.availability,'observed');assert.equal(status.workflows.length,0);
  assert.equal(fs.statSync(path.join(config.stateDir,'queue.sqlite')).mtimeMs,before);
  assert.equal(readStatus(config,{now:Date.now()+300000}).availability,'stale');
});
test('unavailable status creates no database',t=>{
  const {config}=setup(t);assert.equal(readStatus(config).availability,'unavailable');assert.equal(fs.existsSync(path.join(config.stateDir,'queue.sqlite')),false);
});
test('default notifications record disabled delivery',async t=>{
  const {config,task}=setup(t),c=new WorkController(config);c.enqueue('event:1',task);c.close();
  const status=await serviceTick(config,{now:noon});assert.equal(status.delivery[0].state,'disabled');assert.equal(status.delivery[0].adapter,'noop');
});
test('console notifications are previews and duplicate flush does not send twice',async t=>{
  const {config,task}=setup(t);config.notifications.adapter='console';const c=new WorkController(config);t.after(()=>c.close());
  c.enqueue('event:1',task);const {execute}=await import('../scripts/providers/fixture.mjs');await c.tick({execute});let calls=0;
  const adapter=e=>preview(e,()=>calls++);await flushNotifications(c,adapter,noon);await flushNotifications(c,adapter,noon);
  assert.equal(calls,1);assert.equal(c.snapshot().delivery[0].state,'preview');
});
test('quiet hours and daily cap hold pending events across reopen',async t=>{
  const {config}=setup(t);config.notifications={...config.notifications,adapter:'console',dailyCap:1};let c=new WorkController(config);
  c.db.prepare('INSERT INTO outbox VALUES(?,?,?,?,NULL,NULL,NULL)').run('first','e1','blocked','pending');
  c.db.prepare('INSERT INTO outbox VALUES(?,?,?,?,NULL,NULL,NULL)').run('second','e2','blocked','pending');
  await flushNotifications(c,noop,new Date('2026-01-15T23:00:00Z'));assert.equal(c.snapshot().delivery[0].state,'pending');
  let n=0;const adapter=e=>preview(e,()=>n++);await flushNotifications(c,adapter,noon);c.close();c=new WorkController(config);t.after(()=>c.close());
  await flushNotifications(c,adapter,noon);assert.equal(n,1);assert.equal(c.snapshot().delivery.filter(e=>e.state==='pending').length,1);
  await flushNotifications(c,adapter,new Date('2026-01-16T12:00:00Z'));assert.equal(n,2);
});
test('uncertain notification attempts are durable and never automatically resent',async t=>{
  const {config}=setup(t);config.notifications.adapter='console';let c=new WorkController(config);c.db.prepare('INSERT INTO outbox VALUES(?,?,?,?,NULL,NULL,NULL)').run('opaque','e1','blocked','pending');
  let n=0;await flushNotifications(c,()=>{n++;throw Error('response lost');},noon);c.close();c=new WorkController(config);t.after(()=>c.close());
  await flushNotifications(c,()=>{n++;},noon);assert.equal(n,1);assert.equal(c.snapshot().delivery[0].state,'unknown');
});
for(const outcome of ['accepted','failed','unknown'])test(`Reminders stub result ${outcome} is never phone receipt proof`,async()=>{
  const fake=(bin,args,opts,callback)=>{assert.equal(bin,'/usr/bin/osascript');assert.ok(args.includes('Runtime alerts'));callback(outcome==='accepted'?null:Object.assign(Error('fake'),outcome==='unknown'?{code:'ETIMEDOUT'}:{}));};
  const result=await remindersAdapter({list:'Runtime alerts'},{platform:'darwin',run:fake})({event_id:'opaque',outcome:'blocked'});
  assert.equal(result.state,outcome);assert.equal(result.receipt,undefined);
});
test('Reminders is unavailable off macOS without invoking an OS command',async()=>{
  const result=await remindersAdapter({list:'Runtime alerts'},{platform:'linux',run:()=>{throw Error('Must not run');}})({event_id:'opaque',outcome:'blocked'});
  assert.equal(result.state,'failed');
});
