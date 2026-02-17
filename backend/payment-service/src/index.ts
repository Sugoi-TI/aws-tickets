import { APIGatewayProxyEventV2 } from "aws-lambda";
import { processPayment } from "./routes/processPayment";

function matchRoute(method: string, path: string): "processPayment" | null {
  if (method === "POST" && path === "/stripe/pay") {
    return "processPayment";
  }
  return null;
}

export async function handler(event: APIGatewayProxyEventV2) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath;

  const route = matchRoute(method, path);

  switch (route) {
    case "processPayment":
      return processPayment(event);
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
  }
}
