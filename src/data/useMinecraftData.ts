import React from "react";

type MinecraftData = typeof import("./minecraft");

let cache: MinecraftData | null = null;
let pending: Promise<MinecraftData> | null = null;

export function loadMinecraftData(): Promise<MinecraftData> {
  if (cache) return Promise.resolve(cache);
  pending ??= import("./minecraft").then((m) => (cache = m));
  return pending;
}

export function useMinecraftData(): MinecraftData | null {
  const [data, setData] = React.useState<MinecraftData | null>(cache);
  React.useEffect(() => {
    if (data) return;
    let live = true;
    loadMinecraftData().then((m) => live && setData(m));
    return () => {
      live = false;
    };
  }, [data]);
  return data;
}

let lineContext: { sounds: Set<string>; items: Set<string> } | null = null;
const NO_CONTEXT = {};

export function useLineContext(): { sounds?: Set<string>; items?: Set<string> } {
  const data = useMinecraftData();
  if (!data) return NO_CONTEXT;
  lineContext ??= { sounds: new Set(data.SOUNDS), items: new Set(data.ITEMS) };
  return lineContext;
}
