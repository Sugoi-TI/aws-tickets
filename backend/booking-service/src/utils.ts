import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const API_URL = process.env.API_URL || "";
export const MAIN_TABLE_NAME = process.env.MAIN_TABLE_NAME || "";
export const LOCK_TABLE_NAME = process.env.LOCK_TABLE_NAME || "";

if (!MAIN_TABLE_NAME) {
  throw new Error("Critical: MAIN_TABLE_NAME is not defined in environment variables");
}
if (!LOCK_TABLE_NAME) {
  throw new Error("Critical: LOCK_TABLE_NAME is not defined in environment variables");
}

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

export type ReservePostDTO = {
  ticketIds: string[];
  eventId: string;
};

export type PayPostDTO = {
  bookingId: string;
};

export type PaymentWebhookDTO = {
  type: string;
  data: {
    bookingId: string;
    transactionId: string;
    userId?: string;
  };
};
