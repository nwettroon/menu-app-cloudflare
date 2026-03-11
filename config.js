/* توليد تلقائي من الإدارة */

const CLIENTS_DATA = {
    "fruitofrefreshingtaste": {
        name: "ثمرة المذاق المنعش",
        domains: ["menu-app-cloudflare.pages.dev","fruitofrefreshingtaste.menu-app-cloudflare.pages.dev"],
        moyasarPublishableKey: "pk_test_h67jUi6ZKv49amLbX9c3uu74av5ddUP9UEPntMQt"
    },
};

function detectClient() {
    const hostname = window.location.hostname;
    for (const [clientId, client] of Object.entries(CLIENTS_DATA)) {
        if (client.domains.includes(hostname)) return { id: clientId, ...client };
    }
    const fallbackId = Object.keys(CLIENTS_DATA)[0] || "default";
    return { id: fallbackId, ...(CLIENTS_DATA[fallbackId] || {}) };
}

const CLIENT = detectClient();
export { CLIENT, CLIENTS_DATA };
