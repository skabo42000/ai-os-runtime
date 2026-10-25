// Optional macOS notification port. A local accepted result is not an iPhone receipt.
import { execFile } from 'node:child_process';

export const REMINDERS_SCRIPT=`on run argv
  set listName to item 1 of argv
  set alertTitle to item 2 of argv
  set alertBody to item 3 of argv
  tell application "Reminders"
    if not (exists list listName) then make new list with properties {name:listName}
    set targetList to list listName
    if not (exists (reminders of targetList whose body is alertBody)) then
      make new reminder at end of reminders of targetList with properties {name:alertTitle, body:alertBody, remind me date:(current date)}
    end if
  end tell
end run`;

export function remindersAdapter(config,{platform=process.platform,run=execFile}={}) {
  return event=>new Promise(resolve=>{
    const base={adapter:'reminders',event_id:event.event_id};
    if(platform!=='darwin'){resolve({...base,state:'failed'});return;}
    run('/usr/bin/osascript',['-e',REMINDERS_SCRIPT,'--',config.list,
      `Runtime ${event.outcome}; review local status`, `Reference ${event.event_id}`],
      {timeout:20000,killSignal:'SIGKILL',maxBuffer:4096,encoding:'utf8'},error=>{
        resolve({...base,state:error?(error.killed||error.code==='ETIMEDOUT'?'unknown':'failed'):'accepted'});
      });
  });
}
