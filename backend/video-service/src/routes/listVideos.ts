import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { VIDEO_TABLE_NAME, docClient } from "../utils";

export async function listVideos(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: VIDEO_TABLE_NAME,
        IndexName: "GSI1",
        KeyConditionExpression: "gsi1pk = :pk",
        ExpressionAttributeValues: {
          ":pk": "VIDEO#META",
        },
        ScanIndexForward: false,
      }),
    );

    const videos = (result.Items || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
      cdnUrl: item.cdnUrl,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(videos),
    };
  } catch (e) {
    console.error("Error listing videos:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to list videos" }),
    };
  }
}
