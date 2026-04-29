// The Heathbound — a witch-themed reskin of laserllama's Magus.
//
// Mechanically identical to the Magus class but:
// - Spellcasting ability is Wisdom (not Intelligence)
// - Saving throw proficiencies are Constitution and Wisdom
// - The "Order of Dragon Knights" subclass is replaced by "Ward of the Witch"
//   with all draconic features renamed and reflavored toward fey witch-magic
//   (the player is the witch's chosen, accompanied by a familiar she has sent
//    to watch over them; fire is the canonical element)
//
// All other subclasses, base features, level progression, fighting styles, and
// the full spell list are inherited from the Magus.
//
// Source: laserllama (derivative reskin for in-campaign use).

import type { ClassDefinition, FeatureDefinition, SubclassDefinition } from '@/types/homebrew-class';
import { ALL_FIGHTING_STYLE_IDS } from '@/data/fighting-styles';

// ──────────────────────────────────────────────────────────────────────────
// Base class features (all "INT" / "Magus" references swapped for WIS / Heathbound)
// ──────────────────────────────────────────────────────────────────────────

const BASE_FEATURES: Record<string, FeatureDefinition> = {
  arcane_armory: {
    id: 'arcane_armory',
    name: 'Arcane Armory',
    description:
      "An extradimensional space accessible only by you. " +
      "Enchanting Objects: 1-hour ritual on a single weapon, shield, set of armor, or Tiny Object — when complete it disappears into the Armory until summoned. Capacity: 1 + your Heathbound level (one must always be a melee weapon). " +
      "Accessing: as a bonus action, summon any number of objects from the Armory (instantly equipping/donning) and/or shunt any number back into it. " +
      "Benefits: Armory weapons, shields, and armor are magical while inside. When calculating AC in light or medium Armory armor, you may use WIS in place of DEX.",
  },
  fighting_style: {
    id: 'fighting_style',
    name: 'Fighting Style',
    description:
      'You learn one Fighting Style from the Heathbound list (e.g. Archery, Balanced Fighting, Classical Swordplay, Defensive, Dual Wielding, Hurler, Protection, Versatile Fighting; expanded options also available). When you gain a Heathbound level, you may replace your Fighting Style with another for which you meet the prerequisites.',
  },
  spellcasting: {
    id: 'spellcasting',
    name: 'Spellcasting',
    description:
      "At 2nd level, you cast wild arcane spells using WIS. Spell save DC = 8 + your proficiency bonus + your WIS modifier; spell attack modifier = your proficiency bonus + your WIS modifier. " +
      "You can use any weapon, shield, or arcane focus within your Arcane Armory as a Spellcasting Focus. Armory weapons and shields can also perform somatic components. " +
      "Spell slots: half-caster table starting at 2nd level. Cantrips known: 2 at L2, 3 at L4, 4 at L10.",
  },
  spellstrike: {
    id: 'spellstrike',
    name: 'Spellstrike',
    description:
      "Once on your turn when you attack with a melee Arcane Armory weapon, you can simultaneously cast a Heathbound spell, expending a spell slot as normal. The spell must have casting time 1 action and either require one spell attack roll, force at least one save, or affect a number of HP worth of creatures (like sleep). " +
      "The spell channels through your weapon: on a miss, the spell fails and has no effect; on hit, the spell takes effect instantly after your attack. " +
      "Area of Effect: spells targeting an area larger than a 5-foot cube either affect only your target or extend as a 15-foot cone outward. " +
      "Saving Throws: targets make their initial save with disadvantage; on a critical hit, they automatically fail. " +
      "Spell Attacks: your weapon attack roll replaces the spell attack roll. " +
      "Concentration: if the spell requires concentration, you start concentrating after the attack resolves. " +
      "Cantrips: when imbued, your attack does NOT add the cantrip's bonus damage; instead, your weapon damage type changes to the cantrip's, and the cantrip's non-damaging effects apply.",
  },
  arcane_regeneration: {
    id: 'arcane_regeneration',
    name: 'Arcane Regeneration',
    description:
      'Starting at 3rd level, during a short rest you can recover expended spell slots of a combined level equal to your WIS modifier (minimum a single 1st-level spell slot). Once used, you must finish a long rest before using this feature again.',
    is_resource: true,
    resource_uses: '1',
    resource_recovery: 'long',
  },
  esoteric_order: {
    id: 'esoteric_order',
    name: 'Esoteric Order',
    description:
      'At 3rd level, you formally join one of the Esoteric Orders: Arcanists, Arcane Archers, Blades, Ward of the Witch, Spellbreakers, or Warders (plus expanded options: Armorers, Conduits, Hexblades, Shades, Spellswords, Travelers). Your Order grants features at 3rd, 7th, 15th, and 20th level. Order spells use your Heathbound Spell save DC.',
  },
  ability_score_improvement: {
    id: 'ability_score_improvement',
    name: 'Ability Score Improvement',
    description: 'Increase one ability score by 2, or two ability scores by 1. (Cannot exceed 20.)',
    hide_on_sheet: true,
  },
  extra_attack: {
    id: 'extra_attack',
    name: 'Extra Attack',
    description:
      'Beginning at 5th level, you can attack twice instead of once whenever you take the Attack action. Moreover, if you use your action to Cast a Spell, you can make a single weapon attack as a bonus action that same turn.',
  },
  spellsight: {
    id: 'spellsight',
    name: 'Spellsight',
    description:
      "At 5th level, as an action you awaken your senses to magic within 30 feet as if you had cast detect magic. Lasts 10 minutes, requires concentration. " +
      "You can end this sense early to identify a single object you touch as if you had cast identify on it. " +
      "Once per short or long rest at no cost; thereafter, spend a spell slot to use it.",
    is_resource: true,
    resource_uses: '1',
    resource_recovery: 'short',
  },
  ethereal_step: {
    id: 'ethereal_step',
    name: 'Ethereal Step',
    description:
      "Beginning at 6th level, once per turn after you Cast a Spell or use Spellstrike, you can immediately teleport to an unoccupied space you can see in range. " +
      "Range: 10 feet for a Cantrip + 10 feet per level of the spell slot you spent.",
  },
  spellsunder: {
    id: 'spellsunder',
    name: 'Spellsunder',
    description:
      "Starting at 9th level, when you see a spell being cast that will affect you, you can use your reaction to expend one spell slot and attack the spell with an Arcane Armory weapon. " +
      "If the hostile spell was cast at a level equal to your slot or lower, it fails and has no effect. " +
      "If higher, you make an attack roll with your Armory weapon; if your roll exceeds 12 + twice the hostile spell's level, the spell fails.",
  },
  mystical_ward: {
    id: 'mystical_ward',
    name: 'Mystical Ward',
    description:
      'Beginning at 10th level, you are immune to the effects of any Heathbound spell you cast, unless you wish to be affected.',
  },
  arcane_conservation: {
    id: 'arcane_conservation',
    name: 'Arcane Conservation',
    description:
      "Beginning at 11th level, when you miss with a Spellstrike, you can regain a single spell slot at least one level lower than the slot you expended. If you do, you cannot use Ethereal Step after that Spellstrike.",
  },
  prismatic_strikes: {
    id: 'prismatic_strikes',
    name: 'Prismatic Strikes',
    description:
      "Starting at 11th level, you can Spellstrike a Cantrip whenever you make an attack with a melee Arcane Armory weapon. When you do so, your attack deals a bonus 1d8 damage of the Cantrip's type.",
  },
  superior_spellsunder: {
    id: 'superior_spellsunder',
    name: 'Superior Spellsunder',
    description:
      'Beginning at 14th level, if a creature within 30 feet is targeted by a spell you can see being cast, you can use your reaction to teleport to an unoccupied space within 5 feet of that target, then use Spellsunder against the hostile spell.',
  },
  improved_arcane_conservation: {
    id: 'improved_arcane_conservation',
    name: 'Improved Arcane Conservation',
    description: 'At 18th level, when Arcane Conservation triggers, you regain the SAME spell slot you expended (instead of one a level lower).',
  },
};

const ESOTERIC_ORDER_TIER: FeatureDefinition = {
  id: 'esoteric_order_feature',
  name: 'Esoteric Order Feature',
  description: 'Gain features from your chosen Esoteric Order at this level.',
  hide_on_sheet: true,
};

const FEATURES: Record<string, FeatureDefinition> = {
  ...BASE_FEATURES,
  esoteric_order_feature: ESOTERIC_ORDER_TIER,
};

// ──────────────────────────────────────────────────────────────────────────
// Level progression — identical to Magus
// ──────────────────────────────────────────────────────────────────────────

const LEVEL_PROGRESSION = [
  { level: 1,  proficiency_bonus: 2, features: ['arcane_armory', 'fighting_style'] },
  { level: 2,  proficiency_bonus: 2, features: ['spellcasting', 'spellstrike'], cantrips_known: 2, spells_known: 2 },
  { level: 3,  proficiency_bonus: 2, features: ['arcane_regeneration', 'esoteric_order'], cantrips_known: 2, spells_known: 2 },
  { level: 4,  proficiency_bonus: 2, features: ['ability_score_improvement'], cantrips_known: 3, spells_known: 3 },
  { level: 5,  proficiency_bonus: 3, features: ['extra_attack', 'spellsight'], cantrips_known: 3, spells_known: 3 },
  { level: 6,  proficiency_bonus: 3, features: ['ethereal_step'], cantrips_known: 3, spells_known: 4 },
  { level: 7,  proficiency_bonus: 3, features: ['esoteric_order_feature'], cantrips_known: 3, spells_known: 4 },
  { level: 8,  proficiency_bonus: 3, features: ['ability_score_improvement'], cantrips_known: 3, spells_known: 5 },
  { level: 9,  proficiency_bonus: 4, features: ['spellsunder'], cantrips_known: 3, spells_known: 5 },
  { level: 10, proficiency_bonus: 4, features: ['mystical_ward'], cantrips_known: 4, spells_known: 6 },
  { level: 11, proficiency_bonus: 4, features: ['arcane_conservation', 'prismatic_strikes'], cantrips_known: 4, spells_known: 6 },
  { level: 12, proficiency_bonus: 4, features: ['ability_score_improvement'], cantrips_known: 4, spells_known: 7 },
  { level: 13, proficiency_bonus: 5, features: [], cantrips_known: 4, spells_known: 7 },
  { level: 14, proficiency_bonus: 5, features: ['superior_spellsunder'], cantrips_known: 4, spells_known: 8 },
  { level: 15, proficiency_bonus: 5, features: ['esoteric_order_feature'], cantrips_known: 4, spells_known: 8 },
  { level: 16, proficiency_bonus: 5, features: ['ability_score_improvement'], cantrips_known: 4, spells_known: 9 },
  { level: 17, proficiency_bonus: 6, features: [], cantrips_known: 4, spells_known: 9 },
  { level: 18, proficiency_bonus: 6, features: ['improved_arcane_conservation'], cantrips_known: 4, spells_known: 10 },
  { level: 19, proficiency_bonus: 6, features: ['ability_score_improvement'], cantrips_known: 4, spells_known: 10 },
  { level: 20, proficiency_bonus: 6, features: ['esoteric_order_feature'], cantrips_known: 4, spells_known: 11 },
];

// ──────────────────────────────────────────────────────────────────────────
// Subclasses (Esoteric Orders) — same structure as Magus, with one swap
// ──────────────────────────────────────────────────────────────────────────

const ARCANISTS: SubclassDefinition = {
  id: 'arcanists',
  name: 'Order of Arcanists',
  description: 'Heathbound who serve wizards and arcane scholars. Maintain a Spellbook for prepared casting and gather magical knowledge.',
  features_by_level: {
    3: ['arcanists_arcane_spellbook', 'arcanists_arcane_library'],
    7: ['arcanists_esoteric_sight'],
    15: ['arcanists_stored_spells'],
    20: ['arcanists_grand_arcanist'],
  },
  features: {
    arcanists_arcane_spellbook: {
      id: 'arcanists_arcane_spellbook',
      name: 'Arcane Spellbook',
      description:
        "You maintain a Spellbook from which you prepare your Heathbound spells (replacing the Spells Known column). " +
        "It starts with three 1st-level spells from the Heathbound or Wizard spell list. " +
        "Preparing: during a long rest, spend 1 hour studying to prepare a number of spells equal to your WIS mod + half your Heathbound level. " +
        "Ritual Casting: cast the Ritual version of any spell in your Spellbook, even if not prepared. " +
        "Adding spells: each time you gain a Heathbound level, add one Heathbound or Wizard spell of a level for which you have spell slots.",
    },
    arcanists_arcane_library: {
      id: 'arcanists_arcane_library',
      name: 'Arcane Library',
      description:
        "Knowledge stored in your Arcane Armory is at your fingertips. When making a WIS check to recall information from a book, tome, or scroll stored within your Armory, treat any d20 roll lower than your Heathbound level as equal to it. " +
        "Adding a Heathbound or Wizard Spell Scroll of a level you have slots for to your Armory lets you destroy it to add the spell to your Spellbook (or to a Spellbook each Armory ritual).",
    },
    arcanists_esoteric_sight: {
      id: 'arcanists_esoteric_sight',
      name: 'Esoteric Sight',
      description: 'When you use Spellsight, gain ONE benefit within its 30-foot range: Darkvision (and see through magical darkness), read/understand any written language, or see invisible creatures and objects.',
    },
    arcanists_stored_spells: {
      id: 'arcanists_stored_spells',
      name: 'Stored Spells',
      description:
        'During a long rest, perform a 1-hour ritual to fill vacant Armory slots with spells from your Spellbook. Each spell takes Armory slots equal to twice its level; total stored level cannot exceed your WIS modifier (min 1). Cast each stored spell once at its normal casting time without expending a spell slot; once cast, it is lost.',
    },
    arcanists_grand_arcanist: {
      id: 'arcanists_grand_arcanist',
      name: 'Grand Arcanist',
      description: 'Add one 6th-level and one 7th-level Wizard spell of your choice to your Spellbook. You can cast each of them once per long rest without expending a spell slot. They count as Heathbound spells.',
    },
  },
};

const ARCANE_ARCHERS: SubclassDefinition = {
  id: 'arcane_archers',
  name: 'Order of Arcane Archers',
  description: 'Mage hunters and elven-trained skirmishers who strike from afar with magical arrows.',
  features_by_level: {
    3: ['archers_arcane_quiver', 'archers_eagle_eyed'],
    7: ['archers_enchanted_shot'],
    15: ['archers_ranged_transposition'],
    20: ['archers_mystic_marksman'],
  },
  features: {
    archers_arcane_quiver: {
      id: 'archers_arcane_quiver',
      name: 'Arcane Quiver',
      description:
        "Add quivers (with ammunition) to your Armory. Your always-required Armory weapon may be ranged instead of melee. You can use Spellstrike with ranged Arcane Armory weapons; AoE spells are limited to affecting only your target.",
    },
    archers_eagle_eyed: {
      id: 'archers_eagle_eyed',
      name: 'Eagle-Eyed',
      description: 'Gain proficiency in Perception. You may use WIS twice (Perception already uses WIS), so this is purely the proficiency grant.',
    },
    archers_enchanted_shot: {
      id: 'archers_enchanted_shot',
      name: 'Enchanted Shot',
      description: 'When you make a ranged attack roll with an Armory weapon and miss, use a reaction to magically curve the shot and re-roll against a different target within 60 feet of the original.',
    },
    archers_ranged_transposition: {
      id: 'archers_ranged_transposition',
      name: 'Ranged Transposition',
      description:
        "As an action, imbue a ranged Armory weapon with conjuration magic and fire one piece of ammunition at a point or creature in normal range. On hit at a point: instantly teleport to an unoccupied space within 5 feet of the impact. On hit at a creature: target makes a CHA save or instantly switches places with you (no swap = feature fails). " +
        "Once per short or long rest at no cost; thereafter, expend a spell slot.",
      is_resource: true,
      resource_uses: '1',
      resource_recovery: 'short',
    },
    archers_mystic_marksman: {
      id: 'archers_mystic_marksman',
      name: 'Mystic Marksman',
      description:
        "As a bonus action, enter a heightened arcane state for 1 minute. Benefits: " +
        "(a) for each ranged Armory attack, either use Enchanted Shot without a reaction OR Ethereal Step to teleport up to 10 feet; " +
        "(b) on a ranged Armory hit, you may expend a spell slot to deal 2d4 force damage per slot level. " +
        "Once per long rest at no cost; thereafter, expend a 5th-level slot to transform again. Ends early if Incapacitated or you bonus-action it off.",
    },
  },
  bonus_spells: {
    3: ['ensnaring strike', 'hail of thorns'],
    5: ['acid arrow', 'cordon of arrows'],
    9: ['conjure volley', 'lightning arrow'],
    13: ['accursed touch', 'arcane eye'],
    17: ['scrying', 'swift quiver'],
  },
};

const BLADES: SubclassDefinition = {
  id: 'blades',
  name: 'Order of Blades',
  description: 'Lifelong devotees of the Blade Dance — a mystical combat trance that turns the Heathbound into a whirlwind of magic and steel.',
  features_by_level: {
    3: ['blades_art_of_the_dance', 'blades_blade_dance'],
    7: ['blades_fluid_steps'],
    15: ['blades_deadly_dance'],
    20: ['blades_master_of_blades'],
  },
  features: {
    blades_art_of_the_dance: {
      id: 'blades_art_of_the_dance',
      name: 'Art of the Dance',
      description: 'Gain Performance proficiency. On Performance checks, use STR or DEX in place of CHA. While unarmored, your AC = 10 + DEX mod + WIS mod.',
    },
    blades_blade_dance: {
      id: 'blades_blade_dance',
      name: 'Blade Dance',
      description:
        "As a bonus action (no heavy armor / no heavy weapon), enter the Blade Dance for 1 minute: " +
        "+10 ft. walking speed; +1 AC; WIS mod (min +1) added to Acrobatics, Athletics, and Performance checks; once per turn, when dealing damage with an Armory weapon, roll its damage dice twice (incl. Spellstrike dice) and use the higher result. " +
        "Ends early if Incapacitated or bonus-actioned off. Once per short or long rest at no cost; thereafter, expend a spell slot.",
      is_resource: true,
      resource_uses: '1',
      resource_recovery: 'short',
    },
    blades_fluid_steps: {
      id: 'blades_fluid_steps',
      name: 'Fluid Steps',
      description: 'Gain DEX saving throw proficiency. Add your PB to initiative rolls. Your Blade Dance AC bonus increases to +2.',
    },
    blades_deadly_dance: {
      id: 'blades_deadly_dance',
      name: 'Deadly Dance',
      description:
        'While in Blade Dance, gain: Evasion (DEX save for half → take none on success, half on fail); Spellsunder rolls add WIS mod (min +1); Blade Dance AC bonus becomes +3.',
    },
    blades_master_of_blades: {
      id: 'blades_master_of_blades',
      name: 'Master of Blades',
      description: 'Always considered to be under Blade Dance effects (no heavy armor / no heavy weapon). When taking the Attack action while in Blade Dance, make one additional attack as part of that action.',
    },
  },
  bonus_spells: {
    3: ['compelled duel', 'zephyr strike'],
    5: ['blur', 'misty step'],
    9: ['elemental weapon', 'haste'],
    13: ['fire shield', 'freedom of movement'],
    17: ['steel wind strike', 'vorpal blade'],
  },
};

// ── WARD OF THE WITCH ────────────────────────────────────────────────────
// Replaces "Order of Dragon Knights" — flavor reskinned to match the witch
// theme (the Heathbound is the witch's chosen, accompanied by a familiar she
// has sent to walk beside them; fire is canonical, other elements available).

const WARD_OF_THE_WITCH: SubclassDefinition = {
  id: 'ward_of_the_witch',
  name: 'Ward of the Witch',
  description:
    "Heathbound chosen by a witch of the deep forest are bound to her service, marked by her power, and accompanied by a familiar she has sent to walk beside them. Some are her lovers, some her sworn knights, some her wayward children — all carry a fragment of her ancient magic.",
  features_by_level: {
    3: ['witch_touched_spells', 'witchs_familiar', 'witchs_mark'],
    7: ['awakened_familiar'],
    15: ['hexbreath', 'mythic_familiar'],
    20: ['witchs_chosen'],
  },
  features: {
    witch_touched_spells: {
      id: 'witch_touched_spells',
      name: 'Witch-Touched Spells',
      description:
        "You learn certain spells at the Heathbound levels noted below. These spells do not count against your total number of Spells Known and cannot be switched on level up. " +
        "Level 3: absorb elements, command. Level 5: scorching ray, warding bond. Level 9: fireball, fear. Level 13: dominate creature, freedom of movement. Level 17: awaken, fire storm.",
    },
    witchs_familiar: {
      id: 'witchs_familiar',
      name: "Witch's Familiar",
      description:
        "Your soul is bound to a familiar the witch has sent to walk beside you. " +
        "Choose the form your familiar takes — common choices include a fox, raven, black cat, owl, hare, or stoat, but any small natural creature touched by fey magic is appropriate. The familiar's appearance reflects both your bond and your witch's nature: a witch of autumn forests might send a fox with leaves caught in its fur; a witch of midwinter might send a snow-white hare with eyes like coals. " +
        "The Witch's Element. Choose its elemental nature. Fire is the most common — the witch's domain is hearthfire, wildfire, and hexflame — but some witches grant familiars touched by other elements: acid, cold, lightning, or poison. Once chosen, the element cannot be changed except by the witch herself. This element determines the damage type of the familiar's natural attacks and breath. " +
        "Stat block (Small Fey, Neutral): AC 14 + PB; HP = 5 + (5 × Heathbound level); Speed 30 ft., fly 30 ft.; STR 16, DEX 12, CON 15, INT 8, WIS 10, CHA 14; Immunities the chosen element's damage type; Senses Darkvision 60 ft.; Languages Sylvan, understands the languages of the Heathbound bound to it but cannot speak them. Hit Dice: d6 × Heathbound level. Witch-Bound: when the Familiar is forced to make an ability check or saving throw, it adds your PB to its roll — the witch's blessing protects her chosen's companion. " +
        "Action — Claw (or fang/beak/talon, as fits your familiar's form): Melee Weapon Attack +3+PB to hit, reach 5 ft., one target. Hit: 1d4+PB slashing + 1d4 element damage. " +
        "Statistics. The Witch's Familiar is Friendly to you and your allies and fervently loyal to you. " +
        "Combat. In combat, your Familiar shares your initiative; on your bonus action you can order it to take an action from its stat block (or you forgo one Attack action attack to order it to attack). It moves and uses reactions on its own; without an order it Dodges. " +
        "Witch's Hold. Should you choose to, you can hold your Familiar in stasis as you would an object in your Arcane Armory, giving you the ability to summon and shunt it as needed. " +
        "Death. If your Familiar falls to 0 hit points, it makes Death Saves like a player character would. If your Familiar dies, you can perform a 1-hour ritual under the moonlight to call upon the witch's power and restore it to life with 1 hit point — you may spend its Hit Dice as a short rest as part of this.",
    },
    witchs_mark: {
      id: 'witchs_mark',
      name: "Witch's Mark",
      description:
        "The witch's mark is upon you. You learn to speak, read, and write Sylvan, the language of the deep wood. " +
        "When you cast a spell that deals acid, cold, fire, lightning, or poison damage, you can change its damage type to your Familiar's element instead.",
    },
    awakened_familiar: {
      id: 'awakened_familiar',
      name: 'Awakened Familiar',
      description:
        "As the bond deepens, your Familiar takes on a more fearsome aspect — the fox grows wolf-sized with embers smoldering in its eyes; the raven becomes the size of a great eagle with feathers black as deep night. " +
        "Your Familiar becomes Medium and can bear you (or a Medium-or-smaller ally) as a rider; flying speed halves while ridden by anyone other than you. Its Claw attacks become magical and use d6 in place of d4.",
    },
    hexbreath: {
      id: 'hexbreath',
      name: 'Hexbreath',
      description:
        "Your Familiar can channel its element into a breath of pure power. As an action, it exhales a 30-foot cone of its element, forcing all creatures in that area to make a Dexterity saving throw. They take 10d6 damage of the element's type on a failed save, and half as much on a success. If your Familiar's element is fire, this manifests as a roar of hexflame; if cold, a withering frost; if lightning, a crackling storm; and so on. " +
        "Uses = your WIS modifier (min 1), recharging on long rest. With no uses left, expend a 3rd-level or higher spell slot.",
      is_resource: true,
      resource_uses: 'WIS modifier',
      resource_recovery: 'long',
    },
    mythic_familiar: {
      id: 'mythic_familiar',
      name: 'Mythic Familiar',
      description:
        "At the apex of your bond, your Familiar reveals its true form — closer to what it was in the witch's grove before she sent it to you. The fox becomes a great fey hound the size of a horse; the raven, an enormous spirit-bird that can carry you on its back. It is no longer truly an animal — it is a creature of myth, of fey magic, of the deep wood. " +
        "As an action, your Familiar changes size (Small/Medium/Large). At Large, no speed halving with you riding. Once per turn, when you order it to attack, it can make two Claw attacks instead of one.",
    },
    witchs_chosen: {
      id: 'witchs_chosen',
      name: "Witch's Chosen",
      description:
        "Your bond with the witch is complete; her power flows through you, and her chosen Familiar reveals its full might. Your Familiar uses the Greater Witchblood stat block: " +
        "Greater Witchblood (Large Fey, Neutral): AC 20 (natural); HP 125; Speed 40, climb 40, fly 60; STR 20, DEX 12, CON 18, INT 14, WIS 10, CHA 18; Immunities the chosen element's damage type; Senses Blindsight 30, Darkvision 60; Languages Sylvan, understands the languages of the Heathbound bound to it but cannot speak them. " +
        "Multiattack: two Claw attacks. Change Size: Small/Medium/Large until used again. Claw: +11 to hit, reach 5 ft., 2d6+5 slashing + 1d6 element damage. Hexbreath (recharge 5–6): 30-ft. cone DEX save, 12d6 element damage on fail, half on success. Witch-Bound: adds your PB to forced ability checks/saves.",
    },
  },
  bonus_spells: {
    3: ['absorb elements', 'command'],
    5: ['scorching ray', 'warding bond'],
    9: ['fireball', 'fear'],
    13: ['dominate creature', 'freedom of movement'],
    17: ['awaken', 'fire storm'],
  },
};

const SPELLBREAKERS: SubclassDefinition = {
  id: 'spellbreakers',
  name: 'Order of Spellbreakers',
  description: 'Arcane warrior fraternities devoted to slaying or judging those who abuse magic.',
  features_by_level: {
    3: ['spellbreakers_baleful_mark'],
    7: ['spellbreakers_mantle_of_defense', 'spellbreakers_crippling_mark'],
    15: ['spellbreakers_reflective_spellsunder'],
    20: ['spellbreakers_master_spellbreaker'],
  },
  features: {
    spellbreakers_baleful_mark: {
      id: 'spellbreakers_baleful_mark',
      name: 'Baleful Mark',
      description:
        "As a bonus action on your turn, place a Baleful Mark on a creature you can see. Lasts until you Mark another, the target dies, or it is removed by dispel magic / remove curse / similar. While active and visible only to you: " +
        "you know the exact direction of the Mark while you remain on the same plane; you learn its spellcasting ability and the highest spell level it can cast (if any); if your Mark casts a spell within your reach, you can use your reaction to make an OA against it; whenever you damage your Mark, it has disadvantage on its concentration save.",
    },
    spellbreakers_mantle_of_defense: {
      id: 'spellbreakers_mantle_of_defense',
      name: 'Mantle of Defense',
      description: 'Whenever your Mark forces you to make a saving throw to resist a spell or magical effect, gain a bonus to your roll = your WIS modifier (min +1).',
    },
    spellbreakers_crippling_mark: {
      id: 'spellbreakers_crippling_mark',
      name: 'Crippling Mark',
      description:
        "When your Mark makes an ability check or save within 30 feet of you, use a reaction to end your Baleful Mark and impose disadvantage on its roll. After ending the Mark this way, you cannot Mark that creature again until you finish a long rest.",
    },
    spellbreakers_reflective_spellsunder: {
      id: 'spellbreakers_reflective_spellsunder',
      name: 'Reflective Spellsunder',
      description: "When Spellsunder causes a hostile spell to fail, you can force the caster to become the new target of their own spell. Uses the caster's spell attack roll and Spell save DC; if it requires concentration, you must concentrate on it.",
    },
    spellbreakers_master_spellbreaker: {
      id: 'spellbreakers_master_spellbreaker',
      name: 'Master Spellbreaker',
      description:
        "When you roll initiative (and not surprised), you can mark a creature you can see with Baleful Mark. Advantage on weapon attack rolls as part of Spellstrike and Spellsunder against your Mark. When you hit your Mark with a Spellstrike, you can end your Baleful Mark to make your attack (including the spell) deal maximum damage; cannot Mark that creature again until a long rest.",
    },
  },
  bonus_spells: {
    3: ['bane', 'detect evil and good'],
    5: ['blindness/deafness', 'silence'],
    9: ['counterspell', 'magic circle'],
    13: ['banishment', 'resilient sphere'],
    17: ['dispel evil and good', 'planar binding'],
  },
};

const WARDERS: SubclassDefinition = {
  id: 'warders',
  name: 'Order of Warders',
  description: 'Defensive Heathbound who bond to a single ward and combine martial guardianship with arcane protection.',
  features_by_level: {
    3: ['warders_bond'],
    7: ['warders_arcane_aegis'],
    15: ['warders_bond_perfected'],
    20: ['warders_high_warder'],
  },
  features: {
    warders_bond: {
      id: 'warders_bond',
      name: "Warder's Bond",
      description:
        "Gain heavy armor proficiency. At the end of a long rest, touch a willing creature to forge a mystical bond — they are your Ward until your next long rest. " +
        "When your Ward is targeted by an attack or forced to make a save and you are within 10 feet, use a reaction to instantly switch places with them and become the new target. (Range increases at 7th: 30 ft.; 15th: 60 ft.; 20th: line of sight.)",
    },
    warders_arcane_aegis: {
      id: 'warders_arcane_aegis',
      name: 'Arcane Aegis',
      description:
        "When you use your Warder's Bond reaction and take damage, expend a spell slot as part of the same reaction to reduce that damage by 2d8 per slot level. Also, at the start of each of your turns, while your Ward is within 10 feet, grant yourself or your Ward temp HP equal to your WIS mod (min 1).",
    },
    warders_bond_perfected: {
      id: 'warders_bond_perfected',
      name: 'Bond Perfected',
      description:
        "When you use Warder's Bond, you are considered resistant to any damage from the triggering attack. While within 10 feet of your Ward, both of you are immune to Charmed and Frightened, and the conditions are temporarily suppressed if either of you currently has them.",
    },
    warders_high_warder: {
      id: 'warders_high_warder',
      name: 'High Warder',
      description:
        "At the end of each long rest, bond up to five Wards. When using Warder's Bond because your Ward was targeted by a spell, also use Spellsunder as part of the same reaction (with advantage on the attack roll); if Spellsunder fails, Arcane Aegis can still reduce the damage.",
    },
  },
  bonus_spells: {
    3: ['compelled duel', 'sanctuary'],
    5: ['aid', 'warding bond'],
    9: ['beacon of hope', 'life transference'],
    13: ['faithful hound', 'death ward'],
    17: ['antilife shell', 'circle of power'],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Expanded subclasses — same as Magus, with Magus/INT swapped for Heathbound/WIS
// ──────────────────────────────────────────────────────────────────────────

const ARMORERS: SubclassDefinition = {
  id: 'armorers',
  name: 'Order of Armorers',
  description: 'Heathbound who unlock the true potential of their Arcane Armory, conjuring weapons within to levitate and strike at their foes.',
  features_by_level: {
    3: ['armorers_awakened_armory', 'armorers_mythic_swordsmith'],
    7: ['armorers_improved_focus'],
    15: ['armorers_dancing_parry'],
    20: ['armorers_mythic_strike'],
  },
  features: {
    armorers_awakened_armory: {
      id: 'armorers_awakened_armory',
      name: 'Awakened Armory',
      description:
        "Bonus action: expend a spell slot to awaken your Armory. A number of one-handed melee weapons from your Armory equal to 1 + the slot's level appear and levitate around you. Lasts 1 minute. While active: weapons gain Thrown (20/60), use WIS for attack/damage; no Fighting Style benefit but they can Spellstrike; as an action, make one Thrown attack with each weapon levitating; as a bonus action, recall any thrown Armory weapons (they re-levitate); disadvantage on concentration saves.",
    },
    armorers_mythic_swordsmith: {
      id: 'armorers_mythic_swordsmith',
      name: 'Mythic Swordsmith',
      description: "Gain proficiency in Arcana and smith's tools. On a smith's tools check, add WIS mod (min +1). Time to craft any weapon is halved.",
    },
    armorers_improved_focus: {
      id: 'armorers_improved_focus',
      name: 'Improved Focus',
      description: 'No longer have disadvantage on concentration saves while using Awakened Armory. While active, your Thrown weapon range becomes (40/120).',
    },
    armorers_dancing_parry: {
      id: 'armorers_dancing_parry',
      name: 'Dancing Parry',
      description: 'When hit by an attack while Awakened Armory is active, use a reaction to deflect: AC bonus equal to the number of weapons levitating in your space (possibly making the attack miss).',
    },
    armorers_mythic_strike: {
      id: 'armorers_mythic_strike',
      name: 'Mythic Strike',
      description: 'Once per turn when you hit with an Armory weapon, you can end its Armory enchantment to erupt: creatures of your choice within 20 ft. of the target make a DEX save, 8d6 force damage on fail, half on success.',
    },
  },
  bonus_spells: {
    3: ['compelled duel', 'hail of thorns'],
    5: ['cloud of daggers', 'heat metal'],
    9: ['conjure volley', 'haste'],
    13: ['fabricate', 'freedom of movement'],
    17: ['steel wind strike', 'vorpal blade'],
  },
};

const CONDUITS: SubclassDefinition = {
  id: 'conduits',
  name: 'Order of Conduits',
  description: 'Reclusive martial-arts Heathbound. They become living conduits of wild magic, forgoing the Armory for inner power.',
  features_by_level: {
    3: ['conduits_arcane_conduit', 'conduits_ascetic_resilience'],
    7: ['conduits_ethereal_arts'],
    15: ['conduits_enchanted_physique'],
    20: ['conduits_ascended_conduit'],
  },
  features: {
    conduits_arcane_conduit: {
      id: 'conduits_arcane_conduit',
      name: 'Arcane Conduit',
      description:
        "When unarmored, no shield, no weapon: gain the Brawling Fighting Style (or Featherweight Fighting if you already have Brawling); use DEX in place of STR for unarmed strike attacks/damage; unarmed strikes count as magical and can Spellstrike (also fulfill material components for Conduit Spells); AC = 10 + DEX mod + WIS mod.",
    },
    conduits_ascetic_resilience: {
      id: 'conduits_ascetic_resilience',
      name: 'Ascetic Resilience',
      description:
        "When you roll initiative, gain temp HP = your number of unused spell slots. As a bonus action, expend a 1st-level or higher spell slot to gain those temp HP again.",
      is_resource: true,
      resource_uses: '1',
      resource_recovery: 'long',
    },
    conduits_ethereal_arts: {
      id: 'conduits_ethereal_arts',
      name: 'Ethereal Arts',
      description: 'When you hit with an unarmed strike, you can knock the target back 5 ft. in a line (if your size or smaller), or instantly teleport to an unoccupied space within 5 ft. of the target. Unarmed strikes deal 1d8 damage on hit.',
    },
    conduits_enchanted_physique: {
      id: 'conduits_enchanted_physique',
      name: 'Enchanted Physique',
      description: 'While you have temp HP from Ascetic Resilience: resistance to bludgeoning, piercing, and slashing; advantage on concentration saves.',
    },
    conduits_ascended_conduit: {
      id: 'conduits_ascended_conduit',
      name: 'Ascended Conduit',
      description:
        "Bonus action: overcharge for 1 minute — Attack action with only unarmed strikes makes 4 attacks; flying speed = walking speed; when you teleport with a Heathbound feature/spell, you can touch a creature your size or smaller (including grappled) and bring them with you. Once per long rest at no cost; thereafter, expend a 5th-level slot.",
      is_resource: true,
      resource_uses: '1',
      resource_recovery: 'long',
    },
  },
  bonus_spells: {
    3: ['expeditious retreat', 'thunderous smite'],
    5: ['blur', 'branding smite'],
    9: ['blinding smite', 'haste'],
    13: ['dimension door', 'staggering smite'],
    17: ['banishing smite', 'skill empowerment'],
  },
};

const HEXBLADES: SubclassDefinition = {
  id: 'hexblades',
  name: 'Order of Hexblades',
  description: 'Heathbound infused with sinister Shadowfell magic. They forge sentient cursed weapons that drink the life of foes.',
  features_by_level: {
    3: ['hexblades_hex_warrior'],
    7: ['hexblades_accursed_armory'],
    15: ['hexblades_sinister_sentience'],
    20: ['hexblades_awakened_hexblade'],
  },
  features: {
    hexblades_hex_warrior: {
      id: 'hexblades_hex_warrior',
      name: 'Hex Warrior',
      description:
        "During a long rest, perform a 1-hour ritual to transform one melee Armory weapon into your Hexblade until you ritual again. Benefits: " +
        "Enchanted Armament — use WIS in place of STR/DEX for attacks/damage and choose its damage to be necrotic. " +
        "Life Drain — when you deal necrotic damage to a Hostile, non-Construct, non-Undead creature, gain temp HP = half the damage. " +
        "Malevolent Curse — when attacking a creature affected by a Hexblade Spell with your Hexblade, you score a critical hit on a 19 or 20.",
    },
    hexblades_accursed_armory: {
      id: 'hexblades_accursed_armory',
      name: 'Accursed Armory',
      description:
        "When using Life Drain, you can store the gained life as life essence in an empty Armory slot (10 per slot). Spend life essence: cast a Hexblade Spell using 10/slot-level instead of expending a spell slot (cannot also use Life Drain that turn); or, when forced to save against a Hexblade Spell effect, spend 10 essence for advantage.",
    },
    hexblades_sinister_sentience: {
      id: 'hexblades_sinister_sentience',
      name: 'Sinister Sentience',
      description:
        "Your Hexblade awakens — INT/WIS/CHA 10, its own alignment. Telepathic with you (60 ft.). Mental Bond: while wielding it, concentrate on two spells (one must be a Hexblade Spell); concentration saves combine into a single roll at disadvantage.",
    },
    hexblades_awakened_hexblade: {
      id: 'hexblades_awakened_hexblade',
      name: 'Awakened Hexblade',
      description:
        "Hexblade INT/WIS/CHA become 16; Telepathy 120 ft. Highly resistant to relocating into a more powerful host. Spellstrike damage can be necrotic; attacks ignore resistance to necrotic and treat immunity as resistance.",
    },
  },
  bonus_spells: {
    3: ['hex', 'wrathful smite'],
    5: ['blindness/deafness', 'blur'],
    9: ['bestow curse', 'enemies abound'],
    13: ['accursed touch', 'phantasmal killer'],
    17: ['enervation', 'spiritual sundering'],
  },
};

const SHADES: SubclassDefinition = {
  id: 'shades',
  name: 'Order of Shades',
  description: 'Infiltrators, assassins, and spies who weave illusion and darkness to end conflicts before they begin.',
  features_by_level: {
    3: ['shades_shroud_of_darkness', 'shades_umbral_sight'],
    7: ['shades_from_the_shadows', 'shades_improved_shroud'],
    15: ['shades_cloud_the_mind'],
    20: ['shades_one_with_the_darkness'],
  },
  features: {
    shades_shroud_of_darkness: {
      id: 'shades_shroud_of_darkness',
      name: 'Shroud of Darkness',
      description:
        "As an action, envelop yourself in a Shroud of illusion magic for 1 hour. While active, use a bonus action to turn invisible if in dim light or darkness; invisibility lasts the Shroud's duration but ends if you attack, touch, or force a creature to make an ability check or save. Once per short or long rest at no cost; thereafter, expend a spell slot.",
      is_resource: true,
      resource_uses: '1',
      resource_recovery: 'short',
    },
    shades_umbral_sight: {
      id: 'shades_umbral_sight',
      name: 'Umbral Sight',
      description: 'Gain Darkvision 60 ft. If you already have Darkvision, its range increases by 30 ft.',
    },
    shades_from_the_shadows: {
      id: 'shades_from_the_shadows',
      name: 'From the Shadows',
      description: 'When you hit a Surprised creature with a Spellstrike, it automatically fails its initial save against the spell. If you use Ethereal Step in dim light or darkness, the teleport distance is doubled.',
    },
    shades_improved_shroud: {
      id: 'shades_improved_shroud',
      name: 'Improved Shroud',
      description: 'While Shroud of Darkness is active and you are in darkness, you are invisible to anything relying on Darkvision to see you.',
    },
    shades_cloud_the_mind: {
      id: 'shades_cloud_the_mind',
      name: 'Cloud the Mind',
      description:
        "Action: one creature within 30 feet makes a WIS save. Fail: cannot see, hear, smell, or sense you in any way for 1 minute (immune for 24 hours on success). Effect ends immediately if you attack, touch, or force them to make a check/save. Uses = your WIS modifier (min 1), recharging on long rest. With no uses left, expend a spell slot.",
      is_resource: true,
      resource_uses: 'WIS modifier',
      resource_recovery: 'long',
    },
    shades_one_with_the_darkness: {
      id: 'shades_one_with_the_darkness',
      name: 'One with the Darkness',
      description: 'Conjure your Shroud of Darkness at will. While active, gain the benefits of invisibility and pass without trace at the start of each of your turns (no concentration). As a bonus action on each of your turns, teleport up to 60 ft. to a space you can see in dim light or darkness.',
    },
  },
  bonus_spells: {
    3: ['disguise self', 'sleep'],
    5: ['blindness/deafness', 'pass without trace'],
    9: ['hypnotic pattern', 'nondetection'],
    13: ['divination', 'greater invisibility'],
    17: ['mislead', 'modify memory'],
  },
};

const SPELLSWORDS: SubclassDefinition = {
  id: 'spellswords',
  name: 'Order of Spellswords',
  description: 'Rare masters who pair their wild magic with deep martial study, learning Exploits alongside their spells.',
  features_by_level: {
    3: ['spellswords_martial_exploits', 'spellswords_swift_armory'],
    7: ['spellswords_mystic_precision'],
    15: ['spellswords_ethereal_warrior'],
    20: ['spellswords_arcane_blademaster'],
  },
  features: {
    spellswords_martial_exploits: {
      id: 'spellswords_martial_exploits',
      name: 'Martial Exploits',
      description:
        "You learn Martial Exploits from the Alternate Fighter list. " +
        "Exploit Dice: see the Spellsword Exploits table for count and die size; expend an Exploit Die per use, regain on short or long rest. " +
        "High Degree: your Heathbound level limits the technicality of Exploits you can learn (1st/2nd/3rd Degree). " +
        "Restrictions: only one Exploit per ability check, attack, or save. Cannot use an Exploit and Spellstrike at the same time. " +
        "Saving Throws: if a Martial Exploit forces a save, it uses your Heathbound Spell save DC.",
      is_resource: true,
      resource_uses: 'see table',
      resource_recovery: 'short',
    },
    spellswords_swift_armory: {
      id: 'spellswords_swift_armory',
      name: 'Swift Armory',
      description: 'Access your Arcane Armory as part of each attack you make (no separate bonus action needed).',
    },
    spellswords_mystic_precision: {
      id: 'spellswords_mystic_precision',
      name: 'Mystic Precision',
      description: 'When you hit a creature with a weapon attack and then make a Spellstrike against it on the same turn, gain a bonus to the Spellstrike attack roll equal to the slot level spent (+0 for Cantrips).',
    },
    spellswords_ethereal_warrior: {
      id: 'spellswords_ethereal_warrior',
      name: 'Ethereal Warrior',
      description: 'Whenever you Access your Arcane Armory, you can use Ethereal Step to teleport up to 10 feet.',
    },
    spellswords_arcane_blademaster: {
      id: 'spellswords_arcane_blademaster',
      name: 'Arcane Blademaster',
      description: 'Once on each of your turns, use a Martial Exploit you know without expending an Exploit Die or Spellstrike a 1st-level Heathbound spell you know without expending a spell slot.',
    },
  },
};

const TRAVELERS: SubclassDefinition = {
  id: 'travelers',
  name: 'Order of Travelers',
  description: 'Practitioners of Chronomancy — time magic. They become detached from their own era as they grow in power.',
  features_by_level: {
    3: ['travelers_temporal_shift', 'travelers_visions_of_the_past'],
    7: ['travelers_adrift_in_time', 'travelers_greater_shift'],
    15: ['travelers_conjure_self'],
    20: ['travelers_untethered_traveler'],
  },
  features: {
    travelers_temporal_shift: {
      id: 'travelers_temporal_shift',
      name: 'Temporal Shift',
      description:
        "When you miss with an attack roll, or fail an ability check or save, use a reaction to reroll the d20; you must use the new result. Uses = your WIS modifier (min 1), recharging on long rest. With no uses left, expend a spell slot to use this reaction again.",
      is_resource: true,
      resource_uses: 'WIS modifier',
      resource_recovery: 'long',
    },
    travelers_visions_of_the_past: {
      id: 'travelers_visions_of_the_past',
      name: 'Visions of the Past',
      description: 'Gain proficiency in either History or Investigation. When making a History or Investigation check at the location of past events, you are considered proficient (or, if already proficient, you double your PB).',
    },
    travelers_adrift_in_time: {
      id: 'travelers_adrift_in_time',
      name: 'Adrift in Time',
      description: "Your age can't be changed by spells or magic, and for every 10 years that pass your physical body only ages 1 year.",
    },
    travelers_greater_shift: {
      id: 'travelers_greater_shift',
      name: 'Greater Shift',
      description: 'Use Temporal Shift when a creature you can see within 30 feet misses an attack roll, or fails an ability check or save.',
    },
    travelers_conjure_self: {
      id: 'travelers_conjure_self',
      name: 'Conjure Self',
      description:
        "Action: spend a 3rd-level or higher spell slot to conjure a Future Self. Same statistics, features, and shared spell-slot pool as you. Acts on its own initiative each turn. Knowledge: ask a single question about the future (DM-determined). Duration: 1 hour, or 0 HP. Only one Future Self at a time.",
    },
    travelers_untethered_traveler: {
      id: 'travelers_untethered_traveler',
      name: 'Untethered Traveler',
      description: 'Once between long rests, cast time stop without expending a spell slot. If your Future Self is in range, it can act during the spell with you. With no use available, expend a 5th-level slot to cast time stop this way again.',
    },
  },
  bonus_spells: {
    2: ['expeditious retreat', 'feather fall'],
    5: ['blur', 'hold person'],
    9: ['haste', 'slow'],
    13: ['banishment', 'dimension door'],
    17: ['hold monster', 'modify memory'],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Spell list — same as Magus, with a few additions to support the Ward of the
// Witch bonus spells (so they bucket correctly in the assembler):
//   1st: + command
//   2nd: + warding bond
//   3rd: + fear
//   5th: + dominate creature, fire storm
// ──────────────────────────────────────────────────────────────────────────

const SPELL_LIST: Record<string, string[]> = {
  '0': [
    'acid splash', 'blade ward', 'booming blade', 'dancing lights', 'fire bolt',
    'frostbite', 'glitterbeam', 'green-flame blade', 'light', 'lightning lure',
    'mage hand', 'minor illusion', 'poison spray', 'prestidigitation',
    'ray of frost', 'resistance', 'shocking grasp', 'sword burst',
    'tempestuous blade', 'true strike',
  ],
  '1': [
    'absorb elements', 'armor of agathys', 'burning hands', 'caustic brew',
    'chromatic orb', 'color spray', 'command', 'detect magic', 'earth tremor',
    'expeditious retreat', 'faerie fire', 'feather fall', 'floating disk',
    'fog cloud', 'grease', 'ice knife', 'identify', 'jump', 'mage armor',
    'magic missile', 'ray of sickness', 'shield', 'sleep', 'thunderwave',
    'torrent', 'unseen servant', 'witch bolt', 'zephyr strike',
  ],
  '2': [
    'acid arrow', 'aura of frost', 'blindness/deafness', 'blur',
    'cloud of daggers', 'darkness', 'darkvision', 'earthen grasp',
    'elemental blade', 'enhance ability', 'enlarge/reduce', 'gust of wind',
    'hold person', 'invisibility', 'levitate', 'lock/unlock', 'magic aura',
    'magic weapon', 'mirror image', 'misty step', 'ray of enfeeblement',
    'scorching ray', 'shatter', 'snowball swarm', 'spider climb',
    'warding bond',
  ],
  '3': [
    'counterspell', 'dispel magic', 'elemental bane', 'elemental weapon',
    'erupting earth', 'fear', 'fireball', 'flame arrows', 'fly', 'haste',
    'lightning bolt', 'magic circle', 'minute meteors',
    'protection from energy', 'sleet storm', 'slow', 'sonic wave',
    'tidal wave', 'thunder step', 'wall of sand', 'wall of water', 'wind wall',
  ],
  '4': [
    'accursed touch', 'arcane eye', 'banishment', 'dimension door',
    'divination', 'fire shield', 'freedom of movement', 'greater invisibility',
    'ice storm', 'polymorph', 'resilient sphere', 'sickening radiance',
    'stoneskin', 'vitriolic sphere', 'wall of fire', 'wall of ice',
    'watery sphere',
  ],
  '5': [
    'cone of cold', 'contact other plane', 'contagion', 'dispel evil and good',
    'dominate creature', 'far step', 'fire storm', 'hold monster', 'immolation',
    'passwall', 'scrying', 'skill empowerment', 'steel wind strike',
    'telepathic bond', 'teleportation circle', 'vorpal blade', 'wall of force',
    'wall of light', 'wall of stone',
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// Final export
// ──────────────────────────────────────────────────────────────────────────

export const HEATHBOUND: ClassDefinition = {
  id: 'heathbound',
  name: 'Heathbound',
  source: 'laserllama',
  description:
    "The Heathbound are warriors bound to the wild magic of forgotten heaths and untamed lands, weaving primal sorcery through their blade work. Each is the chosen of a witch of the deep forest — fey-touched, ancient, neither wholly good nor evil — and carries a fragment of her magic into the world. WIS-based half-caster (d10) with the signature Spellstrike mechanic.",

  hit_die: 'd10',
  primary_ability: ['WIS', 'STR', 'DEX'],
  saving_throws: ['CON', 'WIS'],

  caster_type: 'half',
  spellcasting_ability: 'WIS',

  armor_proficiencies: { light: true, medium: true, heavy: false, shields: true },
  weapon_proficiencies: { simple: true, martial: true },
  tool_proficiencies: [],
  skill_choices: {
    count: 2,
    options: ['Acrobatics', 'Arcana', 'Athletics', 'History', 'Investigation', 'Nature', 'Performance'],
  },

  starting_equipment_options: [
    '(a) a martial weapon and shield or (b) two martial weapons',
    '(a) scale mail or (b) leather armor',
    '(a) a light crossbow and 20 bolts or (b) five javelins',
    "(a) a dungeoneer's pack or (b) an explorer's pack",
  ],

  level_progression: LEVEL_PROGRESSION,
  features: FEATURES,

  subclass_label: 'Esoteric Order',
  subclass_choice_level: 3,
  subclasses: [
    ARCANISTS, ARCANE_ARCHERS, BLADES, WARD_OF_THE_WITCH, SPELLBREAKERS, WARDERS,
    ARMORERS, CONDUITS, HEXBLADES, SHADES, SPELLSWORDS, TRAVELERS,
  ],

  spell_list: SPELL_LIST,
  allowed_fighting_style_ids: ALL_FIGHTING_STYLE_IDS,
};

/** Heathbound cantrip progression — same as Magus: 0 at L1, 2 at L2-3, 3 at L4-9, 4 at L10+. */
export function heathboundCantripsKnown(level: number): number {
  if (level < 2) return 0;
  if (level < 4) return 2;
  if (level < 10) return 3;
  return 4;
}
