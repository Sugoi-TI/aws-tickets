import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type EventItem, type EventPreview, Mappers } from "@my-app/shared";
import { MAIN_TABLE_NAME, docClient } from "../utils";

export async function getEvents(_event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const getEventsCommand = new QueryCommand({
    TableName: MAIN_TABLE_NAME,
    IndexName: "GSI3",
    KeyConditionExpression: "gsi3pk = :pk",
    ExpressionAttributeValues: {
      ":pk": "EVENT",
    },
    ScanIndexForward: true,
  });

  let allEvents: EventPreview[];

  try {
    const result = await docClient.send(getEventsCommand);
    allEvents = (result.Items as EventItem[])?.map(Mappers.toEventPreview);
  } catch (e) {
    console.error("Fetch all events error: ", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch events" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(allEvents),
  };
}
