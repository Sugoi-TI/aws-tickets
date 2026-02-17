import { vi, beforeEach, describe, it, expect } from "vitest";

const { processPayment } = await import("../processPayment");
import { APIGatewayProxyEventV2 } from "aws-lambda";

describe("processPayment", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 400 when body is missing", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/stripe/pay",
        },
      },
      body: undefined,
    } as unknown as APIGatewayProxyEventV2;

    const response = await processPayment(mockEvent);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Request body is required");
  });

  it("should process payment and call webhook", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/stripe/pay",
        },
      },
      body: JSON.stringify({
        bookingId: "booking-123",
        amount: 100,
        webhookUrl: "http://localhost:3000/webhook",
      }),
    } as unknown as APIGatewayProxyEventV2;

    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "fake-uuid-123" as `${string}-${string}-${string}-${string}-${string}`,
    );

    const response = await processPayment(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Payment processed");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:3000/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-stripe-signature": "secret-123",
        }),
        body: expect.stringContaining("bookingId"),
      }),
    );
  });

  it("should still return 200 even if webhook fails", async () => {
    const mockEvent = {
      requestContext: {
        http: {
          method: "POST",
          path: "/stripe/pay",
        },
      },
      body: JSON.stringify({
        bookingId: "booking-123",
        amount: 100,
        webhookUrl: "http://localhost:3000/webhook",
      }),
    } as unknown as APIGatewayProxyEventV2;

    fetchSpy = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await processPayment(mockEvent);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe("Payment processed");
  });
});
