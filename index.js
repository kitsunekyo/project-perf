import fs from "node:fs/promises";
import { spawn, spawnSync, exec, execSync } from "node:child_process";

function getDuration(start, end) {
  return ((end - start) / 1000).toFixed(2);
}

const FILE_PATH = "src/app/App.tsx";

const BACKOFF_TIME_MS = 5000;

const YARN_SCRIPTS = [
  ["install"],
  // ["build"],
  // ["test", "run"],
  // ["lint"],
  // ["format"],
  // ["tsc", "--noEmit"],
];

async function test_static() {
  return new Promise((resolve, reject) => {
    try {
      // disabled for now, as this breaks the hot-reload test
      // const s = performance.now();
      // console.log("clearing node_modules...");
      // execSync("rm -rf node_modules");
      // console.log(`${getDuration(s, performance.now())}s`);

      for (const args of YARN_SCRIPTS) {
        const start = performance.now();
        console.log(`yarn ${args.join(" ")}...`);
        spawnSync("yarn", args, {
          stdio: ["ignore", "pipe", "pipe"],
          shell: true,
        });
        console.log(`${getDuration(start, performance.now())}s`);
      }
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

async function test_dev() {
  console.log("yarn dev...");
  const searchRegExp = new RegExp(/imports crawl ended/gi);
  const controller = new AbortController();
  const child = spawn("yarn", ["dev", "--debug"], {
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
    signal: controller.signal,
  });
  if (!child) {
    throw new Error("Failed to spawn yarn dev process");
  }
  const start = performance.now();

  let timeout;

  function handleMessage(data) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log("didnt receive input for 5s assuming dev server is ready");
      child.stderr.removeListener("data", handleMessage);
      console.log(
        `${getDuration(start, performance.now() - BACKOFF_TIME_MS)}s`
      );
      test_hotreload(child, controller);
    }, BACKOFF_TIME_MS);
  }

  child.stderr.addListener("data", handleMessage);
}

async function test_hotreload(childProcess, controller) {
  console.log("hot-reload...");

  let timeout;
  function handleMessage(data) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log(
        `${getDuration(start, performance.now() - BACKOFF_TIME_MS)}s`
      );
      exec(`git checkout ${FILE_PATH}`);
      process.exit(0);
    }, BACKOFF_TIME_MS);
  }
  childProcess.stderr.addListener("data", handleMessage);
  const start = performance.now();
  const content = await fs.readFile(FILE_PATH, "utf-8");
  const updatedContent = content.replace("Sitelife", Math.random());
  fs.writeFile(FILE_PATH, updatedContent);
}

function backoff(cb, timeout = BACKOFF_TIME_MS) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(cb, timeout);
  };
}

(async () => {
  await test_static();
  test_dev();
})();
