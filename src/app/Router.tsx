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
import { db } from '../shared/store/db';

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
  const { initialize: initAuth, loading: authLoading } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    seedIfEmpty().then(async () => {
      const f = await db.files.get('seed-calendar');
      if (f?.title === 'Project Calendar') {
        await db.files.update('seed-calendar', { title: 'Calendar' });
      }
      await loadFiles();
    });
  }, []);

  if (!loaded || authLoading) {
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
