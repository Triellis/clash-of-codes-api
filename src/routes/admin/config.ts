import { Request, Response } from "express";

import { ContestCol, PastScoresCol, RatingData } from "../../util/types";
import { getDB } from "../../util/db";
import { getRedisClient } from "../../util/redis";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import {
	formatRatingLeaderboard,
	getCFSecretData,
	getCustomRating,
	isValidContestCode,
	keepTheValidFields,
	replaceFullName,
} from "../../util/functions";

export async function getConfig(req: Request, res: Response) {
	const query = req.query;
	const page = Number(query.page) || 1;
	const searchQuery = (query.searchQuery as string) || "";
	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;

	const db = getDB();
	const col = db.collection<ContestCol>("Contests");
	const searchRegex = new RegExp(searchQuery, "i");
	const teamRegex = new RegExp(replaceFullName(searchQuery), "i");
	const configData = await col
		.find(
			{
				$or: [
					{
						Team1: teamRegex,
					},
					{
						Team2: teamRegex,
					},
					{
						ContestCode: searchRegex,
					},
				],
			},
			{
				sort: {
					DateAdded: -1,
				},
			}
		)

		.skip(skip)
		.limit(maxResults)
		.toArray();

	return res.json(configData);
}

export async function postConfig(req: Request, res: Response) {
	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}

	if (!body.ContestCode || !body.Team1 || !body.Team2) {
		return res
			.status(400)
			.send("Please add Team1, Team2 and ContestCode in the body");
	}
	const validFields = ["Team1", "Team2", "ContestCode"];
	const contest: ContestCol = keepTheValidFields(body, validFields);

	const contestCode = contest.ContestCode;
	const CFSecrets = await getCFSecretData();

	if (
		!(await isValidContestCode(
			contestCode,
			CFSecrets.CF_GROUP_CODE as string
		))
	) {
		return res
			.status(400)
			.send(`${contestCode} is not a valid contest code`);
	}
	contest["DateAdded"] = new Date();
	contest["Live"] = true;
	const db = getDB();

	const ak = await db.collection<ContestCol>("Contests").insertOne(contest);
	if (!ak.acknowledged) {
		return res.status(500).send();
	}
	const hash = crypto
		.createHash("sha256")
		.update(JSON.stringify(contest) + new Date().getTime().toString())
		.digest("hex");
	const redisClient = getRedisClient();
	await redisClient.publish("configHash", hash);

	return res.status(200).send();
}

export async function deleteConfig(req: Request, res: Response) {
	const query = req.query;
	const id = query.id;

	if (!id) {
		return res.send("Please provide a id in query").status(400);
	} else if (!ObjectId.isValid(id as string)) {
		return res.send(`${id} is not valid object id`).status(500);
	}

	const db = getDB();
	const ak = await db
		.collection("Contests")
		.deleteOne({ _id: new ObjectId(id as string) });
	const pastScoreDoc = await db
		.collection<PastScoresCol>("PastScores")
		.findOne(
			{
				contestId: new ObjectId(id as string),
			},
			{
				projection: {
					_id: 0,
					dateAdded: 0,
					contestId: 0,
				},
			}
		);

	const pastScoreData: RatingData[] = Object.values(pastScoreDoc as any);
	let customRatingData = [];
	for (let i = 0; i < pastScoreData.length; i++) {
		for (let j = 0; j < pastScoreData[i].length; j++) {
			customRatingData.push(pastScoreData[i][j]);
		}
	}
	customRatingData = customRatingData.map((d: any) => {
		return { ...d, username: d.cfUsername };
	});
	const bulkWriteData = customRatingData.map((data) => {
		return {
			updateOne: {
				filter: {
					cfUsername: data.username,
				},
				update: {
					$inc: {
						score: -data.rating,
						problemSolved: -data.points,
					},
				},
			},
		};
	});

	await db.collection("Users").bulkWrite(bulkWriteData, { ordered: false });

	await db.collection<PastScoresCol>("PastScores").deleteOne({
		contestId: new ObjectId(id as string),
	});

	if (!ak.acknowledged) {
		return res.status(500).send();
	}

	const hash = crypto
		.createHash("sha256")
		.update(new Date().getTime().toString())
		.digest("hex");
	const redisClient = getRedisClient();
	await redisClient.publish("configHash", hash);

	return res.status(200).send();
}

export async function updateConfig(req: Request, res: Response) {
	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}
	const validUpdateFields = ["Live"];
	const filteredBody = keepTheValidFields(body, validUpdateFields);

	const contest: ContestCol = body;
	const db = getDB();
	const id = contest._id;
	contest.DateAdded = new Date(contest.DateAdded);
	delete contest["_id"];
	const ak = await db.collection<ContestCol>("Contests").updateOne(
		{ _id: new ObjectId(id) },
		{
			$set: {
				...filteredBody,
			},
		}
	);
	if (!ak.acknowledged) {
		return res.status(500).send();
	}

	const hash = crypto
		.createHash("sha256")
		.update(JSON.stringify(contest) + new Date().getTime().toString())
		.digest("hex");
	if (contest.Live == false) {
		const contestCode = contest.ContestCode;
		const CFSecretData = await getCFSecretData();
		const groupCode = CFSecretData.CF_GROUP_CODE;
		const customRating = await getCustomRating(
			Number(contestCode),
			groupCode
		);
		const bulkWriteData = customRating.map((data) => {
			return {
				updateOne: {
					filter: {
						cfUsername: data.username,
					},
					update: {
						$inc: {
							score: data.rating,
							problemSolved: data.points,
						},
					},
				},
			};
		});
		await db
			.collection("Users")
			.bulkWrite(bulkWriteData, { ordered: false });
		const ratedData = await formatRatingLeaderboard(customRating);

		const docToAdd: PastScoresCol = {
			dateAdded: contest.DateAdded,
			contestId: new ObjectId(id),
			...ratedData,
		};
		await db.collection<PastScoresCol>("PastScores").insertOne(docToAdd);
	} else {
		const pastScoreDoc = await db
			.collection<PastScoresCol>("PastScores")
			.findOne(
				{
					contestId: new ObjectId(id),
				},
				{
					projection: {
						_id: 0,
						dateAdded: 0,
						contestId: 0,
					},
				}
			);

		const pastScoreData: RatingData[] = Object.values(pastScoreDoc as any);
		let customRatingData = [];
		for (let i = 0; i < pastScoreData.length; i++) {
			for (let j = 0; j < pastScoreData[i].length; j++) {
				customRatingData.push(pastScoreData[i][j]);
			}
		}
		customRatingData = customRatingData.map((d: any) => {
			return { ...d, username: d.cfUsername };
		});
		const bulkWriteData = customRatingData.map((data) => {
			return {
				updateOne: {
					filter: {
						cfUsername: data.username,
					},
					update: {
						$inc: {
							score: -data.rating,
							problemSolved: -data.points,
						},
					},
				},
			};
		});

		await db
			.collection("Users")
			.bulkWrite(bulkWriteData, { ordered: false });

		await db.collection<PastScoresCol>("PastScores").deleteOne({
			contestId: new ObjectId(id),
		});
	}

	const redisClient = getRedisClient();
	await redisClient.publish("configHash", hash);

	return res.status(200).send();
}
