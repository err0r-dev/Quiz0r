const { app, BrowserWindow, protocol } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_PORT = process.env.PORT || "3000";

let serverProcess;

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
  const standaloneServer = path.join(
    resourcesPath,
    "next",
    "standalone",
    "server.js",
  );
  const staticOutput = path.join(resourcesPath, "out", "index.html");

  if (fs.existsSync(standaloneServer)) {
    serverProcess = spawn(process.execPath, [standaloneServer], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: DEFAULT_PORT,
        HOSTNAME: "localhost",
      },
      cwd: path.dirname(standaloneServer),
      stdio: "inherit",
    });

    serverProcess.on("exit", (code) => {
      if (code && code !== 0) {
        console.error(`Next.js server exited with code ${code}`);
      }
    });

    return { type: "server", url: `http://localhost:${DEFAULT_PORT}` };
  }

  if (fs.existsSync(staticOutput)) {
    protocol.registerFileProtocol("app", (request, callback) => {
      const url = request.url.replace("app://", "");
      const resolvedPath = path.normalize(path.join(resourcesPath, "out", url));
      callback({ path: resolvedPath });
    });

    return { type: "static", file: staticOutput };
  }

  return null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  if (app.isPackaged) {
    const target = startPackagedServer();

    if (target?.type === "server") {
      try {
        await waitForServer(target.url);
        await win.loadURL(target.url);
      } catch (error) {
        console.error("Failed to load server:", error);
      }
      return;
    }

    if (target?.type === "static") {
      await win.loadFile(target.file);
      return;
    }
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";
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
