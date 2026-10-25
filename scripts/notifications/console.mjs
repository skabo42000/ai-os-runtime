export async function notify(event, write=console.log) {
  write(`Notification preview: ${event.outcome}; reference=${event.event_id.slice(0,12)}; no external delivery`);
  return {state:'preview',adapter:'console',event_id:event.event_id};
}
