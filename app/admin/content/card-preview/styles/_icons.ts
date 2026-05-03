import {
  TrendingDown, AlertTriangle, Gift, Shield, Sparkles,
  Stethoscope, Calculator, Baby, ArrowRight, Search,
  ClipboardCheck, Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CardIconKey } from '@/lib/content/types';

export const ICONS: Record<CardIconKey, LucideIcon> = {
  sparkles: Sparkles, shield: Shield,
  trendingDown: TrendingDown, alert: AlertTriangle,
  gift: Gift, stethoscope: Stethoscope,
  calculator: Calculator, baby: Baby,
  search: Search, clipboard: ClipboardCheck,
  zap: Zap, arrow: ArrowRight,
};
