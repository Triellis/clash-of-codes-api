import { GoogleTokenPayload } from "./types";

export async function verifyToken(token: string): Promise<GoogleTokenPayload> {
	try {
		const { OAuth2Client } = require("google-auth-library");
		const client = new OAuth2Client();

		const ticket = await client.verifyIdToken({
			idToken: token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload: GoogleTokenPayload = ticket.getPayload();

		return payload;
	} catch {
		return 401;
	}
}
