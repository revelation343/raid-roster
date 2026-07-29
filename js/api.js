// Roster content is read from the served file (fast, no rate limit, works offline
// and locally). The blob SHA needed for a safe write comes from the GitHub API.
// If the SHA cannot be fetched, viewing still works and saving is disabled.

export const REPO = 'revelation343/raid-roster';
export const WORKER = 'https://raid-roster.genesiswurm.workers.dev';
const PATH = 'data/roster.json';
const API = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

/**
 * Content and SHA MUST come from the same read.
 *
 * GitHub Pages serves a cached build that lags commits by minutes, while the
 * API is instant. Reading content from Pages and the SHA from the API lets a
 * second person load stale content with a fresh SHA, save, and silently revert
 * somebody else's change — passing the very staleness check meant to stop it.
 *
 * One API call returns both, so they can never disagree. Pages is only a
 * fallback for when the API is unreachable, and that path is read-only.
 */
export async function loadRoster() {
  try {
    const res = await fetch(`${API}?ts=${Date.now()}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const body = await res.json();
      const json = decodeURIComponent(escape(atob(body.content.replace(/\s/g, ''))));
      return { roster: JSON.parse(json), sha: body.sha };
    }
  } catch { /* fall through to the read-only path */ }

  const res = await fetch(`data/roster.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load roster (${res.status})`);
  return { roster: await res.json(), sha: null };
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
