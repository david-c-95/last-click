export async function onRequestGet(context) {
    const result = await context.env.DB
        .prepare("SELECT COUNT(*) AS total FROM rooms")
        .first();

    return Response.json({
        status: "ok",
        rooms: result.total
    });
}