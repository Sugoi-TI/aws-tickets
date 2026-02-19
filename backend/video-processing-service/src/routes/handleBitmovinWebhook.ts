import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { type VideoStatus } from "@my-app/shared";
import {
  VIDEO_TABLE_NAME,
  CLOUDFRONT_DOMAIN,
  docClient,
  updateVideoStatus,
  type BitmovinWebhookPayload,
} from "../utils";

const STATUS: { PROCESSED: VideoStatus } = {
  PROCESSED: "PROCESSED",
};

export async function handleBitmovinWebhook(event: { body: string }) {
  console.log("Received Bitmovin webhook:", event.body);

  let payload: BitmovinWebhookPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON" }),
    };
  }

  if (payload.type !== "ENCODING_FINISHED") {
    console.log("Ignoring webhook type:", payload.type);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Ignored" }),
    };
  }

  // jobId can be used to look up video if we store it during encoding creation
  // For now we extract videoId from output path
  const outputs = payload.outputs || [];

  if (outputs.length === 0) {
    console.error("No outputs found in webhook payload");
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "No outputs found" }),
    };
  }

  const outputPath = outputs[0].path;

  const videoId = outputPath.split("/")[1];

  if (!videoId) {
    console.error("Could not extract videoId from output path:", outputPath);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid output path" }),
    };
  }

  try {
    const videoResult = await docClient.send(
      new GetCommand({
        TableName: VIDEO_TABLE_NAME,
        Key: { pk: `VIDEO#${videoId}`, sk: "META" },
      }),
    );

    if (!videoResult.Item) {
      console.error("Video not found:", videoId);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Video not found" }),
      };
    }

    const manifestPath = `processed-outputs/${videoId}/index.m3u8`;
    const cdnUrl = `https://${CLOUDFRONT_DOMAIN}/${manifestPath}`;

    await updateVideoStatus(videoId, STATUS.PROCESSED, {
      cdnUrl,
    });

    console.log("Video processed successfully:", videoId, "cdnUrl:", cdnUrl);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  } catch (e) {
    console.error("Error processing webhook:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Processing error" }),
    };
  }
}
