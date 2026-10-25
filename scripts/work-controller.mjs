import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { contained } from './project-paths.mjs';
import { hash, taskFingerprint, sourceManifest, policyRevision, runTask, verifyReceipt } from './codex-runner.mjs';

const alive = pid => {
  if (!Number.isInteger(pid) || pid < 1) return true;
  try { process.kill(pid,0); return true; } catch(e) { return e.code !== 'ESRCH'; }
};
export class WorkController {
  constructor(config, { host = os.hostname(), pid = process.pid, isAlive = alive } = {}) {
    this.config = config; this.host = host; this.pid = pid; this.isAlive = isAlive;
    this.owner = crypto.randomUUID(); this.owned = false;
    const database = contained(config.stateDir,'queue.sqlite',{missing:true});
    this.db = new DatabaseSync(database); fs.chmodSync(database,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=1000;
      CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT, host TEXT, pid INTEGER);
      CREATE TABLE IF NOT EXISTS controls (id INTEGER PRIMARY KEY CHECK(id=1), paused INTEGER NOT NULL);
      INSERT OR IGNORE INTO controls VALUES(1,0);
      CREATE TABLE IF NOT EXISTS tasks(event TEXT PRIMARY KEY, task_id TEXT UNIQUE, task TEXT, task_sha TEXT,
        policy_sha TEXT, manifest TEXT, state TEXT, receipt_sha TEXT, reason TEXT);
      CREATE TABLE IF NOT EXISTS timeline(n INTEGER PRIMARY KEY, event TEXT, state TEXT, at TEXT);
      CREATE TABLE IF NOT EXISTS outbox(event_id TEXT PRIMARY KEY, event TEXT, outcome TEXT, state TEXT,
        adapter TEXT, attempted TEXT, receipt TEXT);
      CREATE TABLE IF NOT EXISTS meta(id INTEGER PRIMARY KEY CHECK(id=1), last_tick TEXT);`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result=fn(); this.db.exec('COMMIT'); return result; }
    catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  claim() {
    if (this.owned) throw Error('Controller already executing.');
    this.transaction(() => {
      const old=this.db.prepare('SELECT * FROM owner').get();
      if (old && (old.host !== this.host || this.isAlive(old.pid))) throw Error('Coordinator live, foreign or unknown; takeover refused.');
      this.db.prepare('INSERT OR REPLACE INTO owner VALUES(1,?,?,?)').run(this.owner,this.host,this.pid);
    });
    this.owned=true;
  }
  release() { if(this.owned) this.db.prepare('DELETE FROM owner WHERE token=?').run(this.owner); this.owned=false; }
  close() { this.release(); this.db.close(); }
  pause(value=true) { this.db.prepare('UPDATE controls SET paused=?').run(value?1:0); }
  transition(event,state,reason=null) {
    this.transaction(() => {
      this.db.prepare('UPDATE tasks SET state=?,reason=? WHERE event=?').run(state,reason,event);
      this.db.prepare('INSERT INTO timeline(event,state,at) VALUES(?,?,?)').run(event,state,new Date().toISOString());
      if (['prepared','blocked'].includes(state)) this.db.prepare('INSERT OR IGNORE INTO outbox VALUES(?,?,?, ?,NULL,NULL,NULL)')
        .run(hash(JSON.stringify([event,state])), event, state, 'pending');
      if (state === 'blocked') this.db.prepare("UPDATE outbox SET state='superseded' WHERE event=? AND outcome='prepared' AND state='pending'").run(event);
    });
  }
  enqueue(event,task) {
    if (!/^[a-zA-Z0-9:._-]{1,160}$/.test(event)) throw Error('Stable event ID required.');
    const sha=taskFingerprint(task);
    return this.transaction(() => {
      const old=this.db.prepare('SELECT * FROM tasks WHERE event=?').get(event);
      if(old) {
        if(old.task_sha !== sha) throw Error('Event already bound to a different immutable task.');
        return {event,reused:true,state:old.state};
      }
      // Missing and held inputs are recorded as blocked tasks, with no worker launch.
      let manifest=[], reason=null;
      try { manifest=sourceManifest(this.config,task).map(({path,sha256})=>({path,sha256})); }
      catch { reason='source_or_eligibility_unavailable'; }
      this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,?,?)').run(event,task.id,JSON.stringify(task),sha,
        policyRevision(this.config),JSON.stringify(manifest),'queued',null,reason);
      this.db.prepare('INSERT INTO timeline(event,state,at) VALUES(?,?,?)').run(event,'queued',new Date().toISOString());
      return {event,reused:false,state:'queued'};
    });
  }
  snapshot() {
    return { paused:!!this.db.prepare('SELECT paused FROM controls').get().paused,
      workflows:this.db.prepare('SELECT event,task_id,state,reason FROM tasks ORDER BY rowid').all(),
      timeline:this.db.prepare('SELECT event,state,at FROM timeline ORDER BY n').all(),
      delivery:this.db.prepare('SELECT event_id,outcome,state,adapter,receipt FROM outbox ORDER BY rowid').all(),
      last_tick:this.db.prepare('SELECT last_tick FROM meta').get()?.last_tick || null };
  }
  verify(row) { return verifyReceipt(this.config,JSON.parse(row.task),row.event,row.receipt_sha,JSON.parse(row.manifest),row.policy_sha); }
  async tick({execute,maxStages=1,afterSave}={}) {
    if (!Number.isInteger(maxStages) || maxStages<1 || maxStages>2) throw Error('Tick bounds are 1–2 stages.');
    this.claim(); let advanced=0;
    try {
      if(this.snapshot().paused) return {advanced,...this.snapshot()};
      // Audit prepared evidence too: a later changed file must revoke preparation.
      for(const row of this.db.prepare("SELECT * FROM tasks WHERE state='prepared'").all()) {
        try {this.verify(row);} catch {this.transition(row.event,'blocked','changed_evidence');}
      }
      for(const row of this.db.prepare("SELECT * FROM tasks WHERE state IN ('queued','running','verifying') ORDER BY rowid LIMIT ?").all(maxStages)) {
        if(this.snapshot().paused) break;
        const task=JSON.parse(row.task);
        try {
          if(row.reason || taskFingerprint(task)!==row.task_sha || policyRevision(this.config)!==row.policy_sha
            || JSON.stringify(sourceManifest(this.config,task).map(({path,sha256})=>({path,sha256})))!==row.manifest) throw Error('Invalid source, task, policy or eligibility.');
          if (!row.receipt_sha) {
            if(row.state!=='queued') throw Error('Interrupted worker without an attested result; no replay.');
            if(typeof execute!=='function') throw Error('Provider unavailable.');
            this.transition(row.event,'running');
            const abort=new AbortController();
            let timer;
            try {
              const receiptSha=await Promise.race([
                runTask(this.config,task,row.event,execute,{},abort.signal),
                new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort(); reject(Error('Worker timeout; no retry.'));},task.timeoutMs);})
              ]);
              this.db.prepare('UPDATE tasks SET receipt_sha=? WHERE event=?').run(receiptSha,row.event);
              row.receipt_sha=receiptSha;
            } finally {clearTimeout(timer);}
            // Crash hook is outside task failure handling: simulates process death after a saved result.
          }
        } catch {
          this.transition(row.event,'blocked',row.state==='running'&&!row.receipt_sha?'interrupted_worker':'required_evidence_unavailable');
          advanced++; continue;
        }
        await afterSave?.(row.event);
        this.transition(row.event,'verifying');
        try {this.verify(row);this.transition(row.event,'prepared');}
        catch {this.transition(row.event,'blocked','result_evidence');}
        advanced++;
      }
      this.db.prepare('INSERT OR REPLACE INTO meta VALUES(1,?)').run(new Date().toISOString());
      return {advanced,...this.snapshot()};
    } finally {this.release();}
  }
}
