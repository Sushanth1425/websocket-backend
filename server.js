const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  let username = ''; // Store the username of the user

  // Listen for the first message to get the username
  ws.on('message', (message) => {
    // The first message should be the username
    if (!username) {
      username = message;

      // Notify all other clients that the new user has joined
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(`${username} has joined the chat`);
        }
      });
    } else {
      // Broadcast the chat message to all other clients
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message); // Send regular chat message
        }
      });
    }
  });

  // Handle user disconnecting
  ws.on('close', () => {
    if (username) {
      // Notify all other clients that the user has left
      wss.clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(`${username} has left the chat`);
        }
      });
    }
  });
});

//console.log('WebSocket server is running on ws://localhost:8080');
