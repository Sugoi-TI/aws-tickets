import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { type VideoStatus } from "@my-app/shared";

export const VIDEO_BUCKET_NAME = process.env.VIDEO_BUCKET_NAME || "";
export const VIDEO_TABLE_NAME = process.env.VIDEO_TABLE_NAME || "";
export const BITMOVIN_API_KEY = process.env.BITMOVIN_API_KEY || "";
export const BITMOVIN_ACCESS_KEY = process.env.BITMOVIN_ACCESS_KEY || "";
export const BITMOVIN_SECRET_ACCESS_KEY = process.env.BITMOVIN_SECRET_ACCESS_KEY || "";
export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "";
export const WEBHOOK_URL = process.env.WEBHOOK_URL || "";

if (!VIDEO_BUCKET_NAME) {
  throw new Error("Critical: VIDEO_BUCKET_NAME is not defined");
}
if (!VIDEO_TABLE_NAME) {
  throw new Error("Critical: VIDEO_TABLE_NAME is not defined");
}
if (!BITMOVIN_API_KEY) {
  throw new Error("Critical: BITMOVIN_API_KEY is not defined");
}
if (!BITMOVIN_ACCESS_KEY) {
  throw new Error("Critical: BITMOVIN_ACCESS_KEY is not defined");
}
if (!BITMOVIN_SECRET_ACCESS_KEY) {
  throw new Error("Critical: BITMOVIN_SECRET_ACCESS_KEY is not defined");
}

const dynamoClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function updateVideoStatus(
  videoId: string,
  status: VideoStatus,
  additionalAttrs?: Record<string, string>,
) {
  const updateExpr = additionalAttrs
    ? `SET #status = :status, updatedAt = :updatedAt, ${Object.keys(additionalAttrs)
        .map((k) => `${k} = :${k}`)
        .join(", ")}`
    : "SET #status = :status, updatedAt = :updatedAt";

  const exprAttrValues: Record<string, string> = {
    ":status": status,
    ":updatedAt": new Date().toISOString(),
  };

  if (additionalAttrs) {
    Object.entries(additionalAttrs).forEach(([key, value]) => {
      exprAttrValues[`:${key}`] = value;
    });
  }

  await docClient.send(
    new UpdateCommand({
      TableName: VIDEO_TABLE_NAME,
      Key: { pk: `VIDEO#${videoId}`, sk: "META" },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: exprAttrValues,
    }),
  );
}

export type BitmovinWebhookPayload = {
  type: string;
  eventId: string;
  jobId: string;
  outputs?: Array<{
    id: string;
    path: string;
  }>;
  errorMessage?: string;
};
