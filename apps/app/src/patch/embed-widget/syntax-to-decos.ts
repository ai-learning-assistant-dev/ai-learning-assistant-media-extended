import type { EditorState } from "@codemirror/state";
import type { WidgetType } from "@codemirror/view";
import { Decoration } from "@codemirror/view";
// import { editorInfoField } from "obsidian";
import { isFileMediaInfo } from "@/info/media-info";
import { shouldOpenMedia } from "@/media-note/link-click";
import type MediaExtended from "@/mx-main";

import { isMdFavorInternalLink } from "./utils";
import { InvalidNoticeWidget, WidgetCtorMap } from "./widget";

const getPlayerDecos = (
  plugin: MediaExtended,
  state: EditorState,
  decos: ReturnType<Decoration["range"]>[],
  from?: number,
  to?: number,
) => {
  // const mdView = state.field(editorInfoField),
  // sourcePath = mdView.file?.path ?? "";

  // if (!sourcePath) console.warn("missing sourcePath", mdView);

  const doc = state.doc;
  function addDeco(widget: WidgetType, from: number, to: number) {
    const side = -1; // place the player widget after default live preview widget
    const { from: lineFrom, text: lineText } = doc.lineAt(from),
      isWholeLine =
        "" === lineText.substring(0, from - lineFrom).trim() &&
        "" === lineText.substring(to - lineFrom).trim();
    if (isWholeLine) {
      decos.push(
        Decoration.widget({ widget, block: true, side }).range(lineFrom),
      );
    } else {
      decos.push(Decoration.widget({ widget, side }).range(from));
    }
  }
};

export default getPlayerDecos;
