import cardAbstract from '../../../assets/card-abstract.png';
import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface FinanceProps {
  kicker: string;
  title: string;
  button: string;
}

export function FinanceCard({ item }: WidgetComponentProps) {
  const { kicker, title, button } = item.props as unknown as FinanceProps;
  return (
    <GlassCardShell width={item.width} height={item.height}>
      <div className="finance-card">
        <div>
          <p className="kicker">{kicker}</p>
          <h3>{title}</h3>
          <button className="dashboard-liquid-btn">{button}</button>
        </div>
        <img src={cardAbstract} alt="abstract art" />
      </div>
    </GlassCardShell>
  );
}
