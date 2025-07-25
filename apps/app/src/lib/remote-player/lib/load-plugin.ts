/// <reference types="trusted-types" />

import type { MsgCtrlRemote } from "../interface";
import Plugin from "./plugin";
import { require } from "./require";

const policy = window.trustedTypes?.createPolicy("mx", {
  createScript: (code) => code,
  createHTML: (code) => code,
});

export async function loadPlugin(
  code: string | undefined,
  port: MsgCtrlRemote,
): Promise<Plugin> {
  if (!code) return new Plugin(port);
  const script = `(function anonymous(require,module,exports){${code}\n})`;
  const initializer = policy
    ? window.eval(policy.createScript(script))
    : window.eval(script);
  let exports: Record<string, any> = {};
  const module = { exports };
  initializer(require, module, exports);
  exports = module.exports || exports;
  const defaultExport = (exports.default || module.exports) as
    | typeof Plugin
    | null;
  if (!defaultExport)
    throw new Error("Failed to load plugin. No exports detected.");

  const plugin = new defaultExport(port, policy);
  if (!(plugin instanceof Plugin))
    throw new Error("Failed to load plugin. plugin not extends MediaPlugin");
  return plugin;
}
