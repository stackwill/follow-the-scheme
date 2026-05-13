import { spawn } from "node:child_process";
import path from "node:path";

async function commandExists(command: string) {
  const child = spawn("sh", ["-c", `command -v ${command} >/dev/null 2>&1`], {
    stdio: "ignore",
  });

  return (
    (await new Promise<number>((resolve) => {
      child.once("error", () => resolve(1));
      child.once("exit", (code) => resolve(code ?? 1));
    })) === 0
  );
}

async function run(command: string, args: string[]) {
  const child = spawn(command, args, {
    stdio: "inherit",
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

const releaseTarball = process.argv[2] ?? process.env.DATA_RELEASE_TARBALL;

if (!releaseTarball) {
  throw new Error("Usage: bun run data:deploy <data/releases/<release>.tar.gz>");
}

const deployHost = process.env.DEPLOY_HOST ?? "176.20.179.79";
const deployUser = process.env.DEPLOY_USER ?? "will";
const deployPort = process.env.DEPLOY_PORT ?? "42143";
const appDir = process.env.APP_DIR ?? "/opt/follow-the-scheme";
const sshTarget = `${deployUser}@${deployHost}`;
const releaseFileName = path.basename(releaseTarball);
const releaseSha = `${releaseTarball}.sha256`;
const remoteIncomingDir = `${appDir}/incoming-data`;
const remoteTarball = `${remoteIncomingDir}/${releaseFileName}`;
const canUseRsync = await commandExists("rsync");

await run("ssh", ["-p", deployPort, sshTarget, `mkdir -p ${JSON.stringify(remoteIncomingDir)}`]);

if (canUseRsync) {
  await run("rsync", [
    "-avz",
    "--progress",
    "-e",
    `ssh -p ${deployPort}`,
    "scripts/activate-data-release.sh",
    `${sshTarget}:${appDir}/activate-data-release.sh`,
  ]);
  await run("rsync", [
    "-avz",
    "--progress",
    "-e",
    `ssh -p ${deployPort}`,
    releaseTarball,
    releaseSha,
    `${sshTarget}:${remoteIncomingDir}/`,
  ]);
} else {
  await run("scp", [
    "-P",
    deployPort,
    "scripts/activate-data-release.sh",
    `${sshTarget}:${appDir}/activate-data-release.sh`,
  ]);
  await run("scp", [
    "-P",
    deployPort,
    releaseTarball,
    releaseSha,
    `${sshTarget}:${remoteIncomingDir}/`,
  ]);
}

await run("ssh", [
  "-p",
  deployPort,
  sshTarget,
  `chmod +x ${JSON.stringify(`${appDir}/activate-data-release.sh`)} && APP_DIR=${JSON.stringify(appDir)} bash ${JSON.stringify(`${appDir}/activate-data-release.sh`)} ${JSON.stringify(remoteTarball)}`,
]);
