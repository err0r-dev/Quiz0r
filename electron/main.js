const { app, BrowserWindow, protocol } = require("electron");
const { fork } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_PORT = process.env.PORT || "3000";

let serverProcess;

// Prevent multiple instances
const instanceLock = app.requestSingleInstanceLock();
if (!instanceLock) {
  app.quit();
}

function waitForServer(url, attempts = 50, interval = 300) {
  return new Promise((resolve, reject) => {
    const checkServer = (remaining) => {
      const request = http
        .get(url, () => {
          resolve();
        })
        .on("error", () => {
          if (remaining <= 0) {
            reject(new Error("Server did not become ready in time"));
          } else {
            setTimeout(() => checkServer(remaining - 1), interval);
          }
        });

      request.setTimeout(interval, () => {
        request.destroy();
      });
    };

    checkServer(attempts);
  });
}

function startPackagedServer() {
  const resourcesPath = process.resourcesPath;
  const standaloneDir = path.join(
    resourcesPath,
    "next",
    "standalone",
  );
  const standaloneServer = path.join(standaloneDir, "server.js");

  if (fs.existsSync(standaloneServer)) {
    console.log("Starting Next.js server from:", standaloneServer);

    // Set up database in user data directory
    const userDataPath = app.getPath("userData");
    const dataDir = path.join(userDataPath, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "quiz.db");
    console.log("Database path:", dbPath);

    // Initialize database schema if it doesn't exist
    if (!fs.existsSync(dbPath)) {
      console.log("Initializing database schema...");
      const migrationPath = path.join(resourcesPath, "migrations", "init.sql");
      if (fs.existsSync(migrationPath)) {
        const Database = require("better-sqlite3");
        const db = new Database(dbPath);
        const sql = fs.readFileSync(migrationPath, "utf8");
        db.exec(sql);
        db.close();
        console.log("Database schema initialized");
      } else {
        console.warn("Migration file not found at:", migrationPath);
      }
    }

    serverProcess = fork(standaloneServer, [], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: DEFAULT_PORT,
        HOSTNAME: "localhost",
        DATABASE_URL: `file:${dbPath}`,
      },
      cwd: standaloneDir,
      stdio: ["inherit", "pipe", "pipe", "ipc"],
    });

    // Log server output for debugging
    serverProcess.stdout?.on("data", (data) => {
      console.log(`[Next.js Server] ${data}`);
    });
    
    serverProcess.stderr?.on("data", (data) => {
      console.error(`[Next.js Server Error] ${data}`);
    });

    serverProcess.on("exit", (code) => {
      if (code && code !== 0) {
        console.error(`Next.js server exited with code ${code}`);
      }
    });

    return { type: "server", url: `http://localhost:${DEFAULT_PORT}` };
  }

  console.error("Next.js standalone server not found at:", standaloneServer);
  return null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      devTools: true,
    }
  });

  // Open dev tools to see any errors (remove in production)
  if (process.env.ELECTRON_DEV_TOOLS) {
    win.webContents.openDevTools();
  }

  if (app.isPackaged) {
    const target = startPackagedServer();

    if (target?.type === "server") {
      try {
        console.log("Waiting for server at:", target.url);
        await waitForServer(target.url);
        console.log("Server ready, loading URL");
        await win.loadURL(target.url);
      } catch (error) {
        console.error("Failed to load server:", error);
        win.loadFile(path.join(__dirname, "error.html"));
      }
      return;
    }

    if (target?.type === "static") {
      await win.loadFile(target.file);
      return;
    }

    console.error("No valid target found for packaged app");
    win.loadFile(path.join(__dirname, "error.html"));
    return;
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  console.log("Development mode, loading:", appUrl);
  await win.loadURL(appUrl);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
