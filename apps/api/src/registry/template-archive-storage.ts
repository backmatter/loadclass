import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { BUCKET, s3 } from "../storage.ts";

export async function putArchive(input: {
  archiveKey: string;
  archiveBuffer: Buffer;
  sha256: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.archiveKey,
      Body: input.archiveBuffer,
      ContentType: "application/gzip",
      Metadata: { sha256: input.sha256 },
    }),
  );
}

export async function deleteArchive(archiveKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: archiveKey }));
}

export async function putThumbnail(input: {
  thumbnailKey: string;
  thumbnailBuffer: Buffer;
  contentType: string;
  sha256: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: input.thumbnailKey,
      Body: input.thumbnailBuffer,
      ContentType: input.contentType,
      Metadata: { sha256: input.sha256 },
    }),
  );
}

export async function deleteThumbnail(thumbnailKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: thumbnailKey }));
}
