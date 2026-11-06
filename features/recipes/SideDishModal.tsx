"use client";

import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { Modal, useModalPresence, type ModalPresenceProps } from "@/components/Modal";
import { LoadingState } from "@/components/States";
import { TextInput } from "@/components/TextInput";
import { useToast } from "@/components/Toast";
import { errorMessage } from "@/lib/api/client";
import type { RecipeSummary } from "@/lib/api/contracts";
import { formatMinutes, recipeTitle } from "@/lib/format";
import { useRecipes, useRecommendSideDishes, useSaveSideDishes } from "./hooks";
import { CATEGORY_LABELS } from "./labels";
import { filterRecipesByName } from "./search";

interface SideDishModalProps {
  recipeId: string;
  /** Currently linked side dishes — the initial selection. `null` while closed. */
  linked: RecipeSummary[] | null;
  onClose: () => void;
}

/**
 * `곁들임 레시피 연결`: multi-select saved recipes (search by name), optionally helped by AI candidates.
 * The body mounts on open so the selection starts from the current links each time.
 */
export function SideDishModal({ recipeId, linked, onClose }: SideDishModalProps) {
  const presence = useModalPresence(linked);
  if (!presence.value) return null;
  return (
    <SideDishModalBody recipeId={recipeId} linked={presence.value} onClose={onClose} open={presence.open} onExited={presence.onExited} />
  );
}

function SideDishModalBody({
  recipeId,
  linked,
  onClose,
  open,
  onExited,
}: { recipeId: string; linked: RecipeSummary[]; onClose: () => void } & ModalPresenceProps) {
  const toast = useToast();
  const recipes = useRecipes(null);
  const save = useSaveSideDishes(recipeId);
  const recommend = useRecommendSideDishes(recipeId);
  const initial = useMemo(() => new Set(linked.map((r) => r.id)), [linked]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [query, setQuery] = useState("");

  // Saved recipes other than this one; linked ones first.
  const candidates = useMemo(
    () =>
      (recipes.data ?? [])
        .filter((r) => r.status === "saved" && r.id !== recipeId)
        .sort((a, b) => Number(initial.has(b.id)) - Number(initial.has(a.id))),
    [recipes.data, recipeId, initial],
  );
  const filtered = filterRecipesByName(candidates, query);

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = () => {
    const link = [...selected].filter((id) => !initial.has(id));
    const unlink = [...initial].filter((id) => !selected.has(id));
    if (link.length === 0 && unlink.length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { link, unlink },
      {
        onSuccess: () => {
          toast.show({ type: "success", message: "곁들임 레시피를 저장했어요." });
          onClose();
        },
        // Keep the modal and its selection so the user can retry.
        onError: (err) => toast.show({ type: "error", message: `곁들임 레시피를 저장하지 못했어요. ${errorMessage(err)}` }),
      },
    );
  };

  const requestRecommendations = () =>
    recommend.mutate(undefined, {
      onError: (err) => toast.show({ type: "error", message: `곁들임을 추천받지 못했어요. ${errorMessage(err)}` }),
    });

  const aiCandidates = recommend.data?.candidates ?? [];

  return (
    <Modal
      open={open}
      onExited={onExited}
      onClose={onClose}
      title="곁들임 레시피 연결"
      description="함께 먹을 저장 레시피를 선택하세요. 다음 식단 생성부터 반영돼요."
      busy={save.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            취소
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={candidates.length === 0}>
            연결
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section aria-labelledby="ai-sides-title" className="rounded-md bg-surface-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 id="ai-sides-title" className="text-label text-ink">
              AI 곁들임 추천
            </h3>
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles className="size-4" aria-hidden />}
              onClick={requestRecommendations}
              loading={recommend.isPending}
            >
              {recommend.isSuccess ? "다시 추천받기" : "추천받기"}
            </Button>
          </div>
          {recommend.isSuccess &&
            (aiCandidates.length === 0 ? (
              <p className="mt-2 text-body-md text-muted">추천할 곁들임 후보가 없어요.</p>
            ) : (
              <ul className="mt-1 flex flex-col">
                {aiCandidates.map(({ recipe, reason }) => (
                  <li key={recipe.id}>
                    <Checkbox
                      checked={selected.has(recipe.id)}
                      onChange={(checked) => toggle(recipe.id, checked)}
                      label={
                        <span className="flex flex-col">
                          <span className="text-body-md text-ink">{recipeTitle(recipe.title)}</span>
                          <span className="text-caption text-muted">{reason}</span>
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
            ))}
        </section>

        <section aria-labelledby="all-sides-title">
          <h3 id="all-sides-title" className="mb-2 text-label text-ink">
            저장 레시피 <span className="text-caption text-muted">· {selected.size}개 선택</span>
          </h3>
          <TextInput
            label="레시피 검색"
            type="search"
            placeholder="레시피명으로 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {recipes.isPending ? (
            <LoadingState label="레시피를 불러오는 중" />
          ) : recipes.isError ? (
            <p role="alert" className="mt-3 text-body-md text-error">
              레시피 목록을 불러오지 못했어요. {errorMessage(recipes.error)}
            </p>
          ) : candidates.length === 0 ? (
            <p className="mt-3 text-body-md text-muted">곁들임으로 연결할 수 있는 저장 레시피가 없어요.</p>
          ) : filtered.length === 0 ? (
            <p className="mt-3 text-body-md text-muted">검색 결과가 없어요.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {filtered.map((recipe) => (
                <li key={recipe.id}>
                  <Checkbox
                    checked={selected.has(recipe.id)}
                    onChange={(checked) => toggle(recipe.id, checked)}
                    label={
                      <span className="flex flex-col">
                        <span className="text-body-md text-ink">{recipeTitle(recipe.title)}</span>
                        <span className="text-caption text-muted">
                          {[recipe.category && CATEGORY_LABELS[recipe.category], formatMinutes(recipe.cookMinutes)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
