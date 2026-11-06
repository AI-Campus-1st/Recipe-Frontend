"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Modal, useModalPresence, type ModalPresenceProps } from "@/components/Modal";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import type { ISODate, ShoppingItem, SubstituteCandidate, SubstituteTarget } from "@/lib/api/contracts";
import { formatDateWithWeekday } from "@/lib/date";
import { formatQuantity, recipeTitle } from "@/lib/format";
import { useApplySubstitute, useSubstituteOptions } from "./hooks";

interface SubstituteModalProps {
  weekStart: ISODate;
  item: ShoppingItem | null;
  onClose: () => void;
}

const targetKey = (t: Pick<SubstituteTarget, "entryId" | "recipeId">) => `${t.entryId}:${t.recipeId}`;

export function SubstituteModal({ weekStart, item, onClose }: SubstituteModalProps) {
  const presence = useModalPresence(item);
  if (!presence.value) return null;
  return (
    <SubstituteModalBody
      key={presence.value.id}
      weekStart={weekStart}
      item={presence.value}
      onClose={onClose}
      open={presence.open}
      onExited={presence.onExited}
    />
  );
}

function SubstituteModalBody({
  weekStart,
  item,
  onClose,
  open,
  onExited,
}: { weekStart: ISODate; item: ShoppingItem; onClose: () => void } & ModalPresenceProps) {
  const toast = useToast();
  const options = useSubstituteOptions(weekStart, item.id);
  const apply = useApplySubstitute(weekStart);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [confirmedUncertain, setConfirmedUncertain] = useState(false);

  const targets = options.data?.targets ?? [];
  const target = targets.find((t) => targetKey(t) === selectedTarget) ?? targets[0];
  const candidate = target?.candidates.find((c) => c.id === candidateId) ?? null;
  const needsConfirm = !!candidate?.uncertain && !confirmedUncertain;

  const submit = () => {
    if (!target || !candidate || needsConfirm) return;
    apply.mutate(
      { itemId: item.id, entryId: target.entryId, recipeId: target.recipeId, candidateId: candidate.id, confirmedUncertain },
      {
        onSuccess: () => {
          toast.show({
            type: "success",
            message: `${recipeTitle(target.recipeTitle)}의 ${target.originalName}을(를) ${candidate.name}(으)로 바꿨어요.`,
          });
          onClose();
        },
        onError: (err) =>
          toast.show({ type: "error", message: `대체 재료를 적용하지 못했어요. 장보기 목록은 그대로예요. ${errorMessage(err)}` }),
      },
    );
  };

  return (
    <Modal
      open={open}
      onExited={onExited}
      onClose={onClose}
      title="대체 관리"
      description="선택한 날짜의 레시피에만 적용돼요. 같은 재료를 쓰는 다른 레시피의 필요량은 그대로 유지돼요."
      busy={apply.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={apply.isPending}>
            취소
          </Button>
          <Button onClick={submit} loading={apply.isPending} disabled={!candidate || needsConfirm}>
            이 메뉴에 적용
          </Button>
        </>
      }
    >
      {options.isPending ? (
        <LoadingState label="대체 후보를 찾는 중" />
      ) : options.isError ? (
        <ErrorState message={errorMessage(options.error)} onRetry={() => options.refetch()} retrying={options.isFetching} />
      ) : targets.length === 0 ? (
        <p className="py-6 text-center text-body-md text-muted">적용할 수 있는 대체 후보가 없어요.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {targets.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-label text-ink">적용할 메뉴</legend>
              <div className="flex flex-col gap-2">
                {targets.map((t) => (
                  <label
                    key={targetKey(t)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 text-body-md",
                      target && targetKey(t) === targetKey(target) ? "border-secondary bg-primary-soft" : "border-hairline",
                    )}
                  >
                    <input
                      type="radio"
                      name="substitute-target"
                      className="size-4 accent-[var(--color-secondary)]"
                      checked={!!target && targetKey(t) === targetKey(target)}
                      onChange={() => {
                        setSelectedTarget(targetKey(t));
                        setCandidateId(null);
                        setConfirmedUncertain(false);
                      }}
                    />
                    <span>
                      {formatDateWithWeekday(t.date)} · {recipeTitle(t.recipeTitle)}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {target && (
            <fieldset>
              <legend className="mb-2 text-label text-ink">
                {targets.length === 1 && `${formatDateWithWeekday(target.date)} · ${recipeTitle(target.recipeTitle)}의 `}
                {target.originalName} 대체 후보
              </legend>
              <div className="flex flex-col gap-2">
                {target.candidates.map((c) => (
                  <CandidateOption
                    key={c.id}
                    candidate={c}
                    selected={candidateId === c.id}
                    onSelect={() => {
                      setCandidateId(c.id);
                      setConfirmedUncertain(false);
                    }}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {candidate?.uncertain && (
            <div className="rounded-sm bg-surface-soft p-3">
              <Checkbox
                checked={confirmedUncertain}
                onChange={setConfirmedUncertain}
                label={<span className="text-body-md text-ink">필요량을 확정할 수 없어요. 직접 확인하고 준비할게요.</span>}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CandidateOption({ candidate, selected, onSelect }: { candidate: SubstituteCandidate; selected: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-md border p-3",
        selected ? "border-secondary bg-primary-soft" : "border-hairline bg-canvas",
      )}
    >
      <input
        type="radio"
        name="substitute-candidate"
        className="mt-1 size-4 shrink-0 accent-[var(--color-secondary)]"
        checked={selected}
        onChange={onSelect}
      />
      <span className="flex min-w-0 flex-col gap-1 text-body-md">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{candidate.name}</span>
          <span className={candidate.quantity === null ? "text-warning" : "text-body"}>
            {formatQuantity(candidate.quantity, candidate.unit)}
          </span>
          {candidate.uncertain && <StatusBadge tone="warning">확인 필요</StatusBadge>}
        </span>
        {candidate.ratio && <span className="text-caption text-muted">비율 {candidate.ratio}</span>}
        <span className="text-body">맛 차이: {candidate.tasteDifference}</span>
        <span className="text-body">조리 변경: {candidate.cookingChange ?? "없음"}</span>
        {candidate.caution && <span className="text-warning">주의: {candidate.caution}</span>}
      </span>
    </label>
  );
}
