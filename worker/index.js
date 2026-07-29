import { validateRoster } from './validate.js';

const REPO = 'revelation343/raid-roster';
const PATH = 'data/roster.json';

function reply(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// Constant-time-ish comparison so the passphrase can't be probed by timing.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

    let body;
    try { body = await request.json(); }
    catch { return reply({ error: 'malformed JSON' }, 400, origin); }

    const { roster, sha, actor, summary, details, passphrase } = body || {};

    if (!sameSecret(passphrase, env.GUILD_PASSPHRASE)) {
      return reply({ error: 'bad passphrase' }, 401, origin);
    }

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
