import cardAbstract from '../../../assets/card-abstract.png';
import { useLocation, useNavigate } from 'react-router-dom';
import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface FinanceProps {
  kicker: string;
  title: string;
  button: string;
  fileId?: string;
}

export function FinanceCard({ item }: WidgetComponentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { kicker, title, button, fileId } = item.props as unknown as FinanceProps;
  const dashboardKey = location.pathname.startsWith('/widgets/view/')
    ? `dashboard-view-${decodeURIComponent(location.pathname.replace('/widgets/view/', ''))}`
    : 'dashboard-2';
  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="finance-card">
        <div>
          <p className="kicker">{kicker}</p>
          <h3>{title}</h3>
          <button
            className="dashboard-liquid-btn"
            onClick={() => navigate(fileId
              ? `/page?fileId=${encodeURIComponent(fileId)}&dashboardKey=${encodeURIComponent(dashboardKey)}`
              : `/page?dashboardKey=${encodeURIComponent(dashboardKey)}`)}
          >
            {button}
          </button>
        </div>
        <img src={cardAbstract} alt="abstract art" />
      </div>
    </GlassCardShell>
  );
}
