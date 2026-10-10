import Link from "next/link";
import { Suspense } from "react";
import { ApiOffline, LoadingBlock } from "@/components/api-offline";
import { BootSequence } from "@/components/boot-sequence";
import { Changelog } from "@/components/changelog";
import { ContactForm } from "@/components/contact-form";
import { Hero } from "@/components/hero";
import { LiveMetrics } from "@/components/live-metrics";
import { ProjectsLab } from "@/components/projects-lab";
import { Section } from "@/components/section";
import { SkillMatrix } from "@/components/skill-matrix";
import { TerminalLab } from "@/components/terminal-lab";
import { getProfile, getProjects, orNull } from "@/lib/api";
import { site } from "@/lib/site";

// Os dados vêm da API a cada requisição e chegam via streaming:
// o "esqueleto" da página é estático e não depende da API estar no ar.

async function OriginData() {
  const profile = await orNull(getProfile());
  if (!profile) return <ApiOffline what="a timeline" />;
  return <Changelog entries={profile.timeline} />;
}

async function SkillsData() {
  const profile = await orNull(getProfile());
  if (!profile) return <ApiOffline what="as skills" />;
  return <SkillMatrix skills={profile.skills} />;
}

async function ProjectsData() {
  const projects = await orNull(getProjects());
  if (!projects) return <ApiOffline what="os projetos" />;
  return <ProjectsLab projects={projects} />;
}

export default function Home() {
  return (
    <>
      <BootSequence />
      <Hero />

      <Section
        id="origem"
        index="02 · ORIGIN STORY"
        title="git log --oneline minha-carreira"
        subtitle="Do suporte de TI ao desenvolvimento: cada versão resolveu um problema que a anterior só contornava."
      >
        <Suspense fallback={<LoadingBlock label="timeline" />}>
          <OriginData />
        </Suspense>
      </Section>

      <Section
        id="skills"
        index="03 · SKILL MATRIX"
        title="Módulos instalados"
        subtitle="Sem barras de porcentagem: cada skill aponta para onde ela foi usada de verdade."
      >
        <Suspense fallback={<LoadingBlock label="skills" />}>
          <SkillsData />
        </Suspense>
      </Section>

      <Section
        id="projetos"
        index="04 · PROJECTS LAB"
        title="Projetos"
        subtitle="Cada projeto é documentado como um relatório de engenharia: problema, ameaças, arquitetura e impacto."
      >
        <Suspense fallback={<LoadingBlock label="projetos" />}>
          <ProjectsData />
        </Suspense>
      </Section>

      <Section
        id="terminal"
        index="05 · THE TERMINAL"
        title="Acesso ao laboratório"
        subtitle="Um terminal de verdade, conectado à API por WebSocket. Experimente 'nmap lab.local' e 'mode red' (no desktop, o rack ao lado reage aos comandos)."
      >
        <TerminalLab />
      </Section>

      <Section
        id="metricas"
        index="06 · LIVE METRICS"
        title="Telemetria do lab"
        subtitle="Números reais desta aplicação, transmitidos ao vivo pela API (contadores em Redis)."
      >
        <LiveMetrics />
      </Section>

      <Section
        id="contato"
        index="08 · HANDSHAKE"
        title="Vamos conversar"
        subtitle="Procuro vagas de desenvolvimento backend, automação e dados. O formulário fala direto com a API (com rate limit e honeypot)."
      >
        <div className="grid gap-10 md:grid-cols-[1fr_auto]">
          <ContactForm />
          <ul className="space-y-2 font-mono text-sm">
            <li>
              <a href={site.linkedin} className="text-accent-2 hover:underline">
                linkedin →
              </a>
            </li>
            <li>
              <a href={site.github} className="text-accent-2 hover:underline">
                github →
              </a>
            </li>
            <li>
              <a href={`mailto:${site.email}`} className="text-accent-2 hover:underline">
                {site.email}
              </a>
            </li>
            <li>
              <Link href="/resume" className="text-accent-2 hover:underline">
                currículo →
              </Link>
            </li>
          </ul>
        </div>
      </Section>
    </>
  );
}
