"use client";

import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { ExternalLink } from "@/components/Link";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/cn";
import { buildCoupangSearchUrl } from "@/lib/coupang";
import type { ShoppingItem } from "@/lib/api/contracts";
import { formatQuantity, recipeTitle } from "@/lib/format";

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem, checked: boolean) => void;
  onManageSubstitute: (item: ShoppingItem) => void;
}

export function ShoppingItemRow({ item, onToggle, onManageSubstitute }: ShoppingItemRowProps) {
  const amount = item.amounts.map((a) => formatQuantity(a.quantity, a.unit)).join(" + ") || "필요량 미확인";
  const hasUnknown = item.amounts.some((a) => a.quantity === null);
  const originals = [...new Set(item.substituteFor.map((s) => s.originalName))];

  return (
    <li className={cn("rounded-md border border-hairline p-4", item.checked ? "bg-surface-soft" : "bg-canvas")}>
      <div className="flex items-start justify-between gap-3">
        <Checkbox
          checked={item.checked}
          onChange={(checked) => onToggle(item, checked)}
          label={
            <span className="flex flex-col">
              <span className={cn("text-body-lg font-semibold", item.checked ? "text-muted line-through" : "text-ink")}>
                {item.name}
              </span>
              <span className="sr-only">{item.checked ? "준비 완료" : "준비 전"}</span>
            </span>
          }
        />
        <span className={cn("pt-2.5 text-right text-body-md", hasUnknown ? "text-warning" : "text-body")}>{amount}</span>
      </div>

      {item.substituteFor.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-9 text-caption text-body">
          <StatusBadge tone="success">대체 적용</StatusBadge>
          <span>
            {originals.join(", ")} 대신 · {[...new Set(item.substituteFor.map((s) => recipeTitle(s.recipeTitle)))].join(", ")}
          </span>
        </div>
      )}

      {!item.checked && (
        <div className="mt-3 flex gap-2 pl-9 [&>*]:flex-1">
          {item.hasSubstituteCandidates && (
            <Button size="sm" variant="secondary" onClick={() => onManageSubstitute(item)}>
              대체 관리
            </Button>
          )}
          <ExternalLink href={buildCoupangSearchUrl(item.name)} variant="secondary" size="sm">
            쿠팡 검색
          </ExternalLink>
        </div>
      )}
    </li>
  );
}
