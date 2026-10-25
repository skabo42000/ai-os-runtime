import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { configArgument,loadConfig,contained } from './project-paths.mjs';

export function readStatus(config,{now=Date.now(),staleMs=120000}={}) {
  const file=contained(config.stateDir,'queue.sqlite',{missing:true});
  if(!fs.existsSync(file))return {availability:'unavailable',source:'live read-only database',reason:'No queue database.'};
  const db=new DatabaseSync(file,{readOnly:true});
  try {
    const last=db.prepare('SELECT last_tick FROM meta').get()?.last_tick || null;
    const age=last?Math.max(0,now-Date.parse(last)):null;
    return {availability:age===null?'unknown':age>staleMs?'stale':'observed',source:'live read-only database',age_ms:age,
      paused:!!db.prepare('SELECT paused FROM controls').get().paused,
      workflows:db.prepare('SELECT event,state,reason FROM tasks ORDER BY rowid').all(),
      delivery:db.prepare('SELECT event_id,outcome,state,adapter FROM outbox ORDER BY rowid').all(),
      note:'A database observation does not prove a scheduler or host is healthy.'};
  } finally {db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{console.log(JSON.stringify(readStatus(loadConfig({file:configArgument(),readOnly:true})),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
