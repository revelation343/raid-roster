import { loadRoster, saveRoster, Stale } from './api.js';
import { computeAll } from './compute.js';
import { renderRoster, flashSaved } from './roster-ui.js';
import { renderCoverage } from './coverage-ui.js';
import { renderHistory } from './history-ui.js';

const el = id => document.getElementById(id);

const state = { roster: null, sha: null, filter: '' };
let base = null;              // last persisted snapshot, for diffing
let touched = new Set();      // player ids this browser has edited
let removed = new Set();      // player ids this browser has removed
let timer = null;
let inFlight = false;
let queued = false;

const SETTLE_MS = 1100;

/* ------------------------------------------------------------- diffing */

const FIELDS = [
  ['main class',   p => p.main?.class],
  ['main spec',    p => p.main?.spec],
  ['off-spec',     p => p.main?.offSpec],
  ['alt class',    p => p.alt?.class],
  ['alt spec',     p => p.alt?.spec],
  ['alt off-spec', p => p.alt?.offSpec],
  ['status',       p => p.status],
  ['note',         p => p.note],
];

const who = p => p.name?.trim() || 'an unnamed character';

function describeChanges(before, after) {
  const was = new Map(before.players.map(p => [p.id, p]));
  const out = [];
  for (const p of after.players) {
    const old = was.get(p.id);
    if (!old) { out.push(`added ${who(p)}`); continue; }
    if ((old.name || '') !== (p.name || '')) {
      out.push(`renamed ${who(old)} to ${who(p)}`);
    }
    for (const [label, get] of FIELDS) {
      const a = get(old) ?? '', b = get(p) ?? '';
      if (a !== b) out.push(`${who(p)} ${label}: ${a || '—'} → ${b || '—'}`);
    }
  }
  for (const p of before.players) {
    if (!after.players.some(q => q.id === p.id)) out.push(`removed ${who(p)}`);
  }
  return out;
}

/* ------------------------------------------------------------ identity */

function actor() {
  const v = el('actor').value.trim();
  return v || 'someone';
}

el('actor').value = localStorage.getItem('actor') || '';
el('actor').oninput = () => localStorage.setItem('actor', el('actor').value.trim());

/* -------------------------------------------------------------- status */

let statusTimer = null;
function setStatus(text, kind = '', clearAfter = 0) {
  clearTimeout(statusTimer);
  el('status').textContent = text;
  el('status').className = `status ${kind}`;
  if (clearAfter) statusTimer = setTimeout(() => setStatus(''), clearAfter);
}

/* -------------------------------------------------------------- saving */

/**
 * Re-apply this browser's edits on top of a freshly fetched roster.
 *
 * Because every edit is scoped to one player, a conflict is resolvable rather
 * than fatal: take whatever is on the server now, drop in the players this
 * browser touched, drop out the ones it removed, and retry. Nobody loses work
 * and nobody silently clobbers anybody.
 */
function reapply(fresh) {
  for (const id of removed) {
    const i = fresh.players.findIndex(p => p.id === id);
    if (i >= 0) fresh.players.splice(i, 1);
  }
  for (const id of touched) {
    const mine = state.roster.players.find(p => p.id === id);
    if (!mine) continue;
    const i = fresh.players.findIndex(p => p.id === id);
    if (i >= 0) fresh.players[i] = structuredClone(mine);
    else fresh.players.push(structuredClone(mine));
  }
  return fresh;
}

async function push() {
  const changes = describeChanges(base, state.roster);
  if (!changes.length) return null;
  return saveRoster({
    roster: state.roster,
    sha: state.sha,
    actor: actor(),
    summary: changes[0] + (changes.length > 1 ? ` (+${changes.length - 1} more)` : ''),
    details: changes,
  });
}

async function flush() {
  if (inFlight) { queued = true; return; }
  if (!state.sha) { setStatus('offline — changes are not being saved', 'err'); return; }

  const changes = describeChanges(base, state.roster);
  if (!changes.length) { setStatus(''); return; }   // edits cancelled each other out

  inFlight = true;
  const saving = new Set(touched);
  setStatus('saving…');

  try {
    let result;
    try {
      result = await push();
    } catch (e) {
      if (!(e instanceof Stale)) throw e;
      // Somebody else committed between our read and our write. Merge and retry.
      setStatus('merging someone else’s change…');
      const fresh = await loadRoster();
      state.roster = reapply(fresh.roster);
      state.sha = fresh.sha;
      render();
      result = await push();
    }

    if (result) {
      state.sha = result.sha;
      base = structuredClone(state.roster);
      touched.clear();
      removed.clear();
      setStatus('saved', 'ok', 2600);
      flashSaved(el('tab-roster'), saving);
    }
  } catch (e) {
    setStatus(e.message, 'err');
  } finally {
    inFlight = false;
    if (queued) { queued = false; schedule(); }
  }
}

function schedule() {
  clearTimeout(timer);
  setStatus('unsaved…');
  timer = setTimeout(flush, SETTLE_MS);
}

/* -------------------------------------------------------------- render */

function repaintChrome() {
  const d = computeAll(state.roster);
  el('title').textContent = state.roster.title || 'Raid Roster';
  const bits = [`<b>${d.totals.lockedIn}</b> signed up`];
  if (d.totals.bench) bits.push(`<b>${d.totals.bench}</b> benched`);
  if (d.incomplete.length) {
    bits.push(`<span class="flag">${d.incomplete.length} without a spec</span>`);
  }
  el('subtitle').innerHTML = bits.join(' &middot; ');
  renderCoverage(el('tab-coverage'), d);
}

function render() {
  repaintChrome();
  renderRoster(el('tab-roster'), state.roster, {
    filter: state.filter,
    onFilter: v => { state.filter = v; render(); },

    // Typing: never rebuild the cards, that would steal the caret.
    commitSoft: () => { markAll(); repaintChrome(); schedule(); },

    // Class/spec/status: the card itself has to change.
    commit: () => { markAll(); render(); schedule(); },

    remove: p => {
      touched.delete(p.id);
      removed.add(p.id);
      const i = state.roster.players.indexOf(p);
      if (i >= 0) state.roster.players.splice(i, 1);
      render();
      schedule();
    },

    add: () => {
      const p = {
        id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
        name: '',
        main: { class: null, spec: null, offSpec: null },
        alt: { class: null, spec: null, offSpec: null },
        note: '',
        status: 'locked',
      };
      state.roster.players.push(p);
      touched.add(p.id);
      state.filter = '';
      render();
      const input = el('tab-roster')
        .querySelector(`.plate[data-id="${CSS.escape(p.id)}"] .who`);
      input?.focus();
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  });
}

/** Anything differing from the last persisted snapshot is ours to re-apply. */
function markAll() {
  const was = new Map(base.players.map(p => [p.id, JSON.stringify(p)]));
  for (const p of state.roster.players) {
    if (was.get(p.id) !== JSON.stringify(p)) touched.add(p.id);
  }
}

/* ---------------------------------------------------------------- tabs */

for (const btn of document.querySelectorAll('.tabs button')) {
  btn.onclick = () => {
    for (const b of document.querySelectorAll('.tabs button')) {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    for (const name of ['roster', 'coverage', 'history']) {
      el(`tab-${name}`).hidden = name !== btn.dataset.tab;
    }
    if (btn.dataset.tab === 'history') {
      renderHistory(el('tab-history'), restored => {
        state.roster = restored;
        for (const p of state.roster.players) touched.add(p.id);
        for (const p of base.players) {
          if (!state.roster.players.some(q => q.id === p.id)) removed.add(p.id);
        }
        document.querySelector('.tabs button[data-tab="roster"]').click();
        render();
        schedule();
      });
    }
  };
}

window.addEventListener('beforeunload', e => {
  if (describeChanges(base, state.roster).length) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------------------------------------------------------------- boot */

(async () => {
  try {
    const { roster, sha } = await loadRoster();
    state.roster = roster;
    state.sha = sha;
    base = structuredClone(roster);
    render();
    if (!sha) setStatus('read-only — could not reach GitHub', 'err');
  } catch (e) {
    el('tab-roster').innerHTML = `<p class="empty">${e.message}</p>`;
    setStatus('failed to load', 'err');
  }
})();
