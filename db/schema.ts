import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", { code: text("code").primaryKey(), hostSession: text("host_session").notNull(), started: integer("started").notNull().default(0), startedAt: integer("started_at"), winnerSession: text("winner_session"), winnerName: text("winner_name") });
export const players = sqliteTable("players", { roomCode: text("room_code").notNull(), session: text("session").primaryKey(), name: text("name").notNull(), joinedAt: integer("joined_at").notNull() });
