import { APIGatewayProxyEventV2 } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

type PayPostDTO = {
  bookingId: string;
  amount: number;
  webhookUrl: string;
};

type AsyncProcessDTO = PayPostDTO & {
  _async: boolean;
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

const lambdaClient = new LambdaClient({});

async function processPayment(bookingId: string, amount: number, webhookUrl: string) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // const isSuccess = Math.random() > 0.1;
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
}

export async function handler(event: APIGatewayProxyEventV2) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method;
  const endpoint = event.requestContext.http?.path;

  if (method === "POST" && endpoint === "/stripe/pay") {
    if (event.body) {
      const body = JSON.parse(event.body) as PayPostDTO | AsyncProcessDTO;

      if ("_async" in body && body._async) {
        await processPayment(body.bookingId, body.amount, body.webhookUrl);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: "Processed" }),
        };
      }

      const { bookingId, amount, webhookUrl } = body as PayPostDTO;

      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
          InvocationType: "Event",
          Payload: JSON.stringify({
            requestContext: event.requestContext,
            body: JSON.stringify({
              _async: true,
              bookingId,
              amount,
              webhookUrl,
            }),
          }),
        }),
      );

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
