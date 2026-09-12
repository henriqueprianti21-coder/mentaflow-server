import { Router } from "express";
import { v4 as uuid } from "uuid";
import { db } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
const FREE_LIMIT = 3;

router.use(requireAuth);

function parse(row: any) {
return { ...row, data: JSON.parse(row.data) };
}

function defaultBoardData() {
const todoId = uuid();
const doingId = uuid();
const doneId = uuid();
return {
listOrder: [todoId, doingId, doneId],
lists: {
[todoId]: { id: todoId, title: "A Fazer", cardIds: [] },
[doingId]: { id: doingId, title: "Fazendo", cardIds: [] },
[doneId]: { id: doneId, title: "Concluido", cardIds: [] },
},
cards: {},
};
}

router.get("/", (req: AuthedRequest, res) => {
const rows = db
.prepare("SELECT * FROM boards WHERE user_id = ? ORDER BY updated_at DESC")
.all(req.user!.id);
res.json({ boards: rows.map(parse) });
});

router.post("/", (req: AuthedRequest, res) => {
const { title } = req.body || {};
const isPro = req.user!.tier === "pro" || req.user!.isOwner;
if (!isPro) {
const count = (
db.prepare("SELECT COUNT(*) as c FROM boards WHERE user_id = ?").get(req.user!.id) as any
).c;
if (count >= FREE_LIMIT) {
return res.status(403).json({
error: `Plano Free permite ate ${FREE_LIMIT} quadros. Faca upgrade para o Pro para criar mais.`,
});
}
}
const id = uuid();
db.prepare("INSERT INTO boards (id, user_id, title, data) VALUES (?, ?, ?, ?)").run(
id,
req.user!.id,
title || "Novo quadro",
JSON.stringify(defaultBoardData())
);
const row = db.prepare("SELECT * FROM boards WHERE id = ?").get(id);
res.status(201).json({ board: parse(row) });
});

router.get("/:id", (req: AuthedRequest, res) => {
const row: any = db
.prepare("SELECT * FROM boards WHERE id = ? AND user_id = ?")
.get(req.params.id, req.user!.id);
if (!row) return res.status(404).json({ error: "Quadro nao encontrado." });
res.json({ board: parse(row) });
});

router.put("/:id", (req: AuthedRequest, res) => {
const { title, data } = req.body || {};
const row: any = db
.prepare("SELECT * FROM boards WHERE id = ? AND user_id = ?")
.get(req.params.id, req.user!.id);
if (!row) return res.status(404).json({ error: "Quadro nao encontrado." });
const nextTitle = title ?? row.title;
const nextData = data ? JSON.stringify(data) : row.data;
db.prepare(
"UPDATE boards SET title = ?, data = ?, updated_at = datetime('now') WHERE id = ?"
).run(nextTitle, nextData, row.id);
const updated = db.prepare("SELECT * FROM boards WHERE id = ?").get(row.id);
res.json({ board: parse(updated) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
const info = db
.prepare("DELETE FROM boards WHERE id = ? AND user_id = ?")
.run(req.params.id, req.user!.id);
if (info.changes === 0) return res.status(404).json({ error: "Quadro nao encontrado." });
res.status(204).end();
});

export default router;
