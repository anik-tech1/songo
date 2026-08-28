import { Hono } from "hono";
import { getDb, saveDb } from "./db";

function rowsToObjects(result: any): any[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((vals: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((col: string, i: number) => (obj[col] = vals[i]));
    return obj;
  });
}

const playlists = new Hono();

playlists.get("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const db = getDb();
  const result = db.exec("SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC", [payload.userId]);
  return c.json({ playlists: rowsToObjects(result) });
});

playlists.post("/api/playlists", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const { name } = await c.req.json<{ name: string }>();
  const db = getDb();

  db.run("INSERT INTO playlists (user_id, name) VALUES (?, ?)", [payload.userId, name]);
  const idResult = db.exec("SELECT last_insert_rowid()");
  const newId = idResult[0].values[0][0];
  const playlist = db.exec("SELECT * FROM playlists WHERE id = ?", [newId]);
  saveDb();

  return c.json({ playlist: rowsToObjects(playlist)[0] });
});

playlists.delete("/api/playlists/:id", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const db = getDb();

  const result = db.exec("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [id, payload.userId]);
  if (rowsToObjects(result).length === 0) return c.json({ error: "Playlist not found" }, 404);

  db.run("DELETE FROM playlist_songs WHERE playlist_id = ?", [id]);
  db.run("DELETE FROM playlists WHERE id = ?", [id]);
  saveDb();

  return c.json({ success: true });
});

playlists.get("/api/playlists/:id/tracks", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const db = getDb();

  const plResult = db.exec("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [id, payload.userId]);
  if (rowsToObjects(plResult).length === 0) return c.json({ error: "Playlist not found" }, 404);

  const result = db.exec(
    `SELECT ps.position, s.* FROM playlist_songs ps
     JOIN songs s ON ps.song_id = s.id
     WHERE ps.playlist_id = ?
     ORDER BY ps.position`,
    [id]
  );

  return c.json({ tracks: rowsToObjects(result) });
});

playlists.post("/api/playlists/:id/add", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const { songId } = await c.req.json<{ songId: number }>();
  const db = getDb();

  const plResult = db.exec("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [id, payload.userId]);
  if (rowsToObjects(plResult).length === 0) return c.json({ error: "Playlist not found" }, 404);

  const maxResult = db.exec("SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?", [id]);
  const maxPos = maxResult.length > 0 ? maxResult[0].values[0][0] : null;
  const position = (maxPos === null ? -1 : Number(maxPos)) + 1;

  db.run("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)", [id, songId, position]);
  saveDb();

  return c.json({ success: true, position });
});

playlists.delete("/api/playlists/:id/remove/:songId", async (c) => {
  const payload = c.get("jwtPayload") as { userId: number };
  const id = Number(c.req.param("id"));
  const songId = Number(c.req.param("songId"));
  const db = getDb();

  const plResult = db.exec("SELECT * FROM playlists WHERE id = ? AND user_id = ?", [id, payload.userId]);
  if (rowsToObjects(plResult).length === 0) return c.json({ error: "Playlist not found" }, 404);

  db.run("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", [id, songId]);
  saveDb();

  return c.json({ success: true });
});

export { playlists };
