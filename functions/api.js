// GET : vérifier la connexion à la base de données
export async function onRequestGet(context) {
    const result = await context.env.DB
        .prepare("SELECT COUNT(*) AS total FROM rooms")
        .first();

    return Response.json({
        status: "ok",
        rooms: result.total
    });
}


// POST : gérer les actions multijoueurs
export async function onRequestPost(context) {
    const { request, env } = context;
    const data = await request.json();


    // ==========================================
    // CRÉER UN SALON
    // ==========================================

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


    // ==========================================
    // REJOINDRE UN SALON
    // ==========================================

    if (data.action === "join") {

        const { nickname, room } = data;

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

        // Vérifier que le salon existe
        const existingRoom = await env.DB
            .prepare("SELECT * FROM rooms WHERE code = ?")
            .bind(roomCode)
            .first();

        if (!existingRoom) {
            return Response.json({
                error: "Salon introuvable"
            }, { status: 404 });
        }

        // Ajouter le joueur si le salon est disponible
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
                error: "Salon complet, partie commencée ou pseudo déjà utilisé"
            }, { status: 409 });
        }

        return Response.json({
            status: "ok",
            room: roomCode,
            playerId: playerId
        });
    }


    // ==========================================
    // ACTION INCONNUE
    // ==========================================

    return Response.json({
        error: "Action inconnue"
    }, { status: 400 });
}