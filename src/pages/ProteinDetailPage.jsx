import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { getProteinByCode } from "../api/proteinsApi";
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

function ProteinField({ label, value, fullWidth = false, isUrl = false }) {
  const safeUrl = isUrl ? getSafeUrl(value) : null;

  return (
    <div
      className={`protein-detail-field ${
        fullWidth ? "protein-detail-field-full" : ""
      }`}
    >
      <div className="protein-detail-label">{label}</div>

      <div className="protein-detail-value">
        {safeUrl ? (
          <a
            className="protein-link"
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {formatValue(value)}
          </a>
        ) : (
          formatValue(value)
        )}
      </div>
    </div>
  );
}

export default function ProteinDetailPage() {
  const { code } = useParams();

  const [protein, setProtein] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProtein() {
      try {
        setLoading(true);
        setError(null);
        setProtein(null);

        const data = await getProteinByCode(code, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setProtein(data);
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

    fetchProtein();

    return () => controller.abort();
  }, [code]);

  if (loading) {
    return (
      <div className="protein-page">
        <p>Loading protein details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="protein-page">
        <Link to="/proteins" className="protein-link">
          ← Back to Proteins
        </Link>
        <p className="protein-error">Error: {error}</p>
      </div>
    );
  }

  if (!protein) {
    return (
      <div className="protein-page">
        <Link to="/proteins" className="protein-link">
          ← Back to Proteins
        </Link>
        <p>Protein not found.</p>
      </div>
    );
  }

  return (
    <div className="protein-page protein-detail-page">
      <Link to="/proteins" className="protein-link">
        ← Back to Proteins
      </Link>

      <div className="protein-detail-header">
        <h2>Protein Detail</h2>

        <h3>{protein.description || protein.code || "Unknown Protein"}</h3>

        <span className="protein-code">
          {formatValue(protein.code)}
        </span>
      </div>

      <div className="protein-detail-card">
        <h3>Protein Information</h3>

        <div className="protein-detail-grid">
          <ProteinField
            label="Source Name"
            value={protein.source_name}
          />

          <ProteinField
            label="Source ID"
            value={protein.source_id}
          />

          <ProteinField
            label="Code"
            value={protein.code}
          />

          <ProteinField
            label="Description"
            value={protein.description}
            fullWidth
          />

          <ProteinField
            label="URL"
            value={protein.url}
            isUrl
            fullWidth
          />

          <ProteinField
            label="Link Records"
            value={protein.link_records}
            fullWidth
          />
        </div>
      </div>
    </div>
  );
}