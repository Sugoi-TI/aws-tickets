import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { getBooking } = await import("../getBooking");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("getBooking", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
  });

  it("should return 400 when bookingId is missing", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/bookings/",
        },
      },
      pathParameters: {},
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await getBooking(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Booking ID is required");
  });

  it("should return 404 when booking not found", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/bookings/booking-123",
        },
      },
      pathParameters: { bookingId: "booking-123" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({});

    const response = await getBooking(mockEvent);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Booking not found");
  });

  it("should return booking successfully", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/bookings/booking-123",
        },
      },
      pathParameters: { bookingId: "booking-123" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "BOOKING#booking-123",
        sk: "META",
        id: "booking-123",
        eventId: "event-1",
        ticketId: "ticket-1",
        ticketSeat: "A1",
        totalPrice: 100,
        status: "PENDING",
        userId: "user-123",
        createdAt: "2024-01-01T00:00:00Z",
      },
    });

    const response = await getBooking(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.bookingId).toBe("booking-123");
    expect(body.status).toBe("PENDING");
    expect(body.ticketSeat).toBe("A1");
    expect(body.totalPrice).toBe(100);
  });

  it("should return 500 on DynamoDB error", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/bookings/booking-123",
        },
      },
      pathParameters: { bookingId: "booking-123" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).rejects(new Error("DynamoDB error"));

    const response = await getBooking(mockEvent);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to fetch booking");
  });
});
