import { OAuth2Client, TokenPayload } from "google-auth-library";
import {
	CFAPIResponse,
	ContestCol,
	GoogleTokenPayload,
	UserCol,
	UserOnClient,
} from "./types";
import { Request } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getDB } from "./db";

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
	const result = data.result.rows.map((element: any) => {
		// console.log(element);
		const rank = element.rank;
		const points = element.points;
		const penalty = element.penalty;
		const username = element.party.members[0].handle;
		const obj = {
			rank,
			points,
			penalty,
			username,
		};

		return obj;
	});
	console.log(result);
	distributeMembers(result);
	return result as CFAPIResponse[];
	// await redisClient.set("leaderboard", JSON.stringify(data));
}

async function distributeMembers(cfData: CFAPIResponse[]) {
	const members = cfData.map((element) => {
		return element.username;
	});
	const cfDataIndexed: {
		[username: string]: CFAPIResponse;
	} = {};
	cfData.forEach((element) => {
		cfDataIndexed[element.username] = element;
	});
	const db = getDB();
	const col = db.collection<UserCol>("Users");
	const users = await col
		.find(
			{
				cfUsername: {
					$in: members,
				},
			},
			{
				projection: {
					cfUsername: 1,
					clan: 1,
					name: 1,
				},
			}
		)
		.toArray();
	const distributedData: {
		[clan: string]: {
			name: string;
			cfUsername: string;
			rank: number;
			points: number;
			penalty: number;
		}[];
	} = {};

	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		const clan = user.clan as string;

		const cfUsername = user.cfUsername as string;
		const name = user.name as string;
		const cfData = cfDataIndexed[cfUsername];
		const rank = cfData.rank;
		const points = cfData.points;
		const penalty = cfData.penalty;

		const obj = {
			name,
			cfUsername,
			rank,
			points,
			penalty,
		};
		if (!distributedData[clan]) {
			distributedData[clan] = [];
		}
		distributedData[clan].push(obj);
		for (let clan in distributedData) {
			distributedData[clan].sort((a, b) => {
				return a.rank - b.rank;
			});
			let rank = 1;
			for (let i = 0; i < distributedData[clan].length; i++) {
				distributedData[clan][i].rank = rank;
				rank++;
			}
		}
	}
	console.log(distributedData);
}

const contest_id = "435107";
const group_code = "RXDkSayhcW";

// getScoreFromCF(Number(contest_id), group_code);
// getScoreFromCF(Number(436414), group_code);
