import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-4 py-32 font-mono">
      <p className="text-sm text-red-400">[ ERR ] 404 — recurso não encontrado</p>
      <h1 className="mt-4 text-3xl font-bold">Esse endpoint não existe no laboratório.</h1>
      <Link href="/" className="mt-8 text-accent hover:underline">
        cd ~ →
      </Link>
    </div>
  );
}
