import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type TicketItem } from "@my-app/shared";
import { LOCK_TABLE_NAME, MAIN_TABLE_NAME, type ReservePostDTO, docClient } from "../utils";

async function deleteLock(ticketId: string) {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: LOCK_TABLE_NAME,
        Key: { lockId: ticketId },
      }),
    );
  } catch (e) {
    console.error("CRITICAL: Failed to release lock", e);
  }
}

async function deleteLocks(ticketIds: string[]) {
  await Promise.all(ticketIds.map((id) => deleteLock(id)));
}

export async function reserveTicket(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Request body is required" }),
    };
  }

  const body = JSON.parse(event.body) as ReservePostDTO;
  const { ticketIds, eventId } = body;

  if (!ticketIds || ticketIds.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "At least one ticket is required" }),
    };
  }

  const userId = event.requestContext.authorizer.jwt.claims.sub as string;
  const bookingId = crypto.randomUUID();
  const now = Date.now();
  const isoDate = new Date(now).toISOString();
  const ttl = Math.floor(now / 1000) + 600;

  const lockPromises: Array<Promise<void>> = [];

  for (const ticketId of ticketIds) {
    lockPromises.push(
      (async () => {
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
            throw new Error(`Ticket ${ticketId} is already reserved`);
          }
          throw new Error(`Failed to lock ticket ${ticketId}`);
        }
      })(),
    );
  }

  try {
    await Promise.all(lockPromises);
  } catch (e) {
    console.error("Error locking tickets:", e);
    return {
      statusCode: 409,
      body: JSON.stringify({ message: e instanceof Error ? e.message : "Ticket already reserved" }),
    };
  }

  const tickets: Array<{ id: string; seat: string; price: number }> = [];

  try {
    const ticketResults = await Promise.all(
      ticketIds.map((ticketId) =>
        docClient.send(
          new GetCommand({
            TableName: MAIN_TABLE_NAME,
            Key: { pk: `EVENT#${eventId}`, sk: `TICKET#${ticketId}` },
          }),
        ),
      ),
    );

    for (let i = 0; i < ticketResults.length; i++) {
      const ticketId = ticketIds[i];
      const ticketResult = ticketResults[i];

      if (!ticketResult.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: `Ticket ${ticketId} not found` }),
        };
      }

      const ticket = ticketResult.Item as TicketItem;

      if (ticket.status === "SOLD") {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: `Ticket ${ticketId} already sold` }),
        };
      }

      tickets.push({
        id: ticket.id,
        seat: ticket.seat,
        price: ticket.price,
      });
    }
  } catch (e) {
    console.error("Error fetching tickets:", e);
    await deleteLocks(ticketIds);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch tickets" }),
    };
  }

  const totalPrice = tickets.reduce((sum, t) => sum + t.price, 0);

  try {
    const transactItems = [
      {
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: `BOOKING#${bookingId}`,
            sk: "META",
            gsi1pk: `USER#${userId}`,
            gsi1sk: isoDate,
            entityType: "BOOKING",
            eventId: eventId,
            totalPrice: totalPrice,
            userId: userId,
            status: "PENDING",
            createdAt: isoDate,
            id: bookingId,
            ttl: ttl,
          },
        },
      },
      ...tickets.map((ticket) => ({
        Put: {
          TableName: MAIN_TABLE_NAME,
          Item: {
            pk: `BOOKING#${bookingId}`,
            sk: `TICKET#${ticket.id}`,
            entityType: "BOOKING_TICKET",
            ticketId: ticket.id,
            seat: ticket.seat,
            price: ticket.price,
            eventId: eventId,
            createdAt: isoDate,
          },
        },
      })),
    ];

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );
  } catch (e) {
    console.error("Error creating booking:", e);
    await deleteLocks(ticketIds);

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to reserve tickets" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ bookingId, status: "PENDING", price: totalPrice }),
  };
}
