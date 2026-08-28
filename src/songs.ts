import { Hono } from "hono";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getB2Object } from "./storage";
import { getDb } from "./db";

function rowsToObjects(result: any): any[] {
  if (result.length === 0) return [];
  const cols = result[0].columns;
  return result[0].values.map((vals: any[]) => {
    const obj: Record<string, any> = {};
    cols.forEach((col: string, i: number) => (obj[col] = vals[i]));
    return obj;
  });
}

const songs = new Hono();

songs.get("/api/songs", async (c) => {
  const db = getDb();
  const result = db.exec("SELECT * FROM songs ORDER BY created_at DESC");
  return c.json({ songs: rowsToObjects(result) });
});

songs.get("/api/songs/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const result = db.exec("SELECT * FROM songs WHERE id = ?", [Number(id)]);
  const rows = rowsToObjects(result);
  if (rows.length === 0) return c.json({ error: "Song not found" }, 404);
  return c.json({ song: rows[0] });
});

songs.get("/api/stream/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const result = db.exec("SELECT * FROM songs WHERE id = ?", [Number(id)]);
  const rows = rowsToObjects(result);
  if (rows.length === 0) return c.json({ error: "Song not found" }, 404);

  const song = rows[0];
  const rangeHeader = c.req.header("range");

  try {
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;

      const response = await getB2Object(song.r2_key, rangeHeader);

      const webStream = response.Body?.transformToWebStream();
      if (!webStream) return c.json({ error: "No body" }, 500);

      return new Response(webStream, {
        status: 206,
        headers: {
          "Content-Range": response.ContentRange || `bytes ${start}-${end || "*"}/0`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(response.ContentLength || 0),
          "Content-Type": response.ContentType || "audio/mpeg",
        },
      });
    }

    const response = await getB2Object(song.r2_key);
    const webStream = response.Body?.transformToWebStream();
    if (!webStream) return c.json({ error: "No body" }, 500);

    return new Response(webStream, {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": String(response.ContentLength || 0),
        "Content-Type": response.ContentType || "audio/mpeg",
      },
    });
  } catch (err: any) {
    if (err.$metadata?.httpStatusCode === 404) {
      return c.json({ error: "Audio file not found in B2" }, 404);
    }
    return c.json({ error: err.message || "Stream error" }, 500);
  }
});

songs.get("/api/download/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb();
  const result = db.exec("SELECT * FROM songs WHERE id = ?", [Number(id)]);
  const rows = rowsToObjects(result);
  if (rows.length === 0) return c.json({ error: "Song not found" }, 404);

  const song = rows[0];

  try {
    const response = await getB2Object(song.r2_key);
    const webStream = response.Body?.transformToWebStream();
    if (!webStream) return c.json({ error: "No body" }, 500);

    const safeTitle = song.title.replace(/[^a-zA-Z0-9_\- ]/g, "_");
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${safeTitle}.mp3"`,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(response.ContentLength || 0),
      },
    });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

export { songs };
