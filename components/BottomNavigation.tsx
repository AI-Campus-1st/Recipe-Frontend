"use client";

import { BookOpen, CalendarDays, Home, ShoppingBasket, type LucideIcon } from "lucide-react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home, match: (p) => p === "/" || p.startsWith("/cook") },
  { href: "/weekly", label: "주간 식단", icon: CalendarDays, match: (p) => p.startsWith("/weekly") },
  { href: "/shopping", label: "장보기", icon: ShoppingBasket, match: (p) => p.startsWith("/shopping") },
  { href: "/recipes", label: "레시피", icon: BookOpen, match: (p) => p.startsWith("/recipes") },
];

interface BottomNavigationProps {
  /** Number of ingredients still needed — shown as a badge on 장보기. */
  shoppingNeededCount?: number;
}

export function BottomNavigation({ shoppingNeededCount }: BottomNavigationProps) {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[var(--app-max-width)] border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-[var(--app-bottom-nav-height)] grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const showBadge = item.href === "/shopping" && !!shoppingNeededCount;
          return (
            <li key={item.href}>
              <NextLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-caption",
                  active ? "font-semibold text-ink" : "text-muted",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-6", active && "text-secondary")} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                  {showBadge && (
                    <span className="absolute -top-1.5 left-4 min-w-5 rounded-full bg-primary px-1 text-center text-badge leading-5 text-on-primary">
                      {shoppingNeededCount > 99 ? "99+" : shoppingNeededCount}
                    </span>
                  )}
                </span>
                <span>
                  {item.label}
                  {showBadge && <span className="sr-only">, 필요 재료 {shoppingNeededCount}개</span>}
                </span>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden />}
              </NextLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
