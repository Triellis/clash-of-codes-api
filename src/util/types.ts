import { TokenPayload } from "google-auth-library";
import { ObjectId } from "mongodb";

export type GoogleTokenPayload = TokenPayload | 401;
type Clan = "BW" | "RG" | "YB" | "PP";

export interface Contest {
	Team1: Clan;
	Team2: Clan;
	ContestCode: number;
	DateAdded: Date;
	Live: boolean;
}

export type UserCol = {
	_id?: ObjectId;
	name: String;
	email: String;
	role: "User" | "Admin" | "Elder" | "Member" | "Leader" | "CoLeader";
	clan: null | Clan;
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
