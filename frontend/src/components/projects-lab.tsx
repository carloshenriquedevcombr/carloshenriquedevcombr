"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORY_META, STATUS_LABEL, type ProjectCategory, type ProjectSummary } from "@/lib/api";
import { CategoryBadge } from "./category-badge";

export function ProjectsLab({ projects }: { projects: ProjectSummary[] }) {
  const [filter, setFilter] = useState<ProjectCategory | "all">("all");

  // Só mostra os filtros das categorias que têm projetos
  const categories = [...new Set(projects.map((p) => p.category))];
  const visible = filter === "all" ? projects : projects.filter((p) => p.category === filter);

  return (
    <div>
      <div role="group" aria-label="Filtrar projetos por área" className="flex flex-wrap gap-2">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
          todos ({projects.length})
        </FilterButton>
        {categories.map((c) => (
          <FilterButton key={c} active={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
          </FilterButton>
        ))}
      </div>

      <ul className="mt-8 grid gap-4 md:grid-cols-2">
        {visible.map((project) => (
          <li key={project.slug}>
            <Link
              href={`/projects/${project.slug}`}
              className="group flex h-full flex-col rounded-lg border border-border bg-surface/70 p-5 transition hover:border-accent/60 hover:shadow-[0_0_24px_rgb(57_255_156/0.08)]"
            >
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge category={project.category} />
                <span className="font-mono text-xs text-muted">
                  {project.featured && <span className="mr-2 text-accent">★ destaque</span>}
                  {STATUS_LABEL[project.status] ?? project.status}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold group-hover:text-accent">{project.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{project.summary}</p>
              <p className="mt-4 font-mono text-xs text-accent-2">{project.stack.join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded border px-3 py-1.5 font-mono text-xs transition ${
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border text-muted hover:border-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
