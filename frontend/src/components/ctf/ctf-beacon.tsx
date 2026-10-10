import { createHmac } from "node:crypto";
import { connection } from "next/server";

/**
 * CTF #2 (Web): a flag vai como comentário HTML codificado em base64.
 * É calculada por requisição a partir do CTF_SECRET (mesma fórmula do backend,
 * em backend/app/ctf.py), então nunca aparece no repositório nem no build.
 */
export async function CtfBeacon() {
  await connection();
  const secret = process.env.CTF_SECRET ?? "dev-ctf-secret";
  const digest = createHmac("sha256", secret).update("source").digest("hex").slice(0, 12);
  const encoded = Buffer.from(`LAB{source_${digest}}`).toString("base64");
  return <div hidden dangerouslySetInnerHTML={{ __html: `<!-- lab-beacon: ${encoded} -->` }} />;
}
