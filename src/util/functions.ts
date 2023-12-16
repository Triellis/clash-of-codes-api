import { OAuth2Client, TokenPayload } from "google-auth-library";
import { GoogleTokenPayload } from "./types";
import { Request } from "express";
const client = new OAuth2Client();
export async function verifyToken(token: string): Promise<GoogleTokenPayload> {
	try {
		const ticket = await client.verifyIdToken({
			idToken: token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();

		return payload as TokenPayload;
	} catch {
		return 401;
	}
}

export async function getJWTPayload(req: Request) {
	const token = req.cookies["token"];
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: process.env.GOOGLE_CLIENT_ID,
	});

	const payload = ticket.getPayload();

	return payload as TokenPayload;
}
