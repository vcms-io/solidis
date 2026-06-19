'use client';

import { ArrowRight, CheckCircle, Clock, MessageCircle } from 'lucide-react';
import Link from 'next/link';

import { CodeBlock } from '@/components/code-block';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n-context';

export default function ChatAppTutorial() {
  const { t } = useI18n();

  return (
    <div className="content-container pt-20 sm:pt-24 pb-10 sm:pb-16">
      <div className="mb-8">
        <Link
          href="/tutorials"
          className="text-amber-500 hover:underline text-sm mb-4 inline-block"
        >
          {t('tutorialChat.backToTutorials')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
          <Badge className="bg-red-500/10 text-red-500">
            {t('tutorialChat.level')}
          </Badge>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{t('tutorialChat.duration')}</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
          {t('tutorialChat.title')}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t('tutorialChat.description')}
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('tutorialChat.whatYoullBuild')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialChat.build1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialChat.build2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialChat.build3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{t('tutorialChat.build4')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              1
            </div>
            {t('tutorialChat.chatManager')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { SolidisFeaturedClient } from '@vcms-io/solidis/featured';

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export class ChatManager {
  private publisher: SolidisFeaturedClient;
  private subscriber: SolidisFeaturedClient;
  private messageHandlers: Map<string, (message: Message) => void>;

  constructor(options: { host?: string; port?: number } = {}) {
    // Separate clients for pub and sub
    this.publisher = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });

    this.subscriber = new SolidisFeaturedClient({
      host: options.host || '127.0.0.1',
      port: options.port || 6379,
    });

    this.messageHandlers = new Map();
  }

  async connect(): Promise<void> {
    await this.publisher.connect();
    await this.subscriber.connect();

    // Set up message handler
    this.subscriber.on('message', (channel, message) => {
      const roomId = channel.replace('chat:', '');
      const data = JSON.parse(message.toString()) as Message;

      const handler = this.messageHandlers.get(roomId);
      if (handler) {
        handler(data);
      }
    });
  }

  /**
   * Join a chat room
   */
  async joinRoom(
    roomId: string,
    onMessage: (message: Message) => void
  ): Promise<void> {
    const channel = \`chat:\${roomId}\`;
    this.messageHandlers.set(roomId, onMessage);
    await this.subscriber.subscribe(channel);
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId: string): Promise<void> {
    const channel = \`chat:\${roomId}\`;
    this.messageHandlers.delete(roomId);
    await this.subscriber.unsubscribe(channel);
  }

  /**
   * Send a message to a room
   */
  async sendMessage(message: Message): Promise<void> {
    const channel = \`chat:\${message.roomId}\`;

    // Publish to channel
    await this.publisher.publish(channel, JSON.stringify(message));

    // Store in message history
    await this.storeMessage(message);
  }

  /**
   * Store message in history
   */
  private async storeMessage(message: Message): Promise<void> {
    const key = \`chat:history:\${message.roomId}\`;

    // Store as sorted set with timestamp as score
    await this.publisher.zadd(
      key,
      message.timestamp,
      JSON.stringify(message)
    );

    // Keep only last 100 messages (use raw command for ZREMRANGEBYRANK)
    await this.publisher.send([['ZREMRANGEBYRANK', key, '0', '-101']]);

    // Set expiry (e.g., 7 days)
    await this.publisher.expire(key, 7 * 24 * 3600);
  }

  /**
   * Get message history
   */
  async getHistory(
    roomId: string,
    limit: number = 50
  ): Promise<Message[]> {
    const key = \`chat:history:\${roomId}\`;

    // Get last N messages
    const messages = await this.publisher.zrange(key, \`\${-limit}\`, '-1');

    return (messages as string[]).map((msg) => JSON.parse(msg) as Message);
  }

  /**
   * Get active users in a room
   */
  async getActiveUsers(roomId: string): Promise<string[]> {
    const key = \`chat:users:\${roomId}\`;
    return await this.publisher.smembers(key);
  }

  /**
   * Mark user as active in room
   */
  async markUserActive(roomId: string, userId: string): Promise<void> {
    const key = \`chat:users:\${roomId}\`;
    await this.publisher.sadd(key, userId);
    await this.publisher.expire(key, 300); // 5 minutes
  }

  /**
   * Remove user from room
   */
  async removeUser(roomId: string, userId: string): Promise<void> {
    const key = \`chat:users:\${roomId}\`;
    await this.publisher.srem(key, userId);
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              2
            </div>
            {t('tutorialChat.wsServer')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { WebSocketServer, WebSocket } from 'ws';
import { ChatManager, Message } from './chat-manager';
import { v4 as uuidv4 } from 'uuid';

interface ClientData {
  userId: string;
  username: string;
  roomId: string | null;
}

export class ChatServer {
  private wss: WebSocketServer;
  private chat: ChatManager;
  private clients: Map<WebSocket, ClientData>;

  constructor(port: number, chat: ChatManager) {
    this.wss = new WebSocketServer({ port });
    this.chat = chat;
    this.clients = new Map();

    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      // Initialize client data
      this.clients.set(ws, {
        userId: uuidv4(),
        username: 'Anonymous',
        roomId: null,
      });

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('Error handling message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', async () => {
        const client = this.clients.get(ws);
        if (client?.roomId) {
          await this.chat.leaveRoom(client.roomId);
          await this.chat.removeUser(client.roomId, client.userId);
        }
        this.clients.delete(ws);
        console.log('Client disconnected');
      });
    });
  }

  private async handleMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'join':
        await this.handleJoin(ws, client, message.roomId, message.username);
        break;

      case 'leave':
        await this.handleLeave(ws, client);
        break;

      case 'message':
        await this.handleChatMessage(ws, client, message.content);
        break;

      case 'history':
        await this.handleHistory(ws, client);
        break;

      default:
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async handleJoin(
    ws: WebSocket,
    client: ClientData,
    roomId: string,
    username: string
  ) {
    // Leave current room if any
    if (client.roomId) {
      await this.chat.leaveRoom(client.roomId);
    }

    // Update client data
    client.roomId = roomId;
    client.username = username || 'Anonymous';

    // Join new room
    await this.chat.joinRoom(roomId, (message) => {
      this.sendToClient(ws, {
        type: 'message',
        data: message,
      });
    });

    // Mark user as active
    await this.chat.markUserActive(roomId, client.userId);

    // Send join confirmation
    this.sendToClient(ws, {
      type: 'joined',
      roomId,
      userId: client.userId,
    });

    // Send message history
    const history = await this.chat.getHistory(roomId);
    this.sendToClient(ws, {
      type: 'history',
      messages: history,
    });
  }

  private async handleLeave(ws: WebSocket, client: ClientData) {
    if (client.roomId) {
      await this.chat.leaveRoom(client.roomId);
      await this.chat.removeUser(client.roomId, client.userId);
      client.roomId = null;

      this.sendToClient(ws, { type: 'left' });
    }
  }

  private async handleChatMessage(
    ws: WebSocket,
    client: ClientData,
    content: string
  ) {
    if (!client.roomId) {
      this.sendError(ws, 'Not in a room');
      return;
    }

    const message: Message = {
      id: uuidv4(),
      roomId: client.roomId,
      userId: client.userId,
      username: client.username,
      content,
      timestamp: Date.now(),
    };

    await this.chat.sendMessage(message);
  }

  private async handleHistory(ws: WebSocket, client: ClientData) {
    if (!client.roomId) {
      this.sendError(ws, 'Not in a room');
      return;
    }

    const history = await this.chat.getHistory(client.roomId);
    this.sendToClient(ws, {
      type: 'history',
      messages: history,
    });
  }

  private sendToClient(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private sendError(ws: WebSocket, message: string) {
    this.sendToClient(ws, {
      type: 'error',
      message,
    });
  }
}`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-semibold">
              3
            </div>
            {t('tutorialChat.startServer')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`import { ChatManager } from './chat-manager';
import { ChatServer } from './chat-server';

async function start() {
  const chat = new ChatManager({
    host: '127.0.0.1',
    port: 6379,
  });

  await chat.connect();
  console.log('Connected to Redis');

  const server = new ChatServer(8080, chat);
  console.log('WebSocket server running on ws://localhost:8080');
}

start().catch(console.error);`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-amber-500" />
            {t('tutorialChat.clientExample')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg text-sm overflow-x-auto">
            <CodeBlock
              code={`// Simple WebSocket client example
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Join a room
  ws.send(JSON.stringify({
    type: 'join',
    roomId: 'general',
    username: 'John Doe',
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'joined':
      console.log('Joined room:', data.roomId);
      break;

    case 'message':
      console.log(\`\${data.data.username}: \${data.data.content}\`);
      break;

    case 'history':
      console.log('Message history:', data.messages);
      break;
  }
};

// Send a message
function sendMessage(content) {
  ws.send(JSON.stringify({
    type: 'message',
    content,
  }));
}

sendMessage('Hello, everyone!');`}
              language="typescript"
              showLineNumbers={true}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-amber-500" />
            {t('tutorialChat.nextSteps')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/tutorials/job-queue"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialChat.nextJobQueue')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialChat.nextJobQueueDesc')}
              </p>
            </Link>
            <Link
              href="/tutorials/session-store"
              className="card-base card-interactive p-4 block"
            >
              <h3 className="font-semibold mb-2">
                {t('tutorialChat.nextSession')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('tutorialChat.nextSessionDesc')}
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
