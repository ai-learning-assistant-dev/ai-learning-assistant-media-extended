import { bilibiliApi, getJsonWithCredentials } from "./ajax";

/**
 * 根据传入的对象拼接处 URL 查询字符串
 * @param obj 参数对象
 * @param config
 * @deprecated 请使用 URLSearchParams
 */
export const formData = (
  obj: Record<string, any>,
  config?: { encode?: boolean },
) => {
  const { encode } = { encode: true, ...config };
  return Object.entries(obj)
    .map(([k, v]) => {
      if (encode) {
        return `${k}=${encodeURIComponent(v)}`;
      }
      return `${k}=${v}`;
    })
    .join("&");
};
/** 测试字符串是否包含子串或匹配正则
 * @param str 字符串
 * @param pattern 子串或正则表达式
 */
export const matchPattern = (str: string, pattern: string | RegExp) => {
  if (typeof pattern === "string") {
    return str.includes(pattern);
  }
  return pattern.test(str);
};
/** 以`document.URL`作为被测字符串, 移除URL查询参数并调用`matchPattern` */
export const matchUrlPattern = (pattern: string | RegExp) =>
  matchPattern(document.URL.replace(window.location.search, ""), pattern);
const selfSorter = (it: any) => it;
/** 升序排序 */
export const ascendingSort =
  <T>(itemProp: (obj: T) => number = selfSorter) =>
  (a: T, b: T) =>
    itemProp(a) - itemProp(b);
/** 字符串升序排序 */
export const ascendingStringSort =
  <T>(itemProp: (obj: T) => string = selfSorter) =>
  (a: T, b: T) =>
    itemProp(a).localeCompare(itemProp(b));
/** 字符串大数字升序排序 */
export const ascendingBigIntSort =
  <T>(itemProp: (obj: T) => string = selfSorter) =>
  (a: T, b: T) => {
    const numberA = BigInt(itemProp(a));
    const numberB = BigInt(itemProp(b));
    if (numberA === numberB) {
      return 0;
    }
    return numberA > numberB ? 1 : -1;
  };
/** 降序排序 */
export const descendingSort =
  <T>(itemProp: (obj: T) => number = selfSorter) =>
  (a: T, b: T) =>
    itemProp(b) - itemProp(a);
/** 字符串降序排序 */
export const descendingStringSort =
  <T>(itemProp: (obj: T) => string = selfSorter) =>
  (a: T, b: T) =>
    itemProp(b).localeCompare(itemProp(a));
/** 字符串大数字降序排序 */
export const descendingBigIntSort =
  <T>(itemProp: (obj: T) => string = selfSorter) =>
  (a: T, b: T) =>
    -ascendingBigIntSort(itemProp)(a, b);

export const videoApi = (params: string) =>
  `https://api.bilibili.com/x/player/wbi/playurl?${params}`;
export const bangumiApi = (params: string) =>
  `https://api.bilibili.com/pgc/player/web/playurl?${params}`;
/** 含有番剧的页面 */
export const bangumiUrls = ["//www.bilibili.com/bangumi/play/"];
export interface VideoQuality {
  name: string;
  value: number;
  displayName: string;
}
export const loginRequiredQualities: VideoQuality[] = [
  {
    name: "720P",
    displayName: "高清 720P",
    value: 64,
  },
  {
    name: "1080P",
    displayName: "高清 1080P",
    value: 80,
  },
];
export const vipRequiredQualities: VideoQuality[] = [
  {
    name: "8K",
    displayName: "超高清 8K",
    value: 127,
  },
  {
    name: "DolbyVision",
    displayName: "杜比视界",
    value: 126,
  },
  {
    name: "HDR",
    displayName: "真彩 HDR",
    value: 125,
  },
  {
    name: "4K",
    displayName: "超清 4K",
    value: 120,
  },
  {
    name: "1080P60",
    displayName: "高清 1080P60",
    value: 116,
  },
  {
    name: "1080P+",
    displayName: "高清 1080P+",
    value: 112,
  },
  {
    name: "720P60",
    displayName: "高清 720P60",
    // 有的视频的 720P60 也是用的 value = 64, 很奇怪...
    value: 74,
  },
];
// @ts-ignore
export const allQualities: VideoQuality[] = [
  ...vipRequiredQualities,
  ...loginRequiredQualities,
  {
    name: "480P",
    displayName: "清晰 480P",
    value: 32,
  },
  {
    name: "360P",
    displayName: "流畅 360P",
    value: 16,
  },
].sort(descendingSort((q: { value: any }) => q.value));

/** 表示一个视频输入数据 */
export interface DownloadVideoInputItem {
  aid: string;
  cid: string;
  /** 格式化 (formatTitle) 处理后的标题 */
  title: string;
  bvid?: string;
  /** 期望的画质, 忽略时表示返回任意画质都可以接受 */
  quality?: VideoQuality;
  /** 是否允许画质回退, 当实际画质和期望画质不符时此项将决定是否抛出异常 */
  allowQualityDrop?: boolean;
}
/** 表示一个视频分段 */
export interface DownloadVideoFragment {
  length: number;
  size: number;
  url: string;
  extension: string;
  backupUrls?: string[];
}
/** 调用 API 后得到的视频详细信息, 包括下载链接, 清晰度, 分段等 */
export class DownloadVideoInfo {
  public input: DownloadVideoInputItem | undefined;

  constructor(parameters: {
    input: DownloadVideoInputItem;
    jsonData: any;
    fragments: DownloadVideoFragment[];
    qualities: (VideoQuality | undefined)[];
    currentQuality: VideoQuality | undefined;
  }) {
    Object.assign(this, parameters);
  }
}
export type TestPattern = (string | RegExp)[];
export type WithName = {
  name: string;
  displayName: string;
};
/** 表示某种类型的下载视频 API */
export interface DownloadVideoApi extends WithName {
  downloadVideoInfo: (
    input: DownloadVideoInputItem,
  ) => Promise<DownloadVideoInfo>;
  description?: string;
  /** 网址匹配规则 */
  match?: TestPattern;
}

/** dash 格式更明确的扩展名 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const DefaultDashExtensions = {
  video: ".mp4",
  audio: ".m4a",
  flacAudio: ".flac",
};
/** dash 格式原本的扩展名 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const DashFragmentExtension = ".m4s";
/** dash 格式支持的编码类型 */
export enum DashCodec {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Avc = "AVC/H.264",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Hevc = "HEVC/H.265",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Av1 = "AV1",
}
export interface Dash {
  type: keyof typeof DefaultDashExtensions;
  bandWidth: number;
  codecs: string;
  codecId: number;
  backupUrls: string[];
  downloadUrl: string;
  duration: number;
}
export interface AudioDash extends Dash {
  type: "audio" | "flacAudio";
}
export interface VideoDash extends Dash {
  type: "video";
  quality: VideoQuality;
  frameRate: string;
  height: number;
  width: number;
  videoCodec: DashCodec;
}
export interface DashFilters {
  video?: (dash: VideoDash) => boolean;
  audio?: (dash: AudioDash) => boolean;
}

const getDashExtensions = (
  type: keyof typeof DefaultDashExtensions,
): string => {
  if (type === "video") {
    return DefaultDashExtensions.video;
  }
  if (type === "audio") {
    return DefaultDashExtensions.audio;
  }
  if (type === "flacAudio") {
    return DefaultDashExtensions.flacAudio;
  }
  return DefaultDashExtensions[type] ?? DashFragmentExtension;
};
const dashToFragment = (dash: Dash): DownloadVideoFragment => ({
  url: dash.downloadUrl,
  backupUrls: dash.backupUrls,
  length: dash.duration,
  size: Math.trunc((dash.bandWidth * dash.duration) / 8),
  extension: getDashExtensions(dash.type),
});
export const dashToFragments = (info: {
  videoDashes: VideoDash[];
  audioDashes: AudioDash[];
  videoCodec: DashCodec;
}) => {
  const { videoDashes, audioDashes, videoCodec } = info;
  const results: DownloadVideoFragment[] = [];
  // 画面按照首选编码选择, 若没有相应编码则选择第一个编码
  if (videoDashes.length !== 0) {
    const matchPreferredCodec = (d: VideoDash) => d.videoCodec === videoCodec;
    if (videoDashes.some(matchPreferredCodec)) {
      const dash = videoDashes
        .filter(matchPreferredCodec)
        .sort(ascendingSort((d: { bandWidth: any }) => d.bandWidth))[0];
      results.push(dashToFragment(dash));
    } else {
      results.push(
        dashToFragment(
          videoDashes.sort(
            ascendingSort((d: { bandWidth: any }) => d.bandWidth),
          )[0],
        ),
      );
    }
  }
  if (audioDashes.length !== 0) {
    // 声音倒序排, 选择最高音质
    const audio = audioDashes.sort(
      descendingSort((d: { bandWidth: any }) => d.bandWidth),
    )[0];
    results.push(dashToFragment(audio));
  }
  return results;
};

/* spell-checker: disable */
const downloadDash = async (
  input: DownloadVideoInputItem,
  config: {
    codec?: DashCodec;
    filters?: DashFilters;
  } = {},
) => {
  const { codec = DashCodec.Avc, filters } = config;
  const dashFilters = {
    video: () => true,
    audio: () => true,
    ...filters,
  };
  const { aid, cid, quality } = input;
  const params = {
    avid: aid,
    cid,
    qn: quality?.value ?? "",
    otype: "json",
    fourk: 1,
    fnver: 0,
    fnval: 4048,
  };
  const isBanugmi = bangumiUrls.some((url: any) => matchUrlPattern(url));
  const api = isBanugmi
    ? bangumiApi(formData(params))
    : videoApi(formData(params));
  const data = await bilibiliApi(
    getJsonWithCredentials(api),
    "获取视频链接失败",
  );
  if (!data.dash) {
    throw new Error("此视频没有 dash 格式, 请改用其他格式.");
  }
  const currentQuality = allQualities.find(
    (q: { value: any }) => q.value === data.quality,
  );
  const { duration, video, audio, dolby, flac } = data.dash;
  const parseVideoCodec = (codecId: number) => {
    switch (codecId) {
      case 12:
        return DashCodec.Hevc;
      case 13:
        return DashCodec.Av1;
      default:
      case 7:
        return DashCodec.Avc;
    }
  };

  const videoDashes: VideoDash[] = (video as any[])
    // @ts-ignore
    .filter((d) => d.id === currentQuality.value)
    .map((d): VideoDash => {
      const dash: VideoDash = {
        type: "video",
        videoCodec: parseVideoCodec(d.codecid),
        // @ts-ignore
        quality: currentQuality,
        width: d.width,
        height: d.height,
        codecs: d.codecs,
        codecId: d.codecid,
        bandWidth: d.bandwidth,
        frameRate: d.frameRate,
        backupUrls: (d.backupUrl || d.backup_url || []).map((it: string) =>
          it.replace("http:", "https:"),
        ),
        downloadUrl: (d.baseUrl || d.base_url || "").replace("http:", "https:"),
        duration,
      };
      return dash;
    })
    .filter((d) => dashFilters.video(d));

  const mapAudioDash = (
    dash: any,
    type: AudioDash["type"] = "audio",
  ): AudioDash => ({
    type,
    bandWidth: dash.bandwidth,
    codecs: dash.codecs,
    codecId: dash.codecid ?? 0,
    backupUrls: (dash.backupUrl || dash.backup_url || []).map((it: string) =>
      it.replace("http:", "https:"),
    ),
    downloadUrl: (dash.baseUrl || dash.base_url || "").replace(
      "http:",
      "https:",
    ),
    duration,
  });
  const audioDashes: AudioDash[] = ((audio as any[]) || [])
    .map((d) => mapAudioDash(d))
    .filter((d) => dashFilters.audio(d));
  if (dolby) {
    audioDashes.push(...(dolby.audio?.map((d: any) => mapAudioDash(d)) ?? []));
  }
  if (flac) {
    audioDashes.push(
      ...(flac.audio ? [mapAudioDash(flac.audio, "flacAudio")] : []),
    );
  }
  const fragments: DownloadVideoFragment[] = dashToFragments({
    audioDashes,
    videoDashes,
    videoCodec: codec,
  });
  const qualities = (() => {
    const filterByCodec = (preferredCodec: DashCodec | null) => {
      return (data.accept_quality as number[])
        .filter((qn) => {
          if (preferredCodec !== null) {
            return (video as any[]).some(
              (d) =>
                d.id === qn && parseVideoCodec(d.codecid) === preferredCodec,
            );
          }
          return true;
        })
        .map((qn) =>
          allQualities.find((q: { value: number }) => q.value === qn),
        )
        .filter((q) => q !== undefined);
    };
    const allAvailableQualities = filterByCodec(codec);
    if (allAvailableQualities.length > 0) {
      return allAvailableQualities;
    }
    return filterByCodec(null);
  })();
  const info = new DownloadVideoInfo({
    input,
    jsonData: data,
    fragments,
    qualities,
    currentQuality,
  });

  return info;
};
export const videoDashAvc: DownloadVideoApi = {
  // @ts-ignore
  name: "video.dash.avc",
  displayName: "dash (AVC/H.264)",
  description:
    "音画分离的 mp4 格式, 编码为 H.264, 体积较大, 兼容性较好. 下载后可以合并为单个 mp4 文件. 如果视频源没有此编码, 则会回退到设置中设定的 DASH 回退编码.",
  downloadVideoInfo: async (input: any) =>
    downloadDash(input, { codec: DashCodec.Avc }),
};
export const videoDashHevc: DownloadVideoApi = {
  // @ts-ignore
  name: "video.dash.hevc",
  displayName: "dash (HEVC/H.265)",
  description:
    "音画分离的 mp4 格式, 编码为 H.265, 体积中等, 兼容性较差. 下载后可以合并为单个 mp4 文件. 如果视频源没有此编码, 则会回退到设置中设定的 DASH 回退编码.",
  downloadVideoInfo: async (input: any) =>
    downloadDash(input, { codec: DashCodec.Hevc }),
};
export const videoDashAv1: DownloadVideoApi = {
  // @ts-ignore
  name: "video.dash.av1",
  displayName: "dash (AV1)",
  description:
    "音画分离的 mp4 格式, 编码为 AV1, 体积较小, 兼容性中等. 下载后可以合并为单个 mp4 文件. 如果视频源没有此编码, 则会回退到设置中设定的 DASH 回退编码.",
  downloadVideoInfo: async (input: any) =>
    downloadDash(input, { codec: DashCodec.Av1 }),
};
export const videoAudioDash: DownloadVideoApi = {
  // @ts-ignore
  name: "video.dash.audio",
  displayName: "dash (仅音频)",
  description: "仅下载视频中的音频轨道.",
  downloadVideoInfo: async (input: any) =>
    downloadDash(input, { filters: { video: () => false } }),
};
