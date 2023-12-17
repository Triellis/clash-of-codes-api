import { OAuth2Client, TokenPayload } from "google-auth-library";
import { Contest, GoogleTokenPayload } from "./types";
import { Request } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { RedisClientType } from "redis";
import { getRedisClient } from "./redis";
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

export async function updateLeaderboard(
	redisClient: RedisClientType,
	contestId: number
) {
	const curr_time = Math.floor(new Date().getTime() / 1000);
	const apiKey = process.env.CF_API_KEY;
	const secret = process.env.CF_SECRET;
	if (!apiKey || !secret) {
		throw new Error("API key or secret is missing");
	}

	const signature = crypto
		.createHash("sha512")
		.update(
			`123456/contest.standings?apiKey=${apiKey}&contestId=${contestId}&time=${curr_time}#${secret}`
		)
		.digest("hex");

	const requestUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;

	const resp = await fetch(requestUrl);
	const data = await resp.json();
	await redisClient.set("leaderboard", JSON.stringify(data));
}

export async function fetchConfig(start: number, end: number) {
	const redisClient = getRedisClient();
	const config = await redisClient.zRange("leaderboardConfig", start, end);
	const configObj: Contest[] = config.map(
		(item: string) => JSON.parse(item) as Contest
	);
	// console.log(configObj);
	return configObj;
}

export async function deleteConfig(index: number) {
	const redisClient = getRedisClient();
	// ZREMRANGEBYSCORE leaderboardConfig 2 2
	const ak = await redisClient.zRemRangeByScore(
		"leaderboardConfig",
		index,
		index
	);

	return ak;
}

export async function addConfig(contest: Contest) {
	const redisClient = getRedisClient();
	const ak = await redisClient.zAdd("leaderboardConfig", {
		score: contest.DateAdded.getTime(),
		value: JSON.stringify(contest),
	});

	return ak;
}
