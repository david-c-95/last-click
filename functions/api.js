export async function onRequestGet(context) {
    const result = await context.env.DB
        .prepare("SELECT COUNT(*) AS total FROM rooms")
        .first();

    return Response.json({
        status: "ok",
        rooms: result.total
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const data = await request.json();

    if (data.action === "create") {

        const { nickname, room, password } = data;

        // Vérifier le mot de passe
        if (password !== env.ROOM_PASSWORD) {
            return Response.json({
                error: "Mot de passe incorrect"
            }, { status: 403 });
        }

        // Vérifier les champs
        if (typeof room !== "string" ||
            typeof nickname !== "string" ||
            !room.trim() || !nickname.trim()) {
            return Response.json({
                error: "Champs manquants"
            }, { status: 400 });
        }

        const roomCode = room.trim().toLowerCase();
        const playerId = crypto.randomUUID();

        // Vérifier si le salon existe déjà
        const existingRoom = await env.DB
            .prepare("SELECT code FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (existingRoom) {
            return Response.json({
                error: "Ce salon existe déjà"
            }, { status: 409 });
        }

        // Créer le salon et son premier joueur
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

    return Response.json({
        error: "Action inconnue"
    }, { status: 400 });
}