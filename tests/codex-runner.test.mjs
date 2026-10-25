import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT,contained,loadConfig,resolveProject } from '../scripts/project-paths.mjs';
import { createDemo } from '../scripts/demo.mjs';
import { validateResult,sourceManifest,verifyReport,taskFingerprint,policyRevision } from '../scripts/codex-runner.mjs';
import { execute } from '../scripts/providers/fixture.mjs';
import { childEnvironment,checkAuth,buildArgs,invokeCli,codexProvider } from '../scripts/providers/codex.mjs';

const setup=t=>{const e=createDemo({base:path.join(ROOT,'.verification'),disposableFixture:true});t.after(e.cleanup);return e;};
test('scripted worker computes from changed source rather than returning expected report',async t=>{
  const {config,task}=setup(t),manifest=sourceManifest(config,task);
  const rows=JSON.parse(manifest[0].content);rows[0].asset='Press Z';manifest[0].content=JSON.stringify(rows);
  const response=await execute(task,manifest,{});
  assert.equal(response.report.requests[0].asset,'Press Z');
  assert.throws(()=>verifyReport(config,task,response.report,manifest),/expected/);
});
for(const mutation of ['missing','duplicate','false','string','empty-details','unknown-criterion','unresolved','edits','extra-key'])test(`reject ${mutation} worker evidence`,async t=>{
  const {config,task}=setup(t),r=(await execute(task,sourceManifest(config,task),{})).worker;
  if(mutation==='missing')r.verification.pop();
  if(mutation==='duplicate')r.verification.push(r.verification[0]);
  if(mutation==='false')r.verification[0].passed=false;
  if(mutation==='string')r.verification[0].passed='true';
  if(mutation==='empty-details')r.verification[0].details=' ';
  if(mutation==='unknown-criterion')r.verification[0].criterion='invented';
  if(mutation==='unresolved')r.unresolved.push('missing source');
  if(mutation==='edits')r.changed_files.push('source/requests.json');
  if(mutation==='extra-key')r.approved=true;
  assert.throws(()=>validateResult(r,task.acceptance));
});
for(const source of ['../outside','/absolute','.env.local','auth.json','credentials.json','x.pem'])test(`refuse out of scope or sensitive source ${source}`,t=>{
  const {config}=setup(t);assert.throws(()=>contained(config.workspaceRoot,source));
});
test('reject source and artifact symlinks',t=>{
  const {config}=setup(t);fs.symlinkSync(config.policyFile,path.join(config.workspaceRoot,'linked'));
  assert.throws(()=>contained(config.workspaceRoot,'linked'),/Symlink/);
});
test('configuration paths are relative to config file, independent of working directory',t=>{
  const {config,directory}=setup(t);const file=path.join(directory,'runtime.json');
  fs.writeFileSync(file,JSON.stringify({...config,workspaceRoot:'workspace',stateDir:'state',reportDir:'output',projectsFile:'registry.json',policyFile:'policy.md'}));
  const loaded=loadConfig({file,env:{},disposableFixture:true});assert.equal(loaded.workspaceRoot,config.workspaceRoot);
  assert.equal(loadConfig({file,env:{AI_OS_CONFIG:'unused'},disposableFixture:true}).stateDir,config.stateDir);
  assert.equal(loadConfig({env:{AI_OS_CONFIG:file},disposableFixture:true}).policyFile,config.policyFile);
});
test('normal runtime rejects synced SQLite and missing state settings',t=>{
  const {config,directory}=setup(t),file=path.join(directory,'runtime.json');fs.writeFileSync(file,JSON.stringify(config));
  assert.throws(()=>loadConfig({file,env:{}}),/SQLite state/);
  assert.throws(()=>loadConfig({env:{}}),/Missing setting: stateDir/);
});
test('disposable configuration refuses live providers and OS notification adapters',t=>{
  setup(t);
  for(const overrides of [{provider:{name:'codex',model:'explicit-model',effort:'low'}},{notifications:{adapter:'reminders',quietStart:22,quietEnd:7,dailyCap:6,list:'Test'}}])
    assert.throws(()=>loadConfig({env:{},disposableFixture:true,overrides:{workspaceRoot:ROOT,stateDir:path.join(ROOT,'.verification/s'),reportDir:path.join(ROOT,'.verification/o'),...overrides}}));
});
test('held, retired and unknown statuses fail closed',t=>{
  const {config}=setup(t);
  for(const status of ['held','paused','frozen','retired','dead','archived','unknown']){
    fs.writeFileSync(config.projectsFile,JSON.stringify({harbor:{path:'.',status}}));
    assert.throws(()=>resolveProject(config,'harbor'));
  }
});
test('policy and task changes have distinct fingerprints',t=>{
  const {config,task}=setup(t);assert.notEqual(taskFingerprint(task),taskFingerprint({...task,goal:'different'}));
  const before=policyRevision(config);fs.appendFileSync(config.policyFile,'\nChanged policy');assert.notEqual(before,policyRevision(config));
});
for(const text of ['Logged in using an API key','Logged in','quota exceeded','unknown',''])test(`subscription check fails closed for ${text||'empty status'}`,()=>assert.throws(()=>checkAuth(text)));
test('subscription auth check accepts only explicit ChatGPT status',()=>assert.equal(checkAuth('Logged in using ChatGPT\n'),'chatgpt'));
test('child environment is an allowlist and excludes billing/auth overrides',()=>{
  assert.deepEqual(childEnvironment({PATH:'/tools',HOME:'home',OPENAI_API_KEY:'fake',ACCESS_TOKEN:'fake',CODEX_HOME:'untrusted',NODE_OPTIONS:'--inspect',BASH_ENV:'evil'}),{PATH:'/tools',HOME:'home'});
});
test('optional CLI arguments enforce read-only mode, explicit model and disabled extensions',t=>{
  const {config}=setup(t);config.provider={name:'codex',model:'explicit-model',effort:'low'};
  const args=buildArgs(config,'snapshot','out','schema');
  assert.equal(args[args.indexOf('-s')+1],'read-only');assert.equal(args[args.indexOf('-m')+1],'explicit-model');
  for(const setting of ['forced_login_method="chatgpt"','features.apps=false','features.multi_agent=false','web_search="disabled"','approval_policy="never"'])assert.ok(args.includes(setting));
});
test('API/unknown auth refusal happens before any provider execution',async t=>{
  const {config,task}=setup(t);let invocations=0;config.disposableFixture=false;config.provider={name:'codex',model:'explicit',effort:'low'};
  const adapter=codexProvider(config,{authStatus:()=> 'Logged in using an API key',invoke:()=>{invocations++;}});
  await assert.rejects(adapter(task,[],{},{}));assert.equal(invocations,0);
});
test('POSIX timeout terminates owned parent and stubborn descendant', {skip:process.platform==='win32'},async t=>{
  const {directory}=setup(t),pidFile=path.join(directory,'pid.txt');
  const program=`const {spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},100)"],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid));process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},100);`;
  const response=await invokeCli(process.execPath,['-e',program],'',childEnvironment(),500,{graceMs:100});
  assert.equal(response.stopped,true);const pid=+fs.readFileSync(pidFile,'utf8');
  await new Promise(resolve=>setTimeout(resolve,100));
  let alive=true;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
  assert.equal(alive,false,'Owned descendant must terminate');
});
