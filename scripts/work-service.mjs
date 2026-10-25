import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configArgument,loadConfig,contained } from './project-paths.mjs';
import { atomicJson } from './codex-runner.mjs';
import { WorkController } from './work-controller.mjs';

export async function providerFor(config) {
  if(config.provider.name==='fixture')return (await import('./providers/fixture.mjs')).execute;
  if(config.provider.name==='codex')return (await import('./providers/codex.mjs')).codexProvider(config);
  throw Error('Provider unavailable.');
}
export async function notificationFor(config) {
  const adapter=config.notifications.adapter;
  if(adapter==='noop')return (await import('./notifications/noop.mjs')).notify;
  if(adapter==='console')return (await import('./notifications/console.mjs')).notify;
  if(adapter==='reminders')return (await import('./work-reminders.mjs')).remindersAdapter(config.notifications);
  throw Error('Notification adapter unavailable.');
}
export async function flushNotifications(controller,notify,now=new Date()) {
  controller.claim();
  try {
    if(controller.snapshot().paused)return;
    const config=controller.config, n=config.notifications;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:config.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const part=k=>parts.find(p=>p.type===k).value, day=`${part('year')}-${part('month')}-${part('day')}`,hour=+part('hour');
    const quiet=n.quietStart===n.quietEnd?false:n.quietStart<n.quietEnd?hour>=n.quietStart&&hour<n.quietEnd:hour>=n.quietStart||hour<n.quietEnd;
    const db=controller.db;
    if(n.adapter!=='noop' && quiet)return;
    for(const row of db.prepare("SELECT * FROM outbox WHERE state='pending' ORDER BY rowid").all()) {
      const used=db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE substr(attempted,1,10)=? AND adapter=?").get(day,n.adapter).n;
      if(n.adapter!=='noop'&&used>=n.dailyCap)break;
      // Reserve before external effect. A crash keeps 'unknown' and never blindly resends.
      db.prepare("UPDATE outbox SET state='unknown',adapter=?,attempted=? WHERE event_id=? AND state='pending'").run(n.adapter,`${day}T${part('hour')}:00:00`,row.event_id);
      const event={event_id:row.event_id,outcome:row.outcome,summary:'Local task evidence requires review.'};
      let result,timer;
      try {
        result=await Promise.race([notify(event),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Notification timeout')),25000);})]);
        if(!result || result.event_id!==row.event_id || result.adapter!==n.adapter || !['disabled','preview','accepted','failed','unknown'].includes(result.state))throw Error('Invalid receipt.');
        if((n.adapter==='noop'&&result.state!=='disabled')||(n.adapter==='console'&&result.state!=='preview')||(n.adapter==='reminders'&&['preview','disabled'].includes(result.state)))throw Error('Contradictory adapter receipt.');
      } catch {result={state:'unknown'};} finally {clearTimeout(timer);}
      // Persist safe finite state only; arbitrary adapter data cannot enter exports.
      db.prepare('UPDATE outbox SET state=?,receipt=? WHERE event_id=?').run(result.state,JSON.stringify({state:result.state,phone_receipt:'unverified'}),row.event_id);
    }
  } finally {controller.release();}
}
export async function serviceTick(config,{execute,notify,now}={}) {
  const controller=new WorkController(config);
  try {
    await controller.tick({execute:execute || await providerFor(config)});
    await flushNotifications(controller,notify || await notificationFor(config),now);
    const snapshot=controller.snapshot();
    const digest={...snapshot,scope:'Local preparation only; phone receipt unverified.'};
    atomicJson(contained(config.reportDir,'latest-status.json',{missing:true}),digest);
    return digest;
  } finally {controller.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await serviceTick(loadConfig({file:configArgument()})),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
