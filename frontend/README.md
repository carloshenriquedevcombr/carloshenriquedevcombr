# The Lab — frontend

Next.js (App Router, Cache Components) + TypeScript + Tailwind.
Veja [`docs/the-lab.md`](../docs/the-lab.md) para rodar o projeto completo.

- `src/lib/api.ts` — cliente tipado da API (espelha `backend/app/schemas.py`)
- `src/app/page.tsx` — home com as seções; os dados da API chegam via streaming em `<Suspense>`,
  então o build não depende da API estar no ar
- `src/app/projects/[slug]` — estudo de caso de cada projeto
- `src/app/resume` — currículo em HTML (imprimível como PDF)
