import { CATEGORY_META, type ProjectCategory } from "@/lib/api";

export function CategoryBadge({ category }: { category: ProjectCategory }) {
  const meta = CATEGORY_META[category];
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs ${meta.color}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}
