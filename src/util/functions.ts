import { OAuth2Client, TokenPayload } from "google-auth-library";
import { GoogleTokenPayload } from "./types";
import { Request } from "express";
import jwt from "jsonwebtoken";
export async function verifyGoogleToken(
	token: string
): Promise<GoogleTokenPayload> {
	try {
		const client = new OAuth2Client();

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

export async function verifyServerToken(token: string) {
	try {
		const decoded = await jwt.verify(token, process.env.JWT_SECRET!);
		return true;
	} catch {
		return false;
	}
}

export async function signJWT(json: any) {
	const myJWT = await jwt.sign(json, process.env.JWT_SECRET!, {
		algorithm: "HS256",
	});

	return myJWT;
}
