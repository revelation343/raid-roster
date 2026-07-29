// Roster content is read from the served file (fast, no rate limit, works offline
// and locally). The blob SHA needed for a safe write comes from the GitHub API.
// If the SHA cannot be fetched, viewing still works and saving is disabled.

export const REPO = 'revelation343/raid-roster';
export const WORKER = 'https://raid-roster.PLACEHOLDER.workers.dev';
const PATH = 'data/roster.json';
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

export async function loadRoster() {
  const res = await fetch(`data/roster.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load roster (${res.status})`);
  return res.json();
}

export async function currentSha() {
  try {
    const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    return (await res.json()).sha;
  } catch {
    return null;
  }
}

export async function saveRoster({ roster, sha, actor, summary, details, passphrase }) {
  const res = await fetch(`${WORKER}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roster, sha, actor, summary, details, passphrase }),
  });
  if (res.status === 409) throw new Error('STALE');
  if (res.status === 401) throw new Error('BAD_PASSPHRASE');
  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = (await res.json()).error || detail; } catch { /* keep status */ }
    throw new Error(detail);
  }
  return res.json();
}

export async function loadHistory() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/commits?path=${PATH}&per_page=50`);
  if (!res.ok) throw new Error(`Could not load history (${res.status})`);
  return res.json();
}

export async function loadVersion(sha) {
  const res = await fetch(`${API}?ref=${sha}`,
    { headers: { Accept: 'application/vnd.github.raw+json' } });
  if (!res.ok) throw new Error(`Could not load that version (${res.status})`);
  return res.json();
}
