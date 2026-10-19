import type { ShoppingAmount, ShoppingItemSource } from "@/lib/api/contracts";
import { roundQuantity } from "./scaling";

/** Normalized ingredient name: the ingredient master's unique key (spaces and case only; "마늘" ≠ "다진 마늘"). */
export function normalizeIngredientName(name: string): string {
  return name.trim().replace(/\s+/g, "").toLowerCase();
}

/** Units that can be converted safely. Anything else is merged only with the exact same unit. */
const UNIT_FAMILIES: Record<string, { base: string; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

function unitKey(unit: string | null): { key: string; factor: number; display: string | null } {
  if (unit === null) return { key: "", factor: 1, display: null };
  const lower = unit.trim().toLowerCase();
  const family = UNIT_FAMILIES[lower];
  if (family) return { key: family.base, factor: family.factor, display: family.base };
  return { key: unit.trim(), factor: 1, display: unit.trim() };
}

/**
 * Merge source usages into display amounts.
 * Only compatible units are summed; unknown quantities are kept as a separate "미확인" amount
 * and are never folded into a numeric total.
 */
export function mergeAmounts(sources: Pick<ShoppingItemSource, "quantity" | "unit">[]): ShoppingAmount[] {
  const known = new Map<string, { quantity: number; unit: string | null }>();
  const unknownUnits = new Map<string, string | null>();

  for (const source of sources) {
    const { key, factor, display } = unitKey(source.unit);
    if (source.quantity === null) {
      unknownUnits.set(key, display);
      continue;
    }
    const current = known.get(key);
    const value = source.quantity * factor;
    known.set(key, { quantity: (current?.quantity ?? 0) + value, unit: display });
  }

  const amounts: ShoppingAmount[] = [];
  for (const { quantity, unit } of known.values()) {
    amounts.push(promoteUnit(roundQuantity(quantity), unit));
  }
  for (const unit of unknownUnits.values()) {
    amounts.push({ quantity: null, unit });
  }
  return amounts;
}

function promoteUnit(quantity: number, unit: string | null): ShoppingAmount {
  if (unit === "g" && quantity >= 1000) return { quantity: roundQuantity(quantity / 1000), unit: "kg" };
  if (unit === "ml" && quantity >= 1000) return { quantity: roundQuantity(quantity / 1000), unit: "L" };
  return { quantity, unit };
}

export interface ShoppingSourceInput extends ShoppingItemSource {
  /** Purchase target ingredient master ID: the substitute's ID when one is applied. */
  targetIngredientId: string;
  /** Purchase target name: the substitute name when one is applied. */
  targetName: string;
}

export interface AggregatedItem {
  id: string;
  name: string;
  amounts: ShoppingAmount[];
  sources: ShoppingItemSource[];
}

/** Group usages by purchase target ingredient (master ID), preserving per-recipe sources. */
export function aggregateShoppingItems(inputs: ShoppingSourceInput[]): AggregatedItem[] {
  const groups = new Map<string, { name: string; sources: ShoppingItemSource[] }>();
  for (const { targetIngredientId: id, targetName, ...source } of inputs) {
    const group = groups.get(id) ?? { name: targetName.trim(), sources: [] };
    group.sources.push(source);
    groups.set(id, group);
  }
  return [...groups.entries()].map(([id, group]) => ({
    id,
    name: group.name,
    amounts: mergeAmounts(group.sources),
    sources: group.sources,
  }));
}

/**
 * Keep the user's checked state for items that are still needed;
 * new items start unchecked and removed items are dropped.
 */
export function carryOverChecked(previous: ReadonlySet<string>, nextIds: string[]): Set<string> {
  return new Set(nextIds.filter((id) => previous.has(id)));
}
