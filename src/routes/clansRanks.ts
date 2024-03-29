import { Request, Response } from "express";
import { getClient } from "../util/db";
import { UserCol } from "../util/types";

export async function getClans(req: Request, res: Response) {
	const client = getClient();
	const db = client.db("clash-of-codes");
	const users = db.collection<UserCol>("Users");
	const clanName = req.query.clanName as string;
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
					totalProblemSolved: {
						$sum: "$problemSolved",
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
			totalProblemSolved: clan.totalProblemSolved,
			rank: 0,
		});
	}

	processedClanData.sort((a, b) => {
		if (a.totalProblemSolved === b.totalProblemSolved)
			return b.totalScore - a.totalScore;
		return b.totalProblemSolved - a.totalProblemSolved;
	});
	processedClanData.forEach((clan, index) => {
		clan.rank = index + 1;
	});
	if (clanName != null) {
		const clan = processedClanData.find(
			(clan) => clan.clanName === clanName
		);
		if (!clan) {
			return res.status(400).send("invalid clan name");
		}
		return res.json(clan);
	}

	return res.json(processedClanData);
}
