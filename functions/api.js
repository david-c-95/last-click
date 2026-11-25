// =========================
// GET - DATABASE TEST
// =========================

export async function onRequestGet(context) {

    const result = await context.env.DB
        .prepare("SELECT COUNT(*) AS total FROM rooms")
        .first();

    return Response.json({
        status: "ok",
        rooms: result.total
    });

}


// =========================
// RESPONSE HELPERS
// =========================

function success(data = {}) {

    return Response.json({
        status: "ok",
        ...data
    });

}

function error(message, status = 400) {

    return Response.json({
        error: message
    }, { status });

}


// =========================
// ONLINE GAME HELPERS
// =========================

// Exactly 1 chance in 20.
// The result is generated on the server.

function isEliminated() {

    const value = new Uint32Array(1);

    do {

        crypto.getRandomValues(value);

    } while (value[0] >= 4294967280);

    return value[0] % 20 === 0;

}


// =========================
// ADVANCE TURN
// =========================

function advanceTurn(db, roomCode, playerId, turnVersion = null) {

    const aliveCount = `(
        SELECT COUNT(*) FROM players
        WHERE room_code = rooms.code
        AND alive = 1
    )`;

    const unplayed = `
        SELECT id FROM players
        WHERE room_code = rooms.code
        AND alive = 1
        AND last_played_round < rooms.round_number
    `;

    const eligible = `
        SELECT id FROM players
        WHERE room_code = rooms.code
        AND alive = 1
    `;

    const condition = turnVersion === null
        ? `(current_turn = ? OR ${aliveCount} <= 1)`
        : `current_turn = ? AND turn_version = ?
           AND EXISTS (
               SELECT 1 FROM players
               WHERE room_code = rooms.code
               AND id = rooms.current_turn
               AND last_played_round = rooms.round_number
           )`;

    const statement = db.prepare(`

        UPDATE rooms

        SET status = CASE

                WHEN ${aliveCount} <= 1 THEN 'finished'

                ELSE 'playing'

            END,

            winner = CASE

                WHEN ${aliveCount} = 1
                THEN (${eligible} LIMIT 1)

                ELSE NULL

            END,

            round_number = CASE

                WHEN ${aliveCount} > 1
                     AND NOT EXISTS (${unplayed})

                THEN round_number + 1

                ELSE round_number

            END,

            current_turn = CASE

                WHEN ${aliveCount} <= 1 THEN NULL

                ELSE COALESCE(
                    (${unplayed} ORDER BY RANDOM() LIMIT 1),
                    (${eligible} ORDER BY RANDOM() LIMIT 1)
                )

            END,

            turn_version = turn_version + 1

        WHERE code = ?
        AND status = 'playing'

        AND ${condition}

    `);

    return turnVersion === null
        ? statement.bind(roomCode, playerId)
        : statement.bind(roomCode, playerId, turnVersion);

}


// =========================
// POST - ONLINE ACTIONS
// =========================

export async function onRequestPost(context) {

    const { request, env } = context;
    const db = env.DB;

    let data;

    try {

        data = await request.json();

    } catch {

        return error("Invalid JSON");

    }

    if (!data || typeof data !== "object") {

        return error("Invalid request");

    }

    const {
        action,
        nickname,
        room,
        password,
        playerId
    } = data;


    // =========================
    // SOLO PASSWORD
    // =========================

    if (action === "solo") {

        if (!env.ROOM_PASSWORD ||
            password !== env.ROOM_PASSWORD) {

            return error("Incorrect password", 403);

        }

        return success();

    }


    // =========================
    // VERIFY ROOM NAME
    // =========================

    if (typeof room !== "string" ||
        !room.trim() ||
        room.trim().length > 30) {

        return error("Invalid room name");

    }

    const roomCode = room.trim().toLowerCase();


    // =========================
    // CREATE ROOM
    // =========================

    if (action === "create") {

        if (!env.ROOM_PASSWORD ||
            password !== env.ROOM_PASSWORD) {

            return error("Incorrect password", 403);

        }

        if (typeof nickname !== "string" ||
            !nickname.trim() ||
            nickname.trim().length > 20) {

            return error("Invalid nickname");

        }

        const newPlayerId = crypto.randomUUID();

        const existingRoom = await db
            .prepare("SELECT code FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (existingRoom) {

            return error("This room already exists", 409);

        }

        try {

            await db.batch([

                db.prepare(`

                    INSERT INTO rooms
                    (code, host_id, current_turn)
                    VALUES (?, ?, ?)

                `).bind(
                    roomCode,
                    newPlayerId,
                    newPlayerId
                ),

                db.prepare(`

                    INSERT INTO players
                    (id, room_code, nickname)
                    VALUES (?, ?, ?)

                `).bind(
                    newPlayerId,
                    roomCode,
                    nickname.trim()
                )

            ]);

        } catch (err) {

            const existing = await db
                .prepare("SELECT code FROM rooms WHERE code = ?")
                .bind(roomCode)
                .first();

            if (existing) {

                return error(
                    "This room already exists",
                    409
                );

            }

            throw err;

        }

        return success({
            room: roomCode,
            playerId: newPlayerId
        });

    }


    // =========================
    // JOIN ROOM
    // =========================

    if (action === "join") {

        if (typeof nickname !== "string" ||
            !nickname.trim() ||
            nickname.trim().length > 20) {

            return error("Invalid nickname");

        }

        const newPlayerId = crypto.randomUUID();

        const existingRoom = await db
            .prepare("SELECT code FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (!existingRoom) {

            return error("Room not found", 404);

        }

        const result = await db.prepare(`

            INSERT INTO players
            (id, room_code, nickname)

            SELECT ?, ?, ?

            WHERE EXISTS (
                SELECT 1 FROM rooms
                WHERE code = ?
                AND status = 'waiting'
            )

            AND (
                SELECT COUNT(*) FROM players
                WHERE room_code = ?
            ) < 10

            AND NOT EXISTS (
                SELECT 1 FROM players
                WHERE room_code = ?
                AND LOWER(nickname) = LOWER(?)
            )

        `).bind(
            newPlayerId,
            roomCode,
            nickname.trim(),
            roomCode,
            roomCode,
            roomCode,
            nickname.trim()
        ).run();

        if (result.meta.changes === 0) {

            return error(
                "Room full, game started or nickname already used",
                409
            );

        }

        return success({
            room: roomCode,
            playerId: newPlayerId
        });

    }


    // =========================
    // VERIFY PLAYER ID
    // =========================

    if (typeof playerId !== "string" ||
        !playerId.trim()) {

        return error("Missing player ID");

    }


    // =========================
    // GET ROOM STATE
    // =========================

    if (action === "state") {

        const result = await db.prepare(`

            SELECT
                r.code AS room_code,
                r.status AS room_status,
                r.host_id,
                r.current_turn,
                r.winner,
                r.round_number,
                r.turn_version,
                p.id,
                p.nickname,
                p.alive,
                p.last_played_round

            FROM rooms r

            JOIN players p
                ON p.room_code = r.code

            WHERE r.code = ?

            AND EXISTS (
                SELECT 1 FROM players
                WHERE room_code = r.code
                AND id = ?
            )

            ORDER BY p.joined_at ASC, p.rowid ASC

        `).bind(
            roomCode,
            playerId
        ).all();

        const players = result.results;

        if (players.length === 0) {

            return error(
                "Room no longer exists or player disconnected",
                404
            );

        }

        const currentRoom = players[0];

        const winner = players.find(
            player => player.id === currentRoom.winner
        );

        return success({

            room: currentRoom.room_code,

            roomStatus: currentRoom.room_status,

            isHost: playerId === currentRoom.host_id,

            isYourTurn: playerId === currentRoom.current_turn,

            roundNumber: currentRoom.round_number,

            turnVersion: currentRoom.turn_version,

            playerCount: players.length,

            winner: winner ? winner.nickname : null,

            players: players.map(player => ({

                nickname: player.nickname,

                alive: player.alive === 1,

                lastPlayedRound: player.last_played_round,

                isHost: player.id === currentRoom.host_id,

                isYou: player.id === playerId,

                isCurrentTurn:
                    player.id === currentRoom.current_turn

            }))

        });

    }


    // =========================
    // LEAVE ROOM
    // =========================

    if (action === "leave") {

        const player = await db.prepare(`

            SELECT id FROM players
            WHERE id = ?
            AND room_code = ?

        `).bind(
            playerId,
            roomCode
        ).first();

        if (!player) {

            return error("Player not found", 404);

        }

        await db.batch([

            // Transfer host if necessary

            db.prepare(`

                UPDATE rooms

                SET host_id = (
                    SELECT id FROM players
                    WHERE room_code = ?
                    AND id != ?
                    ORDER BY joined_at ASC, rowid ASC
                    LIMIT 1
                )

                WHERE code = ?
                AND host_id = ?

                AND EXISTS (
                    SELECT 1 FROM players
                    WHERE room_code = ?
                    AND id = ?
                )

            `).bind(
                roomCode,
                playerId,
                roomCode,
                playerId,
                roomCode,
                playerId
            ),


            // Remove player

            db.prepare(`

                DELETE FROM players

                WHERE id = ?
                AND room_code = ?

            `).bind(
                playerId,
                roomCode
            ),


            // Draw another player if necessary

            advanceTurn(db, roomCode, playerId),


            // Keep lobby current_turn consistent

            db.prepare(`

                UPDATE rooms

                SET current_turn = host_id

                WHERE code = ?
                AND status = 'waiting'
                AND current_turn = ?

            `).bind(
                roomCode,
                playerId
            ),


            // Delete room if empty

            db.prepare(`

                DELETE FROM rooms

                WHERE code = ?

                AND NOT EXISTS (
                    SELECT 1 FROM players
                    WHERE room_code = ?
                )

            `).bind(
                roomCode,
                roomCode
            )

        ]);

        return success();

    }


    // =========================
    // DELETE ROOM - HOST ONLY
    // =========================

    if (action === "delete") {

        const result = await db.prepare(`

            DELETE FROM rooms

            WHERE code = ?
            AND host_id = ?

            AND EXISTS (
                SELECT 1 FROM players
                WHERE room_code = ?
                AND id = ?
            )

        `).bind(
            roomCode,
            playerId,
            roomCode,
            playerId
        ).run();

        if (result.meta.changes === 0) {

            return error(
                "Only the host can delete the room",
                403
            );

        }

        return success();

    }


    // =========================
    // START GAME - HOST ONLY
    // =========================

    if (action === "start") {

        const result = await db.prepare(`

            UPDATE rooms

            SET status = 'playing',

                current_turn = (
                    SELECT id FROM players
                    WHERE room_code = rooms.code
                    AND alive = 1
                    ORDER BY RANDOM()
                    LIMIT 1
                ),

                winner = NULL,

                round_number = 1,

                turn_version = turn_version + 1

            WHERE code = ?
            AND host_id = ?
            AND status = 'waiting'

            AND EXISTS (
                SELECT 1 FROM players
                WHERE room_code = ?
                AND id = ?
            )

            AND (
                SELECT COUNT(*) FROM players
                WHERE room_code = ?
                AND alive = 1
            ) >= 2

        `).bind(
            roomCode,
            playerId,
            roomCode,
            playerId,
            roomCode
        ).run();

        if (result.meta.changes === 0) {

            return error(
                "Only the host can start with at least 2 players",
                409
            );

        }

        return success({
            roomStatus: "playing"
        });

    }


    // =========================
    // PLAY ONE TURN
    // =========================

    if (action === "click") {

        const { turnVersion } = data;

        if (!Number.isSafeInteger(turnVersion) ||
            turnVersion < 0) {

            return error("Invalid turn version");

        }


        // Random elimination - 5%

        const eliminated = isEliminated();


        // Atomic database operations

        const results = await db.batch([

            // Update current player

            db.prepare(`

                UPDATE players

                SET alive = ?,

                    last_played_round = (
                        SELECT round_number FROM rooms
                        WHERE code = players.room_code
                    )

                WHERE id = ?
                AND room_code = ?
                AND alive = 1

                AND EXISTS (
                    SELECT 1 FROM rooms

                    WHERE code = players.room_code
                    AND status = 'playing'
                    AND current_turn = players.id
                    AND turn_version = ?
                    AND players.last_played_round < rooms.round_number
                )

            `).bind(
                eliminated ? 0 : 1,
                playerId,
                roomCode,
                turnVersion
            ),


            // Draw next player or finish game

            advanceTurn(
                db,
                roomCode,
                playerId,
                turnVersion
            )

        ]);


        // Reject duplicate or unauthorized clicks

        if (results[0].meta.changes !== 1 ||
            results[1].meta.changes !== 1) {

            return error(
                "Not your turn or turn already played",
                409
            );

        }


        // Return click result

        return success({

            eliminated,

            turnVersion: turnVersion + 1

        });

    }


    // =========================
    // UNKNOWN ACTION
    // =========================

    return error("Unknown action");

}