export type LabMode = "normal" | "red" | "blue" | "purple";

export type TerminalEvent =
  | { type: "scan"; hosts: string[] }
  | { type: "mode"; mode: LabMode }
  | { type: "navigate"; href: string }
  | { type: "clear" };

export interface TerminalLine {
  text: string;
  style: "accent" | "muted" | "error" | "info" | "input" | null;
}

export interface TerminalMessage {
  type: "output";
  lines: TerminalLine[];
  event: TerminalEvent | null;
}

export const MODE_COLOR: Record<LabMode, string> = {
  normal: "#39ff9c",
  red: "#ff4d5e",
  blue: "#22d3ee",
  purple: "#a78bfa",
};

// Para o autocomplete com Tab (o servidor é quem valida de verdade)
export const KNOWN_COMMANDS = [
  "help",
  "whoami",
  "ls projects",
  "cat ",
  "skills",
  "timeline",
  "nmap lab.local",
  "mode red",
  "mode blue",
  "mode purple",
  "mode normal",
  "uptime",
  "stats",
  "contact",
  "clear",
];
