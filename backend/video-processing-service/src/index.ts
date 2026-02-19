import { APIGatewayProxyEventV2, S3Event, SQSEvent, SNSEvent } from "aws-lambda";
import { handleS3UploadEvent } from "./routes/handleS3Upload";
import { handleBitmovinWebhook } from "./routes/handleBitmovinWebhook";

export async function handler(event: S3Event | APIGatewayProxyEventV2 | SQSEvent | SNSEvent) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  if ("Records" in event) {
    const s3Record = event.Records.find((r) => "s3" in r);
    if (s3Record) {
      console.log("Handling S3 event");
      const s3Records = event.Records.filter((r) => "s3" in r) as Array<{
        s3: { object: { key: string } };
      }>;
      return handleS3UploadEvent(s3Records);
    }
  }

  const apiEvent = event as APIGatewayProxyEventV2;
  const method = apiEvent.requestContext?.http?.method || "";
  const path = apiEvent.rawPath;

  if (method === "POST" && path === "/webhook/bitmovin") {
    return handleBitmovinWebhook({ body: apiEvent.body || "{}" });
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ message: "Not Found" }),
  };
}
