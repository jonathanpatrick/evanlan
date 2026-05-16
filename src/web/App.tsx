import { Link, Route, Routes } from "react-router-dom";
import { ModeFilterBar, ModeFilterProvider } from "./mode-filter.js";
import { Champion } from "./pages/Champion.js";
import { Champions } from "./pages/Champions.js";
import { ChampionsV2 } from "./pages/ChampionsV2.js";
import { Home } from "./pages/Home.js";
import { Match } from "./pages/Match.js";
import { Player } from "./pages/Player.js";
import { Players } from "./pages/Players.js";
import { Trends } from "./pages/Trends.js";

export function App() {
  return (
    <ModeFilterProvider>
      <header className="nav">
        <div className="container">
          <Link to="/" className="brand">League Dashboard</Link>
          <Link to="/players">Players</Link>
          <Link to="/champions">Champions</Link>
          <Link to="/trends">Trends</Link>
        </div>
      </header>
      <div className="container">
        <ModeFilterBar />
      </div>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<Player />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/champions/v2" element={<ChampionsV2 />} />
          <Route path="/champions/:name" element={<Champion />} />
          <Route path="/matches/:id" element={<Match />} />
          <Route path="/trends" element={<Trends />} />
        </Routes>
      </main>
    </ModeFilterProvider>
  );
}
