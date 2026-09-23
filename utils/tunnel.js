const { tunnelmole } = require('tunnelmole');

let publicTunnelUrl = null;
let currentPort = 3000;
let isConnecting = false;

async function startTunnel(port = 3000) {
    currentPort = port;
    if (isConnecting) return publicTunnelUrl;
    isConnecting = true;

    try {
        console.log(`🔄 Initializing Tunnelmole tunnel on port ${port}...`);
        const url = await tunnelmole({ port });
        if (url) {
            publicTunnelUrl = url.trim().replace(/\/$/, '');
            console.log(`✅ Tunnelmole is online! Public HTTPS URL: ${publicTunnelUrl}`);
        }
        isConnecting = false;
        return publicTunnelUrl;
    } catch (err) {
        console.warn('⚠️ Tunnelmole connection warning:', err.message);
        isConnecting = false;
        return null;
    }
}

function getPublicUrl(req) {
    if (publicTunnelUrl) {
        return publicTunnelUrl;
    }
    if (req) {
        return `${req.protocol}://${req.get('host')}`;
    }
    return `http://localhost:${currentPort}`;
}

function getCurrentTunnelUrl() {
    return publicTunnelUrl;
}

module.exports = {
    startTunnel,
    getPublicUrl,
    getCurrentTunnelUrl
};
