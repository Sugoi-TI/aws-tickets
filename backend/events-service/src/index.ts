import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { EventDetailsDTO, EventItem, EventPreview, Mappers } from "@my-app/shared";

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
  const endpoint = event.requestContext.http?.path;
  const params = event.pathParameters;

  // all events
  if (method === "GET" && endpoint === "events") {
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

  // single event with tickets
  if (method === "GET" && params?.eventId) {
    const getEventCommand = new GetCommand({
      TableName: MAIN_TABLE_NAME,
      Key: {
        pk: `EVENT#${params.eventId}`,
        sk: "META",
      },
    });

    let eventDetails: EventDetailsDTO;

    try {
      const result = await docClient.send(getEventCommand);

      eventDetails = Mappers.toEventDetails(result.Item as EventItem);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(eventDetails),
      };
    } catch (e) {
      console.error("Fetch event error: ", e);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Failed to fetch event" }),
      };
    }
  }
}
