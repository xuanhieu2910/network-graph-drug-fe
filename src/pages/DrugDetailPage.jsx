import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { getDrugSmilesById } from "../api/drugsApi";
import "../css/DrugDetailPage.css";

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

// Component hiển thị từng trường thông tin
function DrugField({ label, value, fullWidth = false, isSmiles = false }) {
  return (
    <div
      className={`drug-detail-field ${
        fullWidth ? "drug-detail-field-full" : ""
      }`}
    >
      <div className="drug-detail-label">{label}</div>

      <div
        className={`drug-detail-value ${
          isSmiles ? "drug-detail-smiles" : ""
        }`}
      >
        {formatValue(value)}
      </div>
    </div>
  );
}

export default function DrugDetailPage() {
  const { externalId } = useParams();

  const [drug, setDrug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchDrug() {
      try {
        setLoading(true);
        setError(null);
        setDrug(null);

        const data = await getDrugSmilesById(externalId, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDrug(data);
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

    fetchDrug();

    return () => controller.abort();
  }, [externalId]);

  if (loading) {
    return (
      <div className="drug-detail-page">
        <p>Loading drug details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="drug-detail-page">
        <Link to="/drugs" className="drug-back-link">
          ← Back to Drugs
        </Link>

        <p className="drug-detail-error">Error: {error}</p>
      </div>
    );
  }

  if (!drug) {
    return (
      <div className="drug-detail-page">
        <Link to="/drugs" className="drug-back-link">
          ← Back to Drugs
        </Link>

        <p>Drug not found.</p>
      </div>
    );
  }

  return (
    <div className="drug-detail-page">
      {/* Navigation */}
      <div className="drug-detail-navigation">
        <Link to="/drugs" className="drug-back-link">
          ← Back to Drugs
        </Link>
      </div>

      {/* Header */}
      <div className="drug-detail-header">
        <h2>Drug Detail</h2>

        <h3>{drug.name || drug.external_id || "Unknown Drug"}</h3>

        <span className="drug-detail-id">
          {formatValue(drug.external_id)}
        </span>
      </div>

      {/* Drug Information */}
      <div className="drug-detail-card">
        <h3>Drug Information</h3>

        <div className="drug-detail-grid">
          <DrugField
            label="SID"
            value={drug.sid}
          />

          <DrugField
            label="Data Source"
            value={drug.data_source}
          />

          <DrugField
            label="External Id"
            value={drug.external_id}
          />

          <DrugField
            label="Compound CID"
            value={drug.compound_cid}
          />

          <DrugField
            label="Data Source Category"
            value={drug.data_source_category}
          />

          <DrugField
            label="Name"
            value={drug.name}
          />

          <DrugField
            label="Synonyms"
            value={drug.synonyms}
            fullWidth
          />

          <DrugField
            label="SMILES"
            value={drug.smiles}
            fullWidth
            isSmiles
          />
        </div>
      </div>
    </div>
  );
}