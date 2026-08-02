import { CLASS_COLORS } from './game-data.js';

// Which rows are open survives a re-render, so editing the roster does not
// collapse everything the raid leader had expanded.
const open = new Set();

const key = (block, label) => `${block}::${label}`;

/** One contributor, coloured by the class they bring to that tally. */
function chip(c, onPick) {
  const el = document.createElement(onPick ? 'button' : 'span');
  el.className = 'chip';
  if (onPick) {
    el.type = 'button';
    el.title = `Find ${c.name} on the roster`;
    el.onclick = () => onPick(c);
  }
  el.style.setProperty('--klass', CLASS_COLORS[c.cls] || 'var(--muted)');

  const name = document.createElement('span');
  name.className = 'chip-name';
  name.textContent = c.name;
  el.append(name);

  if (c.spec) {
    const spec = document.createElement('em');
    spec.textContent = c.spec;
    el.append(spec);
  }
  if (c.slot && c.slot !== 'main') {
    const slot = document.createElement('i');
    slot.textContent = c.slot;
    el.append(slot);
  }
  return el;
}

function chipGroup(title, list, onPick) {
  const g = document.createElement('div');
  g.className = 'chip-group';
  const h = document.createElement('span');
  h.className = 'chip-head';
  h.textContent = `${title} · ${list.length}`;
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  if (list.length) {
    for (const c of list) wrap.append(chip(c, onPick));
  } else {
    const none = document.createElement('span');
    none.className = 'chip-none';
    none.textContent = 'nobody';
    wrap.append(none);
  }
  g.append(h, wrap);
  return g;
}

function block(blockId, title, rows, opts = {}) {
  const { flagZero = false, colourByClass = false, onPick = null } = opts;

  const wrap = document.createElement('section');
  wrap.className = 'block';

  const h = document.createElement('h2');
  h.textContent = title;

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th></th><th>Main</th><th>Alt</th></tr></thead>';
  const body = document.createElement('tbody');

  for (const r of rows) {
    const total = (r.mainWho?.length || 0) + (r.altWho?.length || 0);
    const expandable = !r.noExpand && total > 0;
    const id = key(blockId, r.label);
    const isOpen = expandable && open.has(id);

    const tr = document.createElement('tr');
    tr.className = 'tally';
    if (r.rule) tr.classList.add('rule-top');
    if (isOpen) tr.classList.add('open');

    // ---- label cell, a button when there is something to reveal
    const labelCell = document.createElement('td');
    labelCell.className = 'label';
    if (colourByClass) {
      labelCell.classList.add('tag');
      labelCell.style.setProperty('--klass', CLASS_COLORS[r.label] || 'transparent');
    }
    if (r.soft) labelCell.classList.add('soft');

    let panel = null;
    if (expandable) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reveal';
      btn.setAttribute('aria-expanded', String(isOpen));
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.setAttribute('aria-hidden', 'true');
      chev.textContent = '❯';
      const txt = document.createElement('span');
      txt.textContent = r.label;
      btn.append(chev, txt);
      labelCell.append(btn);

      btn.onclick = () => {
        const nowOpen = !open.has(id);
        nowOpen ? open.add(id) : open.delete(id);
        btn.setAttribute('aria-expanded', String(nowOpen));
        tr.classList.toggle('open', nowOpen);
        panel.hidden = !nowOpen;
      };
    } else {
      labelCell.textContent = r.label;
    }

    const main = document.createElement('td');
    main.className = 'num';
    main.textContent = r.main;
    if ((flagZero && r.main === 0) || r.flagMain) main.classList.add('zero');

    const alt = document.createElement('td');
    alt.className = 'num alt';
    alt.textContent = r.alt === '' ? '' : r.alt;

    tr.append(labelCell, main, alt);
    body.append(tr);

    if (expandable) {
      panel = document.createElement('tr');
      panel.className = 'who';
      panel.hidden = !isOpen;
      const cell = document.createElement('td');
      cell.colSpan = 3;
      const inner = document.createElement('div');
      inner.className = 'who-inner';
      inner.append(chipGroup('Main', r.mainWho, onPick));
      if (!r.hideAlt) inner.append(chipGroup('Off-spec / alt', r.altWho, onPick));
      cell.append(inner);
      panel.append(cell);
      body.append(panel);
    }
  }

  table.append(body);
  wrap.append(h, table);
  return wrap;
}

function stat(term, value, flag = false) {
  const d = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  if (flag) dd.className = 'flag';
  d.append(dt, dd);
  return d;
}

export function renderCoverage(root, d, onPick) {
  root.replaceChildren();

  const find = label => d.roles.find(r => r.label === label);
  const roleSum = d.roles.reduce((a, r) => a + r.main, 0);

  const summary = document.createElement('dl');
  summary.className = 'summary';
  summary.append(
    stat('Signed up', d.totals.lockedIn),
    stat('Tanks', find('Tank').main),
    stat('Healers', find('Healer').main),
    stat('DPS', find('Melee DPS').main + find('Ranged DPS').main),
  );
  if (d.totals.bench) summary.append(stat('Benched', d.totals.bench));
  if (d.incomplete.length) summary.append(stat('No spec set', d.incomplete.length, true));

  // ---- Raid Roles gains two derived rows
  const roles = d.roles.map(r => ({ ...r }));
  roles.push({
    label: 'Accounted for', main: roleSum, alt: '',
    mainWho: [], altWho: [], rule: true, soft: true, noExpand: true,
  });
  if (d.incomplete.length) {
    roles.push({
      label: 'No spec set',
      main: d.incomplete.length,
      alt: '',
      mainWho: d.incomplete.map(p => ({
        id: p.id, name: p.name || 'unnamed', cls: p.main?.class || null, spec: null, slot: 'main',
      })),
      altWho: [],
      flagMain: true, soft: true, hideAlt: true,
    });
  }

  // ---- Cooldowns keep the Unassigned bucket, expandable so the gap is visible
  const cds = d.cooldowns.map(c => ({ ...c }));
  const un = d.cooldownUnassigned;
  if (un.main || un.alt) cds.push({ ...un, rule: true, soft: true });

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(
    block('roles', 'Raid Roles', roles, { onPick }),
    block('buffs', 'Major Buffs & Debuffs', d.buffs, { flagZero: true, onPick }),
    block('utility', 'Utility', d.utility, { flagZero: true, onPick }),
    block('classes', 'Classes', d.classes, { colourByClass: true, onPick }),
    block('tier', 'Tier Tokens', d.tierTokens, { onPick }),
    block('cds', 'Cooldown Profiles', cds, { onPick }),
  );

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Click any row to see who it counts.';

  root.append(summary, hint, grid);

  if (un.main) {
    const note = document.createElement('p');
    note.className = 'footnote';
    note.textContent =
      'Cooldown profiles come from the old spreadsheet, which only ever classified ' +
      'DPS specs — tanks, healers and a few others fall into Unassigned. Left alone ' +
      'until there is better data to base them on.';
    root.append(note);
  }
}
