import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Heart, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { DescriptionPicker } from "./description-picker";
import {
  ABILITY_LABELS,
  abilityModifier,
  type AbilityKey,
  type CharacterData,
  type EquipmentDefinition,
  type FeatDefinition,
  type InventoryItem,
  type SpellDefinition,
  type SpellSlotState,
} from "../lib/types";
import {
  attackFromEquipment,
  calculateArmorClass,
  calculateEffectiveSpeed,
  calculateEncumbrance,
  conditionEffectText,
  DAMAGE_TYPES,
  extractDiceFormula,
  formatPounds,
  preparedSpellLimitFor,
  resolveIncomingDamage,
  rollDiceFormula,
} from "../lib/character-rules";

type PatchCharacter = (patch: Partial<CharacterData>) => void;

const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}

function equipmentDescription(item: EquipmentDefinition) {
  return [
    item.description,
    item.damage ? `Damage: ${item.damage}${item.damageType ? ` ${item.damageType}` : ""}` : "",
    item.properties?.length ? `Properties: ${item.properties.join(", ")}` : "",
    item.mastery ? `Mastery: ${item.mastery}` : "",
  ].filter(Boolean).join("\n\n");
}

export function SessionTracker({ character, patchCharacter, hitDie }: { character: CharacterData; patchCharacter: PatchCharacter; hitDie: number }) {
  const [hpAmount, setHpAmount] = useState(1);
  const [damageType, setDamageType] = useState("Bludgeoning");
  const [hpFeedback, setHpFeedback] = useState("");
  const [hitDiceToSpend, setHitDiceToSpend] = useState(1);
  const [hitDiceFeedback, setHitDiceFeedback] = useState("");
  const [condition, setCondition] = useState("");

  function takeDamage() {
    const resolution = resolveIncomingDamage(hpAmount, damageType, character);
    const amount = resolution.adjusted;
    const absorbed = Math.min(character.temporaryHp, amount);
    patchCharacter({
      temporaryHp: character.temporaryHp - absorbed,
      currentHp: Math.max(0, character.currentHp - (amount - absorbed)),
    });
    setHpFeedback(`${hpAmount} ${damageType} → ${amount} damage. ${resolution.reason}${absorbed ? `; ${absorbed} absorbed by temporary HP` : ""}.`);
  }

  function heal() {
    const healing = Math.max(0, hpAmount || 0);
    const restored = Math.min(healing, character.maxHp - character.currentHp);
    patchCharacter({ currentHp: character.currentHp + restored });
    setHpFeedback(`Restored ${restored} HP${restored < healing ? "; excess healing was ignored" : ""}.`);
  }

  function longRest() {
    const exhaustionLevel = Math.max(0, character.exhaustionLevel - 1);
    patchCharacter({
      currentHp: character.maxHp,
      temporaryHp: 0,
      hitDiceUsed: 0,
      deathSaveSuccesses: 0,
      deathSaveFailures: 0,
      spellSlots: Object.fromEntries(
        Object.entries(character.spellSlots).map(([level, slot]) => [level, { ...slot, used: 0 }]),
      ),
      concentratingSpellId: undefined,
      resources: character.resources.map((resource) => resource.recovery === "manual" ? resource : { ...resource, current: resource.maximum }),
      exhaustionLevel,
      conditions: exhaustionLevel ? character.conditions : character.conditions.filter((item) => item !== "Exhaustion"),
    });
  }

  function shortRest() {
    patchCharacter({
      resources: character.resources.map((resource) => resource.recovery === "short"
        ? { ...resource, current: resource.maximum }
        : resource.recovery === "short-one" ? { ...resource, current: Math.min(resource.maximum, resource.current + 1) } : resource),
    });
  }

  function spendHitDice() {
    const available = character.hitDiceTotal - character.hitDiceUsed;
    const count = Math.max(1, Math.min(available, hitDiceToSpend));
    if (available <= 0 || character.currentHp >= character.maxHp) return;
    const staminaHealing = abilityModifier(character.abilities.stamina) * count;
    const result = rollDiceFormula(`${count}d${hitDie}`, false, staminaHealing);
    if (!result) return;
    const restored = Math.min(Math.max(0, result.total), character.maxHp - character.currentHp);
    patchCharacter({ currentHp: character.currentHp + restored, hitDiceUsed: character.hitDiceUsed + count });
    setHitDiceFeedback(`Rolled ${result.rolls.join(" + ")}${staminaHealing ? ` ${staminaHealing >= 0 ? "+" : "−"} ${Math.abs(staminaHealing)} Stamina` : ""}; restored ${restored} HP.`);
  }

  function toggleDeathSave(kind: "success" | "failure", index: number) {
    const key = kind === "success" ? "deathSaveSuccesses" : "deathSaveFailures";
    const current = character[key];
    patchCharacter({ [key]: current === index + 1 ? index : index + 1 });
  }

  function addCondition() {
    if (!condition || character.conditions.includes(condition)) return;
    if (character.conditionImmunities.some((item) => item.toLowerCase() === condition.toLowerCase())) {
      setHpFeedback(`${condition} was not applied because the character is immune.`);
      setCondition("");
      return;
    }
    const endsConcentration = ["Incapacitated", "Paralyzed", "Petrified", "Stunned", "Unconscious"].includes(condition);
    patchCharacter({
      conditions: [...character.conditions, condition],
      exhaustionLevel: condition === "Exhaustion" ? Math.max(1, character.exhaustionLevel) : character.exhaustionLevel,
      ...(endsConcentration ? { concentratingSpellId: undefined } : {}),
    });
    setCondition("");
  }

  function removeCondition(conditionName: string) {
    patchCharacter({
      conditions: character.conditions.filter((value) => value !== conditionName),
      ...(conditionName === "Exhaustion" ? { exhaustionLevel: 0 } : {}),
    });
  }

  function adjustExhaustion(change: number) {
    const exhaustionLevel = clamp(character.exhaustionLevel + change, 0, 6);
    patchCharacter({
      exhaustionLevel,
      conditions: exhaustionLevel
        ? [...new Set([...character.conditions, "Exhaustion"])]
        : character.conditions.filter((item) => item !== "Exhaustion"),
    });
  }

  function addResource() {
    const suggestions: Record<string, string> = {
      barbarian: "Rage",
      bard: "Bardic Inspiration",
      priest: "Channel Divinity",
      warrior: "Second Wind",
      monk: "Focus Points",
      paladin: "Lay on Hands",
      hunter: "Favored Enemy",
      rogue: "Class Resource",
      sorcerer: "Sorcery Points",
      mage: "Arcane Recovery",
    };
    const name = suggestions[character.className.toLowerCase()] ?? "Class Resource";
    patchCharacter({ resources: [...character.resources, { id: crypto.randomUUID(), name, current: 1, maximum: 1, recovery: "long" }] });
  }

  function updateResource(id: string, patch: Partial<CharacterData["resources"][number]>) {
    patchCharacter({ resources: character.resources.map((resource) => {
      if (resource.id !== id) return resource;
      const next = { ...resource, ...patch };
      next.maximum = Math.max(0, Number(next.maximum) || 0);
      next.current = Math.max(0, Math.min(next.maximum, Number(next.current) || 0));
      return next;
    }) });
  }

  return (
    <section className="panel session-panel">
      <div className="section-heading">
        <div><span className="eyebrow">During play</span><h2>Session tracker</h2></div>
        <div className="rest-actions"><button className="button button-outline" onClick={shortRest}>Short rest</button><button className="button button-outline" onClick={longRest}>Long rest</button></div>
      </div>
      <div className="session-grid">
        <div className="session-block hp-controls">
          <span className="field-label"><Heart size={14} />Damage & healing</span>
          <div className="damage-type-row"><input aria-label="Hit point change" type="number" min="0" value={hpAmount} onChange={(event) => setHpAmount(Number(event.target.value))} /><select aria-label="Incoming damage type" value={damageType} onChange={(event) => setDamageType(event.target.value)}>{DAMAGE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="hp-action-row">
            <button className="button damage-button" onClick={takeDamage}>Damage</button>
            <button className="button heal-button" onClick={heal}>Heal</button>
          </div>
          <label className="compact-field"><span>Temporary HP</span><input type="number" min="0" value={character.temporaryHp} onChange={(event) => patchCharacter({ temporaryHp: Math.max(0, Number(event.target.value)) })} /></label>
          {hpFeedback && <p className="tracker-feedback">{hpFeedback}</p>}
        </div>

        <div className="session-block">
          <span className="field-label">Death saves</span>
          <div className="death-save-row"><small>Successes</small>{[0, 1, 2].map((index) => <button key={index} aria-label={`Death save success ${index + 1}`} className={index < character.deathSaveSuccesses ? "marked success" : ""} onClick={() => toggleDeathSave("success", index)} />)}</div>
          <div className="death-save-row"><small>Failures</small>{[0, 1, 2].map((index) => <button key={index} aria-label={`Death save failure ${index + 1}`} className={index < character.deathSaveFailures ? "marked failure" : ""} onClick={() => toggleDeathSave("failure", index)} />)}</div>
        </div>

        <div className="session-block">
          <span className="field-label">Hit dice</span>
          <div className="resource-number"><strong>{character.hitDiceTotal - character.hitDiceUsed}</strong><span>/ {character.hitDiceTotal} d{hitDie} remaining</span></div>
          <div className="hit-dice-spend"><label>Spend<input aria-label="Hit Dice to spend" type="number" min="1" max={Math.max(1, character.hitDiceTotal - character.hitDiceUsed)} value={hitDiceToSpend} onChange={(event) => setHitDiceToSpend(Math.max(1, Number(event.target.value) || 1))} /></label><button disabled={character.hitDiceUsed >= character.hitDiceTotal || character.currentHp >= character.maxHp} onClick={spendHitDice}>Roll healing</button></div>
          {hitDiceFeedback && <p className="tracker-feedback">{hitDiceFeedback}</p>}
        </div>

        <div className="session-block">
          <span className="field-label">Inspiration & conditions</span>
          <button className={`inspiration-toggle ${character.inspiration ? "active" : ""}`} onClick={() => patchCharacter({ inspiration: !character.inspiration })}><Sparkles size={15} />{character.inspiration ? "Inspired" : "Mark inspiration"}</button>
          <div className="condition-add"><select value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">Add condition</option>{CONDITIONS.filter((item) => !character.conditions.includes(item) && !character.conditionImmunities.some((immune) => immune.toLowerCase() === item.toLowerCase())).map((item) => <option key={item}>{item}</option>)}</select><button onClick={addCondition}><Plus size={14} /></button></div>
          {character.conditionImmunities.length > 0 && <small className="immunity-note">Immune: {character.conditionImmunities.join(", ")}</small>}
          <div className="condition-list">{character.conditions.map((item) => item === "Exhaustion"
            ? <span className="exhaustion-chip" key={item}><button aria-label="Reduce exhaustion" onClick={() => adjustExhaustion(-1)}>−</button><b>Exhaustion {character.exhaustionLevel}</b><button aria-label="Increase exhaustion" onClick={() => adjustExhaustion(1)}>+</button><button aria-label="Remove Exhaustion" onClick={() => removeCondition(item)}>×</button></span>
            : <button key={item} onClick={() => removeCondition(item)}>{item} ×</button>)}</div>
          {character.conditions.length > 0 && <div className="condition-effects">{character.conditions.map((item) => <p key={item}><strong>{item === "Exhaustion" ? `Exhaustion ${character.exhaustionLevel}` : item}</strong>{conditionEffectText(item, character.exhaustionLevel)}</p>)}</div>}
        </div>
      </div>
      <div className="class-resource-panel">
        <div className="class-resource-heading"><div><span className="eyebrow">Rest recovery</span><h3>Class resources</h3></div><button className="button button-outline" onClick={addResource}><Plus size={14} />Add tracker</button></div>
        <div className="class-resource-list">{character.resources.map((resource) => <article key={resource.id}>
          <input className="resource-name" aria-label="Resource name" value={resource.name} onChange={(event) => updateResource(resource.id, { name: event.target.value })} />
          <div className="resource-stepper"><button aria-label={`Spend ${resource.name}`} disabled={resource.current <= 0} onClick={() => updateResource(resource.id, { current: resource.current - 1 })}>−</button><strong>{resource.current}</strong><span>/</span><input aria-label={`${resource.name} maximum`} type="number" min="0" value={resource.maximum} onChange={(event) => updateResource(resource.id, { maximum: Number(event.target.value) })} /><button aria-label={`Recover ${resource.name}`} disabled={resource.current >= resource.maximum} onClick={() => updateResource(resource.id, { current: resource.current + 1 })}>+</button></div>
          <select aria-label={`${resource.name} recovery`} value={resource.recovery} disabled={resource.automatic} onChange={(event) => updateResource(resource.id, { recovery: event.target.value as CharacterData["resources"][number]["recovery"] })}><option value="short">Short or Long Rest</option><option value="short-one">One on Short Rest</option><option value="long">Long Rest</option><option value="manual">Manual</option></select>
          {resource.automatic && <span className="automatic-resource" title={`Managed by ${resource.source ?? "class progression"}`}>Auto</span>}
          <button className="icon-button danger" disabled={resource.automatic} aria-label={`Remove ${resource.name}`} onClick={() => patchCharacter({ resources: character.resources.filter((item) => item.id !== resource.id) })}><Trash2 size={14} /></button>
        </article>)}</div>
        {!character.resources.length && <p className="class-resource-empty">Add a reusable tracker for Rage, Focus, Channel Divinity, Sorcery Points, or another limited class feature.</p>}
      </div>
    </section>
  );
}

export function FeatManager({ catalog, character, patchCharacter }: { catalog: FeatDefinition[]; character: CharacterData; patchCharacter: PatchCharacter }) {
  const [selectedId, setSelectedId] = useState("");
  const catalogById = useMemo(() => new Map(catalog.map((feat) => [feat.id, feat])), [catalog]);
  const available = catalog.filter((feat) => !character.feats.some((item) => item.id === feat.id));
  const visibleFeats = character.feats.map((feat) => catalogById.get(feat.id) ?? feat);

  function addFeat() {
    const feat = catalog.find((item) => item.id === selectedId);
    if (!feat) return;
    patchCharacter({ feats: [...character.feats, feat] });
    setSelectedId("");
  }

  return (
    <section className="panel wide-panel tracker-panel">
      <div className="section-heading"><div><span className="eyebrow">Character choices</span><h2>Feats</h2></div><span className="count-chip">{character.feats.length}</span></div>
      <div className="catalog-add-row"><DescriptionPicker ariaLabel="Available feats" value={selectedId} placeholder="Choose an available feat" onChange={setSelectedId} options={available.map((feat) => ({ value: feat.id, label: feat.name, meta: [feat.category, feat.prerequisite].filter(Boolean).join(" · "), description: feat.description }))} /><button className="button button-primary" disabled={!selectedId} onClick={addFeat}><Plus size={15} />Add feat</button></div>
      <div className="tracker-card-list">
        {visibleFeats.map((feat) => <article key={feat.id}><div><span>{feat.category}</span><h3>{feat.name}</h3>{feat.prerequisite && <small>{feat.prerequisite}</small>}<p>{feat.description}</p></div><button className="icon-button danger" aria-label={`Remove ${feat.name}`} onClick={() => patchCharacter({ feats: character.feats.filter((item) => item.id !== feat.id) })}><Trash2 size={14} /></button></article>)}
        {!character.feats.length && <div className="empty-state compact">No feats selected yet.</div>}
      </div>
    </section>
  );
}

export function SpellbookManager({ catalog, character, patchCharacter, spellcastingAbility }: { catalog: SpellDefinition[]; character: CharacterData; patchCharacter: PatchCharacter; spellcastingAbility: AbilityKey | null }) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [lastCast, setLastCast] = useState("");
  const [castLevels, setCastLevels] = useState<Record<string, number>>({});
  const [spellRollResult, setSpellRollResult] = useState("");
  const catalogById = useMemo(() => new Map(catalog.map((spell) => [spell.id, spell])), [catalog]);
  const classCatalog = useMemo(() => catalog.filter((spell) => showAll || spell.classes.some((name) => name.toLowerCase() === character.className.toLowerCase())), [catalog, showAll, character.className]);
  const available = classCatalog
    .filter((spell) => !character.spells.some((known) => known.id === spell.id))
    .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const visibleSpells = character.spells
    .map((spell) => {
      const currentDefinition = catalogById.get(spell.id);
      return currentDefinition ? { ...spell, ...currentDefinition, prepared: spell.prepared } : spell;
    })
    .filter((spell) => spell.name.toLowerCase().includes(query.toLowerCase()));
  const concentratingSpell = character.concentratingSpellId
    ? character.spells.find((spell) => spell.id === character.concentratingSpellId)
    : undefined;
  const spellcastingModifier = spellcastingAbility ? abilityModifier(character.abilities[spellcastingAbility]) : null;
  const spellAttackBonus = spellcastingModifier === null ? null : spellcastingModifier + character.proficiencyBonus;
  const spellSaveDc = spellAttackBonus === null ? null : 8 + spellAttackBonus;
  const preparedLimit = preparedSpellLimitFor(character.className, character.subclassName ?? "", character.level);
  const preparedCount = character.spells.filter((spell) => spell.level > 0 && spell.prepared).length;

  function addSpell() {
    const spell = catalog.find((item) => item.id === selectedId);
    if (!spell) return;
    patchCharacter({ spells: [...character.spells, { ...spell, prepared: spell.level === 0 }] });
    setSelectedId("");
  }

  function updateSlot(level: number, patch: Partial<SpellSlotState>) {
    const current = character.spellSlots[String(level)] ?? { maximum: 0, used: 0 };
    const maximum = clamp(patch.maximum ?? current.maximum, 0, 20);
    const used = clamp(patch.used ?? current.used, 0, maximum);
    patchCharacter({ spellSlots: { ...character.spellSlots, [String(level)]: { maximum, used } } });
  }

  function availableSlotLevels(spell: SpellDefinition) {
    if (spell.level === 0) return [];
    return Array.from({ length: 10 - spell.level }, (_, index) => spell.level + index).filter((level) => {
      const slot = character.spellSlots[String(level)] ?? { maximum: 0, used: 0 };
      return slot.used < slot.maximum;
    });
  }

  function castSpell(spell: SpellDefinition, asRitual = false, selectedLevel?: number) {
    const availableLevels = availableSlotLevels(spell);
    const requestedLevel = selectedLevel && availableLevels.includes(selectedLevel) ? selectedLevel : availableLevels[0];
    const slotLevel = asRitual || spell.level === 0 ? 0 : requestedLevel ?? null;
    if (slotLevel === null) return;
    const spellSlots = slotLevel > 0
      ? {
          ...character.spellSlots,
          [String(slotLevel)]: {
            ...(character.spellSlots[String(slotLevel)] ?? { maximum: 0, used: 0 }),
            used: (character.spellSlots[String(slotLevel)]?.used ?? 0) + 1,
          },
        }
      : character.spellSlots;
    const requiresConcentration = /(?:^C(?:,|\b)|concentration)/i.test(spell.duration);
    patchCharacter({
      spellSlots,
      ...(requiresConcentration ? { concentratingSpellId: spell.id } : {}),
    });
    setLastCast(asRitual
      ? `Cast ${spell.name} as a ritual (no slot used).`
      : slotLevel > 0
        ? `Cast ${spell.name} using a level ${slotLevel} slot.`
        : `Cast ${spell.name} (cantrip; no slot used).`);
  }

  function rollSpellEffect(spell: SpellDefinition) {
    const formula = extractDiceFormula(spell.description);
    if (!formula) return;
    const result = rollDiceFormula(formula);
    if (!result) return;
    setSpellRollResult(`${spell.name}: ${result.rolls.join(" + ")}${result.modifier ? ` ${result.modifier >= 0 ? "+" : "−"} ${Math.abs(result.modifier)}` : ""} = ${result.total}`);
  }

  return (
    <div className="living-tab-grid spellbook-layout">
      <section className="panel slot-panel">
        <div className="section-heading"><div><span className="eyebrow">Daily resources</span><h2>Spell slots</h2></div><button className="text-button" onClick={() => patchCharacter({ spellSlots: Object.fromEntries(Object.entries(character.spellSlots).map(([level, slot]) => [level, { ...slot, used: 0 }])) })}>Restore all</button></div>
        <div className="spellcasting-stats">
          <div><span>Ability</span><strong>{spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "—"}</strong></div>
          <div><span>Spell attack</span><strong>{spellAttackBonus === null ? "—" : `${spellAttackBonus >= 0 ? "+" : ""}${spellAttackBonus}`}</strong></div>
          <div><span>Save DC</span><strong>{spellSaveDc ?? "—"}</strong></div>
          <div><span>Prepared</span><strong>{preparedCount}{preparedLimit !== null ? ` / ${preparedLimit}` : ""}</strong></div>
        </div>
        {!spellcastingAbility && <p className="spellcasting-note">This class has no default spellcasting ability. Known spells can still be tracked and cast.</p>}
        <div className="slot-grid">{Array.from({ length: 9 }, (_, index) => index + 1).map((level) => { const slot = character.spellSlots[String(level)] ?? { maximum: 0, used: 0 }; return <div className="slot-row" key={level}><strong>{level}</strong><label>Max <input aria-label={`Level ${level} maximum spell slots`} type="number" min="0" max="20" value={slot.maximum} onChange={(event) => updateSlot(level, { maximum: Number(event.target.value) })} /></label><span>{slot.maximum - slot.used} left</span><button disabled={slot.used <= 0} onClick={() => updateSlot(level, { used: slot.used - 1 })}>−</button><button disabled={slot.used >= slot.maximum} onClick={() => updateSlot(level, { used: slot.used + 1 })}>Use</button></div>; })}</div>
      </section>

      <section className="panel spell-list-panel">
        <div className="section-heading"><div><span className="eyebrow">Known magic</span><h2>Spellbook</h2></div><span className="count-chip">{character.spells.length}</span></div>
        {concentratingSpell && <div className="concentration-banner"><Sparkles size={16} /><div><span>Concentrating</span><strong>{concentratingSpell.name}</strong></div><button onClick={() => patchCharacter({ concentratingSpellId: undefined })}>End</button></div>}
        {lastCast && <div className="cast-feedback" role="status">{lastCast}<button aria-label="Dismiss casting message" onClick={() => setLastCast("")}>×</button></div>}
        {spellRollResult && <div className="cast-feedback spell-roll-feedback" role="status">{spellRollResult}<button aria-label="Dismiss spell roll" onClick={() => setSpellRollResult("")}>×</button></div>}
        <div className="catalog-add-row spell-add"><DescriptionPicker ariaLabel="Available spells" value={selectedId} placeholder="Choose a spell" onChange={setSelectedId} options={available.map((spell) => ({ value: spell.id, label: spell.name, meta: `${spell.level ? `Level ${spell.level}` : "Cantrip"} · ${spell.school} · ${spell.classes.join(", ")}`, description: `${spell.castingTime} · ${spell.range} · ${spell.duration}\n\n${spell.description}` }))} /><button className="button button-primary" disabled={!selectedId} onClick={addSpell}><Plus size={15} />Learn</button><label className="inline-check"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />All classes</label></div>
        <label className="catalog-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search known spells" /></label>
        <div className="spell-card-list">{visibleSpells.map((spell) => {
          const slotLevels = availableSlotLevels(spell);
          const selectedCastLevel = castLevels[spell.id] && slotLevels.includes(castLevels[spell.id]) ? castLevels[spell.id] : slotLevels[0];
          const preparedToCast = spell.level === 0 || spell.prepared;
          const canCast = spell.level === 0 || (preparedToCast && selectedCastLevel !== undefined);
          const formula = extractDiceFormula(spell.description);
          const atPreparedLimit = preparedLimit !== null && preparedCount >= preparedLimit;
          return <article key={spell.id} className={spell.prepared ? "prepared" : ""}><div className="spell-card-top"><div><span>{spell.level ? `Level ${spell.level} ${spell.school}` : `${spell.school} cantrip`}</span><h3>{spell.name}</h3></div><label><input type="checkbox" checked={spell.prepared} disabled={!spell.prepared && spell.level > 0 && atPreparedLimit} onChange={(event) => patchCharacter({ spells: character.spells.map((item) => item.id === spell.id ? { ...item, prepared: event.target.checked } : item) })} />Prepared</label><button className="icon-button danger" aria-label={`Forget ${spell.name}`} onClick={() => patchCharacter({ spells: character.spells.filter((item) => item.id !== spell.id), ...(character.concentratingSpellId === spell.id ? { concentratingSpellId: undefined } : {}) })}><Trash2 size={14} /></button></div><div className="spell-meta"><span>{spell.castingTime}</span><span>{spell.range}</span><span>{spell.duration}</span>{spell.components && <span>{spell.components}</span>}{spell.ritual && <span>Ritual</span>}</div><p>{spell.description}</p><div className="spell-card-actions">{spell.level > 0 && slotLevels.length > 0 && <select aria-label={`${spell.name} casting level`} value={selectedCastLevel} onChange={(event) => setCastLevels((current) => ({ ...current, [spell.id]: Number(event.target.value) }))}>{slotLevels.map((level) => <option key={level} value={level}>Level {level}{level > spell.level ? " (upcast)" : ""}</option>)}</select>}<button className="button button-primary" disabled={!canCast} onClick={() => castSpell(spell, false, selectedCastLevel)}>{!preparedToCast ? "Not prepared" : canCast ? spell.level === 0 ? "Cast cantrip" : "Cast" : "No slot available"}</button>{spell.ritual && <button className="button button-outline" onClick={() => castSpell(spell, true)}>Cast ritual</button>}{formula && <button className="button button-outline" onClick={() => rollSpellEffect(spell)}>Roll {formula}</button>}</div></article>;
        })}</div>
        {!visibleSpells.length && <div className="empty-state compact">No spells here yet. Learn one from the imported content library.</div>}
      </section>
    </div>
  );
}

export function InventoryManager({ catalog, character, patchCharacter }: { catalog: EquipmentDefinition[]; character: CharacterData; patchCharacter: PatchCharacter }) {
  const [selectedId, setSelectedId] = useState("");
  const [customName, setCustomName] = useState("");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const catalogById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const visibleInventory = character.inventory.map((item) => {
    const definition = item.contentId ? catalogById.get(item.contentId) : undefined;
    const hasGeneratedNotes = /consult the linked source|Reference entry/i.test(item.notes);
    const rulesDescription = definition ? equipmentDescription(definition) : "";
    const notesContainImportedDescription = Boolean(definition) && (item.notes === definition?.description || item.notes === rulesDescription);
    return definition
      ? {
          ...item,
          name: definition.name,
          category: definition.category,
          cost: definition.cost,
          weight: definition.weight,
          notes: hasGeneratedNotes || notesContainImportedDescription ? "" : item.notes,
          rulesDescription,
        }
      : { ...item, rulesDescription: "" };
  });
  const encumbrance = calculateEncumbrance(visibleInventory, character.abilities.strength);
  const { totalWeight, unlistedWeightItems, strength, encumberedAt, heavilyEncumberedAt, carryingCapacity, loadPercent } = encumbrance;
  const effectiveArmor = calculateArmorClass({ ...character, inventory: visibleInventory }, catalog);
  const effectiveSpeed = calculateEffectiveSpeed(character, encumbrance, catalog);
  const attunedCount = visibleInventory.filter((item) => item.attuned).length;

  function addCatalogItem() {
    const definition = catalog.find((item) => item.id === selectedId);
    if (!definition) return;
    const existing = character.inventory.find((item) => item.contentId === definition.id);
    if (existing) {
      patchCharacter({ inventory: character.inventory.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item) });
    } else {
      const itemId = crypto.randomUUID();
      patchCharacter({ inventory: [...character.inventory, { id: itemId, contentId: definition.id, name: definition.name, category: definition.category, quantity: 1, equipped: false, notes: "", weight: definition.weight, cost: definition.cost }] });
      setExpandedIds((current) => [...current, itemId]);
    }
    setSelectedId("");
  }

  function addCustomItem() {
    const name = customName.trim();
    if (!name) return;
    const item: InventoryItem = { id: crypto.randomUUID(), name, category: "Custom", quantity: 1, equipped: false, notes: "" };
    patchCharacter({ inventory: [...character.inventory, item] });
    setExpandedIds((current) => [...current, item.id]);
    setCustomName("");
  }

  function updateItem(id: string, patch: Partial<InventoryItem>) {
    patchCharacter({ inventory: character.inventory.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (next.maximumCharges !== undefined) next.maximumCharges = Math.max(0, Number(next.maximumCharges) || 0);
      if (next.charges !== undefined) next.charges = Math.max(0, Math.min(next.maximumCharges ?? next.charges, Number(next.charges) || 0));
      if (next.ammunition !== undefined) next.ammunition = Math.max(0, Number(next.ammunition) || 0);
      return next;
    }) });
  }

  function setAttuned(item: InventoryItem, attuned: boolean) {
    if (attuned && attunedCount >= 3) return;
    updateItem(item.id, { attuned });
  }

  function useConsumable(item: InventoryItem) {
    if (item.quantity <= 0) return;
    if (item.quantity === 1) {
      patchCharacter({ inventory: character.inventory.filter((value) => value.id !== item.id) });
    } else {
      updateItem(item.id, { quantity: item.quantity - 1 });
    }
  }

  function setEquipped(item: InventoryItem, equipped: boolean) {
    const definition = item.contentId ? catalogById.get(item.contentId) : undefined;
    let attacks = character.attacks;
    if (definition?.damage) {
      if (equipped && !attacks.some((attack) => attack.contentId === definition.id)) {
        attacks = [...attacks, attackFromEquipment(definition)];
      } else if (!equipped) {
        attacks = attacks.filter((attack) => attack.contentId !== definition.id);
      }
    }
    patchCharacter({
      inventory: character.inventory.map((inventoryItem) => inventoryItem.id === item.id ? { ...inventoryItem, equipped } : inventoryItem),
      attacks,
    });
  }

  function toggleItem(id: string) {
    setExpandedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  return (
    <div className="living-tab-grid inventory-layout">
      <section className="panel currency-panel">
        <div className="section-heading"><div><span className="eyebrow">Carried wealth</span><h2>Currency & load</h2></div></div>
        <div className="currency-grid">{(["gold", "silver", "copper"] as const).map((coin) => <label key={coin}><span>{coin}</span><input type="number" min="0" value={character.currency[coin]} onChange={(event) => patchCharacter({ currency: { ...character.currency, [coin]: Math.max(0, Number(event.target.value)) } })} /></label>)}</div>
        <div className="carry-summary"><strong>{character.inventory.reduce((total, item) => total + item.quantity, 0)}</strong><span>items carried</span><strong>{strength}</strong><span>Strength score</span></div>
        <div className={`attunement-summary ${attunedCount >= 3 ? "full" : ""}`}><span>Attunement</span><strong>{attunedCount} / 3</strong></div>
        <div className="equipment-derived-stats">
          <div><span>Armor Class</span><strong>{effectiveArmor.value}</strong><small>{effectiveArmor.source}</small></div>
          <div><span>Effective speed</span><strong>{effectiveSpeed.value} ft.</strong><small>{effectiveSpeed.effects.length ? effectiveSpeed.effects.join(" · ") : "No movement penalties"}</small></div>
        </div>
        <div className={`encumbrance-summary ${encumbrance.level}`}>
          <div className="encumbrance-heading">
            <div><span>Listed weight</span><strong>{formatPounds(totalWeight)} <small>/ {formatPounds(carryingCapacity)} lb.</small></strong></div>
            <b>{encumbrance.label}</b>
          </div>
          <div className="encumbrance-meter" role="progressbar" aria-label={`Carried weight: ${formatPounds(totalWeight)} of ${formatPounds(carryingCapacity)} pounds`} aria-valuemin={0} aria-valuemax={carryingCapacity} aria-valuenow={Math.min(totalWeight, carryingCapacity)}>
            <span style={{ width: `${loadPercent}%` }} />
            <i className="encumbered-marker" aria-hidden="true" />
            <i className="heavily-encumbered-marker" aria-hidden="true" />
          </div>
          <div className="encumbrance-thresholds"><span>{formatPounds(encumberedAt)} lb. encumbered</span><span>{formatPounds(heavilyEncumberedAt)} lb. heavy</span></div>
          <div className="encumbrance-penalty">{encumbrance.level !== "unencumbered" && <AlertTriangle size={15} />}<div><strong>Current penalties</strong><p>{encumbrance.penalty}</p></div></div>
          {unlistedWeightItems > 0 && <p className="unlisted-weight-warning">{unlistedWeightItems} carried {unlistedWeightItems === 1 ? "item has" : "items have"} no numeric listed weight and {unlistedWeightItems === 1 ? "is" : "are"} not included.</p>}
        </div>
      </section>

      <section className="panel inventory-panel">
        <div className="section-heading"><div><span className="eyebrow">Possessions</span><h2>Equipment & inventory</h2></div><span className="count-chip">{character.inventory.length}</span></div>
        <div className="catalog-add-row"><DescriptionPicker ariaLabel="Available equipment" value={selectedId} placeholder="Choose imported equipment" onChange={setSelectedId} options={catalog.map((item) => ({ value: item.id, label: item.name, meta: [item.category, item.cost, item.weight].filter(Boolean).join(" · "), description: equipmentDescription(item) }))} /><button className="button button-primary" disabled={!selectedId} onClick={addCatalogItem}><Plus size={15} />Add</button></div>
        <div className="custom-item-row"><input value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addCustomItem(); }} placeholder="Add a custom item" /><button onClick={addCustomItem}><Plus size={15} /></button></div>
        <div className="inventory-list">
          {visibleInventory.map((item) => {
            const expanded = expandedIds.includes(item.id);
            const preview = item.rulesDescription || item.notes || "No description or notes yet.";
            return (
              <article key={item.id} className={`${item.equipped ? "equipped " : ""}${expanded ? "expanded" : ""}`}>
                <label className="equip-check"><input type="checkbox" checked={item.equipped} onChange={(event) => setEquipped(item, event.target.checked)} /><span>Equipped</span></label>
                <div className="inventory-name"><h3>{item.name}</h3><span>{item.category}{item.cost ? ` · ${item.cost}` : ""}{item.weight ? ` · ${item.weight}` : ""}{item.container ? ` · in ${item.container}` : ""}</span><div className="inventory-status-chips">{item.attuned && <b>Attuned</b>}{item.ammunition !== undefined && <b>{item.ammunition} ammo</b>}{item.maximumCharges !== undefined && <b>{item.charges ?? 0}/{item.maximumCharges} charges</b>}{item.consumable && <b>Consumable</b>}</div><p className="inventory-description-preview">{preview}</p></div>
                <label className="quantity-field">Qty <input aria-label={`${item.name} quantity`} type="number" min="0" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Math.max(0, Number(event.target.value)) })} /></label>
                <button className="inventory-expand" aria-label={`${expanded ? "Hide" : "Show"} details for ${item.name}`} aria-expanded={expanded} onClick={() => toggleItem(item.id)}><span>{expanded ? "Hide" : "Details"}</span><ChevronDown size={15} /></button>
                <button className="icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => patchCharacter({ inventory: character.inventory.filter((value) => value.id !== item.id), attacks: item.contentId ? character.attacks.filter((attack) => attack.contentId !== item.contentId) : character.attacks })}><Trash2 size={14} /></button>
                {expanded && <div className={`inventory-details ${item.rulesDescription ? "" : "notes-only"}`}>
                  {item.rulesDescription && <div className="inventory-rules"><span>Rules description</span><p>{item.rulesDescription}</p></div>}
                  <div className="inventory-detail-fields">
                    {!item.contentId && <label><span>Listed weight</span><input aria-label={`${item.name} listed weight`} value={item.weight ?? ""} onChange={(event) => updateItem(item.id, { weight: event.target.value })} placeholder="For example, 5 lb." /></label>}
                    <div className="equipment-usage-grid">
                      <label><span>Container</span><input aria-label={`${item.name} container`} value={item.container ?? ""} onChange={(event) => updateItem(item.id, { container: event.target.value })} placeholder="Backpack, pouch…" /></label>
                      <label><span>Ammunition</span><input aria-label={`${item.name} ammunition`} type="number" min="0" value={item.ammunition ?? ""} onChange={(event) => updateItem(item.id, { ammunition: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Not tracked" /></label>
                      <label><span>Charges</span><input aria-label={`${item.name} charges`} type="number" min="0" value={item.charges ?? ""} onChange={(event) => updateItem(item.id, { charges: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Current" /></label>
                      <label><span>Maximum</span><input aria-label={`${item.name} maximum charges`} type="number" min="0" value={item.maximumCharges ?? ""} onChange={(event) => updateItem(item.id, { maximumCharges: event.target.value === "" ? undefined : Number(event.target.value) })} placeholder="Maximum" /></label>
                    </div>
                    <div className="equipment-usage-actions"><label><input type="checkbox" checked={Boolean(item.attuned)} disabled={!item.attuned && attunedCount >= 3} onChange={(event) => setAttuned(item, event.target.checked)} />Attuned</label><label><input type="checkbox" checked={Boolean(item.consumable)} onChange={(event) => updateItem(item.id, { consumable: event.target.checked })} />Consumable</label>{item.maximumCharges !== undefined && <button disabled={(item.charges ?? 0) <= 0} onClick={() => updateItem(item.id, { charges: (item.charges ?? 0) - 1 })}>Use charge</button>}{item.consumable && <button disabled={item.quantity <= 0} onClick={() => useConsumable(item)}>Use item</button>}</div>
                    <label><span>Notes</span><textarea aria-label={`${item.name} notes`} value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Add personal notes, charges, or other details" rows={4} /></label>
                  </div>
                </div>}
              </article>
            );
          })}
        </div>
        {!character.inventory.length && <div className="empty-state compact">Your inventory is empty.</div>}
      </section>
    </div>
  );
}
