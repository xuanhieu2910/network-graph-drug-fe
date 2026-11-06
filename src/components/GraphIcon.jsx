import React from "react";

const paths = {
  network: <><circle cx="5" cy="16" r="2.5"/><circle cx="12" cy="5" r="2.5"/><circle cx="19" cy="16" r="2.5"/><path d="m6.4 13.9 4.2-6.8m2.8 0 4.2 6.8M7.5 16h9"/></>,
  nodes: <><circle cx="12" cy="4" r="2"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="17" r="2"/><circle cx="12" cy="13" r="2"/><path d="M12 6v5M10.2 14l-4.4 2m8.1-2 4.4 2"/></>,
  link: <><path d="m10 13 4-4M8.5 15l-2 2a4 4 0 0 1-5.5-5.8l4-4a4 4 0 0 1 5.7.1M15.5 9l2-2a4 4 0 0 1 5.5 5.8l-4 4a4 4 0 0 1-5.7-.1" transform="translate(1 0) scale(.91)"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  warning: <><path d="M10.2 3.2 1.5 19a2 2 0 0 0 1.7 3h17.6a2 2 0 0 0 1.7-3L13.8 3.2a2.1 2.1 0 0 0-3.6 0Z"/><path d="M12 9v5m0 4h.01"/></>,
  search: <><circle cx="10.8" cy="10.8" r="7.3"/><path d="m16.3 16.3 5 5"/></>,
  reload: <><path d="M20 8a8.5 8.5 0 1 0 1 6M20 3v5h-5"/></>,
  fit: <><path d="M8 3H4a1 1 0 0 0-1 1v4m13-5h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4m13 5h4a1 1 0 0 0 1-1v-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  minus: <><path d="M5 12h14"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  shield: <><path d="m12 2 9 4v6c0 5-3.7 8.5-9 10-5.3-1.5-9-5-9-10V6l9-4Z"/><path d="m8.5 12 2.4 2.5 4.9-5"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  chevron: <><path d="m9 6 6 6-6 6"/></>,
  mouse: <><rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v8m-6 2h12"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 10v7m0-11h.01"/></>,
  x: <><path d="M5 5 19 19M19 5 5 19"/></>,
  pill: <><rect x="4" y="2" width="16" height="20" rx="8" transform="rotate(45 12 12)"/><path d="m6.7 6.7 10.6 10.6"/></>,
  check: <><path d="m4 12 5 5L20 6"/></>,
};
export default function GraphIcon({ name, size = 19, className = "", ...rest }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...rest}>{paths[name] || paths.info}</svg>;
}
