import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import {
  type EventDetailsDTO,
  type EventItem,
  type EventPreview,
  Mappers,
  TicketItem,
} from "@my-app/shared";

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

  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method;
  const endpoint = event.requestContext.http?.path;
  const params = event.pathParameters;

  // all events
  if (method === "GET" && endpoint === "/events") {
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
    const getEventCommand = new QueryCommand({
      TableName: MAIN_TABLE_NAME,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": `EVENT#${params.eventId}`,
      },
    });

    let items;

    try {
      const result = await docClient.send(getEventCommand);
      items = (result?.Items as (EventItem | TicketItem)[]) || [];
    } catch (e) {
      console.error("Fetch event error: ", e);

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Failed to fetch event" }),
      };
    }

    if (!items.length) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    const eventMeta = items.find((item) => item.sk === "META");
    const tickets = items.filter((item) => item.sk.startsWith("TICKET#")) as TicketItem[];

    if (!eventMeta) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ message: "Event not found" }),
      };
    }

    // Check LockTable for reserved tickets
    const ticketIds = tickets.map((t) => t.id);

    let lockedTicketIds: string[] = [];
    if (ticketIds.length > 0) {
      try {
        const lockKeys = ticketIds.map((id) => ({ ticketId: id }));
        const lockResult = await docClient.send(
          new BatchGetCommand({
            RequestItems: {
              [LOCK_TABLE_NAME]: { Keys: lockKeys },
            },
          }),
        );

        const locks = lockResult.Responses?.[LOCK_TABLE_NAME] || [];
        lockedTicketIds = locks.map((lock) => lock.ticketId as string);
      } catch (e) {
        console.error("Error fetching locks:", e);
      }
    }

    // TODO optimize
    const mappedTickets = tickets.map(Mappers.toTicket);

    const ticketsWithStatus = mappedTickets.map((ticket) => ({
      ...ticket,
      status: lockedTicketIds.includes(ticket.id) ? "RESERVED" : ticket.status,
    }));

    const eventDetailsWithTickets: EventDetailsDTO = {
      ...Mappers.toEventDetails(eventMeta),
      tickets: ticketsWithStatus,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(eventDetailsWithTickets),
    };
  }

  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ message: "Failed to handle request" }),
  };
}
