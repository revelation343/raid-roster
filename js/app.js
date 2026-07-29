import { loadRoster, currentSha, saveRoster, WORKER } from './api.js';
import { computeAll } from './compute.js';
import { renderRoster } from './roster-ui.js';
import { renderCoverage } from './coverage-ui.js';
import { renderHistory } from './history-ui.js';

const el = id => document.getElementById(id);

const state = { roster: null, sha: null, dirty: false, filter: '' };
let pristine = null;

/* ------------------------------------------------------------ diffing */

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

function describeChanges(before, after) {
  const was = new Map(before.players.map(p => [p.id, p]));
  const out = [];

  for (const p of after.players) {
    const old = was.get(p.id);
    if (!old) { out.push(`added ${p.name || 'a new player'}`); continue; }
    if (old.name !== p.name) out.push(`renamed ${old.name || 'unnamed'} to ${p.name || 'unnamed'}`);
    for (const [label, get] of FIELDS) {
      const a = get(old) ?? '', b = get(p) ?? '';
      if (a !== b) out.push(`${p.name || 'unnamed'} ${label}: ${a || '—'} → ${b || '—'}`);
    }
  }
  for (const p of before.players) {
    if (!after.players.some(q => q.id === p.id)) out.push(`removed ${p.name || 'unnamed'}`);
  }
  return out;
}

/* ------------------------------------------------------------ identity */

function actorName() {
  let a = localStorage.getItem('actor');
  if (!a) {
    a = (prompt('Your name — shown against every change you make:') || '').trim();
    if (!a) return null;
    localStorage.setItem('actor', a);
    paintWhoami();
  }
  return a;
}

function passphrase() {
  let p = localStorage.getItem('passphrase');
  if (!p) {
    p = (prompt('Guild passphrase:') || '').trim();
    if (!p) return null;
    localStorage.setItem('passphrase', p);
  }
  return p;
}

function paintWhoami() {
  const who = localStorage.getItem('actor');
  el('whoami').replaceChildren();
  if (who) {
    el('whoami').append(document.createTextNode(`signed as ${who} · `));
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = 'not you?';
    a.onclick = e => { e.preventDefault(); localStorage.removeItem('actor'); paintWhoami(); };
    el('whoami').append(a);
  } else {
    el('whoami').textContent = 'not signed — you will be asked for a name when you save';
  }
}

/* ------------------------------------------------------------- render */

function setStatus(text, kind = '') {
  el('status').textContent = text;
  el('status').className = `status ${kind}`;
}

function render() {
  const d = computeAll(state.roster);

  el('title').textContent = state.roster.title || 'Raid Roster';
  const bits = [`<b>${d.totals.lockedIn}</b> locked in`];
  if (d.totals.bench) bits.push(`<b>${d.totals.bench}</b> benched`);
  if (d.incomplete.length) bits.push(`<span class="flag">${d.incomplete.length} without a spec</span>`);
  el('subtitle').innerHTML = bits.join(' &middot; ');

  renderRoster(el('tab-roster'), state.roster, {
    filter: state.filter,
    onChange: () => { state.dirty = true; render(); },
    onFilter: v => { state.filter = v; render(); },
  });
  renderCoverage(el('tab-coverage'), d);

  const canSave = Boolean(state.sha) && !WORKER.includes('PLACEHOLDER');
  el('save').disabled = !state.dirty || !canSave;
  el('save').title = canSave ? '' : 'Saving is not wired up yet — the save endpoint has not been deployed.';
  if (state.dirty && WORKER.includes('PLACEHOLDER')) setStatus('read-only — save endpoint not deployed', 'err');
  else if (state.dirty && !state.sha) setStatus('offline — cannot save', 'err');
  else if (state.dirty) setStatus('unsaved changes');
}

/* --------------------------------------------------------------- save */

el('save').onclick = async () => {
  const changes = describeChanges(pristine, state.roster);
  if (!changes.length) { setStatus('nothing changed'); state.dirty = false; render(); return; }

  const who = actorName();
  if (!who) { setStatus('a name is required to save', 'err'); return; }
  const pass = passphrase();
  if (!pass) { setStatus('passphrase required', 'err'); return; }

  el('save').disabled = true;
  setStatus('saving…');

  try {
    const { sha } = await saveRoster({
      roster: state.roster,
      sha: state.sha,
      actor: who,
      summary: changes[0] + (changes.length > 1 ? ` (+${changes.length - 1} more)` : ''),
      details: changes,
      passphrase: pass,
    });
    state.sha = sha;
    pristine = structuredClone(state.roster);
    state.dirty = false;
    render();
    setStatus('saved', 'ok');
  } catch (e) {
    if (e.message === 'STALE') {
      setStatus('someone else saved first — reloading', 'err');
      setTimeout(() => location.reload(), 1800);
    } else if (e.message === 'BAD_PASSPHRASE') {
      localStorage.removeItem('passphrase');
      setStatus('wrong passphrase', 'err');
      el('save').disabled = false;
    } else {
      setStatus(e.message, 'err');
      el('save').disabled = false;
    }
  }
};

window.addEventListener('beforeunload', e => {
  if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});

/* --------------------------------------------------------------- tabs */

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
        state.dirty = true;
        document.querySelector('.tabs button[data-tab="roster"]').click();
        setStatus('version loaded — press Save to apply it');
      });
    }
  };
}

/* --------------------------------------------------------------- boot */

(async () => {
  paintWhoami();
  try {
    state.roster = await loadRoster();
    pristine = structuredClone(state.roster);
    state.sha = await currentSha();
    render();
    if (!state.sha) setStatus('read-only — could not reach GitHub');
  } catch (e) {
    el('tab-roster').innerHTML = `<p class="empty">${e.message}</p>`;
    setStatus('failed to load', 'err');
  }
})();
