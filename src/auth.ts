import { Hono } from "hono";
import { sign } from "hono/jwt";
import { getDb } from "./db";

const auth = new Hono();

auth.post("/api/auth/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  const db = getDb();

  const rows = db.exec("SELECT * FROM users WHERE username = ?", [username]);
  if (rows.length === 0 || rows[0].values.length === 0) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const cols = rows[0].columns;
  const vals = rows[0].values[0];
  const user: Record<string, any> = {};
  cols.forEach((col: string, i: number) => (user[col] = vals[i]));

  if (user.password_hash !== password) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  const payload = {
    userId: user.id,
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
  const token = await sign(payload, secret);

  return c.json({ token, username: user.username });
});

export { auth };
