import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const B2 = new S3Client({
  region: "us-west-004",
  endpoint: "https://s3.us-west-004.backblazeb2.com",
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
