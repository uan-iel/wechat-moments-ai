#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const dashboardServerPath = "/Users/m3max/VS-CODE-PROJECT/dev-dashboard/server.py";

const entry = `  {
    "id": "wechat-moments-ai",
    "name": "WeChat Moments AI",
    "desc": "朋友圈智能营销 AI Agent (port 3100)",
    "intro": (
      "Next.js 14 + Prisma + LangChain 的朋友圈智能营销助手。"
      "包含风格学习、内容工厂、多版本定稿、发布日历和模型设置。"
    ),
    "port": 3100,
    "group": "AI",
    "dir": str(HOME / "Selena's app/Wechat Moments AI"),
    "cmd": [
      "/usr/local/bin/npm",
      "run",
      "dev",
      "--",
      "-p",
      "3100",
      "-H",
      "127.0.0.1",
    ],
    "url_path": "/",
    "has_git": True,
    "update_cmd": ["git", "pull", "--ff-only"],
    "tags": ["朋友圈", "文案", "营销", "AI Agent"],
  },
`;

function main() {
  if (!fs.existsSync(dashboardServerPath)) {
    throw new Error(`Dev Dashboard server.py not found: ${dashboardServerPath}`);
  }

  const source = fs.readFileSync(dashboardServerPath, "utf8");
  if (source.includes('"id": "wechat-moments-ai"')) {
    console.log("WeChat Moments AI is already registered in Dev Dashboard.");
    return;
  }

  const marker = "PROJECTS = [\n";
  if (!source.includes(marker)) {
    throw new Error("Could not find PROJECTS list in Dev Dashboard server.py.");
  }

  const next = source.replace(marker, `${marker}${entry}`);
  const backupPath = path.join(
    path.dirname(dashboardServerPath),
    `server.py.backup-${new Date().toISOString().replace(/[:.]/g, "-")}`
  );

  fs.writeFileSync(backupPath, source);
  fs.writeFileSync(dashboardServerPath, next);
  console.log(`Registered WeChat Moments AI in Dev Dashboard.`);
  console.log(`Backup written to ${backupPath}`);
  console.log("Restart Dev Dashboard for the new service to appear.");
}

main();
