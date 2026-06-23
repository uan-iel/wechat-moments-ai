#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = process.cwd();
const crawlerRoot = path.join(repoRoot, ".crawler");
const mediaCrawlerPath = path.join(crawlerRoot, "MediaCrawler");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      PATH: [
        `${process.env.HOME}/.local/bin`,
        "/opt/homebrew/bin",
        "/usr/local/bin",
        process.env.PATH || ""
      ].join(":")
    },
    stdio: "inherit",
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  console.log("准备安装小红书 crawler worker...");
  console.log("说明：MediaCrawler 采用非商业学习许可证，请在合规前提下使用。");

  ensureDir(crawlerRoot);

  if (!fs.existsSync(mediaCrawlerPath)) {
    run("git", ["clone", "--depth", "1", "https://github.com/NanmiCoder/MediaCrawler.git", mediaCrawlerPath], repoRoot);
  } else {
    console.log("已检测到本地 MediaCrawler 目录，跳过 clone。");
  }

  run("uv", ["sync"], mediaCrawlerPath);
  run("uv", ["run", "playwright", "install"], mediaCrawlerPath);

  console.log("");
  console.log("MediaCrawler 安装完成。");
  console.log(`默认目录：${mediaCrawlerPath}`);
  console.log("建议下一步：");
  console.log("1. 启动本项目");
  console.log("2. 打开 /research/xiaohongshu");
  console.log("3. 如有需要，点击“打开登录浏览器”并完成小红书登录");
  console.log("4. 再启动 worker 并发起抓取");
}

main();
