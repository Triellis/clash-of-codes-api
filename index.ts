import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { auth, authToCookie, verifyEnv } from "./src/util/middlewares";
import { connectToRedis } from "./src/util/redis";
import { connectToDatabase, getClient } from "./src/util/db";
import router from "./src/routes";
import { addConfig, deleteConfig, fetchConfig } from "./src/util/functions";
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
app.use(cors(corsOptions));
app.use(authToCookie);
app.use(cookieParser());
app.use(verifyEnv);
app.use(auth);

connectToDatabase();
connectToRedis();

app.use("/", router);
console.log(fetchConfig(0, 5));

app.listen(port, () => {
	console.log(`clash-of-codes api @ http://localhost:${port}`);
});
const client = getClient();
client.close();
