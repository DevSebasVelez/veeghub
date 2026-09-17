"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type AreaNavItem = {
  key: string;
  label: string;
  /** Shown next to the label; hidden when zero. */
  count?: number;
  href?: string;
};

function itemClasses(active: boolean) {
  return cn(
    // The underline sits on the container's border, so switching sections does
    // not shift anything below it.
    "relative -mb-px flex items-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors",
    active
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  if (!value) return null;

  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] leading-none tabular-nums",
        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

/**
 * Section nav backed by the URL.
 *
 * Uses Link rather than an anchor so Next prefetches each section and swaps it
 * without a full reload, while the address bar still reflects where you are —
 * which means refreshing, sharing or going back all land on the same section.
 *
 * Wraps instead of scrolling sideways: a scrolling nav hides the sections at
 * the end and, on a phone, competes with the page's own gestures.
 */
export function AreaNav({
  items,
  active,
  className,
}: {
  items: AreaNavItem[];
  active: string;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "mb-4 flex flex-wrap gap-x-5 gap-y-1 border-b border-border",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={item.href ?? "#"}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={itemClasses(isActive)}
          >
            {item.label}
            <Count value={item.count ?? 0} active={isActive} />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Same look, driven by local state. For switching how the SAME data is drawn —
 * a calendar's month/week/agenda — where there is nothing new to fetch and a
 * URL change would only add history entries.
 */
export function AreaNavButtons({
  items,
  active,
  onSelect,
  className,
}: {
  items: AreaNavItem[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex flex-wrap gap-x-5 gap-y-1 border-b border-border",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.key === active;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={itemClasses(isActive)}
          >
            {item.label}
            <Count value={item.count ?? 0} active={isActive} />
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Sections of a page whose data is already loaded.
 *
 * On the client and project detail pages the header summarises every area, so
 * the queries run regardless of which section is open. Navigating by URL there
 * would re-run all of them on each switch; keeping the state local makes the
 * switch instant.
 *
 * The address bar is still updated, through the History API rather than the
 * router, so it costs no round-trip — refreshing, sharing or opening a link
 * with ?tab= all land on the right section.
 */
export function AreaTabs({
  items,
  initial,
  param = "tab",
  panels,
}: {
  items: AreaNavItem[];
  initial: string;
  param?: string;
  panels: Record<string, React.ReactNode>;
}) {
  const fallback = items[0]?.key ?? "";
  const [active, setActive] = useState(
    items.some((item) => item.key === initial) ? initial : fallback,
  );

  function select(key: string) {
    setActive(key);

    try {
      const url = new URL(window.location.href);

      if (key === fallback) url.searchParams.delete(param);
      else url.searchParams.set(param, key);

      window.history.replaceState(null, "", url);
    } catch {
      // A blocked History API must not stop the section from switching.
    }
  }

  return (
    <>
      <AreaNavButtons items={items} active={active} onSelect={select} className="mb-4" />
      {panels[active] ?? null}
    </>
  );
}
