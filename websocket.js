const { WebSocketServer } = require('ws');
const { verifyToken } = require('./utils/jwt');

const onlineUsers = new Map();

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    let userId = 'anonymous_' + Math.random().toString(36).substr(2, 9);
    let username = 'Anonymous';

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        userId = decoded.id;
        username = decoded.username;
      }
    }

    onlineUsers.set(userId, {
      userId,
      username,
      ws,
      serverIp: 'unknown',
      world: 'unknown',
      connectedAt: Date.now(),
    });

    console.log(`[WS] ${username} connected. Online: ${onlineUsers.size}`);

    broadcastOnlineUsers();

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleWsMessage(userId, msg);
      } catch (e) {}
    });

    ws.on('close', () => {
      onlineUsers.delete(userId);
      console.log(`[WS] ${username} disconnected. Online: ${onlineUsers.size}`);
      broadcastOnlineUsers();
    });

    ws.on('error', () => {
      onlineUsers.delete(userId);
    });

    ws.send(JSON.stringify({
      type: 'welcome',
      online: getOnlineList(),
    }));
  });

  return wss;
}

function handleWsMessage(userId, msg) {
  const user = onlineUsers.get(userId);
  if (!user) return;

  if (msg.type === 'update') {
    if (msg.server_ip) user.serverIp = msg.server_ip;
    if (msg.world) user.world = msg.world;
    broadcastOnlineUsers();
  }

  if (msg.type === 'ping') {
    user.ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
  }

  if (msg.type === 'ironman') {
    console.log(`[WS] IronMan event from ${user.username}: ${msg.action || 'unknown'}`);
    broadcastIronMan(userId, msg);
  }
}

function broadcastIronMan(senderId, msg) {
  onlineUsers.forEach((user) => {
    if (user.userId !== senderId) {
      try {
        if (user.ws.readyState === 1) {
          user.ws.send(JSON.stringify(msg));
        }
      } catch (e) {}
    }
  });
}

function getOnlineList() {
  const list = [];
  onlineUsers.forEach((user) => {
    list.push({
      userId: user.userId,
      username: user.username,
      serverIp: user.serverIp,
      world: user.world,
    });
  });
  return list;
}

function broadcastOnlineUsers() {
  const list = getOnlineList();
  const data = JSON.stringify({ type: 'online_users', users: list });

  onlineUsers.forEach((user) => {
    try {
      if (user.ws.readyState === 1) {
        user.ws.send(data);
      }
    } catch (e) {}
  });
}

function getOnlineUsers() {
  return getOnlineList();
}

module.exports = { setupWebSocket, getOnlineUsers };
