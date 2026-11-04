import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Login from "./pages/Login";
import Wallet from "./pages/Wallet";
import Payout from "./pages/Payout";
import Transactions from "./pages/Transactions";

function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem("token");

  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/payout"
          element={
            <ProtectedRoute>
              <Payout />
            </ProtectedRoute>
          }
        />

        <Route
  path="/transactions"
  element={
    <ProtectedRoute>
      <Transactions />
    </ProtectedRoute>
  }
/>

      </Routes>
    </BrowserRouter>
  );
}

export default App;