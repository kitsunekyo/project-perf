import fs from "node:fs/promises";
import { spawn, spawnSync, exec } from "node:child_process";

function getDuration(start, end) {
  return ((end - start) / 1000).toFixed(2);
}

const FILE_PATH = "src/app/App.tsx";

const YARN_SCRIPTS = [
  ["install"],
  ["build"],
  ["test", "run"],
  ["lint"],
  ["format"],
  ["tsc", "--noEmit"],
];

async function test_static() {
  return new Promise((resolve, reject) => {
    try {
      exec("rm -rf node_modules");
      for (const args of YARN_SCRIPTS) {
        const start = performance.now();
        console.log(`yarn ${args.join(" ")}...`);
        spawnSync("yarn", args, {
          stdio: ["ignore", "pipe", "pipe"],
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
  const searchRegExp = new RegExp(/imports crawl ended/);
  const process = spawn("yarn", ["dev", "--debug"]);
  const start = performance.now();
  console.log("yarn dev...");

  function handleMessage(data) {
    if (!data.toString().match(searchRegExp)) return;
    process.stderr.off("data", handleMessage);
    console.log(`${getDuration(start, performance.now())}s`);
    test_hotreload(process);
  }

  process.stderr.on("data", handleMessage);
}

async function test_hotreload(process) {
  const searchRegExp = new RegExp(/vite:time .* \/src\/app\/App.tsx/);
  process.stderr.on("data", (data) => {
    if (!data.toString().match(searchRegExp)) return;
    console.log(`${getDuration(start, performance.now())}s`);
    process.kill();
    exec(`git checkout ${FILE_PATH}`);
  });
  const content = await fs.readFile(FILE_PATH, "utf-8");
  const start = performance.now();
  console.log("hot-reload...");
  const updatedContent = content.replace("Sitelife", "TEST");
  fs.writeFile(FILE_PATH, updatedContent);
}

(async () => {
  await test_static();
  await test_dev();
})();
