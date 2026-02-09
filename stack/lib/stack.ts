import * as cdk from "aws-cdk-lib/core";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";

const ENTITY_NAMES = {
  API_GATEWAY: "ApiGateway",
  EVENT_SERVICE: "EventService",
  SEARCH_SERVICE: "SearchService",
  BOOKING_SERVICE: "BookingService",
  PAYMENT_SERVICE: "PaymentService",

  EVENTS_DB: "EventsDB",
  AVENUES_DB: "AvenuesDB",
  PERFORMERS_DB: "PerformersDB",
  USERS_DB: "UsersDB",
  TICKETS_LOCK: "TicketsLock",

  USER_POOL: "UserPool",
  USER_POOL_CLIENT: "UserPoolClient",
  AUTHORIZER: "Authorizer",
};

export class StackStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, ENTITY_NAMES.USER_POOL, {
      userPoolName: "todo-user-pool",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, ENTITY_NAMES.USER_POOL_CLIENT, {
      userPool,
      generateSecret: false,
    });

    const authorizer = new HttpUserPoolAuthorizer(ENTITY_NAMES.AUTHORIZER, userPool, {
      userPoolClients: [userPoolClient],
    });

    // Dynamo DB - main DB (Events Tickets Avenues Performers Users, types "shared/src/types/...")

    // TICKETS_LOCK - Dynamo DB with DAX and strong consistency (TicketId: true -> TTL 10min)

    // API GATEWAY (GET events -> EVENT_SERVICE, GET search with url params -> SEARCH_SERVICE, POST reserve-ticket, POST cancel-ticket, POST buy-ticket -> BOOKING_SERVICE)

    // SERVICES - lambda functions

    // log all URLs in unified format
  }
}
