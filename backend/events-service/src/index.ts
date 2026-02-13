import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { EventItem, Event, Mappers } from "@my-app/shared";

const MAIN_TABLE_NAME = process.env.MAIN_TABLE_NAME || "";
const LOCK_TABLE_NAME = process.env.LOCK_TABLE_NAME || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!MAIN_TABLE_NAME) {
    throw new Error("Critical: MAIN_TABLE_NAME is not defined in environment variables");
  }
  if (!LOCK_TABLE_NAME) {
    throw new Error("Critical: LOCK_TABLE_NAME is not defined in environment variables");
  }

  console.log(`Received event: ${event}`);

  const method = event.requestContext?.http?.method;

  if (method === "GET") {
    const getEventsCommand = new QueryCommand({
      TableName: MAIN_TABLE_NAME,
      IndexName: "GSI3",
      KeyConditionExpression: "gsi3pk = :pk",
      ExpressionAttributeValues: {
        ":pk": "EVENT",
      },
      ScanIndexForward: true,
    });

    let allEvents: Event[];

    try {
      const result = await docClient.send(getEventsCommand);

      allEvents = (result.Items as EventItem[])?.map(Mappers.toEvent);
    } catch (e) {
      console.error("Fetch all events error: ", e);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Failed to fetch events" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(allEvents),
    };
  }
}
