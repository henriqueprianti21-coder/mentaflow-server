import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { OAuth2Client } from "google-auth-library";
import { db } from "../db";
import { JWT_SECRET, requireAuth, requireOwner, AuthedRequest } from "../middleware/auth";

const router = Router();

const OWNER_EMAIL = (process.env.OWNER_EMAIL || "").toLowerCase().trim();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function signToken(user: any) {
  return jwt.sign(
    { id: user.id, email: user.email, tier: user.tier, isOwner: !!user.is_owner },
    JWT_SECRET,
    { expiresIn: "30d" }
    );
  }

function sanitize(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    tier: user.tier,
    isOwner: !!user.is_owner,
    avatarUrl: user.avatar_url || null,
    hasPassword: !!user.password_hash,
    };
  }

router.post("/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, email e senha sao obrigatorios." });
    }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    }
  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "Ja existe uma conta com esse email." });
    }
  const id = uuid();
  const passwordHash = bcrypt.hashSync(String(password), 10);
  const isOwner = OWNER_EMAIL && normalizedEmail === OWNER_EMAIL ? 1 : 0;
  const tier = isOwner ? "pro" : "free";
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, tier, is_owner) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, normalizedEmail, passwordHash, tier, isOwner);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  const token = signToken(user);
  res.status(201).json({ token, user: sanitize(user) });
  });

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha sao obrigatorios." });
    }
  const normalizedEmail = String(email).toLowerCase().trim();
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  if (!user || !user.password_hash) {
    return res.status(401).json({
      error: user
      ? "Essa conta usa login com Google. Use o botao Entrar com Google."
      : "Email ou senha invalidos.",
      });
    }
  if (!bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: "Email ou senha invalidos." });
    }
  const token = signToken(user);
  res.json({ token, user: sanitize(user) });
  });

router.post("/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: "Token do Google ausente." });
    }
  if (!googleClient) {
    return res.status(500).json({
      error: "Login com Google nao esta configurado no servidor (falta GOOGLE_CLIENT_ID).",
      });
    }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
      });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: "Nao foi possivel confirmar sua conta Google." });
      }
    const normalizedEmail = payload.email.toLowerCase().trim();
    const googleId = payload.sub;
    const name = payload.name || normalizedEmail.split("@")[0];
    const avatarUrl = payload.picture || null;

    let user: any = db.prepare("SELECT * FROM users WHERE google_id = ?").get(googleId);

    if (!user) {
      user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
      if (user) {
        db.prepare(
          "UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?"
          ).run(googleId, avatarUrl, user.id);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        } else {
        const id = uuid();
        const isOwner = OWNER_EMAIL && normalizedEmail === OWNER_EMAIL ? 1 : 0;
        const tier = isOwner ? "pro" : "free";
        db.prepare(
          "INSERT INTO users (id, name, email, google_id, avatar_url, tier, is_owner) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(id, name, normalizedEmail, googleId, avatarUrl, tier, isOwner);
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        }
      }

    const token = signToken(user);
    res.json({ token, user: sanitize(user) });
    } catch (err: any) {
    res.status(401).json({ error: `Falha ao verificar login do Google: ${err.message}` });
    }
  });

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user: any = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
  res.json({ user: sanitize(user) });
  });

router.post("/grant-pro", requireAuth, requireOwner, (req: AuthedRequest, res) => {
  const { email, tier } = req.body || {};
  const nextTier = tier === "free" ? "free" : "pro";
  if (!email) return res.status(400).json({ error: "Informe o email do usuario." });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
  db.prepare("UPDATE users SET tier = ? WHERE id = ?").run(nextTier, user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json({ user: sanitize(updated) });
  });

router.get("/users", requireAuth, requireOwner, (_req, res) => {
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  res.json({ users: users.map(sanitize) });
  });

export default router;
