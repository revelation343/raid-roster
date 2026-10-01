// Pure. No DOM. Turns the commit list for data/roster.json into readable entries.
//
// People save in bursts — one signup was five commits in sixty seconds (add,
// rename, rename, class, spec). Here a burst reads as one entry: consecutive
// commits by the same person within WINDOW_MS fold together and only the net
// change survives, so a field changed twice shows where it ended up and a
// field changed back disappears. The commits themselves are untouched; this
// is display only, and Restore still lands on a real commit.

export const WINDOW_MS = 15 * 60 * 1000;

const FIELDS = ['main class', 'main spec', 'off-spec', 'alt class', 'alt spec', 'alt off-spec', 'status', 'note'];
const CHANGE = new RegExp(`^(.+?) (${FIELDS.join('|')}): (.*?) → (.*)$`);
const EMPTY = '—';
const STATUS = { locked: 'in', bench: 'bench', out: 'out' };

export const subjectOf = c => c.commit.message.split('\n')[0].trim();

/** The self-reported name the Worker put before the colon, or null. */
export function actorOf(c) {
  const s = subjectOf(c);
  const i = s.indexOf(':');
  return i > 0 ? s.slice(0, i).trim() : null;
}

export const isReset = c => /roster reset/i.test(subjectOf(c));
export const isAnon = actor => !actor || actor === 'someone';

function detailsOf(c) {
  const [, ...rest] = c.commit.message.split('\n');
  return rest.join('\n').trim().split('\n').map(s => s.trim()).filter(Boolean);
}

/** One line of a commit body, as written by describeChanges in app.js. */
export function parseLine(line) {
  let m;
  if ((m = line.match(/^added (.+)$/)))            return { op: 'add', name: m[1] };
  if ((m = line.match(/^removed (.+)$/)))          return { op: 'remove', name: m[1] };
  if ((m = line.match(/^renamed (.+?) to (.+)$/))) return { op: 'rename', from: m[1], to: m[2] };
  if ((m = line.match(CHANGE))) {
    return { op: 'change', name: m[1], field: m[2], from: m[3] === EMPTY ? '' : m[3], to: m[4] === EMPTY ? '' : m[4] };
  }
  return { op: 'text', text: line };
}

/**
 * Net effect of a run of commits, oldest applied first. Players are tracked
 * by name, following renames, since names are all the commit lines carry.
 */
export function netLines(commits) {
  const players = new Map();   // key → record
  const alias = new Map();     // every name a player has had → key
  const order = [];
  const extra = [];

  const rec = (name, fuzzy = true) => {
    let k = alias.get(name);
    if (k === undefined && fuzzy) {
      // A name nobody has had yet. If somebody in this burst was mid-signup —
      // added or renamed — and their name is a prefix of this one (or this of
      // theirs), it is the same person caught between keystrokes: edits made
      // while a save was in flight used to get no commit line of their own.
      let best = null, bestLen = 0;
      for (const key of order) {
        const p = players.get(key);
        if (!(p.added || p.renamed)) continue;
        const [shorter, longer] = p.name.length <= name.length ? [p.name, name] : [name, p.name];
        if (shorter.length > bestLen && longer.startsWith(shorter)) { best = key; bestLen = shorter.length; }
      }
      if (best !== null) {
        k = best;
        alias.set(name, k);
        players.get(k).name = name;
      }
    }
    if (k === undefined) {
      k = order.length;
      alias.set(name, k);
      order.push(k);
      players.set(k, { name, added: false, removed: false, cancelled: false, renamed: false, was: null, fields: new Map() });
    }
    return players.get(k);
  };

  for (const c of [...commits].reverse()) {
    const lines = detailsOf(c);
    if (!lines.length) { extra.push({ name: null, text: subjectOf(c) }); continue; }
    for (const line of lines) {
      const op = parseLine(line);
      if (op.op === 'add') {
        const p = rec(op.name, false);
        p.added = true; p.removed = false; p.cancelled = false;
      } else if (op.op === 'remove') {
        const p = rec(op.name);
        if (p.added) p.cancelled = true; else p.removed = true;
      } else if (op.op === 'rename') {
        const p = rec(op.from);
        if (!p.added && p.was === null) p.was = op.from;
        p.name = op.to;
        p.renamed = true;
        alias.set(op.to, alias.get(op.from));
        if (p.was === p.name) p.was = null;
      } else if (op.op === 'change') {
        const p = rec(op.name);
        const f = p.fields.get(op.field);
        if (!f) p.fields.set(op.field, { from: op.from, to: op.to });
        else { f.to = op.to; if (f.from === f.to) p.fields.delete(op.field); }
      } else {
        extra.push({ name: null, text: op.text });
      }
    }
  }

  const val = (spec, cls) => [spec, cls].filter(Boolean).join(' ') || EMPTY;
  const out = [];
  for (const k of order) {
    const p = players.get(k);
    if (p.cancelled) continue;
    const f = p.fields;
    if (p.removed) { out.push({ name: p.name, text: 'left the roster' }); continue; }
    if (p.added) {
      const spec = f.get('main spec')?.to, cls = f.get('main class')?.to;
      out.push({ name: p.name, text: spec || cls ? `joined as ${val(spec, cls)}` : 'joined' });
      f.delete('main spec'); f.delete('main class');
    } else if (p.was) {
      out.push({ name: p.was, text: `renamed to ${p.name}` });
    }
    for (const side of ['main', 'alt']) {
      const c = f.get(`${side} class`), s = f.get(`${side} spec`);
      if (c && s) {
        out.push({ name: p.name, text: `${side}: ${val(s.from, c.from)} → ${val(s.to, c.to)}` });
        f.delete(`${side} class`); f.delete(`${side} spec`);
      }
    }
    for (const [field, { from, to }] of f) {
      if (field === 'status')    out.push({ name: p.name, text: `status: ${STATUS[from] || from || EMPTY} → ${STATUS[to] || to || EMPTY}` });
      else if (field === 'note') out.push({ name: p.name, text: to ? `note: ${to}` : 'note cleared' });
      else                       out.push({ name: p.name, text: `${field}: ${from || EMPTY} → ${to || EMPTY}` });
    }
  }
  return [...out, ...extra];
}

/**
 * Commits newest-first (as the GitHub API returns them) → entries newest-first.
 * A reset is always its own entry; everything else folds by actor and gap.
 */
export function groupCommits(commits, { windowMs = WINDOW_MS } = {}) {
  const groups = [];
  for (const c of commits) {
    const actor = actorOf(c);
    const date = new Date(c.commit.author.date);
    const reset = isReset(c);
    const last = groups[groups.length - 1];
    if (last && !reset && !last.reset && last.actor === actor && last.from - date <= windowMs) {
      last.commits.push(c);
      last.from = date;
      continue;
    }
    groups.push({ actor, anon: isAnon(actor), reset, commits: [c], from: date, to: date });
  }
  return groups.map(g => ({
    ...g,
    sha: g.commits[0].sha,
    subject: subjectOf(g.commits[0]),
    author: g.commits[0].commit.author?.name || null,
    count: g.commits.length,
    lines: g.reset ? [] : netLines(g.commits),
  }));
}
