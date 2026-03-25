import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigatewayv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigatewayv2_integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaRuntime from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class ProductManagmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(
      this,
      `${this.stackName}-Products-Table`,
      {
        tableName: `${this.stackName}-Products-Table`,
        partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    const productImagesBucket = new s3.Bucket(
      this,
      `${this.stackName}-Product-Images-Bucket`,
      {
        bucketName: `${this.stackName.toLocaleLowerCase()}-images`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
    );

    const createProductLambda = new NodejsFunction(
      this,
      `${this.stackName}-create-product`,
      {
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(__dirname, "../src/lambda/products/createProducts.ts"),
        functionName: `${this.stackName}-create-product-lambda`,
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
          PRODUCT_IMAGES_BUCKET_NAME: productImagesBucket.bucketName,
        },
        timeout: cdk.Duration.seconds(60),
      },
    );

    const getAllProductsLambda = new NodejsFunction(
      this,
      `${this.stackName}-get-all-products`,
      {
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(__dirname, "../src/lambda/products/getAllProducts.ts"),
        functionName: `${this.stackName}-get-all-products-lambda`,
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
        },
      },
    );

    const deleteProductLambda = new NodejsFunction(
      this,
      `${this.stackName}-delete-product`,
      {
        runtime: lambdaRuntime.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(__dirname, "../src/lambda/products/deleteProduct.ts"),
        functionName: `${this.stackName}-delete-product-lambda`,
        environment: {
          PRODUCTS_TABLE_NAME: productsTable.tableName,
          PRODUCT_IMAGES_BUCKET_NAME: productImagesBucket.bucketName,
        },
      },
    );

    productsTable.grantReadWriteData(createProductLambda);
    productsTable.grantReadData(getAllProductsLambda);
    productsTable.grantReadWriteData(deleteProductLambda);

    productImagesBucket.grantWrite(createProductLambda);
    productImagesBucket.grantWrite(deleteProductLambda);

    const api = new apigatewayv2.HttpApi(this, `${this.stackName}-API`, {
      apiName: `${this.stackName}-API`,
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.DELETE,
        ],
        allowOrigins: ["*"],
      },
    });

    api.addRoutes({
      path: "/products",
      methods: [apigatewayv2.HttpMethod.GET],
      integration: new apigatewayv2_integrations.HttpLambdaIntegration(
        `${this.stackName}-get-all-products-integration`,
        getAllProductsLambda,
      ),
    });

    api.addRoutes({
      path: "/products",
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2_integrations.HttpLambdaIntegration(
        `${this.stackName}-create-product-integration`,
        createProductLambda,
      ),
    });

    api.addRoutes({
      path: "/products/{id}",
      methods: [apigatewayv2.HttpMethod.DELETE],
      integration: new apigatewayv2_integrations.HttpLambdaIntegration(
        `${this.stackName}-delete-product-integration`,
        deleteProductLambda,
      ),
    });

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint!,
      description: "The endpoint of the Product Management API",
      exportName: `${this.stackName}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
      description: "The name of the DynamoDB table for products",
      exportName: `${this.stackName}-ProductsTableName`,
    });

    new cdk.CfnOutput(this, "ProductImagesBucketName", {
      value: productImagesBucket.bucketName,
      description: "The name of the S3 bucket for product images",
      exportName: `${this.stackName}-ProductImagesBucketName`,
    });
  }
}
