import { APIGatewayProxyEventV2 } from "aws-lambda";

type PayPostDTO = {
  bookingId: string;
  amount: number;
  webhookUrl: string;
};

export async function processPayment(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Request body is required" }),
    };
  }

  const body = JSON.parse(event.body) as PayPostDTO;
  const { bookingId, amount, webhookUrl } = body;

  const isSuccess = true;

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
    body: JSON.stringify({ message: "Payment processed" }),
  };
}
