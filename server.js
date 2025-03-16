const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Helper function to get the file path for each room
const getRoomFilePath = (roomID) =>
  path.join(__dirname, "data", `${roomID}.json`);

// Load existing messages for a room
const loadMessages = (roomID) => {
  const filePath = getRoomFilePath(roomID);
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error parsing JSON for room ${roomID}:`, error);
      return [];
    }
  }
  return [];
};

// Save messages to the JSON file for a room
const saveMessages = (roomID, messages) => {
  const filePath = getRoomFilePath(roomID);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2));
};

// Handle new WebSocket connections
wss.on("connection", (ws, req) => {
  const roomID = req.url.slice(1);
  let username = "";

  // Send previous messages to the user
  const messages = loadMessages(roomID);
  ws.send(JSON.stringify({ type: "history", messages }));

  ws.on("message", (message) => {
    if (Buffer.isBuffer(message)) {
      message = message.toString();
    }

    if (!username) {
      username = message; // First message is the username

      const joinMessage = {
        sender: "",
        roomID,
        msg: `${username} has joined the chat`,
      };

      // Append the join message
      const messages = loadMessages(roomID);
      messages.push(joinMessage);
      saveMessages(roomID, messages);

      // Broadcast the join message
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(joinMessage));
        }
      });
    } else {
      // **Fixing double-stringification issue**
      const userMessage = { sender: username, roomID, msg: message };

      // Save the message
      const messages = loadMessages(roomID);
      messages.push(userMessage);
      saveMessages(roomID, messages);

      // **Send only the raw message to all clients**
      wss.clients.forEach((client) => {
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

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(leaveMessage));
        }
      });
    }
  });
});
