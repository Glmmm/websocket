# Servidor Node.js com Express e WebSockets

Este projeto demonstra um servidor Node.js que combina **Express.js** para lidar com rotas HTTP regulares e **WebSockets** (usando a biblioteca `ws`) para comunicação bidirecional em tempo real. Ele também implementa um sistema de autenticação simples para as conexões WebSocket.

## 🚀 Como Funciona

Este código cria um servidor HTTP que também é capaz de "atualizar" conexões para o protocolo WebSocket. A parte mais interessante é o uso do evento `upgrade` do servidor HTTP para interceptar as requisições de conexão WebSocket e aplicar uma lógica de autenticação **antes** de permitir que a conexão WebSocket seja estabelecida. Isso garante que apenas clientes autorizados possam estabelecer comunicação em tempo real.

## 📦 Estrutura do Código

O código pode ser dividido nas seguintes partes principais:

### 1\. Configuração Inicial e Importações

Configura o ambiente Node.js, importando as bibliotecas necessárias e inicializando o Express.

```javascript
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const url = require('url');

const app = express(); // Inicializa o aplicativo Express
app.use(cors()); // Permite requisições de diferentes origens (CORS)
```

- **`express`**: Framework web para Node.js.
- **`ws`**: Biblioteca para WebSockets.
- **`cors`**: Middleware para habilitar Cross-Origin Resource Sharing (CORS).
- **`http`**: Módulo nativo para criar servidores HTTP.
- **`url`**: Módulo nativo para analisar URLs.
- **`app`**: Instância do aplicativo Express.

### 2\. Função de Autenticação (`auth`)

Função assíncrona responsável por verificar a autorização de um cliente WebSocket. Ela extrai um `token` da URL da requisição e faz uma chamada HTTP interna para validar este token.

```javascript
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
```

### 3\. Servidor WebSocket (`wsServer`)

Cria uma instância do servidor WebSocket. Este servidor lida com as conexões WebSocket estabelecidas, gerenciando mensagens, fechamentos e erros.

```javascript
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
```

### 4\. Servidor HTTP e Tratamento de Upgrade (`server`)

Cria o servidor HTTP principal que escuta tanto as requisições HTTP quanto o evento `upgrade` para conexões WebSocket. Ele é responsável por orquestrar o processo de autenticação e "upgrade".

```javascript
const server = http.createServer(app); // Cria um servidor HTTP usando o app Express
server.on('upgrade', async (request, socket, head) => {
  const parsedUrl = url.parse(request.url, true);
  if (parsedUrl.pathname === '/') {
    let isAuthenticated = false;
    try {
      isAuthenticated = await auth(request); // Tenta autenticar o cliente
    } catch (error) {
      isAuthenticated = false;
    }

    if (isAuthenticated) {
      // Se autenticado, lida com o upgrade para WebSocket
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        wsServer.emit('connection', ws, request); // Emite o evento 'connection' para o wsServer
      });
    } else {
      // Se não autenticado, retorna 401 Unauthorized e fecha o socket
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nUnauthorized');
      socket.destroy();
    }
  } else {
    // Se o pathname não for '/', retorna 404 Not Found
    socket.write('HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nNot Found');
    socket.destroy();
  }
});
```

### 5\. Rota de Autenticação HTTP (`/token`)

Uma rota Express simples que simula um serviço de autenticação. Em um cenário real, esta rota faria uma consulta a um banco de dados ou a um serviço de identidade.

```javascript
app.get('/token', (req, res) => {
  if (req.query.token === 'token') {
    // Verifica se o token na query é "token"
    res.send('1'); // Retorna 1 se for válido
  } else {
    res.status(400).send('0'); // Retorna 0 (com status 400 Bad Request) se for inválido
  }
});
```

### 6\. Inicialização do Servidor

Define a porta e inicia o servidor.

```javascript
const PORT = 3000;
server.listen(PORT);
```

### 7\. Clientes de Teste WebSocket

Exemplo de como diferentes clientes tentam se conectar, demonstrando os cenários de sucesso e falha de autenticação.

```javascript
// <--CLIENTES DO WEBSOCKET-->
console.log('\n--- Tentando conectar clientes de teste (execute o servidor primeiro!) ---');

// CLIENTE 1: Autenticado
const client1 = new WebSocket('ws://localhost:3000?token=token');
// ... lógica para client1 (conecta, envia mensagem, fecha) ...

// CLIENTE 2: Não Autenticado (token incorreto)
const client2 = new WebSocket('ws://localhost:3000?token=rogers');
// ... lógica para client2 (mostra que não deveria conectar) ...

// CLIENTE 3: Não Autenticado (sem token)
const client3 = new WebSocket('ws://localhost:3000');
// ... lógica para client3 (mostra que não deveria conectar) ...
```

## 📈 Melhorias e Boas Práticas (Para um Ambiente de Produção)

O código base é funcional, mas para um ambiente de produção ou para torná-lo mais robusto, as seguintes melhorias são essenciais:

### 1\. Segurança e Autenticação

- **Autenticação JWT (JSON Web Tokens):** Utilize JWTs para tokens de autenticação seguros, com tempo de vida limitado e informações do usuário.
- **Serviço de Autenticação Real:** Separe a lógica de autenticação em um serviço dedicado (e.g., microsserviço de identidade, OAuth/OpenID Connect).
- **Gerenciamento de Segredos:** Use variáveis de ambiente para armazenar segredos (e.g., `process.env.MY_SECRET_TOKEN`), nunca hardcode.
- **HTTPS para Autenticação:** A requisição HTTP para `/token` deve ser via HTTPS para prevenir interceptação.

### 2\. Tratamento de Erros e Robustez

- **Tratamento de Erros WebSocket:** Implemente tratamento de erros mais sofisticado para conexões WebSocket, incluindo tentativas de reconexão automática com backoff exponencial para clientes.
- **Validação de Entrada:** Valide o formato e o conteúdo de todos os dados recebidos.
- **Controle de Taxa (Rate Limiting):** Aplique controle de taxa para a rota `/token` e para as conexões WebSocket para prevenir abusos.

### 3\. Gerenciamento de Conexões e Escalabilidade

- **Broadcast de Mensagens:** Implemente um mecanismo para enviar mensagens para múltiplos clientes simultaneamente.
- **Persistência/Estado:** Use um banco de dados ou sistema de cache para persistir mensagens ou o estado do cliente.
- **Escalabilidade Horizontal:** Para múltiplos servidores, use um **backplane** (Redis Pub/Sub, Kafka) para coordenar a comunicação entre as instâncias do servidor WebSocket.
- **Heartbeats/Pings:** Envie pings regulares para detectar clientes desconectados "silenciosamente".

### 4\. Estrutura do Código e Manutenibilidade

- **Modularização:** Separe a lógica do Express, WebSocket e autenticação em arquivos distintos para melhor organização.
- **Configuração Centralizada:** Mova portas e outras configurações para um arquivo de configuração ou use bibliotecas como `dotenv`.
- **Logging Robusto:** Use bibliotecas de logging como `Winston` ou `Pino` para logs mais detalhados e flexíveis.

### 5\. Teste e Qualidade

- **Testes Unitários:** Teste componentes individuais, como a função `auth`.
- **Testes de Integração:** Teste o fluxo completo do sistema, da conexão à troca de mensagens.
- **Testes de Carga:** Avalie o desempenho do servidor sob alta demanda de clientes e mensagens.
