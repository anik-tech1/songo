export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  B2_KEY_ID: string;
  B2_APP_KEY: string;
  B2_BUCKET: string;
  B2_BUCKET_ID: string;
  ASSETS?: Fetcher;
}

export interface UserPayload {
  userId: number;
  username: string;
}
