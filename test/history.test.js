import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCommits, parseLine } from '../js/history.js';

// A commit as the GitHub commits API returns it, with the message the Worker
// writes: "<actor>: <subject>\n\n<one line per change>".
const mk = (sha, iso, actor, subject, details = []) => ({
  sha,
  commit: {
    message: `${actor ? `${actor}: ` : ''}${subject}\n\n${details.join('\n')}`.trim(),
    author: { name: actor || 'Silence', date: iso },
  },
});

const at = (min, sec = 0) =>
  new Date(Date.UTC(2026, 8, 3, 22, min, sec)).toISOString();

test('a signup burst folds into one entry with the net change', () => {
  const commits = [
    mk('e', at(12, 19), 'Bama', 'Bàmaman main spec: — → Outlaw', ['Bàmaman main spec: — → Outlaw']),
    mk('d', at(12, 16), 'Bama', 'Bàmaman main class: — → Rogue', ['Bàmaman main class: — → Rogue']),
    mk('c', at(12, 10), 'Bama', 'renamed Bà to Bàmaman', ['renamed Bà to Bàmaman']),
    mk('b', at(12, 8), 'Bama', 'renamed B to Bà', ['renamed B to Bà']),
    mk('a', at(11, 58), 'Bama', 'added B', ['added B']),
    mk('z', at(10, 35), 'someone', 'removed Everas', ['removed Everas']),
  ];
  const g = groupCommits(commits);
  assert.equal(g.length, 2);
  assert.equal(g[0].actor, 'Bama');
  assert.equal(g[0].count, 5);
  assert.equal(g[0].sha, 'e', 'restore lands on the newest commit of the burst');
  assert.deepEqual(g[0].lines, [{ name: 'Bàmaman', text: 'joined as Outlaw Rogue' }]);
  assert.equal(g[1].anon, true);
  assert.deepEqual(g[1].lines, [{ name: 'Everas', text: 'left the roster' }]);
});

test('a burst with gaps between keystrokes still reads as one signup', () => {
  // Verbatim from the live log: edits typed while a save was in flight got no
  // line of their own, so "Bà" became "Bàma" and "Bàmama" became "Bàmaman"
  // with nothing in between.
  const commits = [
    mk('e', at(12, 19), 'Bama', 'Bàmaman main spec: — → Outlaw', ['Bàmaman main spec: — → Outlaw']),
    mk('d', at(12, 16), 'Bama', 'Bàmaman main class: — → Rogue', ['Bàmaman main class: — → Rogue']),
    mk('c', at(12, 10), 'Bama', 'renamed Bàma to Bàmama', ['renamed Bàma to Bàmama']),
    mk('b', at(12, 8), 'Bama', 'renamed B to Bà', ['renamed B to Bà']),
    mk('a', at(11, 58), 'Bama', 'added B', ['added B']),
  ];
  assert.deepEqual(groupCommits(commits)[0].lines, [{ name: 'Bàmaman', text: 'joined as Outlaw Rogue' }]);
});

test('the prefix bridge never swallows a player who was not mid-signup', () => {
  const commits = [
    mk('b', at(1), 'Nova', 'Novaa main spec: Fire → Frost', ['Novaa main spec: Fire → Frost']),
    mk('a', at(0), 'Nova', 'Nova note: — → hi', ['Nova note: — → hi']),
  ];
  const lines = groupCommits(commits)[0].lines;
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(l => l.name), ['Nova', 'Novaa']);
});

test('a field changed twice shows where it ended up; changed back disappears', () => {
  const commits = [
    mk('c', at(3), 'Nova', 'Nova status: bench → locked', ['Nova status: bench → locked']),
    mk('b', at(2), 'Nova', 'Nova status: locked → bench', ['Nova status: locked → bench']),
    mk('a', at(1), 'Nova', 'Nova main spec: Fire → Arcane', ['Nova main spec: Fire → Arcane']),
    mk('z', at(0), 'Nova', 'Nova main spec: — → Fire', ['Nova main spec: — → Fire']),
  ];
  const g = groupCommits(commits);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].lines, [{ name: 'Nova', text: 'main spec: — → Arcane' }]);
});

test('class and spec changed together read as one line', () => {
  const commits = [
    mk('a', at(0), 'Dottingway', 'Dottingway main class: Death Knight → Warlock (+1 more)', [
      'Dottingway main class: Death Knight → Warlock',
      'Dottingway main spec: Unholy → Affliction',
    ]),
  ];
  assert.deepEqual(groupCommits(commits)[0].lines, [
    { name: 'Dottingway', text: 'main: Unholy Death Knight → Affliction Warlock' },
  ]);
});

test('an unnamed signup that gets named reads under the final name', () => {
  const commits = [
    mk('d', at(31, 40), 'someone', 'Dixinormous main spec: — → Elemental', ['Dixinormous main spec: — → Elemental']),
    mk('c', at(31, 20), 'someone', 'Dixinormous main class: — → Shaman', ['Dixinormous main class: — → Shaman']),
    mk('b', at(31, 10), 'someone', 'renamed an unnamed character to Dixinormous', ['renamed an unnamed character to Dixinormous']),
    mk('a', at(31, 0), 'someone', 'added an unnamed character', ['added an unnamed character']),
  ];
  assert.deepEqual(groupCommits(commits)[0].lines, [
    { name: 'Dixinormous', text: 'joined as Elemental Shaman' },
  ]);
});

test('added then removed within a burst leaves nothing', () => {
  const commits = [
    mk('b', at(1), 'Zed', 'removed Oops', ['removed Oops']),
    mk('a', at(0), 'Zed', 'added Oops', ['added Oops']),
  ];
  assert.deepEqual(groupCommits(commits)[0].lines, []);
});

test('edits further apart than the window stay separate', () => {
  const commits = [
    mk('b', at(20), 'Nova', 'Nova note: — → hi', ['Nova note: — → hi']),
    mk('a', at(0), 'Nova', 'Nova main spec: — → Fire', ['Nova main spec: — → Fire']),
  ];
  assert.equal(groupCommits(commits).length, 2);
  assert.equal(groupCommits(commits, { windowMs: 30 * 60 * 1000 }).length, 1);
});

test('a different person breaks the group even inside the window', () => {
  const commits = [
    mk('b', at(1), 'Nova', 'Nova note: — → hi', ['Nova note: — → hi']),
    mk('a', at(0), 'Bama', 'Bàmaman note: — → yo', ['Bàmaman note: — → yo']),
  ];
  assert.equal(groupCommits(commits).length, 2);
});

test('a reset is its own entry and never folds into its neighbours', () => {
  const commits = [
    mk('c', at(2), 'Silence', 'Silence status: locked → bench', ['Silence status: locked → bench']),
    mk('b', at(1), null, '12.1.5 Roster Reset'),
    mk('a', at(0), 'Silence', 'Silence note: — → tank', ['Silence note: — → tank']),
  ];
  const g = groupCommits(commits);
  assert.equal(g.length, 3);
  assert.equal(g[1].reset, true);
  assert.equal(g[1].author, 'Silence');
  assert.equal(g[1].subject, '12.1.5 Roster Reset');
});

test('a commit with no change lines keeps its subject as the line', () => {
  const commits = [mk('a', at(0), null, 'restore roster after a bad out-of-band write')];
  assert.deepEqual(groupCommits(commits)[0].lines, [
    { name: null, text: 'restore roster after a bad out-of-band write' },
  ]);
});

test('parseLine reads every shape describeChanges writes', () => {
  assert.deepEqual(parseLine('added Keyi/Zapta'), { op: 'add', name: 'Keyi/Zapta' });
  assert.deepEqual(parseLine('renamed Jarethor to Soulofsinder'), { op: 'rename', from: 'Jarethor', to: 'Soulofsinder' });
  assert.deepEqual(parseLine('Lanstyn alt off-spec: — → Holy'),
    { op: 'change', name: 'Lanstyn', field: 'alt off-spec', from: '', to: 'Holy' });
  assert.deepEqual(parseLine('Hygara note: — → High-Gara, not Hig-uh-ra'),
    { op: 'change', name: 'Hygara', field: 'note', from: '', to: 'High-Gara, not Hig-uh-ra' });
  assert.deepEqual(parseLine('something else entirely'), { op: 'text', text: 'something else entirely' });
});
