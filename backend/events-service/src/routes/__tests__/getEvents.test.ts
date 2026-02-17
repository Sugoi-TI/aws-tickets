import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { vi, beforeEach, describe, it, expect } from "vitest";

vi.stubEnv("MAIN_TABLE_NAME", "MainTable");
vi.stubEnv("LOCK_TABLE_NAME", "LockTable");

const { getEvents } = await import("../getEvents");
import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

describe("getEvents", () => {
  const mockDocClient = mockClient(DynamoDBDocumentClient);
  const mockEvent = {
    requestContext: {
      http: {
        method: "GET",
        path: "/events",
      },
    },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

  beforeEach(() => {
    mockDocClient.reset();
    vi.clearAllMocks();
  });

  it("should return events successfully", async () => {
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
    ];

    mockDocClient.on(QueryCommand).resolves({
      Items: mockItems,
    });

    const response = await getEvents(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
  });

  it("should return 500 on DynamoDB error", async () => {
    mockDocClient.on(QueryCommand).rejects(new Error("DynamoDB error"));

    const response = await getEvents(mockEvent);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Failed to fetch events");
  });

  it("should return empty array when no events", async () => {
    mockDocClient.on(QueryCommand).resolves({
      Items: [],
    });

    const response = await getEvents(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual([]);
  });
});
