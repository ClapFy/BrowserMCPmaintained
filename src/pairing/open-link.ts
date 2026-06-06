import { spawn } from "node:child_process";

export async function openInstallLink(url: string): Promise<void> {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

  await new Promise<void>((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", shell: false })
        : spawn(command, [url], { stdio: "ignore" });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Failed to open install link (exit ${code ?? "unknown"})`));
    });
  });
}
