import { Request, Response } from "express";
import { getClient } from "../util/db";
import { UserCol } from "../util/types";

export async function getClans(req: Request, res: Response) {
	const client = getClient();
	const db = client.db("clash-of-codes");
	const users = db.collection<UserCol>("Users");
	const clanData = await users
		.aggregate([
			{
				$match: {
					clan: { $ne: null },
				},
			},

			{
				$group: {
					_id: "$clan",
					totalScore: {
						$sum: "$score",
					},
				},
			},
		])
		.toArray();
	const processedClanData = [];
	for (let i = 0; i < clanData.length; i++) {
		const clan = clanData[i];

		processedClanData.push({
			clanName: clan._id,
			totalScore: clan.totalScore,
		});
	}

	processedClanData.sort((a, b) => b.totalScore - a.totalScore);
	return res.json(processedClanData);
}
