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
// POST - ONLINE ACTIONS
// =========================

export async function onRequestPost(context) {

    const { request, env } = context;
    const data = await request.json();


    // =========================
    // CREATE ROOM
    // =========================

    if (data.action === "create") {

        const { nickname, room, password } = data;

        if (!env.ROOM_PASSWORD ||
            password !== env.ROOM_PASSWORD) {

            return Response.json({
                error: "Incorrect password"
            }, { status: 403 });

        }

        if (typeof room !== "string" ||
            typeof nickname !== "string" ||
            !room.trim() || !nickname.trim() ||
            room.trim().length > 30 ||
            nickname.trim().length > 20) {

            return Response.json({
                error: "Invalid room name or nickname"
            }, { status: 400 });

        }

        const roomCode = room.trim().toLowerCase();
        const playerId = crypto.randomUUID();

        const existingRoom = await env.DB
            .prepare("SELECT code FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (existingRoom) {

            return Response.json({
                error: "This room already exists"
            }, { status: 409 });

        }

        await env.DB.batch([

            env.DB.prepare(
                "INSERT INTO rooms (code, current_turn) VALUES (?, ?)"
            ).bind(roomCode, playerId),

            env.DB.prepare(
                "INSERT INTO players (id, room_code, nickname) VALUES (?, ?, ?)"
            ).bind(playerId, roomCode, nickname.trim())

        ]);

        return Response.json({
            status: "ok",
            room: roomCode,
            playerId: playerId
        });

    }


    // =========================
    // JOIN ROOM
    // =========================

    if (data.action === "join") {

        const { nickname, room } = data;

        if (typeof room !== "string" ||
            typeof nickname !== "string" ||
            !room.trim() || !nickname.trim() ||
            room.trim().length > 30 ||
            nickname.trim().length > 20) {

            return Response.json({
                error: "Invalid room name or nickname"
            }, { status: 400 });

        }

        const roomCode = room.trim().toLowerCase();
        const playerId = crypto.randomUUID();

        const existingRoom = await env.DB
            .prepare("SELECT * FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (!existingRoom) {

            return Response.json({
                error: "Room not found"
            }, { status: 404 });

        }

        const result = await env.DB.prepare(`
            INSERT INTO players (id, room_code, nickname)
            SELECT ?, ?, ?
            WHERE EXISTS (
                SELECT 1 FROM rooms
                WHERE code = ? AND status = 'waiting'
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
            playerId,
            roomCode,
            nickname.trim(),
            roomCode,
            roomCode,
            roomCode,
            nickname.trim()
        ).run();

        if (result.meta.changes === 0) {

            return Response.json({
                error: "Room full, game started or nickname already used"
            }, { status: 409 });

        }

        return Response.json({
            status: "ok",
            room: roomCode,
            playerId: playerId
        });

    }


    // =========================
    // GET ROOM STATE
    // =========================

    if (data.action === "state") {

        const { room, playerId } = data;

        if (typeof room !== "string" ||
            typeof playerId !== "string") {

            return Response.json({
                error: "Missing room or player ID"
            }, { status: 400 });

        }

        const roomCode = room.trim().toLowerCase();


        // Get room

        const currentRoom = await env.DB
            .prepare("SELECT * FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (!currentRoom) {

            return Response.json({
                error: "Room no longer exists"
            }, { status: 404 });

        }


        // Get players

        const result = await env.DB
            .prepare(`
                SELECT id, nickname, alive
                FROM players
                WHERE room_code = ?
                ORDER BY joined_at ASC, rowid ASC
            `)
            .bind(roomCode)
            .all();

        const players = result.results;


        // Verify player membership

        const currentPlayer = players.find(
            player => player.id === playerId
        );

        if (!currentPlayer) {

            return Response.json({
                error: "You are no longer in this room"
            }, { status: 403 });

        }


        // During the lobby, current_turn identifies the host

        const hostId = currentRoom.current_turn;


        // Return public player information

        return Response.json({

            status: "ok",

            room: currentRoom.code,

            roomStatus: currentRoom.status,

            isHost: playerId === hostId,

            playerCount: players.length,

            players: players.map(player => ({

                nickname: player.nickname,

                alive: player.alive === 1,

                isHost: player.id === hostId,

                isYou: player.id === playerId

            }))

        });

    }


    // =========================
    // UNKNOWN ACTION
    // =========================

    return Response.json({
        error: "Unknown action"
    }, { status: 400 });

}