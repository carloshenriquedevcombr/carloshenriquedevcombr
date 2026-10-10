import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-border py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 font-mono text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          © {site.name} · construído com FastAPI + Next.js
        </p>
        <p>
          <a href={site.github} className="hover:text-accent">
            github
          </a>{" "}
          ·{" "}
          <a href={site.linkedin} className="hover:text-accent">
            linkedin
          </a>{" "}
          ·{" "}
          <a href={`mailto:${site.email}`} className="hover:text-accent">
            email
          </a>
        </p>
      </div>
    </footer>
  );
}
