import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, BatchGetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { getEventById } = await import("../getEventById");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("getEventById", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
  });

  it("should return 400 when eventId is missing", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/events",
        },
      },
      pathParameters: {},
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const response = await getEventById(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Event ID is required");
  });

  it("should return 404 when event not found", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/events/1",
        },
      },
      pathParameters: { eventId: "1" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(QueryCommand).resolves({
      Items: [],
    });

    const response = await getEventById(mockEvent);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Event not found");
  });

  it("should return event successfully with tickets", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/events/1",
        },
      },
      pathParameters: { eventId: "1" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const mockItems = [
      {
        pk: "EVENT#1",
        sk: "META",
        id: "1",
        name: "Concert",
        date: "2024-12-01",
        location: "Stadium",
        imageUrl: "https://example.com/image.jpg",
        gsi3pk: "EVENT",
      },
      {
        pk: "EVENT#1",
        sk: "TICKET#ticket-1",
        id: "ticket-1",
        eventId: "1",
        seat: "A1",
        price: 100,
        status: "AVAILABLE",
      },
    ];

    mockDocClient.on(QueryCommand).resolves({
      Items: mockItems,
    });

    mockDocClient.on(BatchGetCommand).resolves({
      Responses: {
        LockTable: [],
      },
    });

    const response = await getEventById(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe("1");
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].status).toBe("AVAILABLE");
  });

  it("should mark reserved tickets as RESERVED", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/events/1",
        },
      },
      pathParameters: { eventId: "1" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    const mockItems = [
      {
        pk: "EVENT#1",
        sk: "META",
        id: "1",
        name: "Concert",
        date: "2024-12-01",
        location: "Stadium",
        imageUrl: "https://example.com/image.jpg",
        gsi3pk: "EVENT",
      },
      {
        pk: "EVENT#1",
        sk: "TICKET#ticket-1",
        id: "ticket-1",
        eventId: "1",
        seat: "A1",
        price: 100,
        status: "AVAILABLE",
      },
    ];

    mockDocClient.on(QueryCommand).resolves({
      Items: mockItems,
    });

    mockDocClient.on(BatchGetCommand).resolves({
      Responses: {
        LockTable: [{ lockId: "ticket-1" }],
      },
    });

    const response = await getEventById(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.tickets[0].status).toBe("RESERVED");
  });

  it("should return 500 on DynamoDB error", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "GET",
          path: "/events/1",
        },
      },
      pathParameters: { eventId: "1" },
    } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

    mockDocClient.on(QueryCommand).rejects(new Error("DynamoDB error"));

    const response = await getEventById(mockEvent);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to fetch event");
  });
});
