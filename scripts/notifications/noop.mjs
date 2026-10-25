export async function notify(event) {
  return { state:'disabled',adapter:'noop',event_id:event.event_id };
}
