import type { ComponentType } from 'react';
import { CalendarCard } from './components/CalendarCard';
import { ChartCard } from './components/ChartCard';
import { FinanceCard } from './components/FinanceCard';
import { MiniActionStack } from './components/MiniActionStack';
import { QuickActionsGrid } from './components/QuickActionsGrid';
import { ReaderCard } from './components/ReaderCard';
import { ReminderList } from './components/ReminderList';
import { SourceLinkCard } from './components/SourceLinkCard';
import { TopCornerIcons } from './components/TopCornerIcons';
import { TopNavBar } from './components/TopNavBar';
import { VideoCard } from './components/VideoCard';
import type { WidgetComponentProps } from './types';

export const widgetRegistry: Record<string, ComponentType<WidgetComponentProps>> = {
  chartCard: ChartCard,
  readerCard: ReaderCard,
  financeCard: FinanceCard,
  calendarCard: CalendarCard,
  videoCard: VideoCard,
  reminderList: ReminderList,
  sourceLinkCard: SourceLinkCard,
  quickActionsGrid: QuickActionsGrid,
  miniActionStack: MiniActionStack,
  topNav: TopNavBar,
  topCornerIcons: TopCornerIcons,
};
