import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { reserveTicket } from "./routes/reserveTicket";
import { getBooking } from "./routes/getBooking";
import { initiatePayment } from "./routes/initiatePayment";
import { handleWebhook } from "./routes/handleWebhook";

interface Route {
  method: string;
  pathPattern: string;
  handler: "reserveTicket" | "getBooking" | "initiatePayment" | "handleWebhook";
}

const routes: Route[] = [
  { method: "POST", pathPattern: "/bookings/reserve", handler: "reserveTicket" },
  { method: "POST", pathPattern: "/bookings/pay", handler: "initiatePayment" },
  { method: "POST", pathPattern: "/bookings/webhook", handler: "handleWebhook" },
  { method: "GET", pathPattern: "/bookings/{bookingId}", handler: "getBooking" },
];

function matchRoute(
  method: string,
  path: string,
): "reserveTicket" | "getBooking" | "initiatePayment" | "handleWebhook" | null {
  for (const route of routes) {
    if (route.method !== method) continue;

    const routeParts = route.pathPattern.split("/");
    const pathParts = path.split("/");

    if (routeParts.length !== pathParts.length) continue;

    const isMatch = routeParts.every((part, i) => {
      if (part.startsWith("{")) return true;
      return part === pathParts[i];
    });

    if (isMatch) return route.handler;
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
