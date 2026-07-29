// Reference tables. No logic lives here.
// Transcribed from the 118 COUNTIF formulas in r3con's "Raid Roster Template MN WIP",
// extracted from xl/worksheets/sheet1.xml. See docs/spec.md §6.

export const CLASSES = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Demon Hunter': ['Havoc', 'Vengeance', 'Devourer'],
  'Druid':        ['Balance', 'Feral', 'Guardian', 'Restoration'],
  'Evoker':       ['Devastation', 'Preservation', 'Augmentation'],
  'Hunter':       ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage':         ['Arcane', 'Fire', 'Frost'],
  'Monk':         ['Brewmaster', 'Mistweaver', 'Windwalker'],
  'Paladin':      ['Holy', 'Protection', 'Retribution'],
  'Priest':       ['Discipline', 'Holy', 'Shadow'],
  'Rogue':        ['Assassination', 'Outlaw', 'Subtlety'],
  'Shaman':       ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock':      ['Affliction', 'Demonology', 'Destruction'],
  'Warrior':      ['Arms', 'Fury', 'Protection'],
};

export const CLASS_COLORS = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  'Druid':        '#FF7C0A',
  'Evoker':       '#33937F',
  'Hunter':       '#AAD372',
  'Mage':         '#3FC7EB',
  'Monk':         '#00FF98',
  'Paladin':      '#F48CBA',
  'Priest':       '#FFFFFF',
  'Rogue':        '#FFF468',
  'Shaman':       '#0070DD',
  'Warlock':      '#8788EE',
  'Warrior':      '#C69B6D',
};

export const ROLE_ORDER = ['Tank', 'Melee DPS', 'Ranged DPS', 'Healer', 'Augvoker'];

// Keyed on (class, spec) pairs. The sheet used spec-name lists with class
// disambiguation bolted on where names collide (Frost is Mage and Death Knight;
// Holy is Paladin and Priest; Restoration is Druid and Shaman). Pairs remove
// the special cases entirely.
export const ROLES = {
  'Tank': {
    'Death Knight': ['Blood'],
    'Demon Hunter': ['Vengeance'],
    'Druid':        ['Guardian'],
    'Monk':         ['Brewmaster'],
    'Paladin':      ['Protection'],
    'Warrior':      ['Protection'],
  },
  'Melee DPS': {
    'Death Knight': ['Frost', 'Unholy'],
    'Demon Hunter': ['Havoc'],
    'Druid':        ['Feral'],
    'Hunter':       ['Survival'],
    'Monk':         ['Windwalker'],
    'Paladin':      ['Retribution'],
    'Rogue':        ['Assassination', 'Outlaw', 'Subtlety'],
    'Shaman':       ['Enhancement'],
    'Warrior':      ['Arms', 'Fury'],
  },
  'Ranged DPS': {
    // Devourer is ranged DPS (Int primary), not a tank. Absent from every role
    // bucket in the source template — see docs/spec.md §7.1.
    'Demon Hunter': ['Devourer'],
    'Druid':        ['Balance'],
    'Evoker':       ['Devastation'],
    'Hunter':       ['Beast Mastery', 'Marksmanship'],
    'Mage':         ['Arcane', 'Fire', 'Frost'],
    'Priest':       ['Shadow'],
    'Shaman':       ['Elemental'],
    'Warlock':      ['Affliction', 'Demonology', 'Destruction'],
  },
  'Healer': {
    'Druid':   ['Restoration'],
    'Evoker':  ['Preservation'],
    'Monk':    ['Mistweaver'],
    'Paladin': ['Holy'],
    'Priest':  ['Discipline', 'Holy'],
    'Shaman':  ['Restoration'],
  },
  'Augvoker': {
    'Evoker': ['Augmentation'],
  },
};

export function roleFor(cls, spec) {
  if (!cls || !spec) return null;
  for (const role of ROLE_ORDER) {
    if ((ROLES[role][cls] || []).includes(spec)) return role;
  }
  return null;
}

// `classes` — any spec of that class counts.
// `specs`   — that spec on any class counts.
// `pairs`   — exact class + spec.
export const BUFFS = [
  { label: 'Intellect',                    classes: ['Mage'] },
  { label: 'Attack Power',                 classes: ['Warrior'] },
  { label: 'Stamina',                      classes: ['Priest'] },
  { label: '3% DR (Devo Aura)',            classes: ['Paladin'] },
  { label: '5% Physical',                  classes: ['Monk'] },
  { label: '3% Magic',                     classes: ['Demon Hunter'] },
  { label: '3% Versatility',               classes: ['Druid'] },
  // Source template's Q9 counted Druid alts here. See docs/spec.md §7.2.
  { label: '3% Damage',                    classes: ['Hunter'] },
  { label: 'Bloodlust',                    classes: ['Mage', 'Shaman', 'Evoker'] },
  { label: 'Combat Res',                   classes: ['Druid', 'Warlock', 'Death Knight', 'Paladin'] },
  { label: 'Burst Move Speed',             classes: ['Druid', 'Shaman'] },
  { label: 'Lock Stuff (HS, Gate, Curse)', classes: ['Warlock'] },
  { label: 'Mass Dispel',                  classes: ['Priest'], specs: ['Mistweaver'] },
  { label: 'Innervate',                    classes: ['Druid'] },
  { label: 'Death Grip/AMZ',               classes: ['Death Knight'] },
  { label: 'Blessing of Protection',       classes: ['Paladin'] },
  { label: 'Rallying Cry',                 classes: ['Warrior'] },
  { label: 'Darkness',                     classes: ['Demon Hunter'] },
  { label: 'Immunities',                   classes: ['Paladin', 'Mage', 'Hunter'] },
  { label: 'Skyfury',                      classes: ['Shaman'] },
  { label: 'Boss DR',                      classes: ['Rogue'] },
  { label: 'Dragons',                      classes: ['Evoker'] },
  { label: 'Execute Damage',               classes: ['Warrior', 'Paladin', 'Priest', 'Hunter'], specs: ['Fire', 'Assassination'] },
  { label: 'Attack Speed Reduction',       classes: ['Rogue', 'Death Knight', 'Warlock'] },
  { label: 'Cast Speed Reduction',         classes: ['Rogue', 'Warlock'] },
];

export const UTILITY = [
  { label: 'Knock Up/Back',            classes: ['Evoker', 'Monk', 'Druid', 'Shaman', 'Hunter', 'Mage'] },
  { label: 'Mortal Strike',            classes: ['Rogue'], specs: ['Arms', 'Havoc'] },
  { label: 'Soothe',                   classes: ['Evoker', 'Monk', 'Druid', 'Hunter'] },
  { label: 'Purge',                    classes: ['Priest', 'Mage', 'Shaman', 'Hunter'] },
  { label: 'Power Infusion',           classes: ['Priest'] },
  { label: 'Extra Dam to Shields',     classes: ['Evoker', 'Warrior'] },
  { label: 'Cheat Death',              classes: ['Rogue'], specs: ['Augmentation', 'Fire', 'Vengeance', 'Blood'], pairs: [['Priest', 'Holy']] },
  { label: 'Blessing of Spellwarding', pairs: [['Paladin', 'Protection']] },
];

export const TIER_TOKENS = [
  { label: 'Dreadful (Cloth)', classes: ['Priest', 'Mage', 'Warlock'] },
  { label: 'Mystic (Leather)', classes: ['Druid', 'Monk', 'Rogue', 'Demon Hunter'] },
  { label: 'Venerated (Mail)', classes: ['Evoker', 'Hunter', 'Shaman'] },
  { label: 'Zenith (Plate)',   classes: ['Paladin', 'Warrior', 'Death Knight'] },
];

// Lorrgs.io-derived, DPS specs only. Arcane, Frost, Elemental and Devourer have
// no profile in the source template — surfaced as "Unassigned" rather than invented.
export const COOLDOWNS = [
  { label: '1 and 1.5 min', specs: ['Fury', 'Enhancement', 'Retribution'] },
  { label: '2 min',         specs: ['Survival', 'Assassination', 'Subtlety', 'Devastation',
                                    'Affliction', 'Shadow', 'Fire', 'Marksmanship',
                                    'Augmentation', 'Feral', 'Havoc', 'Windwalker',
                                    'Demonology', 'Destruction', 'Beast Mastery'] },
  { label: '3 min',         specs: ['Balance', 'Unholy'] },
];

export function* allSpecNames() {
  for (const e of [...BUFFS, ...UTILITY, ...TIER_TOKENS, ...COOLDOWNS]) {
    for (const s of e.specs || []) yield s;
    for (const [, s] of e.pairs || []) yield s;
  }
}
