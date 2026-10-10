import type { Metadata } from "next";
import { Suspense } from "react";
import { ApiOffline, LoadingBlock } from "@/components/api-offline";
import { PrintButton } from "@/components/print-button";
import { getProfile, getProjects, orNull, SKILL_GROUP_LABEL, type SkillGroup } from "@/lib/api";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Currículo" };

async function ResumeBody() {
  const [profile, projects] = await Promise.all([orNull(getProfile()), orNull(getProjects())]);
  if (!profile || !projects) return <ApiOffline what="o currículo" />;

  const groups = new Map<SkillGroup, string[]>();
  for (const s of profile.skills) groups.set(s.group, [...(groups.get(s.group) ?? []), s.name]);

  return (
    <>
      <section className="mt-10">
        <h2 className="font-mono text-sm tracking-widest text-accent print:text-black">EXPERIÊNCIA</h2>
        <ul className="mt-4 space-y-5">
          {[...profile.timeline].reverse().map((t) => (
            <li key={t.version}>
              <p className="font-semibold">
                {t.title} <span className="font-normal text-muted">· {t.period}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {t.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-sm tracking-widest text-accent print:text-black">COMPETÊNCIAS</h2>
        <dl className="mt-4 space-y-2 text-sm">
          {[...groups].map(([group, names]) => (
            <div key={group} className="grid gap-1 sm:grid-cols-[200px_1fr]">
              <dt className="font-semibold">{SKILL_GROUP_LABEL[group]}</dt>
              <dd className="text-muted">{names.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-sm tracking-widest text-accent print:text-black">PROJETOS</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {projects.map((p) => (
            <li key={p.slug}>
              <span className="font-semibold">{p.title}</span>
              <span className="text-muted"> — {p.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function ResumePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold">{site.name}</h1>
          <p className="mt-1 font-mono text-accent-2 print:text-black">
            {site.role} · {site.tagline}
          </p>
          <p className="mt-2 text-sm text-muted">
            {site.email} · {site.linkedin.replace("https://www.", "")} ·{" "}
            {site.github.replace("https://", "")}
          </p>
        </div>
        <PrintButton />
      </header>
      <Suspense fallback={<LoadingBlock label="currículo" />}>
        <ResumeBody />
      </Suspense>
    </div>
  );
}
