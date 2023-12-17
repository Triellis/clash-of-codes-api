import { createClient } from "redis";

const client = createClient({
	password: process.env.REDIS_PASS,
	socket: {
		host: process.env.REDIS_HOST,
		port: 10533,
	},
});
export function connectToRedis() {
	client.connect();
	client.on("error", function (error: Error) {
		console.error("Failed to connect to redis! " + error);
	});
	client.on("connect", function () {
		console.log("Connected to Redis");
	});
}

export function getRedisClient() {
	return client;
}
