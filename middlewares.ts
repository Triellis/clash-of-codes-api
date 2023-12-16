import { NextFunction } from "express";
import { Request, Response } from "express";
import { verifyToken } from "./functions";

const envList = ["GOOGLE_CLIENT_SECRET", "GOOGLE_CLIENT_ID"];

export function verifyEnv(req: Request, res: Response, next: NextFunction) {
	const missingEnvVariables = envList.filter(
		(envVariable) => !process.env[envVariable]
	);
	if (missingEnvVariables.length > 0) {
		console.error(
			`Missing environment variables: ${missingEnvVariables.join(", ")}`
		);
		if (process.env.NODE_ENV === "production") {
			return res.sendStatus(500);
		} else {
			return res.status(500).send("Missing environment variables");
		}
	}

	next();
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
	const token = req.cookies["token"];
	if (!token) {
		res.status(401).send("unauthorized");
		return;
	}
	const payload = await verifyToken(token);

	if (payload == 401) {
		return res.sendStatus(401);
	}

	console.log(payload);

	next(); // Call the next middleware in the stack
};
