import { Link } from "react-router";

export default function HomePage() {
  return (
    <section>
      <h1>Drug–Target–ADR Knowledge Graph</h1>

      <p>
        Explore drug information and biological relationships.
      </p>

      <Link to="/drugs">
        Explore Drugs
      </Link>
       <Link to="/proteins">
        Explore Proteins
      </Link>
    </section>
  );
}