import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { type BookingItem, type BookingTicketItem } from "@my-app/shared";
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
    const result = await docClient.send(
      new QueryCommand({
        TableName: MAIN_TABLE_NAME,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `BOOKING#${bookingId}`,
        },
      }),
    );

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Booking not found" }),
      };
    }

    const metaItem = result.Items.find((item) => item.sk === "META");
    const ticketItems = result.Items.filter((item) => item.sk.startsWith("TICKET#"));

    if (!metaItem) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Booking not found" }),
      };
    }

    const booking = metaItem as BookingItem;
    const tickets = ticketItems.map((item) => ({
      id: (item as BookingTicketItem).ticketId,
      seat: (item as BookingTicketItem).seat,
      price: (item as BookingTicketItem).price,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        bookingId: booking.id,
        status: booking.status,
        tickets: tickets,
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
