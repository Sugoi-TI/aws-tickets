import { handler } from "./index";

const mockEvent: any = {
  requestContext: {
    http: {
      method: "GET",
    },
  },
  headers: {},
  body: null,
};

async function run() {
  console.log("🚀 Starting local Lambda execution...");

  try {
    const result = await handler(mockEvent);
    console.log("✅ Result:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

run();
