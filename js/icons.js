// Spec and class icons, stored in the repo under img/icons so the page does
// not depend on another site being up. Names are the game's own texture
// names. Devourer's is classicon_demonhunter_void, added in Midnight.

export const SPEC_ICON = {
  'Death Knight': { Blood: 'spell_deathknight_bloodpresence', Frost: 'spell_deathknight_frostpresence', Unholy: 'spell_deathknight_unholypresence' },
  'Demon Hunter': { Havoc: 'ability_demonhunter_specdps', Vengeance: 'ability_demonhunter_spectank', Devourer: 'classicon_demonhunter_void' },
  'Druid':        { Balance: 'spell_nature_starfall', Feral: 'ability_druid_catform', Guardian: 'ability_racial_bearform', Restoration: 'spell_nature_healingtouch' },
  'Evoker':       { Devastation: 'classicon_evoker_devastation', Preservation: 'classicon_evoker_preservation', Augmentation: 'classicon_evoker_augmentation' },
  'Hunter':       { 'Beast Mastery': 'ability_hunter_bestialdiscipline', Marksmanship: 'ability_hunter_focusedaim', Survival: 'ability_hunter_camouflage' },
  'Mage':         { Arcane: 'spell_holy_magicalsentry', Fire: 'spell_fire_firebolt02', Frost: 'spell_frost_frostbolt02' },
  'Monk':         { Brewmaster: 'spell_monk_brewmaster_spec', Mistweaver: 'spell_monk_mistweaver_spec', Windwalker: 'spell_monk_windwalker_spec' },
  'Paladin':      { Holy: 'spell_holy_holybolt', Protection: 'ability_paladin_shieldofthetemplar', Retribution: 'spell_holy_auraoflight' },
  'Priest':       { Discipline: 'spell_holy_powerwordshield', Holy: 'spell_holy_guardianspirit', Shadow: 'spell_shadow_shadowwordpain' },
  'Rogue':        { Assassination: 'ability_rogue_deadlybrew', Outlaw: 'ability_rogue_waylay', Subtlety: 'ability_stealth' },
  'Shaman':       { Elemental: 'spell_nature_lightning', Enhancement: 'spell_shaman_improvedstormstrike', Restoration: 'spell_nature_magicimmunity' },
  'Warlock':      { Affliction: 'spell_shadow_deathcoil', Demonology: 'spell_shadow_metamorphosis', Destruction: 'spell_shadow_rainoffire' },
  'Warrior':      { Arms: 'ability_warrior_savageblow', Fury: 'ability_warrior_innerrage', Protection: 'ability_warrior_defensivestance' },
};

export const CLASS_ICON = {
  'Death Knight': 'classicon_deathknight',
  'Demon Hunter': 'classicon_demonhunter',
  'Druid':        'classicon_druid',
  'Evoker':       'classicon_evoker',
  'Hunter':       'classicon_hunter',
  'Mage':         'classicon_mage',
  'Monk':         'classicon_monk',
  'Paladin':      'classicon_paladin',
  'Priest':       'classicon_priest',
  'Rogue':        'classicon_rogue',
  'Shaman':       'classicon_shaman',
  'Warlock':      'classicon_warlock',
  'Warrior':      'classicon_warrior',
};

/** Path to the best icon for a (class, spec): the spec's, else the class's, else null. */
export function specIcon(cls, spec) {
  const name = (cls && spec && SPEC_ICON[cls]?.[spec]) || (cls && CLASS_ICON[cls]) || null;
  return name ? `img/icons/${name}.jpg` : null;
}
