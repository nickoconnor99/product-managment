import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ProductRecord } from '../../types/product';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME || '';


export const handler = async(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
 console.log('Event Received:', event);

 try {
    const command = new ScanCommand({ TableName: TABLE_NAME });
    const result = await docClient.send(command);
    const products = result.Items as ProductRecord[];
    products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return {
         statusCode: 200,
         body: JSON.stringify( products )
      };
 } catch (error) {
    console.error('Error fetching products:', error);
    return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to fetch products' })
    };
 }
}