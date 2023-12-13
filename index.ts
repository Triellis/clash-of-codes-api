import express, { NextFunction } from "express";
import { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();
const app = express();
const port = 3001;
const corsOptions = {
	origin: ["http://localhost:3000", "http://localhost:3001"],
	credentials: true, //access-control-allow-credentials:true
	optionSuccessStatus: 200,
};

function verifyEnv(req: Request, res: Response, next: NextFunction) {
	if (!process.env.GOOGLE_CLIENT_SECRET) {
		throw new Error("GOOGLE_CLIENT_SECRET not set");
	}
	next();
}
const myMiddleware = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const token = req.cookies["token"];

	if (token) {
		const decoded = await jwt.verify(token, publicKeys, {
			algorithms: ["RS256"],
		});
		console.log(decoded);
	} else {
		res.status(401).send("unauthorized");
	}

	next(); // Call the next middleware in the stack
};

// Use the middleware for all routes
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(verifyEnv);
app.use(myMiddleware);

app.get("/", (req, res) => {
	res.send("Hello World!");
});
app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`);
});

console.log("hello");
