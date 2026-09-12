import { Router } from "express";
import fetch from "node-fetch";
import { v4 as uuid } from "uuid";
import { db } from "../db";
import { requireAuth, requirePro, AuthedRequest } from "../middleware/auth";

const router = Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";

const SYSTEM_PROMPT = "Voce e o assistente de organizacao do Mentaflow, um app de mapas mentais, quadros de tarefas e quadros brancos. Ajude a pessoa a organizar ideias, quebrar tarefas grandes em passos menores, sugerir estruturas para mapas mentais e priorizar o que fazer primeiro. Responda em portugues do Brasil, de forma direta e pratica, usando listas curtas quando fizer sentido.";

router.use(requireAuth, requirePro);

router.get("/history", (req: AuthedRequest, res) => {
  const rows = db
  .prepare("SELECT * FROM ai_messages WHERE user_id = ? ORDER BY created_at ASC")
  .all(req.user!.id);
  res.json({ messages: rows });
  });

router.post("/chat", async (req: AuthedRequest, res) => {
  const { message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Mensagem vazia." });
    }
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY nao configurada no servidor. Defina essa variavel de ambiente para ativar a IA.",
      });
    }

  const history = db
  .prepare("SELECT role, content FROM ai_messages WHERE user_id = ? ORDER BY created_at ASC")
  .all(req.user!.id) as { role: string; content: string }[];

  const userMsgId = uuid();
  db.prepare(
    "INSERT INTO ai_messages (id, user_id, role, content) VALUES (?, ?, 'user', ?)"
    ).run(userMsgId, req.user!.id, message);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:5173",
        "X-Title": "Mentaflow",
        },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
          ],
        }),
      });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: `Erro no OpenRouter: ${text.slice(0, 300)}` });
      }

    const json: any = await response.json();
    const reply =
    json?.choices?.[0]?.message?.content?.trim() ||
    "Nao consegui gerar uma resposta agora. Tente novamente.";

    const assistantMsgId = uuid();
    db.prepare(
      "INSERT INTO ai_messages (id, user_id, role, content) VALUES (?, ?, 'assistant', ?)"
      ).run(assistantMsgId, req.user!.id, reply);

    res.json({ reply });
    } catch (err: any) {
    res.status(502).json({ error: `Falha ao conectar ao OpenRouter: ${err.message}` });
    }
  });

router.delete("/history", (req: AuthedRequest, res) => {
  db.prepare("DELETE FROM ai_messages WHERE user_id = ?").run(req.user!.id);
  res.status(204).end();
  });

export default router;
