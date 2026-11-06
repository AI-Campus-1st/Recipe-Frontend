"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { fieldClass, Select, TextArea, TextInput } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { RECIPE_CATEGORIES, type RecipeCategory, type Unit } from "@/lib/api/contracts";
import { cn } from "@/lib/cn";
import { useCreateRecipe, useUnits } from "./hooks";
import { CATEGORY_LABELS } from "./labels";
import {
  emptyIngredientRow,
  emptyManualRecipeForm,
  hasManualRecipeInput,
  isUnmeasured,
  mapServerFieldErrors,
  splitSteps,
  toCreateRequest,
  type IngredientRow,
  type ManualRecipeErrors,
  type ManualRecipeForm,
} from "./manualRecipe";

interface ManualRecipeModalProps {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
}

const FORM_ID = "manual-recipe-form";

/** RECIPE-001: enter a recipe by hand (no URL). Saved right away via `POST /recipes`. */
export function ManualRecipeModal({ open, onClose, onExited }: ManualRecipeModalProps) {
  const router = useRouter();
  const toast = useToast();
  const createRecipe = useCreateRecipe();
  const units = useUnits();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ManualRecipeForm>(emptyManualRecipeForm);
  const [errors, setErrors] = useState<ManualRecipeErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unitList = units.data ?? [];
  const unitByCode = new Map(unitList.map((unit) => [unit.code, unit]));
  const stepCount = splitSteps(form.steps).length;

  const update = <K extends keyof ManualRecipeForm>(key: K, value: ManualRecipeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof ManualRecipeErrors]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const updateRow = (key: string, patch: Partial<IngredientRow>) => {
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
    setErrors((current) => {
      if (!current.ingredients && !current.rows?.[key]) return current;
      const rows = { ...current.rows };
      delete rows[key];
      return { ...current, ingredients: undefined, rows };
    });
  };

  const addRow = () => setForm((current) => ({ ...current, ingredients: [...current.ingredients, emptyIngredientRow()] }));

  const removeRow = (key: string) =>
    setForm((current) => {
      const rest = current.ingredients.filter((row) => row.key !== key);
      return { ...current, ingredients: rest.length > 0 ? rest : [emptyIngredientRow()] };
    });

  const focusFirstError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const finish = () => {
    setConfirmOpen(false);
    onClose();
  };

  /** Closing asks first when something was typed, so the input is not lost by accident. */
  const requestClose = () => {
    if (createRecipe.isPending) return;
    if (hasManualRecipeInput(form)) setConfirmOpen(true);
    else finish();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (createRecipe.isPending) return;
    const result = toCreateRequest(form, unitList);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstError();
      return;
    }
    setErrors({});
    createRecipe.mutate(result.request, {
      onSuccess: (recipe) => {
        toast.show({ type: "success", message: "레시피를 저장했어요." });
        finish();
        router.push(`/recipes?highlight=${encodeURIComponent(recipe.id)}`);
      },
      onError: (err) => {
        // Inputs are kept so the user can fix them and retry.
        if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
          const mapped = mapServerFieldErrors(err.fieldErrors);
          setErrors(mapped.errors);
          focusFirstError();
          if (mapped.general.length > 0) toast.show({ type: "error", message: mapped.general.join(" ") });
          return;
        }
        toast.show({ type: "error", message: `레시피를 저장하지 못했어요. ${errorMessage(err)}` });
      },
    });
  };

  const onModalExited = () => {
    setForm(emptyManualRecipeForm());
    setErrors({});
    createRecipe.reset();
    onExited?.();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        onExited={onModalExited}
        size="tall"
        title="레시피 직접 입력"
        description="URL 없이 레시피를 적어 저장해요."
        busy={createRecipe.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose} disabled={createRecipe.isPending}>
              취소
            </Button>
            <Button type="submit" form={FORM_ID} loading={createRecipe.isPending}>
              저장
            </Button>
          </>
        }
      >
        <form ref={formRef} id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
          <TextInput
            label="레시피명"
            required
            autoComplete="off"
            maxLength={60}
            placeholder="예: 김치볶음밥"
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            error={errors.title}
          />

          <Select
            label="카테고리"
            value={form.category}
            onChange={(event) => update("category", event.target.value as RecipeCategory | "")}
            error={errors.category}
          >
            <option value="">선택 안 함</option>
            {RECIPE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="기본 인분"
              inputMode="numeric"
              autoComplete="off"
              placeholder="예: 2"
              value={form.baseServings}
              onChange={(event) => update("baseServings", event.target.value)}
              error={errors.baseServings}
            />
            <TextInput
              label="조리 시간(분)"
              inputMode="numeric"
              autoComplete="off"
              placeholder="예: 20"
              value={form.cookMinutes}
              onChange={(event) => update("cookMinutes", event.target.value)}
              error={errors.cookMinutes}
            />
          </div>
          {!errors.cookMinutes && (
            <p className="-mt-3 text-caption text-muted">조리 시간을 비워 두면 AI 주간 식단 자동 생성 후보에서 빠져요.</p>
          )}

          <IngredientRows
            rows={form.ingredients}
            units={unitList}
            unitByCode={unitByCode}
            unitsState={units.isPending ? "loading" : units.isError ? "error" : "ready"}
            onRetryUnits={() => void units.refetch()}
            errors={errors}
            onChange={updateRow}
            onAdd={addRow}
            onRemove={removeRow}
          />

          <TextArea
            label="조리 순서"
            rows={6}
            placeholder={"양파를 채 썬다.\n팬에 기름을 두르고 볶는다."}
            value={form.steps}
            onChange={(event) => update("steps", event.target.value)}
            error={errors.steps}
            hint={
              <>
                한 줄이 한 단계예요. 줄 앞 번호(1. 1) ①)는 빼고 저장해요.{" "}
                <span aria-live="polite" className="text-ink">
                  {stepCount}단계
                </span>
              </>
            }
          />

          <TextInput
            label="참고 URL"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={form.sourceUrl}
            onChange={(event) => update("sourceUrl", event.target.value)}
            error={errors.sourceUrl}
          />
        </form>
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="작성을 그만할까요?"
        description="작성 중인 내용이 사라져요."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              계속 작성
            </Button>
            <Button variant="destructive" onClick={finish}>
              나가기
            </Button>
          </>
        }
      />
    </>
  );
}

interface IngredientRowsProps {
  rows: IngredientRow[];
  units: Unit[];
  unitByCode: Map<string, Unit>;
  unitsState: "loading" | "error" | "ready";
  onRetryUnits: () => void;
  errors: ManualRecipeErrors;
  onChange: (key: string, patch: Partial<IngredientRow>) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}

function IngredientRows({ rows, units, unitByCode, unitsState, onRetryUnits, errors, onChange, onAdd, onRemove }: IngredientRowsProps) {
  const listError = errors.ingredients;
  return (
    <fieldset aria-describedby={listError ? "manual-ingredients-error" : undefined}>
      <legend className="mb-1.5 flex items-center gap-1">
        <span className="text-label text-ink">재료</span>
        <span className="text-caption text-warning">필수</span>
      </legend>
      <div className="mb-1 grid grid-cols-[1fr_4.5rem_5.5rem_2.75rem] gap-2 text-caption text-muted" aria-hidden>
        <span>재료명</span>
        <span>수량</span>
        <span>단위</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const n = index + 1;
          const unit = unitByCode.get(row.unitCode);
          const unmeasured = isUnmeasured(unit);
          const rowError = errors.rows?.[row.key];
          const errorId = `manual-ingredient-${row.key}-error`;
          return (
            <li key={row.key}>
              <div className="grid grid-cols-[1fr_4.5rem_5.5rem_2.75rem] gap-2">
                <input
                  aria-label={`재료 ${n} 이름`}
                  aria-invalid={rowError?.name ? true : undefined}
                  aria-describedby={rowError ? errorId : undefined}
                  autoComplete="off"
                  placeholder="예: 양파"
                  className={cn(fieldClass(rowError?.name), "min-h-11 min-w-0")}
                  value={row.name}
                  onChange={(event) => onChange(row.key, { name: event.target.value })}
                />
                <input
                  aria-label={`재료 ${n} 수량`}
                  aria-invalid={rowError?.quantity ? true : undefined}
                  aria-describedby={rowError ? errorId : undefined}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={unmeasured ? "-" : "2"}
                  disabled={unmeasured}
                  className={cn(fieldClass(rowError?.quantity), "min-h-11 min-w-0 px-2")}
                  value={unmeasured ? "" : row.quantity}
                  onChange={(event) => onChange(row.key, { quantity: event.target.value })}
                />
                <select
                  aria-label={`재료 ${n} 단위`}
                  className={cn(fieldClass(), "min-h-11 min-w-0 px-1")}
                  value={row.unitCode}
                  onChange={(event) => {
                    const next = unitByCode.get(event.target.value);
                    // Unmeasured units (약간·적당량) take no number.
                    onChange(row.key, isUnmeasured(next) ? { unitCode: event.target.value, quantity: "" } : { unitCode: event.target.value });
                  }}
                >
                  <option value="">{unitsState === "loading" ? "…" : "단위"}</option>
                  {units.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`재료 ${n} 삭제`}
                  onClick={() => onRemove(row.key)}
                  className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {rowError && (
                <p id={errorId} role="alert" className="mt-1 text-caption text-error">
                  {[rowError.name, rowError.quantity].filter(Boolean).join(" ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {listError && (
        <p id="manual-ingredients-error" role="alert" className="mt-1 text-caption text-error">
          {listError}
        </p>
      )}
      {unitsState === "error" && (
        <p className="mt-1 text-caption text-body">
          단위 목록을 불러오지 못했어요. 수량만 적어도 저장할 수 있어요.{" "}
          <button type="button" className="text-secondary underline" onClick={onRetryUnits}>
            다시 불러오기
          </button>
        </p>
      )}
      <Button variant="ghost" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={onAdd} className="mt-2">
        재료 추가
      </Button>
    </fieldset>
  );
}
