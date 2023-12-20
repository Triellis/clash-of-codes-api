import { Request, Response } from "express";
import { UserCol, UserOnClientProj } from "../../util/types";
import { getDB } from "../../util/db";
import { ObjectId } from "mongodb";

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

export async function deleteUser(req: Request, res: Response) {
	const query = req.query;
	const id = query.id as string;
	if (!id) {
		return res.send("Please provide an id in the query").status(400);
	}

	const db = getDB();
	const col = db.collection<UserCol>("Users");
	const deleteResult = await col.deleteOne({
		_id: new ObjectId(id),
	});
	if (deleteResult.deletedCount === 0) {
		return res.send("No user found with that id").status(400);
	}
	return res.send("User deleted successfully").status(200);
}