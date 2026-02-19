import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { type VideoStatus } from "@my-app/shared";

export const VIDEO_BUCKET_NAME = process.env.VIDEO_BUCKET_NAME || "";
export const VIDEO_TABLE_NAME = process.env.VIDEO_TABLE_NAME || "";

if (!VIDEO_BUCKET_NAME) {
  throw new Error("Critical: VIDEO_BUCKET_NAME is not defined");
}
if (!VIDEO_TABLE_NAME) {
  throw new Error("Critical: VIDEO_TABLE_NAME is not defined");
}

const dynamoClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({});
export const s3ClientSdk = s3Client;

export type VideoMetadata = {
  id: string;
  title: string;
  description?: string;
  status: VideoStatus;
  createdAt: string;
  updatedAt: string;
  s3Key?: string;
  cdnUrl?: string;
  errorMessage?: string;
};
