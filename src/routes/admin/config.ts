import { Request, Response } from "express";

import { ContestCol } from "../../util/types";
import { getDB } from "../../util/db";
import { getRedisClient } from "../../util/redis";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { isValidContestCode, replaceFullName } from "../../util/functions";

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

	const contest: ContestCol = body;
	const contestCode = contest.ContestCode;
	if (
		!(await isValidContestCode(
			contestCode,
			process.env.GROUP_CODE as string
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
		res.send("Please provide a id in query").status(400);
	}
	const db = getDB();
	const ak = await db
		.collection("Contests")
		.deleteOne({ _id: new ObjectId(id as string) });

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

	const contest: ContestCol = body;
	const db = getDB();
	const id = contest._id;
	delete contest["_id"];
	const ak = await db.collection<ContestCol>("Contests").updateOne(
		{ _id: new ObjectId(id) },
		{
			$set: {
				...contest,
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
	const redisClient = getRedisClient();
	await redisClient.publish("configHash", hash);

	return res.status(200).send();
}
