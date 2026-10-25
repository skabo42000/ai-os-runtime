// One definition for project states that must never become actionable work.
export function isRetiredStatus(status) {
  return /^(?:dead|archived|retired)(?:\b|$)/i.test(String(status || '').trim());
}

export function isHeldStatus(status) {
  return /^(?:paused|frozen|held|hold|on[ -]hold)(?:\b|$)/i.test(String(status || '').trim());
}

export function cardStatus(markdown) {
  return markdown.match(/^status:\s*(.+)$/m)?.[1]?.trim() || 'active';
}
