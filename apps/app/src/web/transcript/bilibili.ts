/* eslint-disable @typescript-eslint/naming-convention */
// import type { MsgCtrlLocal } from "@/lib/remote-player/interface";
// import type MxPlugin from "@/mx-main";
import { request, requestUrl } from "obsidian";
import { WebsiteTextTrack } from "@/info/track-info";
import { getUserAgent } from "@/lib/remote-player/ua";
import { getSession } from "@/lib/require";
import { useAppId } from "@/settings/context";
import type {
  TranscriptConfig,
  TranscriptLine,
  TranscriptResponse,
} from "./types";
import { BilibiliTranscriptError } from "./types";

export class BilibiliTranscript {
  public static async getTranscript(
    url: string,
    config?: TranscriptConfig,
  ): Promise<TranscriptResponse> {
    try {
      const { title, aid, cid } = await this.getVideoInfo(url);
      console.log(
        `🚀 DEBUG: Starting transcript fetch for ${title} (aid: ${aid}, cid: ${cid})`,
      );
      const found = await getSession(useAppId())?.cookies.get({
        url: "https://www.bilibili.com",
        name: "SESSDATA",
        domain: ".bilibili.com",
        httpOnly: true,
        secure: true,
      });
      console.log("found cookie:", found);
      if (!found || found?.length === 0)
        throw new BilibiliTranscriptError(
          "❌ failed to get subtitle of this video: cookies not found",
        );
      const cookies: string = found[0].value;
      // console.log(cookies);

      const subtitle_urls = await this.getBilibiliSubtitles(
        aid.toString(),
        cid.toString(),
        cookies,
      );
      if (typeof subtitle_urls !== "undefined") {
        for (const subtitle of subtitle_urls) {
          if (subtitle.lang != config?.lang) {
            continue;
          }
          return this.getOneSubtitle(title, subtitle);
        }
        throw new BilibiliTranscriptError(
          "❌ failed to get subtitle of this video: No matching language subtitle fonud.",
        );
      } else {
        throw new BilibiliTranscriptError(
          "❌ failed to get subtitle of this video: This video probably has no subtitle.",
        );
      }
    } catch (err: any) {
      throw new BilibiliTranscriptError(err);
    }
  }

  /**
   * 通过URL获取bvid号，并得到aid号、cid号
   * 具体三者区别联系：
   * 1. aid是AV号，B站针对视频的旧编号方法（只用数字0-9为编码）
   * 2. bvid是BV号，B站视频新的编号方法（存在大小写字母编码）
   * 3. cid是站内的唯一标识号码，用于真正确定当前视频（以及其他）。对于分P的视频bvid是同一个号，但不同P的cid却会有所不同
   *
   * @param videoUrl - B站视频URL
   * @returns 包含视频标题、bvid、aid和cid的对象
   * @throws 如果URL无效、无法提取ID或API请求失败
   */
  public static async getVideoInfo(videoUrl: string): Promise<{
    title: string;
    bvid: string;
    aid: number;
    cid: number;
  }> {
    // 解析URL并提取路径参数
    const parsedUrl = new URL(videoUrl);
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

    // 从URL中提取视频ID（支持BV号和AV号）
    let videoId = "";
    if (pathSegments.length > 1 && pathSegments[0] === "video") {
      videoId = pathSegments[1];
    } else {
      throw new Error("Invalid Bilibili video URL");
    }

    // 确定ID类型（BV或AV）
    const isBvid = videoId.startsWith("BV");
    const isAid = videoId.startsWith("av") && /^av\d+$/.test(videoId);

    if (!isBvid && !isAid) {
      throw new Error("URL does not contain valid BV or AV ID");
    }

    // 获取分P参数（默认第一P）
    const pParam = parsedUrl.searchParams.get("p");
    const page = pParam ? parseInt(pParam, 10) : 1;

    // 构建API请求URL
    const apiUrl = isBvid
      ? `https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`
      : `https://api.bilibili.com/x/web-interface/view?aid=${videoId.slice(2)}`;

    // 调用B站API获取视频信息
    const response = await requestUrl({ url: apiUrl });

    const apiData: any = await (response.json ?? JSON.parse(response.text));
    if (apiData.code !== 0) {
      throw new Error(`Bilibili API error: ${apiData.message}`);
    }

    const { title, bvid, aid, pages } = apiData.data;

    // 获取对应分P的CID
    const targetPage = pages.find((p: any) => p.page === page);
    if (!targetPage) {
      throw new Error(`Page ${page} not found in this video`);
    }

    return {
      title,
      bvid,
      aid,
      cid: targetPage.cid,
    };
  }
  static async getWbiKeys(cookies: string): Promise<[string, string]> {
    const url = "https://api.bilibili.com/x/web-interface/nav";
    const headers = {
      "User-Agent": getUserAgent(navigator.userAgent),
      Referer: "https://www.bilibili.com/",
      Cookie: `SESSDATA=${cookies}`,
    } satisfies HeadersInit;

    const response = await request({ url, headers });
    const json_content: any = JSON.parse(response);
    const wbi_img = json_content.data.wbi_img;

    // 解析 img_key 和 sub_key
    const img_key = wbi_img.img_url.split("/").slice(-1)[0].split(".")[0];
    const sub_key = wbi_img.sub_url.split("/").slice(-1)[0].split(".")[0];
    return [img_key, sub_key];
  }

  static getMixinKey(orig: string) {
    const MIXIN_KEY_ENC_TAB = [
      46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5,
      49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55,
      40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57,
      62, 11, 36, 20, 34, 44, 52,
    ];
    // 对 img_key 和 sub_key 进行字符顺序打乱编码
    return MIXIN_KEY_ENC_TAB.map((i) => orig[i])
      .join("")
      .slice(0, 32);
  }

  static encWbi(
    params: { aid: string; cid: string },
    img_key: string,
    sub_key: string,
  ) {
    // 创建副本避免修改原对象
    const signed_params = { ...params, w_rid: "", wts: "" };

    // 添加时间戳
    const wts = Math.floor(Date.now() / 1000);
    signed_params.wts = wts.toString();

    // 参数排序
    const sorted_params = Object.fromEntries(
      Object.entries(signed_params).sort(([a], [b]) => a.localeCompare(b)),
    ) as typeof signed_params;

    // 序列化参数
    const query_string = new URLSearchParams(sorted_params).toString();

    // 计算MD5
    const mixin_key = this.getMixinKey(img_key + sub_key);
    const MD5 = require("crypto-js/md5");
    const wbi_sign = MD5(query_string + mixin_key).toString();
    signed_params.w_rid = wbi_sign;
    return signed_params;
  }

  static async getBilibiliSubtitles(aid: string, cid: string, cookies: string) {
    // 1. 获取签名密钥
    const [img_key, sub_key] = await this.getWbiKeys(cookies).catch((e) => {
      console.log(`获取签名密钥失败：${e}`);
      return ["", ""];
    });

    if (img_key === "" || sub_key === "") {
      return;
    }

    // 2. 准备请求参数
    const params = { aid, cid };

    // 3. 计算签名
    const signed_params = this.encWbi({ ...params }, img_key, sub_key);

    // 4. 构建请求头
    const headers = {
      "User-Agent": getUserAgent(navigator.userAgent),
      Referer: `https://www.bilibili.com/video/av${aid}`,
      Origin: "https://www.bilibili.com",
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      DNT: "1",
      Connection: "keep-alive",
      Pragma: "no-cache",
      Cookie: `SESSDATA=${cookies}`,
      "Cache-Control": "no-cache",
    };

    // 5. 发送请求
    const api_url = `https://api.bilibili.com/x/player/wbi/v2?${new URLSearchParams(
      {
        ...signed_params,
        wts: String(signed_params.wts),
        aid: String(signed_params.aid),
        cid: String(signed_params.cid),
      },
    )}`;
    try {
      const response = await request({ url: api_url, headers });
      const res: any = JSON.parse(response);
      return res.data.subtitle.subtitles;
    } catch (e) {
      console.log(`获取字幕列表请求失败：${e}`);
      return undefined;
    }
  }

  static async getOneSubtitle(
    title: string,
    subtitle_info: any,
  ): Promise<TranscriptResponse> {
    const subtitle = await fetch("https:" + subtitle_info.subtitle_url);
    const raw_data: any = subtitle.json();
    return {
      title,
      lines: raw_data.body.map((elem: any) => {
        return {
          text: elem.content,
          duration: elem.to - elem.from,
          offset: elem.from,
        } satisfies TranscriptLine;
      }),
    } satisfies TranscriptResponse;
  }
}
