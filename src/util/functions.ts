import crypto from "crypto";
import { Request } from "express";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import jwt from "jsonwebtoken";
import hash from "object-hash";
import { getClient, getDB } from "./db";
import { getRedisClient } from "./redis";

import {
	CFAPIResponse,
	CFSecretData,
	Clan,
	ContestCol,
	GoogleTokenPayload,
	RatingData,
	UserCol,
	UserOnClient,
	ProcessedRatingData,
} from "./types";

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
	const CFSecrets = await getCFSecretData();
	const apiKey = CFSecrets.CF_API_KEY;
	const secret = CFSecrets.CF_SECRET;

	const signature = crypto
		.createHash("sha512")
		.update(
			`123456/contest.standings?apiKey=${apiKey}&contestId=${contestId}&groupCode=${groupCode}&time=${curr_time}#${secret}`
		)
		.digest("hex");

	// return [];
	const requestUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&groupCode=${groupCode}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;
	// const requestUrl = `https://codeforces.com/api/groupCode=${groupCode}&customRating=${6094}&apiKey=${apiKey}&time=${curr_time}&apiSig=123456${signature}`;

	const resp = await fetch(requestUrl);

	if (!resp.ok) {
		return false;
	}
	return true;
}

export async function getScoreFromCF(contestId: number, groupCode: string) {
	const curr_time = Math.floor(new Date().getTime() / 1000);
	const CFSecrets = await getCFSecretData();
	const apiKey = CFSecrets.CF_API_KEY;
	const secret = CFSecrets.CF_SECRET;

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
		return;
	}
	redisClient.sAdd("liveContestCodes", liveContestCodes);

	const cfData = [];
	const CFSecrets = await getCFSecretData();
	const groupCode = CFSecrets.CF_GROUP_CODE;
	for (let i = 0; i < liveContestCodes.length; i++) {
		const contestCode = liveContestCodes[i];
		const data = await getScoreFromCF(Number(contestCode), groupCode);
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
		if (oldLeaderboardHash == hash([])) return;
		redisClient.set("leaderboardHash", hash([]));

		redisClient.set("leaderboard", JSON.stringify([]));

		await redisClient.publish("live", JSON.stringify([]));
	}
	const cfData: CFAPIResponse[][] = [];
	const CFSecrets = await getCFSecretData();
	const groupCode = CFSecrets.CF_GROUP_CODE;

	for (let i = 0; i < liveContestCodes.length; i++) {
		const contestCode = liveContestCodes[i];
		const data = await getScoreFromCF(Number(contestCode), groupCode);
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

export async function getCFSecretData(): Promise<CFSecretData> {
	const redisClient = getRedisClient();

	const CF_API_KEY = await redisClient.get("CF_API_KEY");
	const CF_SECRET = await redisClient.get("CF_SECRET");
	const CF_GROUP_CODE = await redisClient.get("CF_GROUP_CODE");

	if (!CF_API_KEY || !CF_GROUP_CODE || !CF_SECRET) {
		throw new Error(
			"The CF_API_KEY, CF_SECRET, CF_GROUP_CODE are not defined on the redis  "
		);
	}
	return {
		CF_API_KEY,
		CF_SECRET,
		CF_GROUP_CODE,
	};
}

export async function getCustomRating(contestId: number, groupCode: string) {
	const cfData = await getScoreFromCF(contestId, groupCode);
	const ratingData: RatingData = [];

	// formula R = (200) * ((n - place + 1)/n) * (solved / maxSolved) + 100 *(upsolved / problemCount)
	// n — maximum of 50 and number of contest participants
	const n = Math.max(50, cfData.length);
	let maxSolved = 0;
	cfData.forEach((a) => {
		maxSolved = Math.max(maxSolved, a.points);
	});
	cfData.forEach((a) => {
		const solved = a.points;
		const place = a.rank;
		const username = a.username;
		const rating =
			Math.round(
				200 * ((n - place + 1) / n) * (solved / maxSolved) * 100
			) / 100;
		ratingData.push({
			username,
			rating,
		});
	});
	return ratingData;
}

export async function formatRatingLeaderboard(ratingData: RatingData) {
	const usernames: string[] = [];
	ratingData.forEach((a) => {
		usernames.push(a.username);
	});
	const relatedData = await getDB()
		.collection<UserCol>("Users")
		.find(
			{
				cfUsername: {
					$in: usernames,
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
	const clans: Clan[] = [];
	relatedData.forEach((a) => {
		if (clans.includes(a.clan!)) return;
		clans.push(a.clan!);
	});
	const processedData: ProcessedRatingData = {};
	clans.forEach((clan) => {
		processedData[clan] = [];
	});
	relatedData.forEach((a) => {
		const clan = a.clan!;
		const name = a.name!;
		const cfUsername = a.cfUsername!;
		const rating = ratingData.find((b) => {
			return b.username === cfUsername;
		})!.rating;
		if (!processedData[clan]) {
			processedData[clan] = [];
		}
		processedData[clan]!.push({
			name,
			cfUsername,
			rating,
		});
	});
	for (const clan in processedData) {
		processedData[clan as Clan]!.sort((a, b) => {
			return b.rating - a.rating;
		});
	}

	return processedData;
}
