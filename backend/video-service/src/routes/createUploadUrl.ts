import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { type VideoStatus } from "@my-app/shared";
import { VIDEO_TABLE_NAME, VIDEO_BUCKET_NAME, docClient, s3ClientSdk } from "../utils";

const INITIAL_VIDEO_STATUS: VideoStatus = "PENDING";

export async function createUploadUrl(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Request body is required" }),
    };
  }

  let body: { title: string; description?: string; fileName: string; contentType: string };
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  const { title, description, fileName, contentType } = body;

  if (!title || !fileName || !contentType) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "title, fileName, and contentType are required" }),
    };
  }

  const videoId = crypto.randomUUID();
  const now = new Date().toISOString();
  const s3Key = `raw-uploads/${videoId}__${fileName}`;

  try {
    await docClient.send(
      new PutCommand({
        TableName: VIDEO_TABLE_NAME,
        Item: {
          pk: `VIDEO#${videoId}`,
          sk: "META",
          id: videoId,
          title,
          description: description || "",
          status: INITIAL_VIDEO_STATUS,
          s3Key,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
  } catch (e) {
    console.error("Error creating video record:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to create video record" }),
    };
  }

  const signedUrl = await getSignedUrl(
    s3ClientSdk,
    new PutObjectCommand({
      Bucket: VIDEO_BUCKET_NAME,
      Key: s3Key,
      ContentType: contentType,
    }),
    { expiresIn: 3000 },
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      videoId,
      uploadUrl: signedUrl,
      s3Key,
    }),
  };
}
