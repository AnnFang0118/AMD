import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import UserHome from "./pages/Home";
import ChildHome from "./pages/ChildHome";
import DiaryDetail from "./pages/DiaryDetailUser";


function App() {
  return (
    <Router>
      <Routes>
        {/* 一進網站 ("/") → 自動跳到登入頁 */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<LoginPage />} />
        
        <Route path="/user" element={<UserHome />} />
        <Route path="/child" element={<ChildHome />} />
        <Route path="/diary/:id" element={<DiaryDetail />} />
      </Routes>
    </Router>
  );
}

export default App;
