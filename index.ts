import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { auth, authToCookie, verifyEnv } from "./src/util/middlewares";
import {
	connectToRedis,
	getNewRedisClient,
	getRedisClient,
} from "./src/util/redis";
import { connectToDatabase, getClient } from "./src/util/db";
import router from "./src/routes";
import bodyParser from "body-parser";
import ws from "ws";
import http from "http";
const app = express();
const port = 3001;
const corsOptions = {
	origin: [
		"http://localhost:3000",
		"http://localhost:3001",
		"https://clash-of-codes-five.vercel.app",
		"https://clash-of-codes-api-pwiz.onrender.com",
	],
	credentials: true, //access-control-allow-credentials:true
	optionSuccessStatus: 200,
};

//  middleware
connectToDatabase();
connectToRedis();
app.use(cors(corsOptions));
app.use(authToCookie);
app.use(cookieParser());
app.use(verifyEnv);
app.use(auth);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/", router);

const server = http.createServer(app);
const wss = new ws.Server({ server });
wss.on("connection", async (ws) => {
	console.log("WebSocket connection established");

	// Handle WebSocket closure
	ws.on("close", () => {
		console.log("WebSocket connection closed");
	});
	const redisClient = getNewRedisClient();
	await redisClient.connect();

	redisClient.subscribe("configHash", (m, c) => {
		console.log(m, c);
	});
});

server.listen(port, () => {
	console.log(`clash-of-codes api @ http://localhost:${port}`);
});

const client = getClient();
client.close();
// const redisClient = getRedisClient();
// redisClient.disconnect();
