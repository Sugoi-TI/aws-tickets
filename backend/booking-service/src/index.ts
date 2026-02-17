import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { reserveTicket } from "./routes/reserveTicket";
import { getBooking } from "./routes/getBooking";
import { initiatePayment } from "./routes/initiatePayment";
import { handleWebhook } from "./routes/handleWebhook";

function matchRoute(
  method: string,
  path: string,
): "reserveTicket" | "getBooking" | "initiatePayment" | "handleWebhook" | null {
  if (method === "POST" && path === "/bookings/reserve") {
    return "reserveTicket";
  }
  if (method === "GET" && /^\/bookings\/[^/]+$/.test(path)) {
    return "getBooking";
  }
  if (method === "POST" && path === "/bookings/pay") {
    return "initiatePayment";
  }
  if (method === "POST" && path === "/bookings/webhook") {
    return "handleWebhook";
  }
  return null;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath;

  const route = matchRoute(method, path);

  switch (route) {
    case "reserveTicket":
      return reserveTicket(event);
    case "getBooking":
      return getBooking(event);
    case "initiatePayment":
      return initiatePayment(event);
    case "handleWebhook":
      return handleWebhook(event);
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
  }
}
