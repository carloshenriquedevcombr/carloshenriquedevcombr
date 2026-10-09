import { SKILL_GROUP_LABEL, type Skill, type SkillGroup } from "@/lib/api";

export function SkillMatrix({ skills }: { skills: Skill[] }) {
  const groups = new Map<SkillGroup, Skill[]>();
  for (const skill of skills) {
    groups.set(skill.group, [...(groups.get(skill.group) ?? []), skill]);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...groups].map(([group, items], i) => (
        <article key={group} className="rounded-lg border border-border bg-surface/70 p-5">
          <header className="flex items-center justify-between border-b border-border pb-3 font-mono text-xs">
            <h3 className="text-sm font-semibold text-foreground">{SKILL_GROUP_LABEL[group]}</h3>
            <span className="text-muted">rack-0{i + 1}</span>
          </header>
          <ul className="mt-4 space-y-3">
            {items.map((skill) => (
              <li key={skill.name}>
                <p className="flex items-center gap-2 font-mono text-sm">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {skill.name}
                </p>
                <p className="mt-0.5 pl-3.5 text-sm text-muted">{skill.evidence}</p>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
