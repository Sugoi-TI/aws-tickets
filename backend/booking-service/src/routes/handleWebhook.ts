import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type BookingItem } from "@my-app/shared";
import { LOCK_TABLE_NAME, MAIN_TABLE_NAME, type PaymentWebhookDTO, docClient } from "../utils";

export async function handleWebhook(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const signature = event.headers["x-stripe-signature"];

  if (signature !== "secret-123") {
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Invalid signature" }),
    };
  }

  let body: PaymentWebhookDTO;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid JSON" }),
    };
  }

  if (body.type !== "payment_intent.succeeded") {
    return {
      statusCode: 200,
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
        body: JSON.stringify({ message: "Booking not found" }),
      };
    }

    const booking = bookingResult.Item as BookingItem;

    if (booking.status === "CONFIRMED") {
      return {
        statusCode: 200,
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
                "SET #status = :status, paymentId = :paymentId, paymentDate = :paymentDate",
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
              UpdateExpression: "SET #status = :status, gsi1pk = :userPk",
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
              Key: { lockId: ticketId },
            },
          },
        ],
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  } catch (e) {
    console.error("Error processing webhook:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Processing error" }),
    };
  }
}
