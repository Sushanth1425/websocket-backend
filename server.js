const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const encryptionKey = 'bZ1ufMGIh54MyBX9l2NsxCqKX9yiYsbP'; 
const ivLength = 16; 
const algorithm = 'aes-256-cbc'; 

const wss = new WebSocket.Server({ port: 8080 });
const getRoomFilePath = (roomID) =>
  path.join(__dirname, "data", `${roomID}.json`);

const getValidEncryptionKey = (key) => {
  return crypto.createHash('sha256').update(key).digest(); 
};

const encrypt = (text) => {
  const iv = crypto.randomBytes(ivLength); 
  const cipher = crypto.createCipheriv(algorithm, getValidEncryptionKey(encryptionKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; 
};

const decrypt = (encryptedText) => {
  const [iv, encrypted] = encryptedText.split(':');
  const decipher = crypto.createDecipheriv(algorithm, getValidEncryptionKey(encryptionKey), Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

const loadMessages = (roomID) => {
  const filePath = getRoomFilePath(roomID);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      const messages = data.trim() ? JSON.parse(data) : [];
      return messages.map(msg => ({
        ...msg,
        msg: decrypt(msg.msg), 
      }));
    } catch (error) {
      console.error(`Error parsing JSON for room ${roomID}:`, error);
      return [];
    }
  }
  return [];
};

const saveMessages = (roomID, messages) => {
  const filePath = getRoomFilePath(roomID);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const encryptedMessages = messages.map(msg => ({
    ...msg,
    msg: encrypt(msg.msg), 
  }));

  fs.writeFileSync(filePath, JSON.stringify(encryptedMessages, null, 2));
};

const roomClients = new Map();

wss.on("connection", (ws, req) => {
  const roomID = req.url.slice(1);  
  let username = "";

  if (!roomClients.has(roomID)) {
    roomClients.set(roomID, new Set());
  }
  roomClients.get(roomID).add(ws);

  const messages = loadMessages(roomID);
  ws.send(JSON.stringify({ type: "history", messages }));

  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      message = message.toString();
    }

    if (!username) {
      username = message; 
      const joinMessage = {
        sender: "",
        roomID,
        msg: `${username} has joined the chat`,
      };

      const messages = loadMessages(roomID);
      messages.push(joinMessage);
      saveMessages(roomID, messages);

      roomClients.get(roomID).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(joinMessage));
        }
      });
    } else {
      const userMessage = { sender: username, roomID, msg: message };

      const messages = loadMessages(roomID);
      messages.push(userMessage);
      saveMessages(roomID, messages);

      roomClients.get(roomID).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(userMessage));
        }
      });
    }
  });

  ws.on("close", () => {
    if (username) {
      const leaveMessage = {
        sender: "",
        roomID,
        msg: `${username} has left the chat`,
      };

      const messages = loadMessages(roomID);
      messages.push(leaveMessage);
      saveMessages(roomID, messages);
      roomClients.get(roomID).delete(ws);
      roomClients.get(roomID).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(leaveMessage));
        }
      });
    }
  });
});
