import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type TicketItem } from "@my-app/shared";
import {
  API_URL,
  LOCK_TABLE_NAME,
  MAIN_TABLE_NAME,
  type ReservePostDTO,
  docClient,
} from "../utils";

async function deleteLock(ticketId: string) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: LOCK_TABLE_NAME,
        Key: { ticketId },
      }),
    );
  } catch (e) {
    console.error("CRITICAL: Failed to release lock", e);
  }
}

export async function reserveTicket(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Request body is required" }),
    };
  }

  const body = JSON.parse(event.body) as ReservePostDTO;
  const { ticketId, eventId } = body;

  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const bookingId = crypto.randomUUID();
  const now = Date.now();
  const isoDate = new Date(now).toISOString();
  const ttl = Math.floor(now / 1000) + 600;

  let ticketPrice: number;
  let ticketSeat: string;
  try {
    const ticketResult = await docClient.send(
      new GetCommand({
        TableName: MAIN_TABLE_NAME,
        Key: { pk: `EVENT#${eventId}`, sk: `TICKET#${ticketId}` },
      }),
    );

    if (!ticketResult.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Ticket not found" }),
      };
    }

    if (ticketResult.Item.status === "SOLD") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Ticket already sold" }),
      };
    }

    const ticket = ticketResult.Item as TicketItem;

    if (ticket.status === "SOLD") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Ticket already sold" }),
      };
    }

    ticketPrice = ticket.price;
    ticketSeat = ticket.seat;
  } catch (e) {
    console.error("Error fetching ticket:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch ticket" }),
    };
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: LOCK_TABLE_NAME,
        Item: {
          lockId: ticketId,
          ttl,
        },
        ConditionExpression: "attribute_not_exists(lockId)",
      }),
    );
  } catch (e) {
    if (ConditionalCheckFailedException.name === (e as { name?: string }).name) {
      console.error("Error locking ticket, already locked: ", e);
      return {
        statusCode: 409,
        body: JSON.stringify({ message: "Ticket already reserved" }),
      };
    }
    console.error("Error locking ticket:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to lock ticket" }),
    };
  }

  try {
    await docClient.send(
      new PutCommand({
        TableName: MAIN_TABLE_NAME,
        Item: {
          pk: `BOOKING#${bookingId}`,
          sk: "META",

          gsi1pk: `USER#${userId}`,
          gsi1sk: isoDate,

          entityType: "BOOKING",
          eventId: eventId,
          ticketId: ticketId,
          ticketSeat: ticketSeat,
          ticketPrice: ticketPrice,
          totalPrice: ticketPrice,
          userId: userId,
          status: "PENDING",
          createdAt: isoDate,
          bookingId: bookingId,

          ttl: ttl,
        },
      }),
    );
  } catch (e) {
    console.error("Error creating booking:", e);
    await deleteLock(ticketId);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to reserve ticket" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ bookingId, status: "PENDING", price: ticketPrice }),
  };
}
