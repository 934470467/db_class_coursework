import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import Workspace from './components/Workspace';
import ExperimentDetail from './components/ExperimentDetail';
import TeacherDashboard from './components/TeacherDashboard';
import StudentExperimentSnapshot from './components/StudentExperimentSnapshot';

const TEACHER_EMAIL = "teacher@system.local";

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser) {
    if (currentUser.email === TEACHER_EMAIL) {
      return <Navigate to="/teacher-dashboard" />;
    }
    return <Navigate to="/" />;
  }
  return children;
}

function AppRoutes() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />
      <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
      <Route path="/" element={
        <PrivateRoute>
          <Workspace />
        </PrivateRoute>
      } />
      <Route path="/experiment/:id" element={
        <PrivateRoute>
          <ExperimentDetail />
        </PrivateRoute>
      } />
      <Route path="/snapshot/:id" element={
        <PrivateRoute>
          <StudentExperimentSnapshot />
        </PrivateRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
