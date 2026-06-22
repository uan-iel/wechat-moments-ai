#!/usr/bin/env node

const { spawn } = require("node:child_process");
const http = require("node:http");

const app = {
  id: "wechat-moments-ai",
  name: "WeChat Moments AI",
  url: "http://localhost:3100",
  port: 3100,
  description: "朋友圈智能营销 AI Agent",
  routes: [
    { name: "首页", url: "http://localhost:3100" },
    { name: "内容工厂", url: "http://localhost:3100/content-factory" },
    { name: "文案任务", url: "http://localhost:3100/tasks" },
    { name: "发布日历", url: "http://localhost:3100/calendar" },
    { name: "模型设置", url: "http://localhost:3100/settings" }
  ]
};

const panelBaseUrl = "http://localhost:9999";

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = body ? JSON.stringify(body) : "";
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        },
        timeout: 2000
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseBody += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, body: responseBody });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("request timeout"));
    });
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "GET",
        timeout: 500
      },
      () => resolve(false)
    );
    req.on("error", () => resolve(true));
    req.on("timeout", () => {
      req.destroy();
      resolve(true);
    });
    req.end();
  });
}

async function registerWithPanel() {
  try {
    const result = await request("GET", `${panelBaseUrl}/api/projects`);
    if (result.status < 200 || result.status >= 300) {
      console.log(`Dev Dashboard /api/projects returned ${result.status}`);
      return false;
    }

    const projects = JSON.parse(result.body);
    const registered = Array.isArray(projects) && projects.some((project) => project.id === app.id);
    if (registered) {
      console.log("WeChat Moments AI is registered in Dev Dashboard.");
      return true;
    }
    console.log("WeChat Moments AI is not registered in Dev Dashboard yet.");
  } catch (error) {
    console.log(`Could not reach Dev Dashboard at ${panelBaseUrl}: ${error.message}`);
  }

  return false;
}

async function startFromPanel() {
  try {
    const result = await request("POST", `${panelBaseUrl}/api/projects/${app.id}/start`);
    if (result.status >= 200 && result.status < 300) {
      const body = JSON.parse(result.body || "{}");
      console.log(body.ok ? "Started from Dev Dashboard." : `Dev Dashboard start response: ${body.msg || result.body}`);
      return Boolean(body.ok);
    }
    console.log(`Dev Dashboard start endpoint returned ${result.status}`);
  } catch (error) {
    console.log(`Could not start from Dev Dashboard: ${error.message}`);
  }
  return false;
}

async function main() {
  const available = await isPortAvailable(app.port);
  if (!available) {
    console.error(`Port ${app.port} is already in use. Stop that process or change this script.`);
    process.exit(1);
  }

  const registered = await registerWithPanel();
  if (registered) {
    const started = await startFromPanel();
    if (started) {
      return;
    }
  }

  console.log(`Starting ${app.name} at ${app.url}`);
  const child = spawn("npm", ["run", "dev", "--", "-p", String(app.port), "-H", "127.0.0.1"], {
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
