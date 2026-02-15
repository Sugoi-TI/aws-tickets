import { DynamoDBClient, ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

type ReservePostDTO = {
  ticketId: string;
  eventId: string;
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
            status: 500,
            headers,
            body: JSON.stringify({ message: "something went wrong" }),
          };
        }
        console.error("Error locking ticket, something went from: ", e);
        return {
          status: 500,
          headers,
          body: JSON.stringify({ message: "something went wrong" }),
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

              // Данные
              entityType: "BOOKING",
              ticketId: ticketId,
              eventId: eventId,
              userId: userId,
              status: "pending",
              createdAt: now,
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

      try {
        // call payment service
      } catch (e) {
        console.error("Error creating booking:", e);
        // set booking as failed
        await deleteLock(ticketId);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ message: "Failed to reserve ticket" }),
        };
      }
    }
  }

  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ message: "Failed to handle request" }),
  };
}
