import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { BookingItem } from "@my-app/shared";

type ReservePostDTO = {
  ticketId: string;
  eventId: string;
};

type PaymentWebhookDTO = {
  type: string;
  data: {
    bookingId: string;
    transactionId: string;
    userId?: string;
  };
};

const MAIN_TABLE_NAME = process.env.MAIN_TABLE_NAME || "";
const LOCK_TABLE_NAME = process.env.LOCK_TABLE_NAME || "";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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

  if (method === "POST" && endpoint === "reserve") {
    if (event.body) {
      const body = JSON.parse(event.body) as ReservePostDTO;
      const { ticketId, eventId } = body;

      const userId = event.requestContext.authorizer.jwt.claims.sub as string;
      const bookingId = crypto.randomUUID();
      const now = Date.now();
      const isoDate = new Date(now).toISOString();
      const ttl = Math.floor(now / 1000) + 600; // 10min

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
            headers,
            body: JSON.stringify({ message: "Ticket not found" }),
          };
        }

        if (ticketResult.Item.status === "SOLD") {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: "Ticket already sold" }),
          };
        }

        ticketPrice = ticketResult.Item.price as number;
        ticketSeat = ticketResult.Item.seat as string;
      } catch (e) {
        console.error("Error fetching ticket:", e);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ message: "Failed to fetch ticket" }),
        };
      }

      try {
        await docClient.send(
          new PutCommand({
            TableName: LOCK_TABLE_NAME,
            Item: {
              ticketId,
              ttl,
            },
            ConditionExpression: "attribute_not_exists(ticketId)",
          }),
        );
      } catch (e) {
        // @ts-ignore
        if (ConditionalCheckFailedException.name === e.name) {
          console.error("Error locking ticket, already locked: ", e);
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ message: "Ticket already reserved" }),
          };
        }
        console.error("Error locking ticket:", e);
        return {
          statusCode: 500,
          headers,
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
          headers,
          body: JSON.stringify({ message: "Failed to reserve ticket" }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ bookingId, status: "PENDING", price: ticketPrice }),
      };
    }
  }

  if (method === "POST" && endpoint === "webhook") {
    const signature = event.headers["x-stripe-signature"];

    if (signature !== "secret-123") {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ message: "Invalid signature" }),
      };
    }

    let body: PaymentWebhookDTO;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "Invalid JSON" }),
      };
    }

    if (body.type !== "payment_intent.succeeded") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Ignored" }),
      };
    }

    const { bookingId, transactionId } = body.data;

    try {
      const bookingResult = await docClient.send(
        new GetCommand({
          TableName: MAIN_TABLE_NAME,
          Key: { pk: `BOOKING#${bookingId}`, sk: "META" },
        }),
      );

      if (!bookingResult.Item) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ message: "Booking not found" }),
        };
      }

      const booking = bookingResult.Item as BookingItem;

      if (booking.status === "CONFIRMED") {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: "Already confirmed" }),
        };
      }

      const { eventId, userId, ticketId } = booking;
      const now = Date.now();

      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: MAIN_TABLE_NAME,
                Key: { pk: `BOOKING#${bookingId}`, sk: "META" },
                UpdateExpression:
                  "SET #status = :status, paymentId = :paymentId, paymentDate = :paymentDate REMOVE ttl",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":status": "CONFIRMED",
                  ":paymentId": transactionId,
                  ":paymentDate": new Date(now).toISOString(),
                },
              },
            },
            {
              Update: {
                TableName: MAIN_TABLE_NAME,
                Key: { pk: `EVENT#${eventId}`, sk: `TICKET#${ticketId}` },
                UpdateExpression: "SET #status = :status, gsi1pk = :userPk REMOVE ttl",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":status": "SOLD",
                  ":userPk": `USER#${userId}`,
                },
              },
            },
            {
              Delete: {
                TableName: LOCK_TABLE_NAME,
                Key: { ticketId },
              },
            },
          ],
        }),
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Success" }),
      };
    } catch (e) {
      console.error("Error processing webhook:", e);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ message: "Processing error" }),
      };
    }
  }

  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ message: "Failed to handle request" }),
  };
}
