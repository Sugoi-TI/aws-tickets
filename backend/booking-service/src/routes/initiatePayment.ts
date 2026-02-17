import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type BookingItem } from "@my-app/shared";
import { API_URL, MAIN_TABLE_NAME, type PayPostDTO, docClient } from "../utils";

export async function initiatePayment(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Request body is required" }),
    };
  }

  const body = JSON.parse(event.body) as PayPostDTO;
  const { bookingId } = body;

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

    if (booking.status !== "PENDING") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Booking is not pending" }),
      };
    }

    const paymentResponse = await fetch(`${API_URL}/stripe/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId,
        amount: booking.totalPrice,
        webhookUrl: `${API_URL}/bookings/webhook`,
      }),
    });

    const paymentData = await paymentResponse.json();

    return {
      statusCode: paymentResponse.ok ? 200 : 500,
      body: JSON.stringify(paymentData),
    };
  } catch (e) {
    console.error("Error processing payment:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to process payment" }),
    };
  }
}
