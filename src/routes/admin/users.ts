import { Request, Response } from "express";
import { UserCol, UserOnClientProj } from "../../util/types";
import { getDB } from "../../util/db";
import { ObjectId } from "mongodb";
import { keepTheValidFields } from "../../util/functions";

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
	} else if (!ObjectId.isValid(id as string)) {
		return res.send(`${id} is not valid object id`).status(500);
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

export async function addUser(req: Request, res: Response) {
	let body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}
	if (!body.name || !body.email || !body.role) {
		return res
			.send("Please provide name, email, role and clan in the body")
			.status(400);
	}

	body = keepTheValidFields(body, ["name", "email", "role", "clan"]);
	if (!body.clan) {
		body.clan = null;
	}
	body.createdAt = new Date();
	body.lastVisit = new Date();
	body.visits = 0;

	const user: UserCol = body;
	const db = getDB();
	const col = db.collection<UserCol>("Users");
	const sameEmail = await col.countDocuments({ email: body.email });
	if (sameEmail !== 0) {
		return res.status(403).send(`User with ${body.email} already exists.`);
	}
	const insertResult = await col.insertOne(user);
	if (!insertResult.acknowledged) {
		return res.send("User not inserted").status(500);
	}
	return res.send("User inserted successfully").status(200);
}

export async function updateUser(req: Request, res: Response) {
	const body = req.body;
	if (!body) {
		return res.send("Please provide a body").status(400);
	}

	const user: UserCol = body;
	const db = getDB();
	const col = db.collection<UserCol>("Users");
	if (!user._id) {
		return res
			.status(403)
			.send("you must provide _id in the body to update the user ");
	}
	const id = user._id;
	const userFiltered = keepTheValidFields(user as any, [
		"name",
		"email",
		"role",
		"clan",
		"cfUsername",
	]);
	const updateResult = await col.updateOne(
		{
			_id: new ObjectId(id),
		},
		{
			$set: {
				...userFiltered,
			},
		}
	);
	if (!updateResult.acknowledged) {
		return res.send("No user found with that id").status(400);
	}
	return res.send("User updated successfully").status(200);
}
