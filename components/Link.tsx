import NextLink from "next/link";
import { ExternalLink as ExternalIcon } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { cn } from "@/lib/cn";

interface LinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** Render as a button-styled link. */
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Navigation to another screen inside the app. */
export function InternalLink({ href, children, className, variant, size }: LinkProps) {
  return (
    <NextLink
      href={href}
      className={
        variant ? buttonClass(variant, size, className) : cn("text-secondary underline-offset-2 hover:underline", className)
      }
    >
      {children}
    </NextLink>
  );
}

/** Navigation to an external URL — always opens in a new tab and is marked as external. */
export function ExternalLink({ href, children, className, variant, size }: LinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        variant
          ? buttonClass(variant, size, className)
          : cn("inline-flex items-center gap-1 text-secondary underline-offset-2 hover:underline", className)
      }
    >
      {children}
      <ExternalIcon className="size-4" aria-hidden />
      <span className="sr-only">(새 탭에서 열림)</span>
    </a>
  );
}
