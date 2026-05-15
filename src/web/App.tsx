import { Link, Route, Routes } from "react-router-dom";
import { Arena } from "./pages/Arena.js";
import { Champion } from "./pages/Champion.js";
import { Champions } from "./pages/Champions.js";
import { Home } from "./pages/Home.js";
import { Match } from "./pages/Match.js";
import { Player } from "./pages/Player.js";
import { Players } from "./pages/Players.js";

export function App() {
  return (
    <>
      <header className="nav">
        <div className="container">
          <Link to="/" className="brand">League Dashboard</Link>
          <Link to="/players">Players</Link>
          <Link to="/champions">Champions</Link>
          <Link to="/arena">Arena</Link>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<Player />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/champions/:name" element={<Champion />} />
          <Route path="/matches/:id" element={<Match />} />
          <Route path="/arena" element={<Arena />} />
        </Routes>
      </main>
    </>
  );
}
