import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
  /** Separate cards, or one card with dividers. */
  variant?: "cards" | "divided";
}

export function List({ children, variant = "cards", className, ...rest }: ListProps) {
  return (
    <ul
      className={cn(
        variant === "cards" ? "flex flex-col gap-3" : "divide-y divide-hairline rounded-md border border-hairline bg-canvas",
        className,
      )}
      {...rest}
    >
      {children}
    </ul>
  );
}

interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  children: ReactNode;
  variant?: "card" | "plain";
}

export function ListItem({ children, variant = "card", className, ...rest }: ListItemProps) {
  return (
    <li
      className={cn(variant === "card" ? "rounded-md border border-hairline bg-canvas p-4" : "px-4 py-3", className)}
      {...rest}
    >
      {children}
    </li>
  );
}
