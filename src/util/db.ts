import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI!);
export async function connectToDatabase() {
	try {
		await client.connect();
		console.log("Connected to MongoDB");
	} catch (error) {
		console.error("Error connecting to MongoDB:", error);
		process.exit(1); // Exit the application on connection error
	}
}

export function getClient() {
	return client;
}

export function getDB() {
	return client.db("clash-of-codes");
}
