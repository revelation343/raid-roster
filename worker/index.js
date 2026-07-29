import { validateRoster } from './validate.js';

const REPO = 'revelation343/raid-roster';
const PATH = 'data/roster.json';

const CORS = origin => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
});

function reply(obj, status, origin) {
  // 204 must not carry a body — constructing one with content throws.
  if (status === 204) return new Response(null, { status, headers: CORS(origin) });
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS(origin) },
  });
}

/**
 * No passphrase, by design: this is an open signup sheet and a door code is
 * friction for the people it is meant to serve. What protects it instead:
 *
 *   - the payload must be a structurally valid roster (validate.js), so the
 *     endpoint cannot be used to write arbitrary content to the repo;
 *   - the token is scoped to one file in one repo;
 *   - every write is a commit, so anything unwanted is one revert away;
 *   - the burst limit below stops the endpoint being used as a commit firehose.
 */
const RECENT = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function overRate(ip) {
  const now = Date.now();
  for (const [key, times] of RECENT) {
    const live = times.filter(t => now - t < WINDOW_MS);
    if (live.length) RECENT.set(key, live); else RECENT.delete(key);
  }
  const mine = RECENT.get(ip) || [];
  if (mine.length >= MAX_PER_WINDOW) return true;
  mine.push(now);
  RECENT.set(ip, mine);
  return false;
}

const utf8ToBase64 = str => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') return reply({}, 204, origin);
    if (request.method !== 'POST') return reply({ error: 'POST only' }, 405, origin);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (overRate(ip)) return reply({ error: 'too many saves — slow down' }, 429, origin);

    let body;
    try { body = await request.json(); }
    catch { return reply({ error: 'malformed JSON' }, 400, origin); }

    const { roster, sha, actor, summary, details } = body || {};

    const invalid = validateRoster(roster);
    if (invalid) return reply({ error: invalid }, 400, origin);

    if (typeof sha !== 'string' || !sha) return reply({ error: 'missing sha' }, 400, origin);

    const who = (typeof actor === 'string' && actor.trim())
      ? actor.trim().replace(/[\r\n]/g, ' ').slice(0, 64)
      : 'anonymous';
    const subject = (typeof summary === 'string' && summary.trim() ? summary : 'roster update')
      .replace(/[\r\n]/g, ' ').slice(0, 120);
    const lines = Array.isArray(details)
      ? details.slice(0, 100).map(d => String(d).replace(/[\r\n]/g, ' ').slice(0, 200))
      : [];
    const message = `${who}: ${subject}\n\n${lines.join('\n')}`.trim();

    const content = utf8ToBase64(JSON.stringify(roster, null, 2) + '\n');

    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${PATH}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'raid-roster-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content,
        sha,
        committer: { name: who, email: 'raid-roster@users.noreply.github.com' },
      }),
    });

    if (res.status === 409 || res.status === 422) return reply({ error: 'stale' }, 409, origin);
    if (!res.ok) {
      return reply({ error: `github ${res.status}`, detail: await res.text() }, 502, origin);
    }

    const out = await res.json();
    return reply({ sha: out.content.sha }, 200, origin);
  },
};
