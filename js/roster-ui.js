import { CLASSES, CLASS_COLORS, roleFor } from './game-data.js';
import { specIcon } from './icons.js';
import { cut } from './ui.js';

const STATUSES = [
  ['locked', 'In'],
  ['bench',  'Bench'],
  ['out',    'Out'],
];

const SHORT = { 'Death Knight': 'DK', 'Demon Hunter': 'DH' };
const roleName = role => (role || '').replace(' DPS', '');

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
  b.textContent = roleName(role);
  return b;
}

function img(cls, spec, size) {
  const src = specIcon(cls, spec);
  if (!src) return null;
  const i = document.createElement('img');
  i.src = src;
  i.alt = '';
  i.width = size;
  i.height = size;
  i.loading = 'lazy';
  i.decoding = 'async';
  return i;
}

/* ------------------------------------------------ closed: at a glance */

function mini(label, cls, spec, text) {
  const s = document.createElement('span');
  s.className = 'mini';
  const l = document.createElement('span');
  l.className = 'lbl';
  l.textContent = label;
  s.append(l);
  const i = img(cls, spec, 16);
  if (i) s.append(i);
  s.append(document.createTextNode(text));
  return s;
}

function glance(p) {
  const m = p.main, a = p.alt;
  const box = document.createElement('div');
  box.className = 'glance';

  const ico = document.createElement('span');
  ico.className = 'ico';
  const i = img(m.class, m.spec, 40);
  if (i) ico.append(i); else ico.classList.add('blank');

  const bd = document.createElement('div');
  bd.className = 'bd';

  const l1 = document.createElement('div');
  l1.className = 'l1';
  const nm = document.createElement('span');
  nm.className = 'nm';
  nm.textContent = p.name?.trim() || 'Unnamed';
  l1.append(nm);
  if (p.status !== 'locked') {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = p.status === 'bench' ? 'Bench' : 'Out';
    l1.append(tag);
  }

  const l2 = document.createElement('div');
  l2.className = 'l2';
  if (m.class && m.spec) {
    const sp = document.createElement('span');
    sp.className = 'sp';
    sp.textContent = `${m.spec} ${m.class}`;
    const rl = document.createElement('span');
    rl.className = 'rl';
    rl.textContent = roleName(roleFor(m.class, m.spec));
    l2.append(sp, rl);
  } else {
    const none = document.createElement('span');
    none.className = 'none';
    none.textContent = m.class ? `${m.class} — no spec chosen` : 'No class chosen';
    l2.append(none);
  }
  bd.append(l1, l2);

  const bits = [];
  if (m.class && m.offSpec) bits.push(mini('Off-spec', m.class, m.offSpec, m.offSpec));
  if (a?.class) {
    bits.push(mini('Alt', a.class, a.spec, a.spec ? `${a.spec} ${SHORT[a.class] || a.class}` : a.class));
  }
  if (bits.length) {
    const l3 = document.createElement('div');
    l3.className = 'l3';
    l3.append(...bits);
    bd.append(l3);
  }
  if (p.note?.trim()) {
    const note = document.createElement('p');
    note.className = 'note-line';
    note.textContent = p.note.trim();
    bd.append(note);
  }

  box.append(ico, bd);
  return box;
}

/* ---------------------------------------------------- open: the editor */

/** One half of a plate: main or alt. */
function loadout(p, side, commit) {
  const box = document.createElement('div');
  box.className = `loadout ${side}`;
  const colour = CLASS_COLORS[p[side].class] || '';

  const head = document.createElement('div');
  head.className = 'loadout-head';
  const label = document.createElement('span');
  label.className = 'side';
  label.textContent = side === 'main' ? 'Main' : 'Alt';
  head.append(label, roleBadge(p[side].class, p[side].spec));

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

function editor(p, { commitSoft, commit, remove, onClose }) {
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

  // inline removal confirm, in place of a browser dialog
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

  const plateEl = () => head.closest('.plate');
  kill.onclick = () => { plateEl().classList.add('confirming'); yes.focus(); };
  no.onclick = () => { plateEl().classList.remove('confirming'); kill.focus(); };
  yes.onclick = () => remove(p);

  const note = document.createElement('input');
  note.className = 'note';
  note.value = p.note || '';
  note.placeholder = 'Add a note';
  note.setAttribute('aria-label', 'Note');
  note.oninput = () => { p.note = note.value; commitSoft(); };

  const foot = document.createElement('div');
  foot.className = 'plate-foot';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'ghost';
  done.textContent = 'Done';
  done.onclick = onClose;
  foot.append(done);

  return [head, confirmBar, loadout(p, 'main', commit), loadout(p, 'alt', commit), note, foot];
}

/* ------------------------------------------------------------ identity */

/** Shown when a save is waiting on a name. */
function askBar(onName) {
  const bar = document.createElement('div');
  bar.className = 'ask';
  const q = document.createElement('span');
  q.textContent = 'Who’s making this change?';
  const input = document.createElement('input');
  input.placeholder = 'Your character';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Your character');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Save';
  const go = () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    onName(v);
  };
  btn.onclick = go;
  input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  bar.append(q, input, btn);
  return { bar, input };
}

/**
 * Put the ask in front of whoever is editing without rebuilding anything —
 * they may be mid-sentence in a note, and a re-render would steal the caret.
 */
export function showAsk(root, { open, onName }) {
  if (root.querySelector('.ask')) return;
  const { bar, input } = askBar(onName);
  const host = open && root.querySelector(`.plate.open[data-id="${CSS.escape(open)}"] > .skin > .body`);
  if (host) host.prepend(bar);
  else root.querySelector('.toolbar')?.after(bar);
  if (document.activeElement === document.body) input.focus();
}

export function hideAsk(root) {
  for (const a of root.querySelectorAll('.ask')) a.remove();
}

/* --------------------------------------------------------------- plate */

function plate(p, opts) {
  p.main ??= { class: null, spec: null, offSpec: null };
  p.alt ??= { class: null, spec: null, offSpec: null };

  const { el, body } = cut('article', `plate ${p.status}`);
  el.dataset.id = p.id;
  const colour = CLASS_COLORS[p.main.class];
  el.style.setProperty('--klass', colour || 'transparent');
  el.style.setProperty('--rail', colour || 'var(--rule)');
  if (p.status === 'locked' && (!p.main.class || !p.main.spec)) el.classList.add('unfinished');

  if (opts.open === p.id) {
    el.classList.add('open');
    if (opts.needName) body.append(askBar(opts.onName).bar);
    body.append(...editor(p, opts));
    el.onkeydown = e => { if (e.key === 'Escape') opts.onClose(); };
  } else {
    el.classList.add('closed');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Edit ${p.name?.trim() || 'unnamed character'}`);
    body.append(glance(p));
    el.onclick = () => opts.onOpen(p.id);
    el.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onOpen(p.id); }
    };
  }
  return el;
}

export function renderRoster(root, roster, opts) {
  const { filter = '', onFilter, add, open, needName, onName } = opts;

  // The toolbar is built once and kept, so typing in the search box never
  // loses its caret to a re-render. Handlers are rebound every time.
  let bar = root.querySelector('.toolbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'toolbar';
    const search = document.createElement('input');
    search.className = 'field';
    search.type = 'search';
    search.placeholder = 'Find a name…';
    search.value = filter;
    search.setAttribute('aria-label', 'Filter by name');
    const addBtn = document.createElement('button');
    addBtn.className = 'ghost primary add';
    addBtn.type = 'button';
    addBtn.textContent = 'Sign me up';
    const tally = document.createElement('span');
    tally.className = 'tally';
    bar.append(search, addBtn, tally);
    root.replaceChildren(bar);
  }
  bar.querySelector('.field').oninput = e => onFilter(e.target.value);
  bar.querySelector('.add').onclick = add;
  const n = s => roster.players.filter(p => p.status === s).length;
  bar.querySelector('.tally').innerHTML =
    `<b>${n('locked')}</b> in · <b>${n('bench')}</b> bench · <b>${n('out')}</b> out`;

  for (const stale of root.querySelectorAll(':scope > .ask, :scope > .plates, :scope > .empty')) stale.remove();
  if (needName && !open) bar.after(askBar(onName).bar);

  const q = filter.trim().toLowerCase();
  const shown = roster.players.filter(p => !q || (p.name || '').toLowerCase().includes(q));

  if (!shown.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = q ? `Nobody matching “${filter}”.` : 'Nobody signed up yet.';
    root.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'plates';
  for (const p of shown) grid.append(plate(p, opts));
  root.append(grid);
}

/** Brief flare along the rail of the plates that just persisted. */
export function flashSaved(root, ids) {
  for (const id of ids) {
    const el = root.querySelector(`.plate[data-id="${CSS.escape(id)}"]`);
    if (!el) continue;
    el.classList.remove('saved');
    void el.offsetWidth;
    el.classList.add('saved');
  }
}
