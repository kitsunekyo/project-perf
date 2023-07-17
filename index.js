import fs from "node:fs/promises";
import { spawn, spawnSync, exec, execSync } from "node:child_process";

const FILE_PATH = "src/app/App.tsx";

const BACKOFF_TIME_MS = 5000;

const SCRIPTS = [
  ["yarn", ["install"]],
  ["yarn", ["build"]],
  ["yarn", ["test", "run"]],
  ["yarn", ["lint"]],
  ["yarn", ["format"]],
  ["yarn", ["tsc", "--noEmit"]],
];

function getDuration(start, end) {
  return ((end - start) / 1000).toFixed(2);
}

function debounce(cb, wait = 5000) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => cb(args), wait);
  };
}

async function test_static() {
  return new Promise((resolve) => {
    for (const script of SCRIPTS) {
      const [command, args] = script;
      const start = performance.now();
      console.log(`${command} ${args.join(" ")}...`);
      spawnSync(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });
      console.log(`${getDuration(start, performance.now())}s`);
    }
    resolve();
  });
}

async function test_dev() {
  console.log("yarn dev...");
  const searchRegExp = new RegExp(/imports crawl ended/gi);
  const start = performance.now();
  const child = spawn("yarn", ["dev", "--debug"], {
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const handleMessage = debounce(() => {
    console.log(`${getDuration(start, performance.now() - BACKOFF_TIME_MS)}s`);
    child.stderr.removeListener("data", handleMessage);
    test_hotreload(child);
  });

  child.stderr.addListener("data", handleMessage);
}

async function test_hotreload(child) {
  console.log("hot-reload...");

  const handleMessage = debounce(() => {
    console.log(`${getDuration(start, performance.now() - BACKOFF_TIME_MS)}s`);
    const gitProcess = spawn("git", ["checkout", FILE_PATH], {
      shell: true,
    });
    gitProcess.on("close", () => {
      process.exit(0);
    });
  });
  child.stderr.addListener("data", handleMessage);
  const start = performance.now();
  const content = await fs.readFile(FILE_PATH, "utf-8");
  const updatedContent = content.replace("Sitelife", Math.random());
  fs.writeFile(FILE_PATH, updatedContent);
}

(async () => {
  await test_static();
  test_dev();
})();
