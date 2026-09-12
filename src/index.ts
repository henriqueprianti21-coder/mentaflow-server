import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import mindmapRoutes from "./routes/mindmaps";
import boardRoutes from "./routes/boards";
import whiteboardRoutes from "./routes/whiteboards";
import aiRoutes from "./routes/ai";
import "./db";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, name: "mentaflow-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/mindmaps", mindmapRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/whiteboards", whiteboardRoutes);
app.use("/api/ai", aiRoutes);

app.use((_req, res) => res.status(404).json({ error: "Rota nao encontrada." }));

app.listen(PORT, () => {
console.log("Mentaflow API rodando na porta " + PORT);
});
