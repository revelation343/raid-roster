import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CLASSES } from '../js/game-data.js';
import { SPEC_ICON, CLASS_ICON, specIcon } from '../js/icons.js';

const onDisk = rel => existsSync(new URL(`../${rel}`, import.meta.url));

test('every class and every spec has an icon, and the file is in the repo', () => {
  for (const [cls, specs] of Object.entries(CLASSES)) {
    assert.ok(CLASS_ICON[cls], `${cls} has no class icon`);
    assert.ok(onDisk(specIcon(cls, null)), `${cls} class icon file missing`);
    for (const spec of specs) {
      assert.ok(SPEC_ICON[cls]?.[spec], `${cls} ${spec} has no icon`);
      assert.ok(onDisk(specIcon(cls, spec)), `${cls} ${spec} icon file missing`);
    }
  }
});

test('no icon is named for a spec that does not exist', () => {
  for (const [cls, specs] of Object.entries(SPEC_ICON)) {
    assert.ok(CLASSES[cls], `${cls} is not a class`);
    for (const spec of Object.keys(specs)) {
      assert.ok(CLASSES[cls].includes(spec), `${spec} is not a ${cls} spec`);
    }
  }
});

test('a class with no spec falls back to the class icon; nothing at all gives null', () => {
  assert.equal(specIcon('Warrior', null), 'img/icons/classicon_warrior.jpg');
  assert.equal(specIcon('Warrior', 'Arms'), 'img/icons/ability_warrior_savageblow.jpg');
  assert.equal(specIcon(null, null), null);
});
