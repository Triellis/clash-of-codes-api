import { Request, Response } from "express";
import { getDB } from "../util/db";

export default async function getPastScores(req: Request, res: Response) {
	const query = req.query;
	const page = Number(query.page) || 1;

	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;

	const db = getDB();
	const col = db.collection("PastScores");
	const pastScores = await col
		.find(
			{},
			{
				sort: {
					dateAdded: -1,
				},
			}
		)
		.project({
			_id: 0,

			contestId: 0,
		})
		.skip(skip)
		.limit(maxResults)
		.toArray();
	return res.json(pastScores);
}
