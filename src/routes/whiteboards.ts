import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
const FREE_LIMIT = 2;

router.use(requireAuth);

function parse(row: any) {
  return { ...row, data: JSON.parse(row.data) };
  }

router.get("/", (req: AuthedRequest, res) => {
  const rows = db
  .prepare("SELECT * FROM whiteboards WHERE user_id = ? ORDER BY updated_at DESC")
  .all(req.user!.id);
  res.json({ whiteboards: rows.map(parse) });
  });

router.post("/", (req: AuthedRequest, res) => {
  const { title } = req.body || {};
  const isPro = req.user!.tier === "pro" || req.user!.isOwner;
  if (!isPro) {
    const count = (
      db.prepare("SELECT COUNT(*) as c FROM whiteboards WHERE user_id = ?").get(req.user!.id) as any
      ).c;
    if (count >= FREE_LIMIT) {
      return res.status(403).json({
        error: `Plano Free permite ate ${FREE_LIMIT} quadros brancos. Faca upgrade para o Pro para criar mais.`,
        });
      }
    }
  const id = uuid();
  db.prepare("INSERT INTO whiteboards (id, user_id, title, data) VALUES (?, ?, ?, ?)").run(
    id,
    req.user!.id,
    title || "Novo quadro branco",
    JSON.stringify({ elements: [] })
    );
  const row = db.prepare("SELECT * FROM whiteboards WHERE id = ?").get(id);
  res.status(201).json({ whiteboard: parse(row) });
  });

router.get("/:id", (req: AuthedRequest, res) => {
  const row: any = db
  .prepare("SELECT * FROM whiteboards WHERE id = ? AND user_id = ?")
  .get(req.params.id, req.user!.id);
  if (!row) return res.status(404).json({ error: "Quadro branco nao encontrado." });
  res.json({ whiteboard: parse(row) });
  });

router.put("/:id", (req: AuthedRequest, res) => {
  const { title, data } = req.body || {};
  const row: any = db
  .prepare("SELECT * FROM whiteboards WHERE id = ? AND user_id = ?")
  .get(req.params.id, req.user!.id);
  if (!row) return res.status(404).json({ error: "Quadro branco nao encontrado." });
  const nextTitle = title ?? row.title;
  const nextData = data ? JSON.stringify(data) : row.data;
  db.prepare(
    "UPDATE whiteboards SET title = ?, data = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(nextTitle, nextData, row.id);
  const updated = db.prepare("SELECT * FROM whiteboards WHERE id = ?").get(row.id);
  res.json({ whiteboard: parse(updated) });
  });

router.delete("/:id", (req: AuthedRequest, res) => {
  const info = db
  .prepare("DELETE FROM whiteboards WHERE id = ? AND user_id = ?")
  .run(req.params.id, req.user!.id);
  if (info.changes === 0) return res.status(404).json({ error: "Quadro branco nao encontrado." });
  res.status(204).end();
  });

export default router;
