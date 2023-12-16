import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { auth, verifyEnv } from "./src/util/middlewares";
import login from "./src/routes/login";
import { connectToDatabase, getClient } from "./src/util/db";
const app = express();
const port = 3001;
const corsOptions = {
	origin: ["http://localhost:3000", "http://localhost:3001"],
	credentials: true, //access-control-allow-credentials:true
	optionSuccessStatus: 200,
};

//  middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(verifyEnv);
app.use(auth);

connectToDatabase();

app.get("/", (req, res) => {
	res.send("Hello World!");
});
app.get("/login", login);
app.listen(port, () => {
	console.log(`clash-of-codes api @ http://localhost:${port}`);
});
const client = getClient();
client.close();
