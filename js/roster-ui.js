import { CLASSES, CLASS_COLORS } from './game-data.js';

const STATUSES = ['locked', 'bench', 'out'];

function opt(value, selected, blank = '—') {
  const o = document.createElement('option');
  o.value = value ?? '';
  o.textContent = value ?? blank;
  o.selected = (value ?? '') === (selected ?? '');
  return o;
}

function classSelect(value, onPick) {
  const s = document.createElement('select');
  s.className = 'cell klass';
  s.append(opt(null, value), ...Object.keys(CLASSES).map(c => opt(c, value)));
  s.style.setProperty('--klass', CLASS_COLORS[value] || '');
  s.onchange = () => onPick(s.value || null);
  return s;
}

function specSelect(cls, value, onPick) {
  const s = document.createElement('select');
  s.className = 'cell';
  s.append(opt(null, value), ...(CLASSES[cls] || []).map(sp => opt(sp, value)));
  s.disabled = !cls;
  s.onchange = () => onPick(s.value || null);
  return s;
}

function textCell(value, placeholder, onInput) {
  const i = document.createElement('input');
  i.className = 'cell';
  i.value = value || '';
  i.placeholder = placeholder;
  i.oninput = () => onInput(i.value);
  return i;
}

const HEAD = [
  { label: '', span: 1 },
  { label: 'Player' },
  { label: 'Main Class', group: true },
  { label: 'Main Spec' },
  { label: 'Off Spec' },
  { label: 'Alt Class', group: true },
  { label: 'Alt Spec' },
  { label: 'Alt Off Spec' },
  { label: 'Note', group: true },
  { label: 'Status' },
  { label: '' },
];

export function renderRoster(root, roster, { filter = '', onChange, onFilter }) {
  root.replaceChildren();

  // ---- toolbar
  const bar = document.createElement('div');
  bar.className = 'toolbar';

  const search = document.createElement('input');
  search.className = 'field';
  search.type = 'search';
  search.placeholder = 'Find your name…';
  search.value = filter;
  search.oninput = () => onFilter(search.value);

  const add = document.createElement('button');
  add.className = 'ghost';
  add.textContent = '+ Add me';
  add.onclick = () => {
    roster.players.push({
      id: `p${Date.now().toString(36)}`,
      name: '',
      main: { class: null, spec: null, offSpec: null },
      alt: { class: null, spec: null, offSpec: null },
      note: '',
      status: 'locked',
    });
    onFilter('');
  };

  const tally = document.createElement('span');
  tally.className = 'tally';
  const n = s => roster.players.filter(p => p.status === s).length;
  tally.textContent = `${n('locked')} locked · ${n('bench')} benched · ${n('out')} out`;

  bar.append(search, add, tally);

  // ---- table
  const scroller = document.createElement('div');
  scroller.className = 'scroller';
  const table = document.createElement('table');
  table.className = 'roster';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const h of HEAD) {
    const th = document.createElement('th');
    th.textContent = h.label;
    if (h.group) th.className = 'group';
    hr.append(th);
  }
  thead.append(hr);

  const body = document.createElement('tbody');
  const q = filter.trim().toLowerCase();
  const shown = roster.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !q || (p.name || '').toLowerCase().includes(q));

  for (const { p, i } of shown) {
    p.main ??= { class: null, spec: null, offSpec: null };
    p.alt ??= { class: null, spec: null, offSpec: null };

    const tr = document.createElement('tr');
    tr.className = p.status;
    const colour = CLASS_COLORS[p.main.class] || '';
    tr.style.setProperty('--klass', colour);

    const edge = document.createElement('td');
    edge.className = 'edge';

    const nameTd = document.createElement('td');
    const wrap = document.createElement('div');
    wrap.className = 'name-cell';
    wrap.append(textCell(p.name, 'Character name', v => { p.name = v; onChange({ soft: true }); }));
    if (p.status === 'locked' && (!p.main.class || !p.main.spec)) {
      const flag = document.createElement('span');
      flag.className = 'flagged';
      flag.textContent = '▲';
      flag.title = 'No main spec chosen — not counted in any role';
      wrap.append(flag);
    }
    nameTd.append(wrap);

    const cells = [
      classSelect(p.main.class, v => {
        p.main.class = v; p.main.spec = null; p.main.offSpec = null; onChange();
      }),
      specSelect(p.main.class, p.main.spec, v => { p.main.spec = v; onChange(); }),
      specSelect(p.main.class, p.main.offSpec, v => { p.main.offSpec = v; onChange(); }),
      classSelect(p.alt.class, v => {
        p.alt.class = v; p.alt.spec = null; p.alt.offSpec = null; onChange();
      }),
      specSelect(p.alt.class, p.alt.spec, v => { p.alt.spec = v; onChange(); }),
      specSelect(p.alt.class, p.alt.offSpec, v => { p.alt.offSpec = v; onChange(); }),
      textCell(p.note, '', v => { p.note = v; onChange({ soft: true }); }),
    ];

    const status = document.createElement('select');
    status.className = 'cell status-sel';
    status.append(...STATUSES.map(s => opt(s, p.status)));
    status.onchange = () => { p.status = status.value; onChange(); };
    cells.push(status);

    const kill = document.createElement('button');
    kill.className = 'kill';
    kill.textContent = '×';
    kill.title = `Remove ${p.name || 'this player'}`;
    kill.onclick = () => {
      if (!confirm(`Remove ${p.name || 'this player'} from the roster?`)) return;
      roster.players.splice(i, 1);
      onChange();
    };
    cells.push(kill);

    tr.append(edge, nameTd);
    cells.forEach((c, idx) => {
      const td = document.createElement('td');
      if (idx === 0 || idx === 3 || idx === 6) td.className = 'sep';
      td.append(c);
      tr.append(td);
    });
    body.append(tr);
  }

  table.append(thead, body);
  scroller.append(table);
  root.append(bar, scroller);

  if (!shown.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = q ? `Nobody matching “${filter}”.` : 'Nobody on the roster yet.';
    scroller.append(empty);
  }
}
