# HPO 0 despite FastAPI Swagger 200 — debug and fix

The Swagger request is sent by Swagger from the backend origin, whereas the Vite browser application needs its own request. A Swagger HTTP 200 does **not** establish that the React application fetched, accepted, and mapped the same response.

## Apply
Copy these files into the existing Vite project:

- `src/api/humanPhenotypeOntologyApi.js`
- `src/api/graphApiClient.js`
- `src/data/sampleGraph.js`
- `src/pages/GraphPage.jsx`
- `vite.config.js` (merge its `/__kg_backend` proxy entry if you have other custom Vite settings)

In `.env` / `.env.local` at your **frontend** root set:

```env
VITE_KG_ENABLE_HPO=true
VITE_KG_HPO_API_PATH=/human_phenotype_ontology/find_all
VITE_KG_HPO_USE_PROXY=true
KG_FASTAPI_PROXY_TARGET=http://127.0.0.1:8000
```

Stop and restart `npm run dev`. Open `http://localhost:5173`, do a hard refresh (Ctrl+Shift+R), click Reload APIs.

The browser Network tab (Fetch/XHR) should show:
`GET http://localhost:5173/__kg_backend/human_phenotype_ontology/find_all`
responding HTTP 200 and JSON. The Vite dev server proxies it to the FastAPI backend at `http://127.0.0.1:8000`.

The sidebar now shows separate states: `loaded`, `empty`, `error`, `disabled`, `schema_error`. Open `API & ID diagnostics` to see the HPO request URL, number of received JSON rows, first-row field names, and number of catalog IDs. A 200 with 0 rows will no longer be silently counted as a valid 0 HPO catalog.

If the proxy target is not on the same machine as Vite, set `KG_FASTAPI_PROXY_TARGET` to the address of your backend reachable *from the Vite development server*.

If HPO still reads 0, inspect its status in the sidebar. A `loaded` result with 612 distinct HP IDs should display 612. The code **never hardcodes 612** and never fabricates HPO terms from `adr_hpo` or `mondoPhenotypes`.

Production: proxy exists only in Vite development. Set `VITE_KG_HPO_USE_PROXY=false` and use an appropriate production API base URL / reverse proxy. If using direct browser requests, FastAPI must allow the frontend origin with CORS.

Gene-Disease opt-in stays disabled by default. Workflow and Sigma.js, fullscreen, shared node filters are unaffected.
