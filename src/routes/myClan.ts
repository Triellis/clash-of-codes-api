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
	const clansStanding = await getClanStandings();
	const myClanRank = clansStanding.findIndex(
		(clan) => clan.clanName === clanName
	);
	const myClanData = clansStanding.filter(
		(clan) => clan.clanName === clanName
	)[0];
	const myClanScore = myClanData.totalScore;
	const myClanProblemSolved = myClanData.totalProblemSolved;

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
	const clanDataWithRank = clanData.map((user, index) => {
		return {
			...user,
			rank: index + 1,
		};
	}) as ClanMember[];
	const clanDataWithRankAndClan: ClanDataWithRankAndClan = {
		clanName,
		clanRank: myClanRank + 1,
		clanScore: myClanScore,
		clanProblemSolved: myClanProblemSolved,
		members: clanDataWithRank,
	};
	return res.json(clanDataWithRankAndClan);
}
