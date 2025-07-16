const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const url = require('url');

const app = express();

app.use(cors());

// <-- FUNÇÃO DE AUTENTICAÇÃO -->
async function auth(request) {
  const parsedUrl = url.parse(request.url, true);
  const requestToken = parsedUrl.query.token;

  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:3000/token?token=${requestToken}`, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          const canConnect = parseInt(data, 10);
          resolve(canConnect === 1);
        });
      })
      .on('error', (err) => {
        console.error('Erro na requisição de autenticação:', err.message);
        reject(false);
      });
  });
}

//<-- WEBSOCKET SERVER -->
const wsServer = new WebSocket.Server({ noServer: true });
wsServer.on('connection', (socket, request) => {
  const parsedUrl = url.parse(request.url, true);
  socket.clientToken = parsedUrl.query.token || 'Desconhecido';

  socket.on('message', (message) => {
    const msg = message.toString();
    console.log(`SERVIDOR RECEBEU do cliente ${socket.clientToken}: ${msg}`);
    socket.send(`MENSAGEM: Você enviou "${msg}"`);
  });

  socket.on('close', () => {
    console.log(`CONEXÃO WEBSOCKET FECHADA para cliente: ${socket.clientToken}`);
  });

  socket.on('error', (error) => {
    console.error(`ERRO NO WEBSOCKET para cliente ${socket.clientToken}:`, error);
  });
});

setInterval(() => {
  wsServer.clients.forEach((client) => {
    client.send('BROADCAST');
  });
}, 4000);

// <-- SERVIDOR EXPRESS -->
const server = http.createServer(app);
server.on('upgrade', async (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  if (parsedUrl.pathname === '/') {
    let isAuthenticated = false;
    try {
      isAuthenticated = await auth(request);
    } catch (error) {
      isAuthenticated = false;
    }

    if (isAuthenticated) {
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request);
      });
    } else {
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nUnauthorized');
      socket.destroy();
    }
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nNot Found');
    socket.destroy();
  }
});

app.get('/token', (req, res) => {
  if (req.query.token === 'token') {
    res.send('1');
  } else {
    res.status(400).send('0');
  }
});

const PORT = 3000;
server.listen(PORT);

// <--CLIENTES DO WEBSOCKET-->
console.log('\n--- Tentando conectar clientes de teste (execute o servidor primeiro!) ---');
const client1 = new WebSocket('ws://localhost:3000?token=token');
client1.onopen = () => {
  console.log('CLIENTE 1: Conectado (autenticado)');
};
client1.onmessage = (event) => {
  console.log('CLIENTE 1 RECEBEU: ', event.data.toString());
};
client1.onclose = () => {
  console.log('CLIENTE 1: CONEXÃO FECHADA');
};
client1.onerror = (error) => {
  console.error('CLIENTE 1: ERRO:', error.message);
};

const client2 = new WebSocket('ws://localhost:3000?token=token');
client2.onopen = () => {
  console.log('CLIENTE 2: Conectado (NÃO DEVERIA ACONTECER COM TOKEN INCORRETO)');
};
client2.onmessage = (event) => {
  console.log('CLIENTE 2 RECEBEU: ', event.data.toString());
};
client2.onclose = () => {
  console.log('CLIENTE 2: CONEXÃO FECHADA');
};
client2.onerror = (error) => {
  console.error('CLIENTE 2: ERRO:', error.message);
};

const client3 = new WebSocket('ws://localhost:3000');
client3.onopen = () => {
  console.log('CLIENTE 3: Conectado (NÃO DEVERIA ACONTECER SEM TOKEN)');
};
client3.onmessage = (event) => {
  console.log('CLIENTE 3 RECEBEU: ', event.data.toString());
};
client3.onclose = () => {
  console.log('CLIENTE 3: CONEXÃO FECHADA');
};
client3.onerror = (error) => {
  console.error('CLIENTE 3: ERRO:', error.message);
};
