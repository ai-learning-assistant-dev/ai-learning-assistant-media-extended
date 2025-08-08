import type { Menu, TFile } from "obsidian";
import streamSaver from "streamsaver";
// @ts-ignore
import type { DownloadVideoInputItem } from "@/web/bili-api/dash.ts";
// @ts-ignore
import { videoAudioDash, videoDashAvc } from "@/web/bili-api/dash.ts";
import type { PlayerContext } from ".";

export function downloadMenu(menu: Menu, ctx: PlayerContext) {
  menu.addItem((item) => {
    const submenu = item
      .setSection("view")
      .setTitle("Download audio")
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
}: PlayerContext): Promise<TFile | null> {
  console.log("soruce", source);
  console.log("player", player);
  console.log("plugin", plugin);
  const bvid =
    typeof source.id === "string" ? source.id.replace(/^1@/, "") : "";
  const { aid, cid } = window.player.getManifest();
  const inputItem: DownloadVideoInputItem = {
    // @ts-ignore
    aid: aid.toString(),
    // @ts-ignore
    cid: cid.toString(),
    title: bvid,
  };
  // @ts-ignore
  const videoInfos = await videoDashAvc.downloadVideoInfo(inputItem);
  console.log("videoInfos", videoInfos);
  const title = bvid;
  // @ts-ignore
  const url = videoInfos.iframe.url;
  const size: any = undefined;
  const fileStream = streamSaver.createWriteStream(title, { size });
  const response = await fetch(url);
  if (!response.body) throw new Error("Stream not supported");
  await response.body.pipeTo(fileStream);
  return null;
}

// async function saveAudio({
//   source,
//   plugin,
//   player,
// }: PlayerContext): Promise<TFile | null> {
//   const instance = player.provider;
//   if (
//     !(instance instanceof WebiviewMediaProvider) ||
//     !(source instanceof MediaURL)
//   ) {
//     new Notice("Cannot save transcript from this media");
//     return null;
//   }
//   // 构造 DownloadVideoInputItem
//   const inputItem = {
//     aid: source.aid || "",
//     cid: source.cid || "",
//     title: getFriendlyTitle(true),
//     quality: undefined as VideoQuality | undefined,
//     allowQualityDrop: true,
//   };
//   // 获取下载 API（假设 provider 有 downloadApi 属性）
//   const api = instance.downloadApi;
//   if (!api || typeof api.downloadVideoInfo !== "function") {
//     new Notice("No valid download API found");
//     return null;
//   }
//   // 获取下载信息
//   const videoInfo = await api.downloadVideoInfo(inputItem);
//   if (!videoInfo || !videoInfo.fragments || videoInfo.fragments.length === 0) {
//     new Notice("No downloadable audio found");
//     return null;
//   }
//   // 构造下载 action
//   const action = new DownloadVideoAction([videoInfo]);
//   // 调用输出方式保存
//   await streamSaverOutput.runAction(action);
//   // 返回 null（如需返回文件对象，可扩展）
//   return null;
// }
