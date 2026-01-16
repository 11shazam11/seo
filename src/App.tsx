import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import Quest1 from "./Pages/Quest1";
import Quest2 from "./Pages/Quest2";

function Home() {
  const navigate = useNavigate();

  return (
    <>
      <h1>This is home</h1>

      <button onClick={() => navigate("/quest1")}>Go to quest 1</button>
      <button onClick={() => navigate("/quest2")}>Go to quest 2</button>
    </>
  );
}

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quest1" element={<Quest1 />} />
        <Route path="/quest2" element={<Quest2 />} />
      </Routes>
    </Router>
  );
};

export default App;
