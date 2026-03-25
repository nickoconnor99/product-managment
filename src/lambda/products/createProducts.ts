import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Product } from "../../types/product";
import { v4 as uuidv4 } from 'uuid';
import { buffer } from "stream/consumers";
import { stat } from "fs";
import { error } from "console";


// Initialize AWS SDK clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const s3Client = new S3Client({});

// Environment variables
const PRODUCTS_TABLE_NAME = process.env.PRODUCTS_TABLE_NAME!;
const PRODUCT_IMAGES_BUCKET_NAME = process.env.PRODUCT_IMAGES_BUCKET_NAME!;

export const handler = async(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
 console.log(event)
 try {
   if(!event.body) {
    return {
        statusCode: 400,
        body: JSON.stringify({message: 'Invalid request, no body provided'})
     }
   }
   const product: Product = JSON.parse(event.body);

   if(!product.name || !product.description || typeof product.price !== 'number' || !product.imageData) {
    return {
        statusCode: 400,
        body: JSON.stringify({message: 'Invalid request, missing required fields'})
     }
   }

   const productId = uuidv4()
   const timestamp = new Date().toISOString()

   let imageUrl:string;
   try {
      console.log('Starting S3 upload...')
      console.log(`Bucket: ${PRODUCT_IMAGES_BUCKET_NAME}`)

      //Extract base64 data
      const base64Data = product.imageData.replace(/^data:image\/\w+;base64,/, "");
      const ImageBuffer = Buffer.from(base64Data, 'base64');

      const fileExtension = product.imageData.includes('data:image/jpeg') ? 'jpg' : product.imageData.includes('data:image/png') ? 'png' : product.imageData.includes('data:image/gif') ? 'gif' : 'jpg';

      const s3Key = `products/${productId}.${fileExtension}`;

      console.log('S3 upload parameters:', {
        bucket: PRODUCT_IMAGES_BUCKET_NAME,
        key: s3Key,
        bufferSize: ImageBuffer.length,
        contentType: `image/${fileExtension}`,
      })

      await s3Client.send(new PutObjectCommand({
        Bucket: PRODUCT_IMAGES_BUCKET_NAME,
        Key: s3Key,
        Body: ImageBuffer,
        ContentType: `image/${fileExtension}`,
      }))
      imageUrl = `https://${PRODUCT_IMAGES_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
      console.log('S3 upload successful, image URL:', imageUrl)
   } catch (s3Error:any) {
      console.error('Error uploading image to S3:', s3Error)
      console.error('S3 upload error details:', {
        message: s3Error.message,
        code: s3Error.code,
        statusCode: s3Error.statusCode,
        bucketName: PRODUCT_IMAGES_BUCKET_NAME,
        requestId: s3Error.$metadata?.requestId,
      })
      return {
        statusCode: 500,
        body: JSON.stringify({message: 'Failed to upload image', error: s3Error.message})
     }
   }

 return {
    statusCode: 200,
    body: JSON.stringify({message: 'create product'})
 }
   } catch (error:any) {
    console.error('Error creating product:', error);
    return {
        statusCode: 500,
        body: JSON.stringify({message: 'Failed to create product', error: error.message})
    }
}
}