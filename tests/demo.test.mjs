import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ROOT } from '../scripts/project-paths.mjs';
import { runDemo } from '../scripts/demo.mjs';
test('end-to-end scripted demo verifies real artifact, duplicates, saved-result restart and ten failures',async()=>{
  const lines=[],result=await runDemo({base:path.join(ROOT,'.verification'),disposableFixture:true,failures:true,write:line=>lines.push(line)});
  assert.equal(result.launches,1);assert.equal(result.failuresChecked,10);assert.match(result.artifactHash,/^[a-f0-9]{64}$/);
  assert.ok(lines.some(line=>line.includes('queued -> running -> verifying -> prepared')));
  assert.ok(lines.some(line=>line.includes('fixture worker = scripted')));
  assert.equal(lines.filter(line=>line.startsWith('Controlled failure')).length,10);
  assert.ok(lines.every(line=>!line.includes(ROOT)),'Public demo must not print host paths');
});
