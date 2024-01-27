import { Request, Response } from "express";
import { getClient } from "../util/db";
import {
	Clan,
	ClanDataWithRankAndClan,
	ClanMember,
	UserCol,
} from "../util/types";
import { getClanStandings } from "./clansRanks";

export async function getClan(req: Request, res: Response) {
	const clanName = req.params.clanName as Clan;
	const query = req.query;
	const page = Number(query.page) || 1;
	const searchQuery = (query.searchQuery as string) || "";
	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;

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
					name: { $regex: searchQuery, $options: "i" },
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
		.skip(skip)
		.limit(maxResults)
		.toArray();
	const clanDataWithRank = clanData.map((user, index) => {
		return {
			...user,
			rank: index + 1,
		};
	}) as ClanMember[];

	return res.json(clanDataWithRank);
}
