/**
 * Production server for Electron app
 * Combines Next.js standalone with Socket.io for real-time communication
 */
import { createServer, IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { readFileSync } from "fs";
import { join } from "path";
import { Server } from "socket.io";
import { GameManager } from "../../src/server/game-manager";

// Import Next.js server for standalone mode
const NextServer = require("next/dist/server/next-server").default;

const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const dir = process.cwd();

// Load the Next.js config from standalone build (at runtime, not bundle time)
const configPath = join(dir, ".next", "required-server-files.json");
const nextConfig = JSON.parse(readFileSync(configPath, "utf8"))?.config || {};

async function startServer() {
  // Create Next.js server instance for standalone mode
  const nextServer = new NextServer({
    hostname,
    port,
    dir,
    dev: false,
    customServer: true,
    conf: nextConfig,
  });

  const requestHandler = nextServer.getRequestHandler();

  // Create HTTP server
  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url || "", true);
    requestHandler(req, res, parsedUrl);
  });

  // Attach Socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Initialize game manager for real-time quiz functionality
  const gameManager = new GameManager(io);

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    gameManager.handleConnection(socket);
  });

  // Prepare Next.js and start listening
  await nextServer.prepare();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
