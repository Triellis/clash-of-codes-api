import { TokenPayload } from "google-auth-library";
import { ObjectId } from "mongodb";

export type GoogleTokenPayload = TokenPayload | 401;
export type userCol = {
	_id?: ObjectId;
	name: String;
	email: String;
	role: "User" | "Admin" | "Elder" | "Member" | "Leader" | "CoLeader";
	clan: null | "BW" | "RG" | "YB" | "PP";
	visits: number;
	createdAt: Date;
	lastVisit: Date;
};
