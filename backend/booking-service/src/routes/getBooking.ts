import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type BookingItem } from "@my-app/shared";
import { MAIN_TABLE_NAME, docClient } from "../utils";

export async function getBooking(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const bookingId = event.pathParameters?.bookingId;

  if (!bookingId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Booking ID is required" }),
    };
  }

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

    return {
      statusCode: 200,
      body: JSON.stringify({
        bookingId: booking.id,
        status: booking.status,
        ticketId: booking.ticketId,
        ticketSeat: booking.ticketSeat,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
      }),
    };
  } catch (e) {
    console.error("Error fetching booking:", e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to fetch booking" }),
    };
  }
}
