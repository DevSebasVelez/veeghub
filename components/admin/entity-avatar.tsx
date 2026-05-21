import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  "bg-lime-100 text-lime-700 dark:bg-lime-900/60 dark:text-lime-300",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % PALETTE.length;
  }
  return PALETTE[hash];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const sizes = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

export function ClientAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function ProjectAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl font-semibold",
        sizes[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
