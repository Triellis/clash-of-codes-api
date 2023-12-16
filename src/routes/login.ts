import { Request, Response } from "express";
import { getClient, getDB } from "./../util/db";
import { signJWT, verifyGoogleToken } from "../util/functions";
import { UserCol, UserOnClient, UserOnClientProj } from "../util/types";

export default async function login(req: Request, res: Response) {
	const token = req.cookies["google_token"];
	if (!token) {
		res.status(401).send("unauthorized. no token found");
		return;
	}
	const payload = await verifyGoogleToken(token);
	if (payload === 401) {
		return res.send("Invalid google JWT").status(401);
	}
	const db = getDB();

	const userDoc = {
		name: payload.name!,
		email: payload.email!,
		clan: null,
		role: "User",

		createdAt: new Date(),
	};

	const ak = await db.collection("Users").updateOne(
		{ email: payload.email },
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

	const user = await db.collection<UserCol>("Users").findOne(
		{ email: payload.email },
		{
			projection: UserOnClientProj,
		}
	);
	const myjwt = await signJWT(user);

	return res.send(myjwt);
}
