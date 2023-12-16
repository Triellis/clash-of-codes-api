import { Request, Response } from "express";
import { getClient, getDB } from "./../util/db";
import { getJWTPayload } from "../util/functions";
import { userCol } from "../util/types";

export default async function login(req: Request, res: Response) {
	const db = getDB();
	const session = await getJWTPayload(req);

	const userDoc = {
		name: session.name!,
		email: session.email!,
		clan: null,
		role: "User",

		createdAt: new Date(),
	};
	const ak = await db.collection("Users").updateOne(
		{ email: session.email },
		{
			$setOnInsert: {
				...userDoc,
			},

			$set: {
				lastVisit: new Date(),
			},
			$inc: {
				visits: 1,
			},
		},

		{ upsert: true }
	);

	return res.sendStatus(200);
}
