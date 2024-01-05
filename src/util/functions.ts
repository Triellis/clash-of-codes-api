import { OAuth2Client, TokenPayload } from "google-auth-library";
import {
	CFAPIResponse,
	Clan,
	ContestCol,
	GoogleTokenPayload,
	UserCol,
	UserOnClient,
} from "./types";
import { Request } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getClient, getDB } from "./db";
import { getRedisClient } from "./redis";
import hash from "object-hash";

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
		const decoded = jwt.verify(token, process.env.JWT_SECRET!);
		return true;
	} catch {
		return false;
	}
}

export async function signJWT(json: any) {
	const myJWT = jwt.sign(json, process.env.JWT_SECRET!, {
		algorithm: "HS256",
	});

	return myJWT;
}

export async function getSession(req: Request) {
	return jwt.decode(req.cookies.server_token) as UserOnClient;
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

export async function isValidContestCode(contestId: string, groupCode: string) {
	const curr_time = Math.floor(new Date().getTime() / 1000);
	const apiKey = process.env.CF_API_KEY;
	const secret = process.env.CF_SECRET;

	const signature = crypto
		.createHash("sha512")
		.update(
			`123456/contest.standings?apiKey=${apiKey}&contestId=${contestId}&groupCode=${groupCode}&time=${curr_time}#${secret}`
		)
		.digest("hex");

	// return [];
	const requestUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&groupCode=${groupCode}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;

	const resp = await fetch(requestUrl);

	if (!resp.ok) {
		return false;
	}
	return true;
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

	// return [];
	const requestUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&groupCode=${groupCode}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;
	try {
		const resp = await fetch(requestUrl);

		if (!resp.ok) {
			return [];
		}

		const data = await resp.json();
		if (data.status === "FAILED") {
			return [];
		}
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

		return result as CFAPIResponse[];
	} catch {
		return [];
	}
	// await redisClient.set("leaderboard", JSON.stringify(data));
}

function rearrangeLeaderboard(
	leaderboardData: (CFAPIResponse & {
		clan: Clan;
		name: string | undefined;
	})[][]
) {
	type DistributedData = {
		[clan: string]: {
			name: string;
			cfUsername: string;
			rank: number;
			points: number;
			penalty: number;
		}[];
	}[];
	const distributedData: DistributedData = [];
	for (let i = 0; i < leaderboardData.length; i++) {
		const leaderboard = leaderboardData[i];
		const finalData: any = {};
		for (let j = 0; j < leaderboard.length; j++) {
			const user = leaderboard[j];
			const clan = user.clan;

			if (finalData.hasOwnProperty(clan) === false) {
				finalData[clan] = [];
			}
			finalData[clan].push({
				name: user.name,
				cfUsername: user.username,
				rank: user.rank,
				points: user.points,
				penalty: user.penalty,
			});
		}
		for (const clan in finalData) {
			finalData[clan].sort((a: any, b: any) => {
				return a.rank - b.rank;
			});
		}
		for (const clan in finalData) {
			for (let j = 0; j < finalData[clan].length; j++) {
				const user = finalData[clan][j];
				user.rank = j + 1;
			}
		}
		// console.log(finalData);
		distributedData.push(finalData);
	}

	return distributedData;
}

export async function getLiveContestCodesFromMongo() {
	const db = getDB();
	const col = db.collection<ContestCol>("Contests");
	const contests = await col
		.find(
			{
				Live: true,
			},
			{
				projection: {
					ContestCode: 1,
					_id: 0,
				},
			}
		)
		.toArray();
	const contestCodes = contests.map((element) => {
		return element.ContestCode;
	});

	return contestCodes;
}

export async function syncData() {
	// this is only for live contests
	// this will run when the server starts and when the config changes
	// get the config from the database
	// get the contest codes from the config
	// get the data from the cf api
	// distribute the data to the users
	// create a hashmap of who is in which clan and upload it to the redis
	// send the data to the redis
	const liveContestCodes = await getLiveContestCodesFromMongo();
	const redisClient = getRedisClient();
	redisClient.del("liveContestCodes");
	if (liveContestCodes.length == 0) {
		redisClient.del("liveContestCodes");
		return;
	}
	redisClient.sAdd("liveContestCodes", liveContestCodes);

	const cfData = [];
	for (let i = 0; i < liveContestCodes.length; i++) {
		const contestCode = liveContestCodes[i];
		const data = await getScoreFromCF(
			Number(contestCode),
			process.env.GROUP_CODE as string
		);
		if (data.length == 0) {
			continue;
		}
		cfData.push(data);
	}

	const usernamesToHash = [];
	for (let i = 0; i < cfData.length; i++) {
		const data = cfData[i];
		for (let j = 0; j < data.length; j++) {
			const user = data[j];
			usernamesToHash.push(user.username);
		}
	}

	const db = getDB();
	const col = db.collection<UserCol>("Users");
	// console.log(usernamesToHash);
	const users = await col
		.find(
			{
				cfUsername: {
					$in: usernamesToHash,
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
	const usernamesToClanNName: {
		[username: string]: string;
	} = {};
	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		const username = user.cfUsername as string;
		const clan = user.clan as string;
		const name = user.name as string;
		usernamesToClanNName[username] = name + "\\;\\" + clan;
	}
	// console.log(usernamesToClanNName);
	if (Object.keys(usernamesToClanNName).length !== 0)
		redisClient.hSet("usernamesToClanNName", usernamesToClanNName);
}

export async function syncLeaderboardFromCF() {
	const redisClient = getRedisClient();
	const oldLeaderboardHash = await redisClient.get("leaderboardHash");

	const liveContestCodes = await redisClient.sMembers("liveContestCodes");
	if (liveContestCodes.length == 0) {
		if (oldLeaderboardHash == hash(liveContestCodes)) return;
		await redisClient.publish("live", JSON.stringify([]));
	}
	const cfData: CFAPIResponse[][] = [];

	for (let i = 0; i < liveContestCodes.length; i++) {
		const contestCode = liveContestCodes[i];
		const data = await getScoreFromCF(
			Number(contestCode),
			process.env.GROUP_CODE as string
		);
		if (data.length == 0) {
			continue;
		}
		cfData.push(data);
	}

	const usernames = [];
	for (let i = 0; i < cfData.length; i++) {
		for (let j = 0; j < cfData[i].length; j++) {
			usernames.push(cfData[i][j].username);
		}
	}
	if (usernames.length === 0) {
		return;
	}

	const relatedData = await redisClient.hmGet(
		"usernamesToClanNName",
		usernames
	);
	const usernamesToClanNName: {
		[key: string]: {
			name: string | undefined;
			clan: Clan;
		};
	} = {};
	for (let i = 0; i < relatedData.length; i++) {
		let username = usernames[i];
		let name, clan;
		if (relatedData[i] !== null) {
			[name, clan] = relatedData[i].split("\\;\\");
		}
		usernamesToClanNName[username] = {
			name,
			clan: clan as Clan,
		};
	}
	const finalCfData = cfData.map((arr) => {
		return arr.map((elem) => {
			const modifiedElem = {
				...elem,
				...usernamesToClanNName[elem.username],
			};

			return modifiedElem;
		});
	});
	const rearrangedCFData = rearrangeLeaderboard(finalCfData);
	const newHash = hash(rearrangedCFData);

	if (newHash === oldLeaderboardHash) {
		return;
	}

	redisClient.set("leaderboardHash", newHash);
	redisClient.set("leaderboard", JSON.stringify(rearrangedCFData));

	await redisClient.publish("live", JSON.stringify(rearrangedCFData));
}

export function keepTheValidFields(obj: any, validFields: string[]) {
	const result: any = {};

	Object.keys(obj).forEach((key) => {
		if (validFields.includes(key)) {
			result[key] = obj[key];
		}
	});

	return result;
}
