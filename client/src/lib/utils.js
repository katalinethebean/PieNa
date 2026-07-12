export function formatChineseDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}年${m}月${day}日`;
}

export function getInitials(name) {
  if (!name) return '?';
  return name.slice(0, 2);
}

export function scoreColor(score) {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#7C3AED';
  if (score >= 4) return '#F59E0B';
  return '#EF4444';
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Parses "@username  name (team)" debater slots, looks up matching registered
// users, and creates match_invites so mentioned friends can add this match too.
export async function sendMatchInvites(supabase, sessionId, debaters, selfId, selfUsername) {
  const usernames = (debaters || [])
    .map(d => (d.match(/^@(\S+)/) || [])[1])
    .filter(Boolean)
    .map(u => u.toLowerCase())
    .filter(u => u !== (selfUsername || '').toLowerCase());

  if (usernames.length === 0) return;

  const { data: mentioned } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', [...new Set(usernames)]);

  if (!mentioned || mentioned.length === 0) return;

  // upsert + ignoreDuplicates: a session may already have invites for some of the
  // mentioned users (unique(session_id, receiver_id)); a plain insert would fail wholesale.
  await supabase.from('match_invites').upsert(
    mentioned.map(p => ({ session_id: sessionId, sender_id: selfId, receiver_id: p.id })),
    { onConflict: 'session_id,receiver_id', ignoreDuplicates: true }
  );
}
