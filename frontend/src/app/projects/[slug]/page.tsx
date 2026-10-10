import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ApiOffline, LoadingBlock } from "@/components/api-offline";
import { CategoryBadge } from "@/components/category-badge";
import { ApiError, getProject, STATUS_LABEL, type ProjectDetail } from "@/lib/api";

async function CaseStudy({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let project: ProjectDetail;
  try {
    project = await getProject(slug);
  } catch (error) {
    // 404 da API (ou slug inválido, 422) vira a página de "não encontrado"
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) notFound();
    return <ApiOffline what="este projeto" />;
  }

  const sections: { title: string; body: string | null }[] = [
    { title: "01 · Problem Statement", body: project.problem },
    { title: "02 · Threat Model", body: project.threat_model },
    { title: "03 · Arquitetura", body: project.architecture },
    { title: "04 · Implementação", body: project.implementation },
    { title: "05 · Impacto", body: project.impact },
    { title: "06 · Lições aprendidas", body: project.lessons },
  ];

  return (
    <article>
      <header className="border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <CategoryBadge category={project.category} />
          <span className="font-mono text-xs text-muted">
            status: {STATUS_LABEL[project.status] ?? project.status}
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">{project.title}</h1>
        <p className="mt-3 text-lg text-muted">{project.summary}</p>
        <p className="mt-4 font-mono text-sm text-accent-2">{project.stack.join(" · ")}</p>
        {(project.repo_url || project.demo_url) && (
          <div className="mt-6 flex gap-3 font-mono text-sm">
            {project.repo_url && (
              <a href={project.repo_url} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent">
                repositório →
              </a>
            )}
            {project.demo_url && (
              <a href={project.demo_url} className="rounded border border-border px-3 py-1.5 hover:border-accent hover:text-accent">
                demo →
              </a>
            )}
          </div>
        )}
      </header>

      <div className="mt-10 space-y-10">
        {sections
          .filter((s) => s.body)
          .map((s) => (
            <section key={s.title}>
              <h2 className="font-mono text-sm tracking-widest text-accent">{s.title}</h2>
              <p className="mt-3 leading-relaxed whitespace-pre-line">{s.body}</p>
            </section>
          ))}
      </div>

      {project.tags.length > 0 && (
        <p className="mt-12 font-mono text-xs text-muted">
          tags: {project.tags.map((t) => `#${t}`).join(" ")}
        </p>
      )}
    </article>
  );
}

export default function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/#projetos" className="font-mono text-sm text-muted hover:text-accent">
        ← cd ../projetos
      </Link>
      <div className="mt-8">
        <Suspense fallback={<LoadingBlock label="estudo de caso" />}>
          <CaseStudy params={params} />
        </Suspense>
      </div>
    </div>
  );
}
