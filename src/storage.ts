import type { Env } from "./types";

let b2Auth: { apiUrl: string; authorizationToken: string; downloadUrl: string } | null = null;
let b2AuthExpiry = 0;

export async function getB2Auth(env: Env) {
  if (b2Auth && Date.now() < b2AuthExpiry) return b2Auth;

  const keyId = env.B2_KEY_ID.trim();
  const appKey = env.B2_APP_KEY.trim();
  const credentials = btoa(`${keyId}:${appKey}`);

  const res = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) throw new Error(`B2 auth failed: ${res.status}`);
  const data = await res.json() as any;

  b2Auth = { apiUrl: data.apiUrl, authorizationToken: data.authorizationToken, downloadUrl: data.downloadUrl };
  b2AuthExpiry = Date.now() + 10 * 60 * 1000;
  return b2Auth;
}

export async function listB2Tracks(env: Env): Promise<string[]> {
  const auth = await getB2Auth(env);
  const keys: string[] = [];
  let startFileName = "";

  while (true) {
    const url = `${auth.apiUrl}/b2api/v2/b2_list_file_names?bucketId=${env.B2_BUCKET_ID}&maxFileCount=1000&prefix=tracks%2F${startFileName ? "&startFileName=" + encodeURIComponent(startFileName) : ""}`;

    const res = await fetch(url, { headers: { Authorization: auth.authorizationToken } });
    const data = await res.json() as any;

    if (data.files) {
      for (const file of data.files) {
        if (file.fileName?.endsWith(".mp3")) keys.push(file.fileName);
      }
    }

    if (!data.nextFileName) break;
    startFileName = data.nextFileName;
  }

  return keys;
}

export async function getB2FileStream(env: Env, key: string, range?: string) {
  const auth = await getB2Auth(env);
  const headers: Record<string, string> = { Authorization: auth.authorizationToken };
  if (range) headers["Range"] = range;

  const res = await fetch(`${auth.downloadUrl}/file/${env.B2_BUCKET}/${encodeURIComponent(key)}`, { headers });
  return res;
}
