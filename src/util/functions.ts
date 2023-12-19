import { OAuth2Client, TokenPayload } from "google-auth-library";
import { ContestCol, GoogleTokenPayload, UserOnClient } from "./types";
import { Request } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { RedisClientType } from "redis";
import { getRedisClient } from "./redis";
import { getClient, getDB } from "./db";
import { ObjectId } from "mongodb";
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

export async function getSession(req: Request) {
	return (await jwt.decode(req.cookies.server_token)) as UserOnClient;
}

export function replaceFullName(s: string) {
	// blue wizards -> BW
	// red giants -> RG
	// purple pekkas -> PP
	// yellow barbarians -> YB

	s = s.toLowerCase();
	// replace if the string contains the substring of the team name
	s = s.replace(/blue/g, "BW");
	s = s.replace(/red/g, "RG");
	s = s.replace(/purple/g, "PP");
	s = s.replace(/yellow/g, "YB");

	return s;
}

export async function getScoreFromCF(contestId: number, groupCode: string) {
	const curr_time = Math.floor(new Date().getTime() / 1000);
	const apiKey = process.env.CF_API_KEY;
	const secret = process.env.CF_SECRET;

	const signature = crypto
		.createHash("sha512")
		.update(
			`123456/contest.standings?apiKey=${apiKey}&contestId=${contestId}&groupCode=${groupCode}&time=${curr_time}#${secret}`
		)
		.digest("hex");

	const requestUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&groupCode=${groupCode}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;

	const resp = await fetch(requestUrl);
	const data = await resp.json();
	console.log(data["result"]["rows"]);
	return data;
	// await redisClient.set("leaderboard", JSON.stringify(data));
}

// getScoreFromCF(481714, "UTbmZ31r4w");
