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

  if (payload.type === "ENCODING_ERROR") {
    console.error("Encoding failed:", payload);
    // TODO: Update video status to FAILED
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Encoding failed handled" }),
    };
  }

  if (payload.type !== "ENCODING_FINISHED") {
    console.log("Ignoring webhook type:", payload.type);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Ignored" }),
    };
  }

  const encodingName = payload.encoding?.name;

  if (!encodingName || !encodingName.startsWith("encoding-")) {
    console.error("Invalid encoding name in webhook:", encodingName);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid encoding name" }),
    };
  }

  const videoId = encodingName.replace("encoding-", "");

  if (!videoId) {
    console.error("Could not extract videoId from encoding name:", encodingName);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid videoId extraction" }),
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
