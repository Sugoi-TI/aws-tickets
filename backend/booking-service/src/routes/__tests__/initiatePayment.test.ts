import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.stubEnv("API_URL", "http://localhost:3000");
vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { initiatePayment } = await import("../initiatePayment");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("initiatePayment", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Payment processed" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("should return 400 when body is missing", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/pay",
        },
      },
      body: undefined,
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await initiatePayment(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Request body is required");
  });

  it("should return 404 when booking not found", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/pay",
        },
      },
      body: JSON.stringify({ bookingId: "booking-123" }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({});

    const response = await initiatePayment(mockEvent);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Booking not found");
  });

  it("should return 400 when booking is not PENDING", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/pay",
        },
      },
      body: JSON.stringify({ bookingId: "booking-123" }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "BOOKING#booking-123",
        sk: "META",
        id: "booking-123",
        status: "CONFIRMED",
        totalPrice: 100,
      },
    });

    const response = await initiatePayment(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Booking is not pending");
  });

  it("should process payment successfully", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/pay",
        },
      },
      body: JSON.stringify({ bookingId: "booking-123" }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "BOOKING#booking-123",
        sk: "META",
        id: "booking-123",
        status: "PENDING",
        totalPrice: 100,
      },
    });

    const response = await initiatePayment(mockEvent);

    expect(response.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/stripe/pay",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("should return 500 on DynamoDB error", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/pay",
        },
      },
      body: JSON.stringify({ bookingId: "booking-123" }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).rejects(new Error("DynamoDB error"));

    const response = await initiatePayment(mockEvent);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to process payment");
  });
});
