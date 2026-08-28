import { useState } from "react";
import { Activity, Dices, EyeOff, Trash2 } from "lucide-react";
import { resolvedRollMode, rollD20, rollDiceFormula, type RollMode } from "../lib/character-rules";
import type { LocalRollEvent } from "../lib/live-sync";
import type { SharedRollEvent } from "../lib/types";
import { CollapsiblePanel } from "./collapsible-panel";

type Props = {
  rolls: SharedRollEvent[];
  onRoll: (roll: LocalRollEvent) => void;
  roller: "dm" | "player";
  storageKey: string;
  disabled?: boolean;
  sharingAvailable?: boolean;
  allowHidden?: boolean;
  onClearRolls?: () => Promise<void>;
  initiative?: InitiativeRollConfig;
};

export type InitiativeRollConfig = {
  modifier: number;
  forcedDisadvantage: boolean;
  detail: string;
};

function signed(value: number) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value)}`;
}

export function createInitiativeRoll(initiative: InitiativeRollConfig, selectedMode: RollMode) {
  const mode = resolvedRollMode(selectedMode, initiative.forcedDisadvantage);
  const { dice, kept } = rollD20(mode);
  const total = kept + initiative.modifier;
  return {
    result: `Initiative: ${dice.join(" / ")} ${signed(initiative.modifier)} = ${total}${mode !== "normal" ? ` · ${mode}` : ""}`,
    event: { category: "initiative", label: "Initiative", formula: "d20", dice, modifier: initiative.modifier, total, mode, detail: initiative.detail } satisfies LocalRollEvent,
  };
}

export function PartyRollWorkspace({ rolls, onRoll, roller, storageKey, disabled = false, sharingAvailable = true, allowHidden = false, onClearRolls, initiative }: Props) {
  const [diceFormula, setDiceFormula] = useState("1d20");
  const [diceModifier, setDiceModifier] = useState(0);
  const [diceLabel, setDiceLabel] = useState(roller === "dm" ? "DM roll" : "Dice roll");
  const [diceMode, setDiceMode] = useState<RollMode>("normal");
  const [diceResult, setDiceResult] = useState("");
  const [hideRoll, setHideRoll] = useState(false);

  function rollDice() {
    const formula = diceFormula.trim();
    const hidden = allowHidden && hideRoll;
    if (/^(?:1)?d20$/i.test(formula)) {
      const { dice, kept } = rollD20(diceMode);
      const total = kept + diceModifier;
      setDiceResult(`${dice.join(" / ")}${diceModifier ? ` ${diceModifier >= 0 ? "+" : "−"}${Math.abs(diceModifier)}` : ""} = ${total}`);
      onRoll({ category: "other", label: diceLabel.trim() || (roller === "dm" ? "DM roll" : "Dice roll"), formula: diceMode === "normal" ? "d20" : `2d20 ${diceMode === "advantage" ? "keep highest" : "keep lowest"}`, dice, modifier: diceModifier, total, mode: diceMode, detail: roller === "dm" ? "Rolled by the DM" : "Rolled from the Encounter workspace", hidden });
      return;
    }
    const result = rollDiceFormula(formula, false, diceModifier);
    if (!result) {
      setDiceResult("Use dice notation such as 2d6+3.");
      return;
    }
    setDiceResult(`${result.rolls.join(" + ")}${result.modifier ? ` ${result.modifier >= 0 ? "+" : "−"}${Math.abs(result.modifier)}` : ""} = ${result.total}`);
    onRoll({ category: "other", label: diceLabel.trim() || (roller === "dm" ? "DM roll" : "Dice roll"), formula, dice: result.rolls, modifier: result.modifier, total: result.total, mode: "normal", detail: roller === "dm" ? "Rolled by the DM" : "Rolled from the Encounter workspace", hidden });
  }

  function rollInitiative() {
    if (!initiative) return;
    const roll = createInitiativeRoll(initiative, diceMode);
    setDiceResult(roll.result);
    onRoll(roll.event);
  }

  async function clearRollFeed() {
    if (!onClearRolls || !rolls.length || !window.confirm("Clear every roll in this campaign's shared roll history? This cannot be undone.")) return;
    await onClearRolls();
    setDiceResult("");
  }

  return <CollapsiblePanel className="roll-feed party-roll-workspace" storageKey={storageKey} eyebrow="Last 30 days" title="Party rolls" summary={<span>{rolls.length} shared</span>}>
    {onClearRolls && <div className="roll-feed-heading-actions roll-feed-toolbar"><button type="button" disabled={!rolls.length} onClick={clearRollFeed}><Trash2 size={12} />Clear history</button></div>}
    <div className="dm-dice-roller"><div className="dm-dice-fields"><input aria-label={`${roller === "dm" ? "DM" : "Player"} roll label`} value={diceLabel} onChange={(event) => setDiceLabel(event.target.value)} placeholder="Roll label" /><input aria-label={`${roller === "dm" ? "DM" : "Player"} dice formula`} value={diceFormula} onChange={(event) => setDiceFormula(event.target.value)} placeholder="2d6+3" /><label><span>Modifier</span><input aria-label={`${roller === "dm" ? "DM" : "Player"} roll modifier`} type="number" value={diceModifier} onChange={(event) => setDiceModifier(Number(event.target.value))} /></label><button type="button" disabled={disabled} onClick={rollDice}><Dices size={13} />Roll</button></div>
      <div className="dm-dice-options"><div>{[4, 6, 8, 10, 12, 20].map((sides) => <button type="button" className={diceFormula.toLowerCase() === `1d${sides}` ? "active" : ""} onClick={() => setDiceFormula(`1d${sides}`)} key={sides}>d{sides}</button>)}{initiative && <button type="button" className="party-initiative-button" disabled={disabled} onClick={rollInitiative}><Dices size={11} />Initiative · {signed(initiative.modifier)}</button>}</div>{(/^(?:1)?d20$/i.test(diceFormula.trim()) || initiative) && <div className="roll-mode" aria-label={`${roller === "dm" ? "DM" : "Player"} d20 roll mode`}>{(["normal", "advantage", "disadvantage"] as RollMode[]).map((mode) => <button type="button" key={mode} className={diceMode === mode ? "active" : ""} onClick={() => setDiceMode(mode)}>{mode === "normal" ? "Normal" : mode === "advantage" ? "Adv" : "Dis"}</button>)}</div>}</div>
      {allowHidden && <label className="hidden-roll-toggle"><input type="checkbox" checked={hideRoll} onChange={(event) => setHideRoll(event.target.checked)} /><EyeOff size={13} /><span>Hide this roll from players</span></label>}
      {!sharingAvailable && <small className="roll-sharing-note">Not connected to a live campaign; rolls are shown here but are not shared.</small>}
      {diceResult && <div className="dm-dice-result" role="status"><Dices size={15} /><span>{diceResult}</span><button aria-label="Clear dice result" onClick={() => setDiceResult("")}>×</button></div>}
    </div>
    <div className="roll-feed-list">{rolls.map((roll) => <article className={roll.hidden ? "hidden-roll" : undefined} key={roll.id}><div><strong>{roll.actorName}</strong><span>{roll.label}{roll.hidden && <em><EyeOff size={10} />Hidden</em>}</span><time>{new Date(roll.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><div className="roll-feed-result"><b>{roll.total}</b><small>{roll.dice.join(" / ")}{roll.modifier ? ` ${roll.modifier >= 0 ? "+" : "−"}${Math.abs(roll.modifier)}` : ""}{roll.mode !== "normal" ? ` · ${roll.mode}` : ""}</small></div></article>)}</div>
    {!rolls.length && <div className="empty-state"><Activity size={24} /><p>{!sharingAvailable ? "Connect this character to a live campaign to share and receive party rolls." : "Party rolls will appear here as they happen."}</p></div>}
  </CollapsiblePanel>;
}
