import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getAllDrugSmiles } from "../api/drugsApi";
import "../css/DrugsPage.css";

// Chuẩn hóa dữ liệu hiển thị
function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function DrugsPage() {
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDrugs() {
      try {
        setLoading(true);
        setError(null);

        const data = await getAllDrugSmiles({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDrugs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchDrugs();

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="drugs-page">
        <p>Loading drugs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drugs-page">
        <p className="drugs-error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="drugs-page">
      <div className="drugs-header">
        <h2>Drug Smiles</h2>
        <span>Total: {drugs.length} drugs</span>
      </div>

      <div className="drugs-table-container">
        <table className="drugs-table">
          <colgroup>
            <col style={{ width: "7%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "21%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>SID</th>
              <th>Data Source</th>
              <th>External Id</th>
              <th>Synonyms</th>
              <th>Data Source Category</th>
              <th>Compound CID</th>
              <th>Name</th>
              <th>SMILES</th>
            </tr>
          </thead>

          <tbody>
            {drugs.length === 0 ? (
              <tr>
                <td colSpan={8} className="drugs-empty">
                  No drugs found.
                </td>
              </tr>
            ) : (
              drugs.map((drug, index) => (
                <tr key={drug.sid ?? drug.external_id ?? index}>
                  <td>{formatValue(drug.sid)}</td>

                  <td>{formatValue(drug.data_source)}</td>

                  <td>
                    {drug.external_id != null &&
                    drug.external_id !== "" ? (
                      <Link
                        className="drug-link"
                        to={`/drugs/${encodeURIComponent(
                          String(drug.external_id)
                        )}`}
                      >
                        {formatValue(drug.external_id)}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>{formatValue(drug.synonyms)}</td>

                  <td>{formatValue(drug.data_source_category)}</td>

                  <td>{formatValue(drug.compound_cid)}</td>

                  <td>{formatValue(drug.name)}</td>

                  <td className="smiles-cell">
                    {formatValue(drug.smiles)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}