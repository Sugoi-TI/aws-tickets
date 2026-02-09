import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as path from "path";

const ENTITY_NAMES = {
  MAIN_TABLE: "MainTable",
  LOCK_TABLE: "TicketsLockTable",

  API_GATEWAY: "EventsApi",
  USER_POOL: "UserPool",
  USER_POOL_CLIENT: "UserPoolClient",
  AUTHORIZER: "CognitoAuthorizer",

  EVENTS_SERVICE: "EventsService",
  SEARCH_SERVICE: "SearchService",
  BOOKING_SERVICE: "BookingService",
  PAYMENT_SERVICE: "PaymentService",
};

export class Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================================================
    // 1. COGNITO (Auth)
    // ========================================================================
    const userPool = new cognito.UserPool(this, ENTITY_NAMES.USER_POOL, {
      userPoolName: "main-user-pool",
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
    });

    const userPoolClient = new cognito.UserPoolClient(this, ENTITY_NAMES.USER_POOL_CLIENT, {
      userPool,
      generateSecret: false,
    });

    const authorizer = new HttpUserPoolAuthorizer(ENTITY_NAMES.AUTHORIZER, userPool, {
      userPoolClients: [userPoolClient],
    });

    // ========================================================================
    // 2. DATABASES
    // ========================================================================

    const mainTable = new dynamodb.Table(this, ENTITY_NAMES.MAIN_TABLE, {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    mainTable.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "gsi1pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi1sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    mainTable.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: { name: "gsi2pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "gsi2sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2.2 Lock Table (Tickets Lock)
    const lockTable = new dynamodb.Table(this, ENTITY_NAMES.LOCK_TABLE, {
      partitionKey: { name: "lockId", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "ttl",
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ========================================================================
    // 3. LAMBDA FUNCTIONS (Services)
    // ========================================================================

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_24_X,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ["aws-sdk"],
      },
    };

    // --- Event Service ---
    const eventService = new nodejs.NodejsFunction(this, ENTITY_NAMES.EVENTS_SERVICE, {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../backend/events-service/src/index.ts"),
      handler: "handler",
      environment: {
        MAIN_TABLE_NAME: mainTable.tableName,
        LOCK_TABLE_NAME: lockTable.tableName,
      },
    });

    // --- Search Service ---
    const searchService = new nodejs.NodejsFunction(this, ENTITY_NAMES.SEARCH_SERVICE, {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../backend/search-service/src/index.ts"),
      handler: "handler",
      environment: {
        MAIN_TABLE_NAME: mainTable.tableName,
        // TODO Replace main table with elastic search
      },
    });

    // --- Booking Service ---
    const bookingService = new nodejs.NodejsFunction(this, ENTITY_NAMES.BOOKING_SERVICE, {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../backend/booking-service/src/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      environment: {
        MAIN_TABLE_NAME: mainTable.tableName,
        LOCK_TABLE_NAME: lockTable.tableName,
      },
    });

    // --- Payment Service ---
    const paymentService = new nodejs.NodejsFunction(this, ENTITY_NAMES.PAYMENT_SERVICE, {
      ...commonLambdaProps,
      entry: path.join(__dirname, "../../backend/payment-service/src/index.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
    });

    // ========================================================================
    // 4. PERMISSIONS (IAM)
    // ========================================================================

    mainTable.grantReadData(eventService);
    mainTable.grantReadData(searchService);

    mainTable.grantReadWriteData(bookingService);
    lockTable.grantReadWriteData(bookingService);

    // ========================================================================
    // 5. API GATEWAY (HTTP API)
    // ========================================================================

    const httpApi = new apigw.HttpApi(this, ENTITY_NAMES.API_GATEWAY, {
      description: "API",
      corsPreflight: {
        allowHeaders: ["Authorization", "*"],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"], // TODO replace with proper domain
      },
    });

    const eventIntegration = new integrations.HttpLambdaIntegration("EventInt", eventService);
    const searchIntegration = new integrations.HttpLambdaIntegration("SearchInt", searchService);
    const bookingIntegration = new integrations.HttpLambdaIntegration("BookingInt", bookingService);

    // --- ROUTES ---

    // 1. Without Auth
    httpApi.addRoutes({
      path: "/events",
      methods: [apigw.HttpMethod.GET],
      integration: eventIntegration,
    });

    httpApi.addRoutes({
      path: "/search",
      methods: [apigw.HttpMethod.GET],
      integration: searchIntegration,
    });

    // 2. With Auth
    const secureRoutes = [
      { path: "/tickets/reserve", method: apigw.HttpMethod.POST },
      { path: "/tickets/cancel", method: apigw.HttpMethod.POST },
      { path: "/tickets/buy", method: apigw.HttpMethod.POST },
    ];

    secureRoutes.forEach((route) => {
      httpApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration: bookingIntegration,
        authorizer: authorizer,
      });
    });

    // ========================================================================
    // 6. OUTPUTS
    // ========================================================================

    new cdk.CfnOutput(this, "ApiUrl", {
      value: httpApi.url!,
      description: "Root URL of the HTTP API",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, "MainTableName", {
      value: mainTable.tableName,
    });
  }
}
