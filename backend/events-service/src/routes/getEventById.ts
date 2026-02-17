import { BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type EventDetailsDTO, type EventItem, Mappers, type TicketItem } from "@my-app/shared";
import { LOCK_TABLE_NAME, MAIN_TABLE_NAME, docClient } from "../utils";

export async function getEventById(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const eventId = event.pathParameters?.eventId;

  if (!eventId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Event ID is required" }),
    };
  }

  const getEventCommand = new QueryCommand({
    TableName: MAIN_TABLE_NAME,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": `EVENT#${eventId}`,
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
      body: JSON.stringify({ message: "Failed to fetch event" }),
    };
  }

  if (!items.length) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Event not found" }),
    };
  }

  const eventMeta = items.find((item) => "sk" in item && item.sk === "META") as
    | (EventItem & { sk: "META" })
    | undefined;
  const tickets = items.filter(
    (item) => "sk" in item && item.sk?.startsWith("TICKET#"),
  ) as TicketItem[];

  if (!eventMeta) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Event not found" }),
    };
  }

  const ticketIds = tickets.map((t) => t.id);

  let lockedTicketIds: string[] = [];
  if (ticketIds.length > 0) {
    try {
      const lockKeys = ticketIds.map((id) => ({ lockId: id }));
      const lockResult = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [LOCK_TABLE_NAME]: { Keys: lockKeys },
          },
        }),
      );

      const locks = lockResult.Responses?.[LOCK_TABLE_NAME] || [];
      lockedTicketIds = locks.map((lock) => lock.lockId as string);
    } catch (e) {
      console.error("Error fetching locks:", e);
    }
  }

  const lockedTicketSet = new Set(lockedTicketIds);
  const mappedTickets = tickets.map(Mappers.toTicket);

  const ticketsWithStatus = mappedTickets.map((ticket) => ({
    ...ticket,
    status: lockedTicketSet.has(ticket.id) ? "RESERVED" : ticket.status,
  }));

  const eventDetailsWithTickets: EventDetailsDTO = {
    ...Mappers.toEventDetails(eventMeta as never),
    tickets: ticketsWithStatus,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(eventDetailsWithTickets),
  };
}
