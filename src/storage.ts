import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2 = new S3Client({
  region: "eu-central-003",
  endpoint: "https://s3.eu-central-003.backblazeb2.com",
  forcePathStyle: true,
  credentials: {
    accessKeyId: (process.env.B2_KEY_ID || "").trim(),
    secretAccessKey: (process.env.B2_APP_KEY || "").trim(),
  },
});

const BUCKET = process.env.B2_BUCKET || "songo-music";

export async function uploadToB2(key: string, body: Buffer, contentType: string) {
  await B2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getB2Url(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(B2, command, { expiresIn: 3600 });
}

export async function getB2Object(key: string, range?: string) {
  const params: any = { Bucket: BUCKET, Key: key };
  if (range) params.Range = range;
  const command = new GetObjectCommand(params);
  return B2.send(command);
}

export async function headB2Object(key: string) {
  const command = new HeadObjectCommand({ Bucket: BUCKET, Key: key });
  return B2.send(command);
}

export { B2, BUCKET };

export async function listB2Tracks(): Promise<string[]> {
  const keys: string[] = [];
  let startFileName = "";

  const keyId = (process.env.B2_KEY_ID || "").trim();
  const appKey = (process.env.B2_APP_KEY || "").trim();
  console.log(`B2 Key ID: "${keyId}" (len: ${keyId.length})`);
  console.log(`B2 App Key: "${appKey.slice(0,4)}...${appKey.slice(-4)}" (len: ${appKey.length})`);

  const credentials = Buffer.from(`${keyId}:${appKey}`).toString("base64");

  const authRes = await fetch("https://api.backblazeb2.com/b2api/v2/b2_authorize_account", {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });
  const auth = await authRes.json() as any;
  if (!auth.apiUrl || !auth.authorizationToken) {
    console.error("B2 auth failed:", JSON.stringify(auth));
    return keys;
  }
  const apiUrl = auth.apiUrl;
  const authToken = auth.authorizationToken;
  console.log(`B2 auth OK, apiUrl: ${apiUrl}`);

  let hasMore = true;
  while (hasMore) {
    const url = `${apiUrl}/b2api/v2/b2_list_file_names?bucketId=b3cce0928a594a74a402011d&maxFileCount=1000&prefix=tracks%2F${startFileName ? "&startFileName=" + encodeURIComponent(startFileName) : ""}`;

    const res = await fetch(url, {
      headers: { Authorization: authToken },
    });
    const data = await res.json() as any;

    if (data.files) {
      for (const file of data.files) {
        if (file.fileName && file.fileName.endsWith(".mp3")) {
          keys.push(file.fileName);
        }
      }
    }

    hasMore = data.nextFileName != null;
    startFileName = data.nextFileName || "";
  }

  return keys;
}
