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
import {
	formatRatingLeaderboard,
	getCustomRating,
	syncData,
	syncLeaderboardFromCF,
} from "./src/util/functions";

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

app.use(auth);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/", router);

const server = http.createServer(app);
const wss = new ws.Server({ server });
const redisClient2 = getNewRedisClient();
redisClient2.connect();

redisClient2.subscribe("configHash", async (m, c) => {
	if (c === "configHash") await syncData();
});

wss.on("connection", async (ws) => {
	// Handle WebSocket closure
	console.log("WebSocket connection opened");
	const cachedData = await getRedisClient().get("leaderboard");

	if (cachedData) {
		ws.send(cachedData);
	}
	ws.on("close", () => {
		console.log("WebSocket connection closed");
	});
	redisClient2.subscribe("live", (m, c) => {
		// console.log(m);
		ws.send(m);
	});
});

const client = getClient();
client.on("open", async () => {
	verifyEnv();

	setInterval(async () => {
		await syncLeaderboardFromCF();
	}, 13000);
	server.listen(port, () => {
		console.log(`clash-of-codes api @ http://localhost:${port}`);
	});
});

client.close();
