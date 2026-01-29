import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";

import Quest from "./Pages/Quest";

function Home() {
  const navigate = useNavigate();

  return (
    <>
      <h1>This is home</h1>

      <button onClick={() => navigate("/quest/100001577")}>
        Go to quest 1
      </button>

      <button onClick={() => navigate("/quest/100001576")}>
        Go to quest 2
      </button>
    </>
  );
}

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/quest/:id" element={<Quest />} />
      </Routes>
    </Router>
  );
};

export default App;
