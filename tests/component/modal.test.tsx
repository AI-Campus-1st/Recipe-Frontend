import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/Modal";

/** jsdom has no stylesheet: pretend the close animation applies so the modal waits for `animationend`. */
function withCssAnimation() {
  const real = window.getComputedStyle.bind(window);
  return vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = real(element, pseudo);
    return new Proxy(style, {
      get(target, key) {
        if (key === "animationName") return "modal-slide-down";
        if (key === "animationDuration") return "0.2s";
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

function Nested({ onOuterClose = () => {}, onInnerClose = () => {} }: { onOuterClose?: () => void; onInnerClose?: () => void }) {
  const [outer, setOuter] = useState(true);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Modal
        open={outer}
        onClose={() => {
          onOuterClose();
          setOuter(false);
        }}
        title="하루 식단"
      >
        <button type="button" onClick={() => setInner(true)}>
          레시피 찾기
        </button>
      </Modal>
      <Modal
        open={inner}
        onClose={() => {
          onInnerClose();
          setInner(false);
        }}
        title="레시피 탐색"
        size="tall"
      >
        <input aria-label="검색" />
      </Modal>
    </>
  );
}

describe("Modal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = "";
  });

  it("stays mounted until the close animation ends, then calls onExited", async () => {
    withCssAnimation();
    const onExited = vi.fn();
    const { rerender } = render(<Modal open onClose={() => {}} onExited={onExited} title="레시피 삭제" />);
    expect(screen.getByRole("dialog", { name: "레시피 삭제" })).toBeInTheDocument();

    rerender(<Modal open={false} onClose={() => {}} onExited={onExited} title="레시피 삭제" />);
    // Closing: hidden from the accessibility tree and inert, but still in the DOM while it slides down.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const panel = screen.getByRole("dialog", { hidden: true });
    expect(panel.className).toContain("animate-modal-panel-out");
    expect(onExited).not.toHaveBeenCalled();

    fireEvent.animationEnd(panel);
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("unmounts right away when no animation applies (reduced motion)", async () => {
    const onExited = vi.fn();
    const { rerender } = render(<Modal open onClose={() => {}} onExited={onExited} title="대체 관리" />);
    rerender(<Modal open={false} onClose={() => {}} onExited={onExited} title="대체 관리" />);
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("applies the tall size as a fixed 80dvh panel", async () => {
    const user = userEvent.setup();
    render(<Nested />);
    expect(screen.getByRole("dialog", { name: "하루 식단" }).className).toContain("max-h-[90dvh]");
    await user.click(screen.getByRole("button", { name: "레시피 찾기" }));
    expect(screen.getByRole("dialog", { name: "레시피 탐색" }).className).toContain("h-[80dvh]");
  });

  it("closes only the top-most modal on Escape and keeps the scroll lock until the last one closes", async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(<Nested onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);
    await user.click(screen.getByRole("button", { name: "레시피 찾기" }));
    expect(screen.getByLabelText("검색")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "레시피 탐색", hidden: true })).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "하루 식단" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "레시피 찾기" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(onOuterClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
  });

  it("traps Tab inside the top-most modal only", async () => {
    const user = userEvent.setup();
    render(<Nested />);
    await user.click(screen.getByRole("button", { name: "레시피 찾기" }));
    const inner = screen.getByRole("dialog", { name: "레시피 탐색" });
    for (let i = 0; i < 4; i += 1) {
      await user.tab();
      expect(inner).toContainElement(document.activeElement as HTMLElement);
    }
  });

  it("does not close on scrim click or Escape while busy", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open busy onClose={onClose} title="식단 생성" />);
    await user.keyboard("{Escape}");
    fireEvent.click(document.querySelector(".bg-scrim")!);
    expect(onClose).not.toHaveBeenCalled();
  });
});
