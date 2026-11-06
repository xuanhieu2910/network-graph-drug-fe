import { buildGraphData } from "../data/graphMapper.js";

self.onmessage = ({ data }) => {
  try {
    const graph = buildGraphData(data.collections, data.apiErrors);
    self.postMessage({ ok: true, graph });
  } catch (error) {
    self.postMessage({ ok: false, error: error?.message ?? String(error) });
  }
};
