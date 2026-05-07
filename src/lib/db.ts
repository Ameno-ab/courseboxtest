import { MongoClient, type Db, type MongoClientOptions } from "mongodb";

const clientOptions: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 8000,
  socketTimeoutMS: 30000,
  retryWrites: true,
};

type GlobalWithMongo = typeof globalThis & {
  _mongoClient?: MongoClient;
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

function getClient(): MongoClient {
  if (!globalWithMongo._mongoClient) {
    const mongoUri = process.env.MONGODB_URI?.trim();

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is not set. For local dev add it to .env.local; for Vercel add it as an Environment Variable.",
      );
    }

    globalWithMongo._mongoClient = new MongoClient(mongoUri, clientOptions);
  }

  return globalWithMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  if (!globalWithMongo._mongoClientPromise) {
    const client = getClient();
    globalWithMongo._mongoClientPromise = client.connect();
  }

  const connectedClient = await globalWithMongo._mongoClientPromise;

  return connectedClient.db(process.env.MONGODB_DB?.trim() || "coursebox_prototype");
}

export async function closeDb(): Promise<void> {
  if (globalWithMongo._mongoClient) {
    await globalWithMongo._mongoClient.close();
    globalWithMongo._mongoClient = undefined;
    globalWithMongo._mongoClientPromise = undefined;
  }
}
