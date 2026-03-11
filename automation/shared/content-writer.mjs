import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function readJsonIfExists(fileUrl) {
  try {
    const contents = await readFile(fileUrl, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function writeJsonIfChanged(fileUrl, data) {
  const absolutePath = fileURLToPath(fileUrl);
  const directory = path.dirname(absolutePath);
  const nextContents = `${JSON.stringify(data, null, 2)}\n`;

  await mkdir(directory, { recursive: true });

  try {
    const currentContents = await readFile(fileUrl, "utf8");

    if (currentContents === nextContents) {
      return false;
    }
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(fileUrl, nextContents, "utf8");
  return true;
}
