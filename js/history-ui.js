import { loadHistory, loadVersion } from './api.js';
import { groupCommits } from './history.js';
import { cut } from './ui.js';

function relative(iso) {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const when = d => d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function restoreButton(g, onRestore) {
  const restore = document.createElement('button');
  restore.className = 'ghost restore';
  restore.textContent = 'Restore';
  restore.title = `Load the roster as it was after "${g.subject}"`;
  restore.onclick = async () => {
    if (!confirm(
      `Restore the roster as it was after "${g.subject}"?\n\n` +
      `It loads into the editor and saves like any other change.`)) return;
    restore.disabled = true;
    restore.textContent = 'Loading…';
    try {
      onRestore(await loadVersion(g.sha));
    } catch (e) {
      alert(e.message);
      restore.disabled = false;
      restore.textContent = 'Restore';
    }
  };
  return restore;
}

/** A roster reset is a line across the log, not another card. */
function turn(g, onRestore) {
  const wrap = document.createElement('div');
  wrap.className = 'turn';
  const h = document.createElement('h3');
  h.textContent = g.subject;
  const p = document.createElement('p');
  p.textContent = `${g.author || 'someone'} · ${when(g.to)}`;
  wrap.append(h, p, restoreButton(g, onRestore));
  return wrap;
}

function entry(g, i, onRestore, colourFor) {
  const { el, body } = cut('article', 'group');
  el.style.animationDelay = `${Math.min(i, 12) * 0.03}s`;

  const hd = document.createElement('div');
  hd.className = 'hd';
  const actor = document.createElement('span');
  actor.className = g.anon ? 'actor anon' : 'actor';
  actor.textContent = g.anon ? 'someone' : g.actor;
  const time = document.createElement('time');
  time.dateTime = g.to.toISOString();
  time.textContent = relative(g.to) + (g.count > 1 ? ` · ${g.count} edits` : '');
  time.title = g.count > 1 ? `${when(g.from)} – ${when(g.to)}` : when(g.to);
  hd.append(actor, time);

  const ul = document.createElement('ul');
  const lines = g.lines.length ? g.lines : [{ name: null, text: g.subject }];
  for (const l of lines.slice(0, 20)) {
    const li = document.createElement('li');
    if (l.name) {
      const b = document.createElement('b');
      b.textContent = l.name;
      const colour = colourFor(l.name);
      if (colour) b.style.setProperty('--nm', colour);
      li.append(b, document.createTextNode(` ${l.text}`));
    } else {
      li.textContent = l.text;
    }
    ul.append(li);
  }

  body.append(hd, restoreButton(g, onRestore), ul);
  return el;
}

export async function renderHistory(root, onRestore, colourFor = () => null) {
  root.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'empty';
  loading.textContent = 'Reading the change log…';
  root.append(loading);

  let commits;
  try {
    commits = await loadHistory();
  } catch (e) {
    loading.textContent = e.message;
    return;
  }

  root.replaceChildren();
  if (!commits.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No changes recorded yet.';
    root.append(p);
    return;
  }

  groupCommits(commits).forEach((g, i) => {
    root.append(g.reset ? turn(g, onRestore) : entry(g, i, onRestore, colourFor));
  });
}
