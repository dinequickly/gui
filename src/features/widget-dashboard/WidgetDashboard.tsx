import waterlilies from '../../assets/waterlilies.webp';
import layoutData from './dashboard.layout.json';
import { DashboardRenderer } from './DashboardRenderer';
import type { DashboardLayout } from './types';
import './dashboard.css';
import './widgets.css';

export function WidgetDashboard() {
  return (
    <div className="widget-dashboard-root" style={{ backgroundImage: `url(${waterlilies})` }}>
      <DashboardRenderer layout={layoutData as DashboardLayout} />
      <FloatingChatBar />
    </div>
  );
}

function FloatingChatBar() {
  return (
    <div className="dashboard-chatbar-wrap">
      <div className="dashboard-chatbar" role="group" aria-label="Customize your view">
        <button className="chatbar-icon-btn" aria-label="Close customize bar" type="button">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6 18 18M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>

        <input
          type="text"
          className="chatbar-input"
          placeholder="Customize your view.."
          aria-label="Customize your view"
        />

        <button className="chatbar-icon-btn chatbar-send-btn" aria-label="Send message" type="button" />
      </div>
    </div>
  );
}
