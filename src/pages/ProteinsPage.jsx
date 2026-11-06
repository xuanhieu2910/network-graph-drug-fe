import { useEffect, useState } from "react";
import { Link } from "react-router";

import { getAllProteins } from "../api/proteinsApi";
import "../css/ProteinPage.css";

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

function getSafeUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export default function ProteinsPage() {
  const [proteins, setProteins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProteins() {
      try {
        setLoading(true);
        setError(null);

        const data = await getAllProteins({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setProteins(Array.isArray(data) ? data : []);
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

    fetchProteins();

    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="protein-page">
        <p>Loading proteins...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="protein-page">
        <p className="protein-error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="protein-page">
      <div className="protein-header">
        <h2>Proteins</h2>
        <span>Total: {proteins.length} proteins</span>
      </div>

      <div className="protein-table-container">
        <table className="protein-table">
          <colgroup>
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>

          <thead>
            <tr>
              <th>Name</th>
              <th>Unit Protein ID</th>
            </tr>
          </thead>

          <tbody>
            {proteins.length === 0 ? (
              <tr>
                <td colSpan={6} className="protein-empty">
                  No proteins found.
                </td>
              </tr>
            ) : (
              proteins.map((protein, index) => (
                <tr key={`${protein.name ?? ""}-${protein.unit_protein_id ?? index}`}>
                  <td>{formatValue(protein.name)}</td>

                  <td>{formatValue(protein.unit_protein_id)}</td>


                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}