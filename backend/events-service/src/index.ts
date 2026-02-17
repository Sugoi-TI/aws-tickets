import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getEvents } from "./routes/getEvents";
import { getEventById } from "./routes/getEventById";

function matchRoute(method: string, path: string): "getEvents" | "getEventById" | null {
  if (method === "GET" && path === "/events") {
    return "getEvents";
  }
  if (method === "GET" && /^\/events\/[^/]+$/.test(path)) {
    return "getEventById";
  }
  return null;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  console.log(`Received event: ${JSON.stringify(event, null, 2)}`);

  const method = event.requestContext?.http?.method || "";
  const path = event.rawPath;

  const route = matchRoute(method, path);

  switch (route) {
    case "getEvents":
      return getEvents(event);
    case "getEventById":
      return getEventById(event);
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
  }
}
