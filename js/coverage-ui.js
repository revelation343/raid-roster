import { CLASS_COLORS } from './game-data.js';

function block(title, rows, opts = {}) {
  const wrap = document.createElement('section');
  wrap.className = 'block';

  const h = document.createElement('h2');
  h.textContent = title;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th></th><th>Main</th><th>Alt</th></tr>';

  const body = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.rule) tr.className = 'rule-top';

    const label = document.createElement('td');
    label.textContent = r.label;
    if (opts.colourByClass) {
      label.className = 'tag';
      label.style.setProperty('--klass', CLASS_COLORS[r.label] || 'transparent');
    }
    if (r.soft) label.classList.add('soft');

    const main = document.createElement('td');
    main.className = 'num';
    main.textContent = r.main;
    if (opts.flagZero && r.main === 0) main.classList.add('zero');
    if (r.flagMain) main.classList.add('zero');

    const alt = document.createElement('td');
    alt.className = 'num alt';
    alt.textContent = r.alt;

    tr.append(label, main, alt);
    body.append(tr);
  }

  table.append(thead, body);
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

export function renderCoverage(root, d) {
  root.replaceChildren();

  const roleSum = d.roles.reduce((a, r) => a + r.main, 0);

  const summary = document.createElement('dl');
  summary.className = 'summary';
  summary.append(
    stat('Locked in', d.totals.lockedIn),
    stat('Benched', d.totals.bench),
    stat('Tanks', d.roles.find(r => r.label === 'Tank').main),
    stat('Healers', d.roles.find(r => r.label === 'Healer').main),
    stat('DPS', d.roles.find(r => r.label === 'Melee DPS').main
              + d.roles.find(r => r.label === 'Ranged DPS').main),
    stat('No spec set', d.incomplete.length, d.incomplete.length > 0),
  );

  const roles = d.roles.map(r => ({ ...r }));
  roles.push({
    label: 'Accounted for', main: roleSum, alt: '', rule: true, soft: true,
  });
  if (d.incomplete.length) {
    roles.push({
      label: 'No spec set', main: d.incomplete.length, alt: '', flagMain: true, soft: true,
    });
  }

  const cds = d.cooldowns.map(c => ({ ...c }));
  if (d.cooldownUnassigned.main || d.cooldownUnassigned.alt) {
    cds.push({
      label: 'Unassigned',
      main: d.cooldownUnassigned.main,
      alt: d.cooldownUnassigned.alt,
      rule: true, soft: true,
    });
  }

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(
    block('Raid Roles', roles),
    block('Major Buffs & Debuffs', d.buffs, { flagZero: true }),
    block('Utility', d.utility, { flagZero: true }),
    block('Classes', d.classes, { colourByClass: true }),
    block('Tier Tokens', d.tierTokens),
    block('Cooldown Profiles', cds),
  );

  root.append(summary, grid);

  if (d.incomplete.length) {
    const note = document.createElement('p');
    note.className = 'empty';
    note.style.textAlign = 'left';
    note.style.padding = '1rem 0 0';
    note.textContent =
      `${d.incomplete.map(p => p.name || 'unnamed').join(', ')} ` +
      `${d.incomplete.length === 1 ? 'has' : 'have'} no main spec set, so ` +
      `${d.incomplete.length === 1 ? 'they are' : 'they are'} not counted in any role.`;
    root.append(note);
  }
}
