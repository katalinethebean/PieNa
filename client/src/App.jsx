import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import OnboardingModal from './components/OnboardingModal';
import Discover from './pages/Discover';
import Network from './pages/Network';
import Profile from './pages/Profile';
import Report from './pages/Report';
import Upload from './pages/Upload';
import RecordMatch from './pages/RecordMatch';
import Leaderboard from './pages/Leaderboard';
import Chat from './pages/Chat';
import Review from './pages/Review';
import Login from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { ReviewJobProvider } from './contexts/ReviewJobContext';
import ReviewJobWidget from './components/ReviewJobWidget';
import AnalysisOverlay from './components/AnalysisOverlay';
import { isConfigured } from './lib/supabase';

function Layout({ children }) {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <OnboardingModal />
      <main style={{ flex: 1, paddingTop: '60px' }}>
        {children}
      </main>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (!isConfigured) return children;
  if (loading) return null;
  if (!user) return <Navigate to="/discover" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (!isConfigured) return children;
  if (loading) return null;
  if (user) return <Navigate to="/discover" replace />;
  return children;
}

export default function App() {
  return (
    <ReviewJobProvider>
      <ReviewJobWidget />
      <AnalysisOverlay />
      <Routes>
      <Route path="/" element={<Navigate to="/discover" replace />} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      {/* 访客可浏览招募大厅；页面内部按登录态降级 */}
      <Route path="/discover" element={<Layout><Discover /></Layout>} />
      <Route path="/network" element={<PrivateRoute><Layout><Network /></Layout></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Layout><Leaderboard /></Layout></PrivateRoute>} />
      <Route path="/chat" element={<PrivateRoute><Layout><Chat /></Layout></PrivateRoute>} />
      <Route path="/chat/:id" element={<PrivateRoute><Layout><Chat /></Layout></PrivateRoute>} />
      <Route path="/me" element={<PrivateRoute><Layout><Profile self /></Layout></PrivateRoute>} />
      <Route path="/profile/:id" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="/report/:id" element={<PrivateRoute><Layout><Report /></Layout></PrivateRoute>} />
      <Route path="/review" element={<PrivateRoute><Layout><Review /></Layout></PrivateRoute>} />
      <Route path="/upload" element={<PrivateRoute><Layout><Upload /></Layout></PrivateRoute>} />
      <Route path="/record" element={<PrivateRoute><Layout><RecordMatch /></Layout></PrivateRoute>} />
      {/* legacy redirects */}
      <Route path="/search" element={<Navigate to="/discover" replace />} />
      <Route path="/dashboard" element={<Navigate to="/discover" replace />} />
      <Route path="/profile" element={<Navigate to="/me" replace />} />
      <Route path="/explore" element={<Navigate to="/discover" replace />} />
      <Route path="*" element={<Navigate to="/discover" replace />} />
      </Routes>
    </ReviewJobProvider>
  );
}
