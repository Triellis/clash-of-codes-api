import { Request, Response } from "express";
import { UserCol, UserOnClientProj } from "../../util/types";
import { getDB } from "../../util/db";

export async function getUsers(req: Request, res: Response) {
	const query = req.query;
	const page = Number(query.page) || 1;
	const searchQuery = (query.searchQuery as string) || "";
	const maxResults =
		Number(query.maxResults) || Number(process.env.MAX_RESULTS);
	const skip = (page - 1) * maxResults;

	const db = getDB();
	const col = db.collection<UserCol>("Users");
	const searchRegex = new RegExp(searchQuery, "i");

	const usersData = await col
		.find(
			{
				$or: [
					{
						name: searchRegex,
					},
					{
						email: searchRegex,
					},
					{
						role: searchRegex,
					},
					{
						cfUsername: searchRegex,
					},
					{
						clan: searchRegex,
					},
				],
			},
			{
				sort: {
					lastVisit: -1,
				},
				projection: UserOnClientProj,
			}
		)
		.skip(skip)
		.limit(maxResults)
		.toArray();

	return res.json(usersData);
}
