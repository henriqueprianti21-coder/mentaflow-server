import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthedRequest extends Request {
user?: { id: string; email: string; tier: string; isOwner: boolean };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
const header = req.headers.authorization;
if (!header || !header.startsWith("Bearer ")) {
return res.status(401).json({ error: "Nao autenticado." });
}
const token = header.slice(7);
try {
const payload = jwt.verify(token, JWT_SECRET) as any;
req.user = { id: payload.id, email: payload.email, tier: payload.tier, isOwner: !!payload.isOwner };
next();
} catch {
return res.status(401).json({ error: "Sessao invalida ou expirada." });
}
}

export function requirePro(req: AuthedRequest, res: Response, next: NextFunction) {
if (!req.user) return res.status(401).json({ error: "Nao autenticado." });
if (req.user.tier !== "pro" && !req.user.isOwner) {
return res.status(403).json({ error: "Recurso exclusivo da versao Pro." });
}
next();
}

export function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
if (!req.user || !req.user.isOwner) {
return res.status(403).json({ error: "Apenas o dono do app pode fazer isso." });
}
next();
}

export { JWT_SECRET };
