import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

const config: S3ClientConfig = {
  region: process.env.S3_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
};

if (process.env.S3_ENDPOINT) {
  config.endpoint = process.env.S3_ENDPOINT;
}

export const s3 = new S3Client(config);

export const BUCKET = process.env.S3_BUCKET ?? "loadclass";

export async function checkStorageBucket(): Promise<void> {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
}

export async function ensureStorageBucket(): Promise<void> {
  try {
    await checkStorageBucket();
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

export async function readStorageObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
}
