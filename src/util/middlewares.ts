import { NextFunction } from "express";
import { Request, Response } from "express";
import { verifyServerToken } from "./functions";
import cookie from "cookie";
const envList = [
	"GOOGLE_CLIENT_SECRET",
	"GOOGLE_CLIENT_ID",
	"MONGO_URI",
	"JWT_SECRET",
	"REDIS_PASS",
	"REDIS_HOST",
	"CF_API_KEY",
	"CF_SECRET",
	"MAX_RESULTS",
	"GROUP_CODE",
];

export function verifyEnv() {
	const missingEnvVariables = envList.filter(
		(envVariable) => !process.env[envVariable]
	);
	if (missingEnvVariables.length > 0) {
		throw new Error(
			`Missing environment variables: ${missingEnvVariables.join(", ")}`
		);
	}
}

export async function auth(req: Request, res: Response, next: NextFunction) {
	if (req.path === "/login") {
		next();
		return;
	}
	const token = req.cookies["server_token"];
	if (!token) {
		return res.status(401).send("unauthorized. no server token found");
	}

	const status = await verifyServerToken(token);

	if (!status) {
		return res.status(401).send("unauthorized. invalid token");
	}

	// console.log(payload);

	next(); // Call the next middleware in the stack
}

export function authToCookie(req: Request, res: Response, next: NextFunction) {
	if (!req.headers.auth) {
		return res.status(401).send("you must provide auth header");
	}
	req.cookies = cookie.parse(req.headers.auth as string);
	next();
}
