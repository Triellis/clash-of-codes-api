import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { auth, verifyEnv } from "./middlewares";
dotenv.config();
const app = express();
const port = 3001;
const corsOptions = {
	origin: ["http://localhost:3000", "http://localhost:3001"],
	credentials: true, //access-control-allow-credentials:true
	optionSuccessStatus: 200,
};

// Use the middleware for all routes
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(verifyEnv);
app.use(auth);

app.get("/", (req, res) => {
	res.send("Hello World!");
});
app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});

app.get("/login");
console.log("hello");
