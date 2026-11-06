import { Link, Routes, Route } from "react-router";

import HomePage from "./pages/HomePage";
import DrugsPage from "./pages/DrugsPage";
import DrugDetailPage from "./pages/DrugDetailPage";
import GraphPage from "./pages/GraphPage";
import ProteinsPage from "./pages/ProteinsPage";
import ProteinDetailPage from "./pages/ProteinDetailPage";


export default function App() {
  return (
    <div>
      <header className="navbar">
        <h2>Drug Knowledge Graph</h2>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/drugs">Drugs</Link>
          <Link to="/proteins">Proteins</Link>
          <Link to="/graph">Knowledge Graph</Link>
        </nav>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/drugs" element={<DrugsPage />} />
          <Route
            path="/drugs/:externalId"
            element={<DrugDetailPage />}
          />

          <Route path="/proteins" element={<ProteinsPage />}/>
          <Route path="/proteins/:code" element={<ProteinDetailPage />}/>

          <Route path="/graph" element={<GraphPage />} />
        </Routes>
      </main>
    </div>
  );
}