import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { handleWebhook } = await import("../handleWebhook");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("handleWebhook", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
  });

  it("should return 403 when signature is invalid", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "invalid-signature" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { bookingId: "booking-123", transactionId: "txn-123" },
      }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Invalid signature");
  });

  it("should return 400 when body is invalid JSON", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "secret-123" },
      body: "invalid-json",
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Invalid JSON");
  });

  it("should return 200 and ignore non-success payment", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "secret-123" },
      body: JSON.stringify({
        type: "payment_intent.failed",
        data: { bookingId: "booking-123", transactionId: "txn-123" },
      }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Ignored");
  });

  it("should return 404 when booking not found", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "secret-123" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { bookingId: "booking-123", transactionId: "txn-123" },
      }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({});

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Booking not found");
  });

  it("should return 200 when booking already confirmed", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "secret-123" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { bookingId: "booking-123", transactionId: "txn-123" },
      }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "BOOKING#booking-123",
        sk: "META",
        id: "booking-123",
        status: "CONFIRMED",
        eventId: "event-1",
        userId: "user-123",
        ticketId: "ticket-1",
      },
    });

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Already confirmed");
  });

  it("should process webhook successfully", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/bookings/webhook",
        },
      },
      headers: { "x-stripe-signature": "secret-123" },
      body: JSON.stringify({
        type: "payment_intent.succeeded",
        data: { bookingId: "booking-123", transactionId: "txn-123" },
      }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "BOOKING#booking-123",
        sk: "META",
        id: "booking-123",
        status: "PENDING",
        eventId: "event-1",
        userId: "user-123",
        ticketId: "ticket-1",
      },
    });

    mockDocClient.on(TransactWriteCommand).resolves({});

    const response = await handleWebhook(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Success");
  });
});
