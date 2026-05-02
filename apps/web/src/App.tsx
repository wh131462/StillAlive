import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/auth';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPage from '@/pages/auth/ForgotPage';
import HomePage from '@/pages/HomePage';
import CheckInPage from '@/pages/checkin/CheckInPage';
import RecordPage from '@/pages/checkin/RecordPage';
import MilestonePage from '@/pages/checkin/MilestonePage';
import PersonListPage from '@/pages/person/PersonListPage';
import PersonDetailPage from '@/pages/person/PersonDetailPage';
import StoryListPage from '@/pages/story/StoryListPage';
import StoryDetailPage from '@/pages/story/StoryDetailPage';
import StorySubmitPage from '@/pages/story/StorySubmitPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import DeathConfirmPage from '@/pages/profile/DeathConfirmPage';
import SettingsPage from '@/pages/profile/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-sa-bg"><div className="animate-breathe w-8 h-8 rounded-full bg-sa-life" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot" element={<ForgotPage />} />

      {/* 故事公开访问 */}
      <Route path="/stories" element={<StoryListPage />} />
      <Route path="/stories/:id" element={<StoryDetailPage />} />
      <Route path="/stories/submit" element={<StorySubmitPage />} />

      {/* 需登录 */}
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
      <Route path="/checkin/record" element={<ProtectedRoute><RecordPage /></ProtectedRoute>} />
      <Route path="/checkin/milestone" element={<ProtectedRoute><MilestonePage /></ProtectedRoute>} />
      <Route path="/people" element={<ProtectedRoute><PersonListPage /></ProtectedRoute>} />
      <Route path="/people/:id" element={<ProtectedRoute><PersonDetailPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/profile/death" element={<ProtectedRoute><DeathConfirmPage /></ProtectedRoute>} />
      <Route path="/profile/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
