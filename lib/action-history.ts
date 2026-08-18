import type { CharacterData, RecentActionUse } from "./types";
import type { GeneratedAction } from "./character-rules";

export const MAX_FAVORITE_ACTIONS = 24;
export const MAX_RECENT_ACTIONS = 8;

export function toggleFavoriteAction(favoriteActionIds: string[], actionId: string) {
  if (favoriteActionIds.includes(actionId)) return favoriteActionIds.filter((id) => id !== actionId);
  return [...favoriteActionIds, actionId].slice(-MAX_FAVORITE_ACTIONS);
}

export function favoriteActionsFirst<T extends { id: string }>(actions: T[], favoriteActionIds: string[]) {
  const favoriteOrder = new Map(favoriteActionIds.map((id, index) => [id, index]));
  return [...actions].sort((left, right) => {
    const leftOrder = favoriteOrder.get(left.id);
    const rightOrder = favoriteOrder.get(right.id);
    if (leftOrder === undefined && rightOrder === undefined) return 0;
    if (leftOrder === undefined) return 1;
    if (rightOrder === undefined) return -1;
    return leftOrder - rightOrder;
  });
}

export function recordRecentAction(character: Pick<CharacterData, "recentActions">, action: GeneratedAction, result: string, usedAt = new Date().toISOString()): RecentActionUse[] {
  const entry: RecentActionUse = { actionId: action.id, name: action.name, source: action.source, timing: action.timing, result, usedAt };
  return [entry, ...character.recentActions.filter((recent) => recent.actionId !== action.id)].slice(0, MAX_RECENT_ACTIONS);
}
