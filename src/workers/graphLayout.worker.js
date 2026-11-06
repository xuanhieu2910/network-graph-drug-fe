/** Lightweight worker; no graphology, force layout, or DOM imports. */
import { calculateSigmaLayout } from '../data/sigmaLayout.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage(calculateSigmaLayout(data));
  } catch (error) {
    self.postMessage({ error: error?.message || String(error) });
  }
};
