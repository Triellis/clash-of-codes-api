import { Request, Response } from "express";
import { getClient } from "../util/db";
import { UserCol } from "../util/types";

export async function getClan(req: Request, res: Response) {
	const clanName = req.params.clanName;
	if (!clanName) {
		return res.status(400).send("clan name not provided");
	}
	const validClans = ["RG", "BW", "YB", "PP"];
	if (!validClans.includes(clanName)) {
		return res
			.status(400)
			.send(
				`invalid clan name ${clanName}, valid clans are ${validClans.join(
					", "
				)}`
			);
	}
	const client = getClient();
	const db = client.db("clash-of-codes");
	const users = db.collection<UserCol>("Users");
	const clanData = await users
		.aggregate([
			{
				$match: {
					clan: clanName,
				},
			},
			{
				$project: {
					_id: 0,
					name: 1,
					cfUsername: 1,
					score: 1,
					problemSolved: 1,
					role: 1,
				},
			},
			{
				$sort: {
					problemSolved: -1,
					score: -1,
				},
			},
		])
		.toArray();
	return res.json(clanData);
}
