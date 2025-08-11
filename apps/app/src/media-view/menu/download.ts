import https from "https";
import type { Menu } from "obsidian";
import { normalizePath, TFile, Notice } from "obsidian";
import { getSaveFolder } from "@/lib/folder";
import type { PlayerContext } from ".";

export function downloadMenu(menu: Menu, ctx: PlayerContext) {
  menu.addItem((item) => {
    if (
      ctx.videoInfo &&
      ctx.videoInfo.fragments &&
      ctx.videoInfo.fragments.length !== 0
    ) {
      const submenu = item
        .setSection("view")
        .setTitle("Download video")
        .setIcon("download")
        .setSubmenu();
      submenu.addItem((item) =>
        item.setTitle("下载视频").onClick(async () => {
          const file = await downloadVideo(ctx);
          if (file) {
            await ctx.plugin.app.workspace.openLinkText(file.path, "", "split");
          }
        }),
      );
    } else {
      item
        .setSection("view")
        .setTitle("Download video (need login)")
        .setIcon("download")
        .setDisabled(true);
    }
  });
}

// 注册 Service Worker（只需在项目启动时做一次）
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
}
// @ts-ignore
async function downloadVideo({
  source,
  plugin,
  player,
  videoInfo,
}: PlayerContext): Promise<TFile | null> {
  const note = await plugin.mediaNote.getNote(source, player);
  const folder = await getSaveFolder(
    plugin.settings.getState().subtitleFolderPath,
    { plugin, sourcePath: note.path },
  );
  // @ts-ignore
  const fragments = videoInfo.fragments;
  for (const fragment of fragments) {
    const url = fragment.url;
    // @ts-ignore
    const title = videoInfo.input.title + fragment.extension;
    const filepath = normalizePath(`${folder.path}/${title}`);
    try {
      // 从 URL 下载成 Uint8Array
      const uint8Array = await downloadAsUint8Array(url, {
        Referer: "https://www.bilibili.com/", // 改成你的 Referer
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      });
      // const fileStream = streamSaver.createWriteStream(title, { size });
      // const response = await fetch(url);
      // if (!response.body) throw new Error("Stream not supported");
      // // await response.body.pipeTo(fileStream);
      // const uint8Array = new Uint8Array(await response.arrayBuffer());
      const existingFile = plugin.app.vault.getAbstractFileByPath(filepath);

      if (existingFile instanceof TFile) {
        await plugin.app.vault.modifyBinary(existingFile, uint8Array);
        new Notice("媒体已下载完成,存储在: " + filepath);
      } else {
        await plugin.app.vault.createBinary(filepath, uint8Array);
        new Notice("媒体已下载完成,存储在: " + filepath);
      }
    } catch (err) {
      console.error("下载失败:", err);
      new Notice("下载失败: " + title);
    }
  }
  return null;
}

/**
 * 用 Node.js https 下载资源并返回 Uint8Array
 *
 * 这里不能直接用fetch，因为headers会被Obsidian自带的覆盖掉
 */
function downloadAsUint8Array(
  url: string,
  headers: Record<string, string>,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          res.resume(); // 清空数据避免内存泄漏
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      })
      .on("error", reject);
  });
}
