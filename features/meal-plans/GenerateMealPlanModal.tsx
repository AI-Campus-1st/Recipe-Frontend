"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { TextArea } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { Stepper, Toggle } from "@/components/ToggleStepper";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import type { GenerateMealPlanResponse, ISODate } from "@/lib/api/contracts";
import { defaultCookMinutes, DEFAULT_SERVINGS, formatDateWithWeekday, todayISO, weekDates } from "@/lib/date";
import { useGenerateMealPlan } from "./hooks";

interface GenerateMealPlanModalProps {
  open: boolean;
  onClose: () => void;
  weekStart: ISODate;
  /** Dates that already have a meal. */
  plannedDates: ISODate[];
  /** Pre-select only these dates (e.g. `식단 생성` from an empty day). */
  initialDates?: ISODate[];
}

interface DaySetting {
  enabled: boolean;
  servings: number;
}

function initialSettings(weekStart: ISODate, plannedDates: ISODate[], initialDates?: ISODate[]): Record<ISODate, DaySetting> {
  const today = todayISO();
  return Object.fromEntries(
    weekDates(weekStart).map((date) => [
      date,
      {
        enabled: initialDates ? initialDates.includes(date) : !plannedDates.includes(date) && date >= today,
        servings: DEFAULT_SERVINGS,
      },
    ]),
  );
}

export function summarizeGeneration({ results }: GenerateMealPlanResponse) {
  const success = results.filter((r) => r.status === "success").length;
  const failed = results.length - success;
  if (failed === 0) return { type: "success" as const, message: `${success}일 식단을 생성했어요.` };
  if (success === 0) {
    const reason = results.find((r) => r.reason)?.reason ?? "";
    return { type: "error" as const, message: `식단을 생성하지 못했어요. ${reason} 기존 식단은 그대로 유지돼요.` };
  }
  return {
    type: "info" as const,
    message: `${success}일 생성, ${failed}일은 조건에 맞는 레시피가 없어 미배정으로 남았어요.`,
  };
}

export function GenerateMealPlanModal(props: GenerateMealPlanModalProps) {
  // Remount on open so settings start from defaults each time.
  if (!props.open) return null;
  return <GenerateMealPlanModalBody {...props} />;
}

function GenerateMealPlanModalBody({ onClose, weekStart, plannedDates, initialDates }: GenerateMealPlanModalProps) {
  const toast = useToast();
  const generate = useGenerateMealPlan();
  const [settings, setSettings] = useState(() => initialSettings(weekStart, plannedDates, initialDates));
  const [comment, setComment] = useState("");

  const selectedDates = Object.entries(settings).filter(([, s]) => s.enabled);
  const noneSelected = selectedDates.length === 0;

  const update = (date: ISODate, patch: Partial<DaySetting>) =>
    setSettings((current) => ({ ...current, [date]: { ...current[date], ...patch } }));

  const submit = () => {
    if (noneSelected) return;
    generate.mutate(
      {
        days: selectedDates.map(([date, s]) => ({ date, servings: s.servings, cookMinutes: defaultCookMinutes(date) })),
        comment: comment.trim() || undefined,
      },
      {
        onSuccess: (response) => {
          toast.show(summarizeGeneration(response));
          onClose();
        },
        onError: (err) =>
          // Keep the modal and settings so the user can retry; existing meals are untouched.
          toast.show({ type: "error", message: `식단을 생성하지 못했어요. 기존 식단은 유지돼요. ${errorMessage(err)}` }),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="주간 식단 생성"
      description="생성할 날짜와 각 날짜의 인분을 설정하세요. 저장한 레시피 중에서만 추천해요."
      busy={generate.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={generate.isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={noneSelected} loading={generate.isPending}>
            식단 생성
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-hairline rounded-md border border-hairline" aria-label="요일별 설정">
        {Object.entries(settings).map(([date, setting]) => {
          const label = formatDateWithWeekday(date);
          const hasMeal = plannedDates.includes(date);
          return (
            <li key={date} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <div className="min-w-0 flex-1">
                <p className={cn("text-body-md", setting.enabled ? "text-ink" : "text-muted")}>{label}</p>
                <p className="text-caption text-muted">
                  조리 {defaultCookMinutes(date)}분{hasMeal ? " · 재생성" : ""}
                </p>
              </div>
              <Stepper
                label={`${label} 인분`}
                value={setting.servings}
                onChange={(servings) => update(date, { servings })}
                disabled={!setting.enabled}
              />
              <Toggle label={`${label} 요리 여부`} checked={setting.enabled} onChange={(enabled) => update(date, { enabled })} />
            </li>
          );
        })}
      </ul>
      {noneSelected && (
        <p role="alert" className="mt-3 text-body-md text-warning">
          요리할 날짜를 하나 이상 선택해 주세요.
        </p>
      )}
      <div className="mt-4">
        <TextArea
          label="요청사항"
          placeholder="예: 국물 요리 위주로, 간단한 메뉴로"
          hint="비워 두면 날짜 설정에 맞는 저장 레시피를 추천해요."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={200}
        />
      </div>
    </Modal>
  );
}
