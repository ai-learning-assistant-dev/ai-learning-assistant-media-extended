/* eslint-disable no-var */
// hugely inspired by https://greasyfork.org/zh-CN/scripts/4870-maximize-video

declare global {
  var ytInitialPlayerResponse: any;
}

const css = `
body:not(.mx-player-ready) #movie_player, 
ytd-watch-flexy[theater] #movie_player {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  min-width: 0 !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  z-index: 2147483647 !important; /* Ensure it's on top of other elements */
  background-color: #000 !important;
  transform: none !important;
}
.mx-parent {
  overflow: visible !important;
  z-index: auto !important;
  transform: none !important;
  -webkit-transform-style: flat !important;
  transition: none !important;
  contain: none !important;
}
.mx-absolute {
  position: absolute !important;
}
html, body {
  overflow: hidden !important;
  zoom: 100% !important;
}
.mx-parent video {
  object-fit: contain !important;
}
ytd-app .html5-endscreen {
  opacity: 0 !important;
}
body:not(.mx-show-controls) ytd-app .ytp-chrome-bottom {
  opacity: 0 !important;
}
`.trim();

/**
 * @see https://github.com/iamfugui/YouTubeADB/tree/b0bdfa35878d01dd0be6696f1a027e2fe8aa2492
 */
const hideAD = `
/* 首页顶部横幅广告 */
#masthead-ad, 
/* 首页视频排版广告 */
ytd-rich-item-renderer.style-scope.ytd-rich-grid-row #content:has(.ytd-display-ad-renderer), 
/* 播放器底部广告 */
.video-ads.ytp-ad-module, 
/* 播放页会员促销广告 */
tp-yt-paper-dialog:has(yt-mealbar-promo-renderer), 
/* 播放页右上方推荐广告 */
ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"], 
/* 播放页评论区右侧推广广告 */
#related #player-ads, 
/* 播放页评论区右侧视频排版广告 */
#related ytd-ad-slot-renderer, 
/* 搜索页广告 */
ytd-ad-slot-renderer, 
/* 播放页会员推荐广告 */
yt-mealbar-promo-renderer, 
/* M播放页第三方推荐广 */
ad-slot-renderer, 
/* M可跳过的视频广告链接 */
ytm-companion-ad-renderer {
  opacity: 0 !important;
}
`.trim();

/* eslint-disable @typescript-eslint/naming-convention */
import { requireMx } from "./_require";
import type { WebsiteTextTrack } from "@/info/track-info";
import type { VTTContent, VTTCueWithId } from "@/transcript/handle/type";
import { YoutubeTranscriptError } from "../transcript/types";

const { waitForSelector, MediaPlugin } = requireMx();

export default class YouTubePlugin extends MediaPlugin {
  async findMedia(): Promise<HTMLMediaElement> {
    const media = await waitForSelector<HTMLMediaElement>(
      "ytd-app #movie_player video",
    );
    this.app = media.closest<HTMLElement>("ytd-app")!;
    this.moviePlayer = media.closest<HTMLElement>("#movie_player")!;
    if (!this.app || !this.moviePlayer) {
      throw new Error("Failed to find media");
    }
    this.watchIfDetached();
    return media;
  }

  captionInfo = new Map<string, { url: string; languageCode: string }>();

  getTracks(): WebsiteTextTrack[] {
    const tracks =
      window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    if (!Array.isArray(tracks)) return [];

    return tracks.map((t, i) => {
      const track = t as {
        baseUrl: string;
        isTranslatable?: boolean;
        languageCode?: string;
        name?: { simpleText?: string };
        trackName?: string;
        vssId?: string;
      };
      const id = track.vssId || `tract${i}`;
      this.captionInfo.set(id, {
        url: track.baseUrl,
        languageCode: track.languageCode ?? "en",
      });
      return {
        wid: id,
        kind: "subtitles",
        language: track.languageCode,
        label: track.name?.simpleText || track.trackName,
      };
    });
  }

  async getTrack(id: string): Promise<VTTContent | null> {
    const src = this.captionInfo.get(id);
    if (!src) return null;
    const videoData = this.getTranscript(document.documentElement.outerHTML, {
      lang: src.languageCode,
      country: navigator.language.split("-")[1],
    });
    const metadata: Record<string, string> = {
      Kind: "subtitles",
      ID: id,
    };

    for (let i = 0; i < videoData.transcriptRequests.length; i++) {
      const transcriptRequest = videoData.transcriptRequests[i];

      // Extract and show params info
      let paramsInfo = "UNKNOWN";
      let paramsSource = "UNKNOWN";
      try {
        const requestBodyObj: any = JSON.parse(transcriptRequest.body);
        const currentParams = requestBodyObj.params;
        if (i === 0 && videoData.title) {
          // First attempt - check if this might be page params
          paramsSource =
            currentParams && currentParams.length > 50 ? "PAGE" : "GENERATED";
        } else {
          paramsSource = "GENERATED";
        }
        paramsInfo = `${currentParams.substring(0, 30)}... (${
          currentParams.length
        } chars)`;
      } catch (parseError) {
        paramsInfo = "PARSE_ERROR";
      }
      try {
        console.log(
          `🎯 Attempt ${i + 1}/${
            videoData.transcriptRequests.length
          }: Trying ${paramsSource} params: ${paramsInfo}`,
        );

        console.log("transcriptRequest.url =", transcriptRequest.url);
        console.log("transcriptRequest.headers =", transcriptRequest.headers);
        console.log("transcriptRequest.body =", transcriptRequest.body);
        const response = await fetch(transcriptRequest.url, {
          method: "POST",
          headers: transcriptRequest.headers,
          body: transcriptRequest.body,
        });

        const cues = parseTranscript(await response.text());
        // If we got valid transcript lines, return success
        if (cues && cues.length > 0) {
          console.log(
            `✅ SUCCESS on attempt ${i + 1}: Found ${
              cues.length
            } transcript lines using ${paramsSource} params!`,
          );
          const vtt: VTTContent = {
            cues,
            metadata,
          };
          return vtt;
        } else {
          console.log(
            `❌ Attempt ${
              i + 1
            } failed: No transcript lines returned (empty response)`,
          );
        }
      } catch (requestError: any) {
        console.log(`❌ Attempt ${i + 1} failed: ${requestError.message}`);
        // Continue to next attempt unless this was the last one
        if (i === videoData.transcriptRequests.length - 1) {
          throw requestError;
        }
      }
    }
    return null;
  }

  getTranscript(
    body: string,
    config: { lang: string; country: string },
  ): {
    title: string;
    transcriptRequests: Array<{
      url: string;
      headers: Record<string, string>;
      body: string;
    }>;
  } {
    // const parsedBody = parse(htmlContent);

    // Extract title
    const titleMatch = body.match(YOUTUBE_TITLE_REGEX);
    let title = "";
    if (titleMatch) title = titleMatch[1];

    const videoIdMatch = body.match(YOUTUBE_VIDEOID_REGEX);
    let videoId = "";
    if (videoIdMatch) videoId = videoIdMatch[1].split("?v=")[1];

    // Extract visitorData from the page
    const visitorData = extractVisitorData(body);

    // Try to extract params from the page first
    const pageParams = extractParamsFromPage();

    // Generate all possible parameter combinations
    const generatedParams = generateAlternativeTranscriptParams(
      videoId,
      config?.lang || "en",
    );

    // Compare page params with generated ones
    if (pageParams) {
      let foundMatch = false;
      generatedParams.forEach((generatedParam) => {
        if (generatedParam === pageParams) {
          foundMatch = true;
        }
      });
    }

    // If we found params on the page, try those first, then fall back to generated ones
    const allParams = pageParams
      ? [pageParams, ...generatedParams]
      : generatedParams;

    const transcriptRequests = allParams.map((params) => {
      const requestBody = {
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20250701.01.00",
            hl: config?.lang || "en",
            gl: config?.country || "EN",
            userAgent:
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15,gzip(gfe)",
            platform: "DESKTOP",
            clientFormFactor: "UNKNOWN_FORM_FACTOR",
            visitorData: visitorData,
            deviceMake: "Apple",
            deviceModel: "",
            osName: "Macintosh",
            osVersion: "10_15_7",
            browserName: "Safari",
            browserVersion: "18.5",
            acceptHeader:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            userInterfaceTheme: "USER_INTERFACE_THEME_LIGHT",
            timeZone: "Europe/Warsaw",
            utcOffsetMinutes: 120,
            screenWidthPoints: 2520,
            screenHeightPoints: 847,
            screenPixelDensity: 2,
            screenDensityFloat: 2,
            mainAppWebInfo: {
              graftUrl: `https://www.youtube.com/watch?v=${videoId}`,
              webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
              isWebNativeShareAvailable: true,
            },
          },
          user: {
            lockedSafetyMode: false,
          },
          request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
          },
          clickTracking: {
            clickTrackingParams: "CBUQ040EGAgiEwi43tyvspyOAxUxa3oFHaiXLzM=",
          },
          adSignalsInfo: {
            params: [
              { key: "dt", value: Date.now().toString() },
              { key: "flash", value: "0" },
              { key: "frm", value: "0" },
              { key: "u_tz", value: "120" },
              { key: "u_his", value: "2" },
              { key: "u_h", value: "847" },
              { key: "u_w", value: "2520" },
              { key: "u_ah", value: "847" },
              { key: "u_aw", value: "2520" },
              { key: "u_cd", value: "24" },
              { key: "bc", value: "31" },
              { key: "bih", value: "847" },
              { key: "biw", value: "2504" },
              {
                key: "brdim",
                value: "0,0,0,0,2520,0,2520,847,2520,847",
              },
              { key: "vis", value: "1" },
              { key: "wgl", value: "true" },
              { key: "ca_type", value: "image" },
            ],
          },
        },
        externalVideoId: videoId,
        params: params,
      };

      return {
        url: "https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Youtube-Client-Name": "1",
          "X-Youtube-Client-Version": "2.20250701.01.00",
          "X-Goog-EOM-Visitor-Id":
            visitorData ||
            "Cgs5LXVQa0I1YnhHOCjZ7ZDDBjInCgJQTBIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAS",
          "X-Youtube-Bootstrap-Logged-In": "false",
          "X-Origin": "https://www.youtube.com",
          Origin: "https://www.youtube.com",
          Referer: `https://www.youtube.com/watch?v=${videoId}`,
        },
        body: JSON.stringify(requestBody),
      };
    });

    return {
      title,
      transcriptRequests,
    };
  }
  watchIfDetached() {
    const container = this.moviePlayer;
    const observer = new MutationObserver(async () => {
      if (this.media.isConnected) return;
      console.log("Re-attaching media");
      const lastest = await this.findMedia();
      if (!lastest) return;
      console.log("found media");
      this.rehookMediaEl(lastest);
      console.log("media hooked");
    });
    observer.observe(container, { childList: true, subtree: true });
    this.register(() => observer.disconnect());
  }

  getStyle() {
    return css + "\n" + hideAD;
  }
  async onload(): Promise<void> {
    await super.onload();
    const tracks = this.getTracks();
    if (tracks.length > 0) this.controller.send("mx-text-tracks", { tracks });
    this.disableAutoPlay();
    waitForSelector("ytd-consent-bump-v2-lightbox", this.app).then(() => {
      this.controller.send("mx-open-browser", {
        message:
          "Seems like YouTube is showing a consent popup that block playback. To continue playback, you should handle it in dedicated login browser. ",
        url: "https://youtube.com",
      });
    });
  }

  app!: HTMLElement;
  moviePlayer!: HTMLElement;

  async disableAutoPlay() {
    console.log("Disabling autoplay...");
    const autoPlayButtonSelector =
      'button.ytp-button[data-tooltip-target-id="ytp-autonav-toggle-button"]';
    const autoPlayButton = await waitForSelector<HTMLButtonElement>(
      autoPlayButtonSelector,
      this.app,
    );

    if (!autoPlayButton) {
      throw new Error("Autoplay button not found");
    }

    const label = autoPlayButton.querySelector(".ytp-autonav-toggle-button");
    if (!label) {
      throw new Error("Autoplay button label not found");
    }

    const isAutoPlayEnabled = () =>
      label.getAttribute("aria-checked") === "true";

    if (isAutoPlayEnabled()) {
      console.log("Autoplay is enabled, disabling...");
      autoPlayButton.click();
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (!isAutoPlayEnabled()) {
            observer.disconnect();
            resolve();
          }
        });
        console.log("Waiting for autoplay to be disabled...");
        observer.observe(label, { attributes: true });
      });
    }
  }

  enterWebFullscreen() {
    this.assignParentClass(this.moviePlayer);

    (async () => {
      const fsButton = await waitForSelector<HTMLButtonElement>(
        "#movie_player .ytp-size-button",
      );
      let retries = 0;
      while (!this.isCinematicsMode() && retries++ < 5) {
        console.log("Entering cinema mode");
        fsButton.click();
        await sleep(500);
      }
      if (retries >= 5) {
        console.error("Failed to enter cinema mode, need to manually click");
      }
      window.dispatchEvent(new Event("resize"));
    })();
  }

  isCinematicsMode() {
    // if width of this.media is the same as window.innerWidth, then it's in cinema mode
    return this.media.offsetWidth === window.innerWidth;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const YOUTUBE_TITLE_REGEX = new RegExp(
  /<meta\s+name="title"\s+content="([^"]*)">/,
);
const YOUTUBE_VIDEOID_REGEX = new RegExp(
  /<link\s+rel="canonical"\s+href="([^"]*)">/,
);

function generateTranscriptParams(
  videoId: string,
  useAsrStyle: boolean,
  field6Value: number,
  _lang = "en",
): string {
  // const writer = Writer.create();
  //
  // // Field 1: Video ID (string)
  // writer.uint32(10).string(videoId);
  //
  // // Field 2: Language/context data (string) - base64 with URL-encoded = sign
  // let contextData;
  // if (useAsrStyle) {
  //   // For videos that use asr style: CgNhc3ISAmVuGgA%3D
  //   contextData = "CgNhc3ISAmVuGgA%3D";
  // } else {
  //   // For videos that don't use asr style: CgASAmVuGgA%3D
  //   contextData = "CgASAmVuGgA%3D";
  // }
  // writer.uint32(18).string(contextData);
  //
  // // Field 3: Number 1 (varint)
  // writer.uint32(24).uint32(1);
  //
  // // Field 5: Panel identifier (string)
  // writer
  //   .uint32(42)
  //   .string("engagement-panel-searchable-transcript-search-panel");
  //
  // // Field 6: Specific value based on video characteristics
  // writer.uint32(48).uint32(field6Value);
  //
  // // Field 7: Number 1 (varint)
  // writer.uint32(56).uint32(1);
  //
  // // Field 8: Number 1 (varint)
  // writer.uint32(64).uint32(1);
  //
  // const buffer = writer.finish();
  // return Buffer.from(buffer).toString("base64").replace(/=/g, "%3D");

  const contextData = useAsrStyle ? "CgNhc3ISAmVuGgA%3D" : "CgASAmVuGgA%3D";
  // 手动构造protobuf二进制数据
  const parts = [
    // Field 1 (videoId)
    `\x0A${String.fromCharCode(videoId.length)}${videoId}`,
    // Field 2 (contextData)
    `\x12${String.fromCharCode(contextData.length)}${contextData}`,
    // Field 3 (number 1)
    "\x18\x01",
    // Field 5 (panel identifier)
    `\x2A${String.fromCharCode(
      44,
    )}engagement-panel-searchable-transcript-search-panel`,
    // Field 6 (field6Value)
    `\x30${String.fromCharCode(field6Value)}`,
    // Field 7 & 8 (number 1)
    "\x38\x01\x40\x01",
  ];
  const buffer = parts.join("");
  return btoa(buffer).replace(/=/g, "%3D");
}

export function generateAlternativeTranscriptParams(
  videoId: string,
  lang = "en",
): string[] {
  // Generate both possible parameter combinations to try
  const variations = [
    // Most common: ASR style with field6 = 1
    { useAsrStyle: true, field6Value: 1 },
    // Alternative 1: No ASR style with field6 = 0
    { useAsrStyle: false, field6Value: 0 },
    // Alternative 2: ASR style with field6 = 0
    { useAsrStyle: true, field6Value: 0 },
    // Alternative 3: No ASR style with field6 = 1
    { useAsrStyle: false, field6Value: 1 },
  ];

  return variations.map((variant) =>
    generateTranscriptParams(
      videoId,
      variant.useAsrStyle,
      variant.field6Value,
      lang,
    ),
  );
}

function parseTranscript(responseContent: string): VTTCueWithId[] {
  try {
    const response: any = JSON.parse(responseContent);

    // Extract transcript from YouTube API response
    const transcriptEvents =
      response?.actions?.[0]?.updateEngagementPanelAction?.content
        ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
        ?.transcriptSegmentListRenderer?.initialSegments;

    if (!transcriptEvents || !Array.isArray(transcriptEvents)) {
      return [];
    }

    return transcriptEvents.map((segment: any, i) => {
      const cue = segment.transcriptSegmentRenderer;
      if (!cue || !cue.snippet || !cue.startMs || !cue.endMs) {
        return {
          text: "",
          startTime: 0,
          endTime: 0,
          id: i.toString(),
          // duration: 0,
          // offset: 0,
        };
      }
      return {
        text: (cue.snippet?.runs?.[0]?.text as string) || "",
        startTime: parseInt(cue.startMs) / 1000,
        endTime: parseInt(cue.endMs) / 1000,
        id: i.toString(),
        // duration: parseInt(cue.endMs) - parseInt(cue.startMs),
        // offset: parseInt(cue.startMs),
      };
    });
  } catch (error) {
    throw new YoutubeTranscriptError(`Failed to parse API response: ${error}`);
  }
}

function extractParamsFromPage(): string | null {
  // Recursively search for getTranscriptEndpoint in the object
  // eslint-disable-next-line no-inner-declarations
  function findGetTranscriptEndpoint(
    obj: any,
    path = "",
    depth = 0,
  ): string | null {
    if (!obj || typeof obj !== "object") {
      return null;
    }

    // Check if current object has getTranscriptEndpoint
    if (obj.getTranscriptEndpoint && obj.getTranscriptEndpoint.params) {
      return obj.getTranscriptEndpoint.params;
    }

    // Recursively search in all properties
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === "object") {
        const result = findGetTranscriptEndpoint(
          value,
          path ? `${path}.${key}` : key,
          depth + 1,
        );
        if (result) {
          return result;
        }
      }
    }

    return null;
  }
  if (typeof window !== "undefined" && (window as any).ytInitialData) {
    const ytInitialData = (window as any).ytInitialData;
    return findGetTranscriptEndpoint(ytInitialData); // 复用原有的递归查找逻辑
  }
  return null;
}

function extractVisitorData(htmlContent: string): string | null {
  // Try to extract visitorData from the page
  const visitorDataMatch =
    htmlContent.match(/"visitorData"\s*:\s*"([^"]+)"/) ||
    htmlContent.match(/visitorData['"]\s*:\s*['"]([^"']+)['"]/);

  if (visitorDataMatch) {
    return visitorDataMatch[1];
  }

  return "Cgs5LXVQa0I1YnhHOCjZ7ZDDBjInCgJQTBIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAS";
}
