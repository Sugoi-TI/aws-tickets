import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect, afterEach } from "vitest";

vi.stubEnv("API_URL", "http://localhost:3000");
vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { reserveTicket } = await import("../reserveTicket");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("reserveTicket", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);

  const mockEvent = {
    requestContext: {
      http: {
        method: "POST",
        path: "/bookings/reserve",
      },
      authorizer: {
        jwt: {
          claims: {
            sub: "user-123",
          },
        },
      },
    },
    body: JSON.stringify({ ticketIds: ["ticket-1"], eventId: "event-1" }),
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 400 when body is missing", async () => {
    const eventNoBody = {
      ...mockEvent,
      body: undefined,
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await reserveTicket(eventNoBody);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Request body is required");
  });

  it("should return 400 when no tickets provided", async () => {
    const eventNoTickets = {
      ...mockEvent,
      body: JSON.stringify({ ticketIds: [], eventId: "event-1" }),
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await reserveTicket(eventNoTickets);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("At least one ticket is required");
  });

  it("should return 404 when ticket not found", async () => {
    mockDocClient.on(PutCommand).resolves({});
    mockDocClient.on(GetCommand).resolves({});

    const response = await reserveTicket(mockEvent);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Ticket ticket-1 not found");
  });

  it("should return 400 when ticket already sold", async () => {
    mockDocClient.on(PutCommand).resolves({});
    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "EVENT#event-1",
        sk: "TICKET#ticket-1",
        id: "ticket-1",
        eventId: "event-1",
        seat: "A1",
        price: 100,
        status: "SOLD",
      },
    });

    const response = await reserveTicket(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Ticket ticket-1 already sold");
  });

  it("should return 409 when ticket already reserved (locked)", async () => {
    const error = new Error("Conditional check failed");
    error.name = "ConditionalCheckFailedException";
    mockDocClient.on(PutCommand).rejects(error);

    const response = await reserveTicket(mockEvent);

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Ticket ticket-1 is already reserved");
  });

  it("should reserve ticket successfully", async () => {
    mockDocClient.on(PutCommand).resolves({});
    mockDocClient.on(GetCommand).resolves({
      Item: {
        pk: "EVENT#event-1",
        sk: "TICKET#ticket-1",
        id: "ticket-1",
        eventId: "event-1",
        seat: "A1",
        price: 100,
        status: "AVAILABLE",
      },
    });

    mockDocClient.on(TransactWriteCommand).resolves({});

    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "fake-uuid-123" as `${string}-${string}-${string}-${string}-${string}`,
    );

    const response = await reserveTicket(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("PENDING");
    expect(body.price).toBe(100);
    expect(body.bookingId).toBe("fake-uuid-123");
  });

  it("should return 500 on DynamoDB error when fetching ticket", async () => {
    mockDocClient.on(PutCommand).resolves({});
    mockDocClient.on(GetCommand).rejects(new Error("DynamoDB error"));

    const response = await reserveTicket(mockEvent);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to fetch tickets");
  });
});
