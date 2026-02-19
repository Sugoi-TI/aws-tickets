import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { getEvents } from "./routes/getEvents";
import { getEventById } from "./routes/getEventById";

interface Route {
  method: string;
  pathPattern: string;
  handler: "getEvents" | "getEventById";
}

const routes: Route[] = [
  { method: "GET", pathPattern: "/events", handler: "getEvents" },
  { method: "GET", pathPattern: "/event/{eventId}", handler: "getEventById" },
];

function matchRoute(method: string, path: string): "getEvents" | "getEventById" | null {
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
