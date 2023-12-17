import { TokenPayload } from "google-auth-library";
import { ObjectId } from "mongodb";

export type GoogleTokenPayload = TokenPayload | 401;
export type UserCol = {
	_id?: ObjectId;
	name: String;
	email: String;
	role: "User" | "Admin" | "Elder" | "Member" | "Leader" | "CoLeader";
	clan: null | "BW" | "RG" | "YB" | "PP";
	visits: number;
	createdAt: Date;
	lastVisit: Date;
	cfUsername?: string;
};

export type UserOnClient = Omit<UserCol, "visits" | "createdAt" | "lastVisit">;
export const UserOnClientProj = {
	visits: 0,
	createdAt: 0,
	lastVisit: 0,
};
