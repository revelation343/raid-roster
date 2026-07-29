import { CLASSES, CLASS_COLORS, roleFor } from './game-data.js';

const STATUSES = [
  ['locked', 'In'],
  ['bench',  'Bench'],
  ['out',    'Out'],
];

const ROLE_GLYPH = {
  'Tank':       '⛊',
  'Healer':     '✚',
  'Melee DPS':  '⚔',
  'Ranged DPS': '➸',
  'Augvoker':   '✦',
};

function opt(value, selected, blank) {
  const o = document.createElement('option');
  o.value = value ?? '';
  o.textContent = value ?? blank;
  o.selected = (value ?? '') === (selected ?? '');
  return o;
}

function classPicker(value, blank, onPick) {
  const s = document.createElement('select');
  s.className = 'pick klass';
  s.append(opt(null, value, blank), ...Object.keys(CLASSES).map(c => opt(c, value)));
  s.style.setProperty('--klass', CLASS_COLORS[value] || '');
  if (!value) s.classList.add('unset');
  s.onchange = () => onPick(s.value || null);
  return s;
}

function specPicker(cls, value, blank, onPick) {
  const s = document.createElement('select');
  s.className = 'pick';
  s.append(opt(null, value, blank), ...(CLASSES[cls] || []).map(sp => opt(sp, value)));
  s.disabled = !cls;
  if (!value) s.classList.add('unset');
  s.onchange = () => onPick(s.value || null);
  return s;
}

function roleBadge(cls, spec) {
  const role = roleFor(cls, spec);
  const b = document.createElement('span');
  b.className = 'role';
  if (!role) {
    b.classList.add('none');
    b.textContent = cls ? 'no spec' : 'not signed up';
    return b;
  }
  b.dataset.role = role;
  b.textContent = `${ROLE_GLYPH[role]} ${role.replace(' DPS', '')}`;
  return b;
}

/** Main / Alt half of a card. */
function loadout(p, side, onChange) {
  const box = document.createElement('div');
  box.className = `loadout ${side}`;

  const head = document.createElement('div');
  head.className = 'loadout-head';
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = side === 'main' ? 'Main' : 'Alt';
  head.append(tag, roleBadge(p[side].class, p[side].spec));

  const rows = document.createElement('div');
  rows.className = 'picks';

  rows.append(
    classPicker(p[side].class, side === 'main' ? 'Pick a class' : 'No alt', v => {
      p[side].class = v; p[side].spec = null; p[side].offSpec = null; onChange();
    }),
    specPicker(p[side].class, p[side].spec, 'Pick a spec', v => {
      p[side].spec = v; onChange();
    }),
    specPicker(p[side].class, p[side].offSpec, 'Off-spec (optional)', v => {
      p[side].offSpec = v; onChange();
    }),
  );

  box.append(head, rows);
  return box;
}

function card(p, roster, { onChange, onStructural }) {
  p.main ??= { class: null, spec: null, offSpec: null };
  p.alt ??= { class: null, spec: null, offSpec: null };

  const el = document.createElement('article');
  el.className = `card ${p.status}`;
  el.style.setProperty('--klass', CLASS_COLORS[p.main.class] || 'var(--rule)');
  if (p.status === 'locked' && (!p.main.class || !p.main.spec)) el.classList.add('unfinished');

  // -- header: name + status + remove
  const head = document.createElement('header');

  const name = document.createElement('input');
  name.className = 'who';
  name.value = p.name || '';
  name.placeholder = 'Character name';
  name.spellcheck = false;
  name.oninput = () => { p.name = name.value; onChange(); };

  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'group');
  for (const [value, label] of STATUSES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = p.status === value ? 'on' : '';
    b.dataset.value = value;
    b.onclick = () => { p.status = value; onStructural(); };
    seg.append(b);
  }

  const kill = document.createElement('button');
  kill.className = 'kill';
  kill.type = 'button';
  kill.textContent = '×';
  kill.title = 'Remove from roster';
  kill.onclick = () => {
    if (!confirm(`Remove ${p.name || 'this player'} from the roster?`)) return;
    roster.players.splice(roster.players.indexOf(p), 1);
    onStructural();
  };

  head.append(name, seg, kill);

  const note = document.createElement('input');
  note.className = 'note';
  note.value = p.note || '';
  note.placeholder = 'Note (optional)';
  note.oninput = () => { p.note = note.value; onChange(); };

  el.append(
    head,
    loadout(p, 'main', onStructural),
    loadout(p, 'alt', onStructural),
    note,
  );
  return el;
}

export function renderRoster(root, roster, opts) {
  const { filter = '', onFilter, onChange, onStructural } = opts;
  root.replaceChildren();

  // ---------------------------------------------------------- toolbar
  const bar = document.createElement('div');
  bar.className = 'toolbar';

  const search = document.createElement('input');
  search.className = 'field';
  search.type = 'search';
  search.placeholder = 'Find your name…';
  search.value = filter;
  search.oninput = () => onFilter(search.value);

  const add = document.createElement('button');
  add.className = 'ghost primary';
  add.type = 'button';
  add.textContent = '+ Sign me up';
  add.onclick = () => {
    roster.players.push({
      id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
      name: '',
      main: { class: null, spec: null, offSpec: null },
      alt: { class: null, spec: null, offSpec: null },
      note: '',
      status: 'locked',
    });
    onFilter('');
    queueMicrotask(() => {
      const inputs = root.querySelectorAll('.card .who');
      inputs[inputs.length - 1]?.focus();
    });
  };

  const wipe = document.createElement('button');
  wipe.className = 'ghost danger';
  wipe.type = 'button';
  wipe.textContent = 'Clear roster';
  wipe.title = 'Remove everyone — for starting a new tier';
  wipe.onclick = () => {
    if (!roster.players.length) return;
    if (!confirm(
      `Remove all ${roster.players.length} players?\n\n` +
      `Nothing is lost — every previous version stays in the History tab.`)) return;
    roster.players.length = 0;
    onStructural();
  };

  const tally = document.createElement('span');
  tally.className = 'tally';
  const n = s => roster.players.filter(p => p.status === s).length;
  tally.textContent = `${n('locked')} in · ${n('bench')} benched · ${n('out')} out`;

  bar.append(search, add, wipe, tally);
  root.append(bar);

  // ------------------------------------------------------------ cards
  const q = filter.trim().toLowerCase();
  const shown = roster.players.filter(p => !q || (p.name || '').toLowerCase().includes(q));

  if (!shown.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = q
      ? `Nobody matching “${filter}”.`
      : 'Roster is empty — press “Sign me up” to add the first player.';
    root.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'cards';
  for (const p of shown) grid.append(card(p, roster, { onChange, onStructural }));
  root.append(grid);
}
