import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ProductRecord } from '../../types/product';

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.PRODUCTS_TABLE_NAME!;
const BUCKET_NAME = process.env.PRODUCT_IMAGES_BUCKET_NAME!;



export const handler = async(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
 console.log(event)
 const productId = event.pathParameters?.id;

 if(!productId) {
    return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Product ID is required' }),
    }
 }

 let product: ProductRecord;

 try {
    // Fetch the product to get the image key
    const getResult = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: productId },
    }));
    if(!getResult.Item) {
        return {
            statusCode: 404,
            body: JSON.stringify({ message: 'Product not found' }),
        }
    }

    product = getResult.Item as ProductRecord;
} catch (dynamoError) {
    console.error('Error fetching product:', dynamoError);
    return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Error fetching product' }),
    }
 }

 if(product.imageUrl) {
    try {
        const urlParts = product.imageUrl.split('/');
        const s3Key = urlParts.slice(3).join('/'); // Assuming the URL is in the format https://bucket.s3.amazonaws.com/key

        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        }));
        console.log(`Deleted image from S3: ${s3Key}`);
    } catch (s3Error) {
        console.error('Error deleting image from S3:', s3Error);
    }
    }

    try {
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { id: productId },
        }));
        console.log(`Deleted product from DynamoDB: ${productId}`);
    } catch (dynamoError) {
        console.error('Error deleting product from DynamoDB:', dynamoError);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error deleting product' }),
        }
    }

 return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Product deleted successfully' }),
 }

} 

 
