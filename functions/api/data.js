export async function onRequestGet(context) {
    // هنا نقرأ البيانات من قاعدة البيانات بناءً على هوية العميل
    try {
        const url = new URL(context.request.url);
        const clientId = url.searchParams.get('client') || 'default';

        // استدعاء قاعدة بيانات KV اللي أنشأناها (MENU_DATA)
        const data = await context.env.MENU_DATA.get(clientId);

        if (!data) {
            return new Response(JSON.stringify({ message: "No data found", data: null }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(data, {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    // هنا نكتب/نحدث البيانات في قاعدة البيانات
    try {
        const url = new URL(context.request.url);
        const clientId = url.searchParams.get('client') || 'default';

        // استلام البيانات كـ JSON من الطلب
        const body = await context.request.json();

        // حفظها في KV
        await context.env.MENU_DATA.put(clientId, JSON.stringify(body));

        return new Response(JSON.stringify({ success: true, message: "Data saved successfully" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
