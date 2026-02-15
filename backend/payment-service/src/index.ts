import { APIGatewayProxyEventV2 } from "aws-lambda";

type PayPostDTO = {
  bookingId: string;
  amount: number;
  webhookUrl: string;
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function handler(event: APIGatewayProxyEventV2) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method;
  const endpoint = event.requestContext.http?.path;

  if (method === "POST" && endpoint === "/pay") {
    if (event.body) {
      const body = JSON.parse(event.body) as PayPostDTO;
      const { bookingId, amount, webhookUrl } = body;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const isSuccess = Math.random() > 0.1;

      const webhookPayload = {
        type: isSuccess ? "payment_intent.succeeded" : "payment_intent.failed",
        data: {
          bookingId,
          transactionId: `ch_fake_${crypto.randomUUID()}`,
          amount,
        },
      };

      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stripe-signature": "secret-123",
          },
          body: JSON.stringify(webhookPayload),
        });
      } catch (e) {
        console.error("Failed to send webhook:", e);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Payment processing started" }),
      };
    }
  }

  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ message: "Failed to handle request" }),
  };
}
