//what we're getting from api/frontend
export type Product = {
    name: string;
    description: string;
    price: number;
    imageData: string;
}

//for storing on DynamoDB
export type ProductRecord = {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    createdAt: string;
    updatedAt: string;
}