"use client";

import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Modal, useModalPresence, type ModalPresenceProps } from "@/components/Modal";
import { RecipeCard } from "@/components/RecipeCard";
import { useToast } from "@/components/Toast";
import { Stepper } from "@/components/ToggleStepper";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import type { ISODate, MealPlanEntry, RecipeSummary } from "@/lib/api/contracts";
import { DEFAULT_SERVINGS, formatDateWithWeekday, startOfWeek, todayISO, upcomingDates } from "@/lib/date";
import { formatMinutes, recipeTitle } from "@/lib/format";
import { useLinkedSides, useSetDayMeal, useWeeklyPlan } from "./hooks";
import { RecipePickerModal } from "./RecipePickerModal";

/** How the modal was opened: `하루 식단 생성` (date chosen in the modal) or a day card (`직접 생성` / `수정`, date fixed). */
export type DayMealTarget = { mode: "choose" } | { mode: "fixed"; date: ISODate; entry?: MealPlanEntry };

interface DayMealModalProps {
  target: DayMealTarget | null;
  onClose: () => void;
}

export function DayMealModal({ target, onClose }: DayMealModalProps) {
  const presence = useModalPresence(target);
  if (!presence.value) return null;
  return <DayMealModalBody target={presence.value} onClose={onClose} open={presence.open} onExited={presence.onExited} />;
}

const MAX_SERVINGS = 20;

const toSummary = (recipe: RecipeSummary): RecipeSummary => ({
  id: recipe.id,
  title: recipe.title,
  imageUrl: recipe.imageUrl,
  cookMinutes: recipe.cookMinutes,
});

function DayMealModalBody({ target, onClose, open, onExited }: { target: DayMealTarget; onClose: () => void } & ModalPresenceProps) {
  const dates = upcomingDates(7);
  // Today ~ +6 days can span two weeks.
  const firstWeek = useWeeklyPlan(startOfWeek(dates[0]));
  const lastWeek = useWeeklyPlan(startOfWeek(dates[dates.length - 1]));
  const [chosenDate, setChosenDate] = useState<ISODate | null>(null);

  const date = target.mode === "fixed" ? target.date : chosenDate;
  const plannedEntries = [...(firstWeek.data?.entries ?? []), ...(lastWeek.data?.entries ?? [])];
  const entry = target.mode === "fixed" ? target.entry : plannedEntries.find((e) => e.date === date);
  const weeksLoading = target.mode === "choose" && (firstWeek.isPending || lastWeek.isPending);

  const datePicker =
    target.mode === "fixed" ? (
      <p className="text-body-lg font-semibold text-ink">{formatDateWithWeekday(target.date)}</p>
    ) : (
      <div role="group" aria-label="날짜 선택" className="flex flex-wrap gap-2">
        {dates.map((value) => {
          const planned = plannedEntries.find((e) => e.date === value);
          const completed = !!planned?.completedAt;
          const pressed = value === chosenDate;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              disabled={weeksLoading || completed}
              onClick={() => setChosenDate(value)}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center rounded-md border px-3 py-1 text-label disabled:cursor-not-allowed disabled:opacity-50",
                pressed ? "border-secondary bg-primary-soft text-ink" : "border-hairline bg-canvas text-body",
              )}
            >
              <span>{formatDateWithWeekday(value)}</span>
              {(value === todayISO() || planned) && (
                <span className="text-caption text-muted">
                  {[value === todayISO() && "오늘", completed ? "요리 완료" : planned && "식단 있음"].filter(Boolean).join(" · ")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );

  return <DayMealForm date={date} entry={entry} datePicker={datePicker} onClose={onClose} open={open} onExited={onExited} />;
}

interface DayMealFormProps extends ModalPresenceProps {
  date: ISODate | null;
  entry: MealPlanEntry | undefined;
  datePicker: ReactNode;
  onClose: () => void;
}

interface FormValues {
  main: RecipeSummary | null;
  /** Sides added from the picker (or saved on the meal being edited). */
  added: RecipeSummary[];
  /** Check state the user changed; everything else uses the default. */
  overrides: Record<string, boolean>;
  /** While editing with the saved main recipe, linked sides start checked only if they were saved. */
  savedSideIds: Set<string> | null;
  servings: number;
}

function initialValues(entry: MealPlanEntry | undefined): FormValues {
  return {
    main: entry ? entry.mainRecipe : null,
    added: entry ? entry.sideRecipes : [],
    overrides: {},
    savedSideIds: entry ? new Set(entry.sideRecipes.map((s) => s.id)) : null,
    servings: entry?.servings ?? DEFAULT_SERVINGS,
  };
}

function DayMealForm({ date, entry, datePicker, onClose, open, onExited }: DayMealFormProps) {
  const toast = useToast();
  const save = useSetDayMeal();
  const [values, setValues] = useState(() => initialValues(entry));
  // Choosing a date that has a meal refills the form from it; switching between empty dates keeps the picks.
  const formFor = entry?.id ?? "new";
  const [valuesFor, setValuesFor] = useState(formFor);
  // Frozen while closing, so refetched data after saving doesn't flip the form during the slide-out.
  if (open && valuesFor !== formFor) {
    setValuesFor(formFor);
    setValues(initialValues(entry));
  }
  const { main, added, overrides, savedSideIds, servings } = values;
  const update = (patch: Partial<FormValues>) => setValues((current) => ({ ...current, ...patch }));
  const [picker, setPicker] = useState<"main" | "side" | null>(null);
  // Keeps the picker's title and handler while it slides out.
  const pickerPresence = useModalPresence(picker);
  const pickerKind = pickerPresence.value ?? "main";
  const linked = useLinkedSides(main?.id ?? null);

  const linkedSides = (linked.data ?? []).filter((r) => r.id !== main?.id);
  const extraSides = added.filter((r) => r.id !== main?.id && !linkedSides.some((l) => l.id === r.id));
  const rows = [...linkedSides.map((recipe) => ({ recipe, linked: true })), ...extraSides.map((recipe) => ({ recipe, linked: false }))];
  const isChecked = (row: (typeof rows)[number]) =>
    overrides[row.recipe.id] ?? (row.linked && savedSideIds ? savedSideIds.has(row.recipe.id) : true);
  const checkedSideIds = rows.filter(isChecked).map((row) => row.recipe.id);

  const completed = !!entry?.completedAt;
  const sidesLoading = main !== null && linked.isPending;
  const canSave = date !== null && main !== null && !sidesLoading && !completed;

  const selectMain = (recipe: RecipeSummary) => {
    // Sides linked to the previous main recipe go with it; sides the user added stay.
    const previousLinked = new Set(linkedSides.map((r) => r.id));
    setValues((current) => ({
      ...current,
      main: toSummary(recipe),
      added: current.added.filter((r) => !previousLinked.has(r.id)),
      overrides: {},
      savedSideIds: null,
    }));
    setPicker(null);
  };

  const addSide = (recipe: RecipeSummary) => {
    const listed = rows.some((row) => row.recipe.id === recipe.id);
    setValues((current) => ({
      ...current,
      added: listed ? current.added : [...current.added, toSummary(recipe)],
      overrides: { ...current.overrides, [recipe.id]: true },
    }));
    setPicker(null);
  };

  const submit = () => {
    if (!canSave || !date || !main) return;
    save.mutate(
      { date, mainRecipeId: main.id, sideRecipeIds: checkedSideIds, servings },
      {
        onSuccess: () => {
          toast.show({ type: "success", message: `${formatDateWithWeekday(date)} 식단을 저장했어요.` });
          onClose();
        },
        // The form keeps its values so the user can fix and retry (e.g. 409 for a past date or completed meal).
        onError: (err) => toast.show({ type: "error", message: `식단을 저장하지 못했어요. ${errorMessage(err)}` }),
      },
    );
  };

  return (
    <Modal
      open={open}
      onExited={onExited}
      onClose={onClose}
      title={valuesFor === "new" ? "하루 식단 생성" : "식단 수정"}
      size="tall"
      busy={save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            취소
          </Button>
          <Button onClick={submit} disabled={!canSave} loading={save.isPending}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section aria-label="날짜" className="flex flex-col gap-2">
          <h3 className="text-label text-muted">날짜</h3>
          {datePicker}
          {date === null && <p className="text-caption text-muted">식단을 넣을 날짜를 골라 주세요.</p>}
          {completed && <p className="text-caption text-error">완료된 식단은 완료 취소 후 수정할 수 있어요.</p>}
        </section>

        <section aria-label="주 레시피" className="flex flex-col gap-2">
          <h3 className="text-label text-muted">주 레시피</h3>
          {main ? (
            <div className="flex items-center gap-2 rounded-md border border-hairline p-3">
              <RecipeCard className="min-w-0 flex-1" recipe={main} meta={<span>{formatMinutes(main.cookMinutes)}</span>} />
              <Button size="sm" variant="secondary" onClick={() => setPicker("main")}>
                변경
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setPicker("main")}>
              주 레시피 선택
            </Button>
          )}
        </section>

        <section aria-label="곁들임" className="flex flex-col gap-2">
          <h3 className="text-label text-muted">곁들임</h3>
          {sidesLoading ? (
            <p role="status" className="flex items-center gap-2 text-body-md text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              지정 곁들임을 불러오는 중
            </p>
          ) : rows.length === 0 ? (
            <p className="text-body-md text-muted">{main ? "곁들임이 없어요." : "주 레시피를 고르면 지정 곁들임이 함께 표시돼요."}</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((row) => (
                <li key={row.recipe.id}>
                  <Checkbox
                    checked={isChecked(row)}
                    onChange={(checked) => update({ overrides: { ...overrides, [row.recipe.id]: checked } })}
                    label={
                      <span className="flex items-center gap-2 text-body-md text-ink">
                        {recipeTitle(row.recipe.title)}
                        {row.linked && <span className="text-caption text-muted">지정 곁들임</span>}
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {linked.isError && <p className="text-caption text-error">지정 곁들임을 불러오지 못했어요. {errorMessage(linked.error)}</p>}
          <Button size="sm" variant="ghost" onClick={() => setPicker("side")} disabled={!main}>
            곁들임 추가
          </Button>
        </section>

        <section aria-label="인분" className="flex items-center justify-between gap-2">
          <h3 className="text-label text-muted">인분</h3>
          <Stepper label="인분" value={servings} onChange={(value) => update({ servings: value })} max={MAX_SERVINGS} />
        </section>
      </div>

      <RecipePickerModal
        open={pickerPresence.open}
        onExited={pickerPresence.onExited}
        onClose={() => setPicker(null)}
        title={pickerKind === "side" ? "곁들임 추가" : "주 레시피 선택"}
        selectedIds={pickerKind === "side" ? [...(main ? [main.id] : []), ...checkedSideIds] : main ? [main.id] : []}
        onSelect={pickerKind === "side" ? addSide : selectMain}
      />
    </Modal>
  );
}
