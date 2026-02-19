import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { createUploadUrl } from "./routes/createUploadUrl";
import { listVideos } from "./routes/listVideos";

interface Route {
  method: string;
  pathPattern: string;
  handler: "createUploadUrl" | "listVideos";
}

const routes: Route[] = [
  { method: "POST", pathPattern: "/videos/upload", handler: "createUploadUrl" },
  { method: "GET", pathPattern: "/videos", handler: "listVideos" },
];

function matchRoute(method: string, path: string): "createUploadUrl" | "listVideos" | null {
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
    case "createUploadUrl":
      return createUploadUrl(event);
    case "listVideos":
      return listVideos(event);
    default:
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Not Found" }),
      };
  }
}
