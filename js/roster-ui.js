import { CLASSES, CLASS_COLORS, roleFor } from './game-data.js';

const STATUSES = [
  ['locked', 'In'],
  ['bench',  'Bench'],
  ['out',    'Out'],
];

const ROLE_GLYPH = {
  'Tank':       '⛨',
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

function slot(label, node, railColour) {
  const wrap = document.createElement('label');
  wrap.className = 'slot';
  if (railColour) wrap.style.setProperty('--rail', railColour);
  const cap = document.createElement('span');
  cap.className = 'slot-cap';
  cap.textContent = label;
  wrap.append(cap, node);
  return wrap;
}

function classPicker(value, blank, onPick) {
  const s = document.createElement('select');
  s.className = 'pick klass';
  s.append(opt(null, value, blank), ...Object.keys(CLASSES).map(c => opt(c, value)));
  s.style.setProperty('--klass', CLASS_COLORS[value] || 'var(--faint)');
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
    b.textContent = cls ? 'spec not chosen' : 'empty';
    return b;
  }
  b.dataset.role = role;
  b.textContent = `${ROLE_GLYPH[role]} ${role.replace(' DPS', '')}`;
  return b;
}

/** One half of a plate: main or alt. */
function loadout(p, side, commit) {
  const box = document.createElement('div');
  box.className = `loadout ${side}`;
  const colour = CLASS_COLORS[p[side].class] || '';

  const head = document.createElement('div');
  head.className = 'loadout-head';
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = side === 'main' ? 'Main' : 'Alt';
  head.append(tag, roleBadge(p[side].class, p[side].spec));

  const picks = document.createElement('div');
  picks.className = 'picks';
  picks.append(
    slot('Class', classPicker(p[side].class, side === 'main' ? 'choose' : 'none', v => {
      p[side].class = v; p[side].spec = null; p[side].offSpec = null; commit();
    }), colour),
    slot('Spec', specPicker(p[side].class, p[side].spec, 'choose', v => {
      p[side].spec = v; commit();
    }), colour),
    slot('Off-spec', specPicker(p[side].class, p[side].offSpec, 'none', v => {
      p[side].offSpec = v; commit();
    }), colour),
  );

  box.append(head, picks);
  return box;
}

function plate(p, roster, { commitSoft, commit, remove }) {
  p.main ??= { class: null, spec: null, offSpec: null };
  p.alt ??= { class: null, spec: null, offSpec: null };

  const el = document.createElement('article');
  el.className = `plate ${p.status}`;
  el.dataset.id = p.id;
  const colour = CLASS_COLORS[p.main.class];
  el.style.setProperty('--klass', colour || 'transparent');
  el.style.setProperty('--rail', colour || 'var(--rule)');
  if (p.status === 'locked' && (!p.main.class || !p.main.spec)) el.classList.add('unfinished');

  // ---- header
  const head = document.createElement('header');

  const name = document.createElement('input');
  name.className = 'who';
  name.value = p.name || '';
  name.placeholder = 'Character name';
  name.spellcheck = false;
  name.autocomplete = 'off';
  name.setAttribute('aria-label', 'Character name');
  name.oninput = () => { p.name = name.value; commitSoft(); };

  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.setAttribute('role', 'group');
  seg.setAttribute('aria-label', 'Attendance');
  for (const [value, label] of STATUSES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.className = p.status === value ? 'on' : '';
    b.onclick = () => { p.status = value; commit(); };
    seg.append(b);
  }

  const kill = document.createElement('button');
  kill.className = 'kill';
  kill.type = 'button';
  kill.textContent = '×';
  kill.title = 'Remove from roster';
  kill.setAttribute('aria-label', 'Remove from roster');

  head.append(name, seg, kill);

  // ---- inline removal confirm, in place of a browser dialog
  const confirmBar = document.createElement('div');
  confirmBar.className = 'confirm';
  const question = document.createElement('span');
  question.textContent = 'Remove from the roster?';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'yes';
  yes.textContent = 'Remove';
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'no';
  no.textContent = 'Keep';
  confirmBar.append(question, no, yes);

  kill.onclick = () => {
    el.classList.add('confirming');
    yes.focus();
  };
  no.onclick = () => { el.classList.remove('confirming'); kill.focus(); };
  yes.onclick = () => remove(p);

  const note = document.createElement('input');
  note.className = 'note';
  note.value = p.note || '';
  note.placeholder = 'Add a note';
  note.setAttribute('aria-label', 'Note');
  note.oninput = () => { p.note = note.value; commitSoft(); };

  el.append(
    head,
    confirmBar,
    loadout(p, 'main', commit),
    loadout(p, 'alt', commit),
    note,
  );
  return el;
}

export function renderRoster(root, roster, opts) {
  const { filter = '', onFilter, commit, commitSoft, remove, add } = opts;
  root.replaceChildren();

  const bar = document.createElement('div');
  bar.className = 'toolbar';

  const search = document.createElement('input');
  search.className = 'field';
  search.type = 'search';
  search.placeholder = 'Find a name…';
  search.value = filter;
  search.setAttribute('aria-label', 'Filter by name');
  search.oninput = () => onFilter(search.value);

  const addBtn = document.createElement('button');
  addBtn.className = 'ghost primary';
  addBtn.type = 'button';
  addBtn.textContent = '+ Sign me up';
  addBtn.onclick = add;

  const tally = document.createElement('span');
  tally.className = 'tally';
  const n = s => roster.players.filter(p => p.status === s).length;
  tally.textContent = `${n('locked')} in · ${n('bench')} benched · ${n('out')} out`;

  bar.append(search, addBtn, tally);
  root.append(bar);

  const q = filter.trim().toLowerCase();
  const shown = roster.players.filter(p => !q || (p.name || '').toLowerCase().includes(q));

  if (!shown.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = q
      ? `Nobody matching “${filter}”.`
      : 'Nobody signed up yet.';
    root.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'plates';
  for (const p of shown) grid.append(plate(p, roster, { commitSoft, commit, remove }));
  root.append(grid);
}

/** Brief gold sweep on the plates that just persisted. */
export function flashSaved(root, ids) {
  for (const id of ids) {
    const el = root.querySelector(`.plate[data-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    el.classList.remove('saved');
    void el.offsetWidth;
    el.classList.add('saved');
  }
}
