import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { Layout } from './Layout';
import { WidgetDashboard } from '../features/widget-dashboard/WidgetDashboard';
import { FilePage } from '../features/editor/FilePage';
import { LoginPage } from '../features/auth/LoginPage';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { NewDesignPage } from '../features/new-design/NewDesignPage';
import { IframeTheaterPage } from '../features/widget-dashboard/IframeTheaterPage';
import { SimpleWidgetsPage } from '../features/widget-dashboard/SimpleWidgetsPage';
import { useFileStore } from '../shared/store/fileStore';
import { useAuthStore } from '../shared/store/authStore';

function WidgetViewRoute() {
  const { viewId } = useParams();
  const dashboardKey = viewId ? `dashboard-view-${viewId}` : undefined;
  return <WidgetDashboard dashboardKey={dashboardKey} />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();
  
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading…
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
}

function AppContent() {
  const { loadFiles, seedIfEmpty, loaded } = useFileStore();
  const { initialize: initAuth, loading: authLoading, user } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (authLoading || !user) return;
    seedIfEmpty()
      .catch((error) => {
        console.error('[Router] Failed to initialize workspace from Supabase:', error);
      })
      .finally(() => {
        void loadFiles();
      });
  }, [authLoading, loadFiles, seedIfEmpty, user]);

  if (authLoading || (user && !loaded)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading…
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<ProtectedRoute><Navigate to="/widgets" replace /></ProtectedRoute>} />
      <Route path="/widgets" element={<ProtectedRoute><WidgetDashboard /></ProtectedRoute>} />
      <Route path="/widgets/view/:viewId" element={<ProtectedRoute><WidgetViewRoute /></ProtectedRoute>} />
      <Route path="/widgets/simple" element={<ProtectedRoute><SimpleWidgetsPage /></ProtectedRoute>} />
      <Route path="/widgets/iframe-theater" element={<ProtectedRoute><IframeTheaterPage /></ProtectedRoute>} />
      <Route path="/page" element={<NewDesignPage />} />
      <Route path="/file/:fileId" element={<ProtectedRoute><Layout><FilePage /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
