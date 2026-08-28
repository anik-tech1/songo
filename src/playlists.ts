import { Hono } from "hono";
import { getDb } from "./db";

const playlists = new Hono();

playlists.get("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const db = getDb();
  const result = db.prepare("SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC").all(payload.userId);
  return c.json({ playlists: result });
});

playlists.post("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const { name } = await c.req.json<{ name: string }>();
  const db = getDb();

  const result = db.prepare("INSERT INTO playlists (user_id, name) VALUES (?, ?)").run(payload.userId, name);
  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ?").get(result.lastInsertRowid);

  return c.json({ playlist });
});

playlists.delete("/api/playlists/:id", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = c.req.param("id");
  const db = getDb();

  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?").get(id, payload.userId);
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  db.prepare("DELETE FROM playlist_songs WHERE playlist_id = ?").run(id);
  db.prepare("DELETE FROM playlists WHERE id = ?").run(id);

  return c.json({ success: true });
});

playlists.get("/api/playlists/:id/tracks", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = c.req.param("id");
  const db = getDb();

  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?").get(id, payload.userId);
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  const result = db.prepare(
    `SELECT ps.position, s.* FROM playlist_songs ps
     JOIN songs s ON ps.song_id = s.id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position`
  ).all(id);

  return c.json({ tracks: result });
});

playlists.post("/api/playlists/:id/add", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = c.req.param("id");
  const { songId } = await c.req.json<{ songId: number }>();
  const db = getDb();

  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?").get(id, payload.userId);
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  const maxPos = db.prepare("SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?").get(id) as
    | { maxPos: number | null }
    | undefined;

  const position = (maxPos?.maxPos ?? -1) + 1;

  db.prepare("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)").run(id, songId, position);

  return c.json({ success: true, position });
});

playlists.delete("/api/playlists/:id/remove/:songId", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = c.req.param("id");
  const songId = c.req.param("songId");
  const db = getDb();

  const playlist = db.prepare("SELECT * FROM playlists WHERE id = ? AND user_id = ?").get(id, payload.userId);
  if (!playlist) return c.json({ error: "Playlist not found" }, 404);

  db.prepare("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?").run(id, songId);

  return c.json({ success: true });
});

export { playlists };
