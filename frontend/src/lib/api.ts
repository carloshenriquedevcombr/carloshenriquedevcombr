import { cache } from "react";

// Tipos espelham os schemas de saída da API (backend/app/schemas.py)

export type ProjectCategory =
  | "automation"
  | "data"
  | "blue_team"
  | "red_team"
  | "purple_team"
  | "hardware"
  | "backend"
  | "infra";

export type SkillGroup =
  | "backend_automation"
  | "data_engineering"
  | "cybersecurity"
  | "infrastructure"
  | "hardware";

export interface ProjectSummary {
  slug: string;
  title: string;
  summary: string;
  category: ProjectCategory;
  tags: string[];
  stack: string[];
  featured: boolean;
  status: string;
  repo_url: string | null;
  demo_url: string | null;
}

export interface ProjectDetail extends ProjectSummary {
  problem: string;
  threat_model: string | null;
  architecture: string;
  implementation: string;
  impact: string;
  lessons: string | null;
  created_at: string;
}

export interface TimelineEntry {
  version: string;
  title: string;
  period: string;
  description: string;
  highlights: string[];
}

export interface Skill {
  name: string;
  group: SkillGroup;
  evidence: string;
}

export interface Profile {
  timeline: TimelineEntry[];
  skills: Skill[];
}

// No servidor (SSR) usamos a URL interna (ex.: http://api:8000 no Docker);
// no navegador, a URL pública.
const SERVER_API_URL = process.env.API_URL ?? "http://localhost:8000";
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_API_URL}/api/v1${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// cache() deduplica chamadas iguais dentro de uma mesma renderização
export const getProjects = cache(() => apiGet<ProjectSummary[]>("/projects"));
export const getProject = cache((slug: string) => apiGet<ProjectDetail>(`/projects/${slug}`));
export const getProfile = cache(() => apiGet<Profile>("/profile"));

/** Executa uma chamada à API e devolve null se ela falhar (API fora do ar, timeout...). */
export async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export const CATEGORY_META: Record<ProjectCategory, { label: string; icon: string; color: string }> = {
  blue_team: { label: "Blue Team", icon: "🔵", color: "text-sky-400 border-sky-400/40" },
  red_team: { label: "Red Team", icon: "🔴", color: "text-red-400 border-red-400/40" },
  purple_team: { label: "Purple Team", icon: "🟣", color: "text-violet-400 border-violet-400/40" },
  hardware: { label: "Hardware", icon: "🔧", color: "text-amber-400 border-amber-400/40" },
  data: { label: "Dados", icon: "📊", color: "text-emerald-400 border-emerald-400/40" },
  automation: { label: "Automação", icon: "⚙️", color: "text-lime-400 border-lime-400/40" },
  backend: { label: "Backend", icon: "🐍", color: "text-cyan-400 border-cyan-400/40" },
  infra: { label: "Infra", icon: "🐧", color: "text-orange-400 border-orange-400/40" },
};

export const SKILL_GROUP_LABEL: Record<SkillGroup, string> = {
  backend_automation: "Backend & Automação",
  data_engineering: "Engenharia de Dados",
  cybersecurity: "Cybersecurity",
  infrastructure: "Infraestrutura",
  hardware: "Hardware & Embarcados",
};

export const STATUS_LABEL: Record<string, string> = {
  done: "concluído",
  in_progress: "em andamento",
};

// ---- Data Reactor (pipeline) ----

export type PipelineSource = "http" | "terminal" | "contact" | "ctf";

export interface PipelineEvent {
  id: number;
  ts: number;
  source: PipelineSource;
  kind: string;
  status: number | null;
  latency_ms: number | null;
  malicious: boolean;
  synthetic: boolean;
}

export interface PipelineAlert {
  id: number;
  ts: number;
  rule: string;
  title: string;
  severity: "low" | "medium" | "high";
  technique: string | null;
  synthetic: boolean;
}

export interface PipelineStats {
  extracted: number;
  transformed: number;
  loaded: number;
  blocked: number;
  alerts: number;
}

// ---- CTF ----

export interface Challenge {
  id: string;
  title: string;
  category: string;
  points: number;
  hint: string;
}

export interface HallOfFameEntry {
  nickname: string;
  points: number;
  solved: string[];
  last_solve: string;
}

export const getChallenges = cache(() => apiGet<Challenge[]>("/ctf/challenges"));
