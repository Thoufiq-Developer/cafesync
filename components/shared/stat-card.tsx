import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Count, Money } from './format-values';

interface StatCardProps {
  title: string;
  amount?: number;
  value?: number;
  valueType?: 'money' | 'count';
  countSuffix?: string;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'income' | 'expense' | 'highlight';
}

export function StatCard({
  title,
  amount,
  value,
  valueType = 'money',
  countSuffix,
  subtitle,
  icon: Icon,
  variant = 'default',
}: StatCardProps) {
  const numericValue = value !== undefined ? value : (amount ?? 0);

  const variantStyles = {
    default: {
      border: 'border-slate-200',
      text: 'text-slate-900',
      bgIcon: 'bg-slate-100 text-slate-700',
      inlineStyle: undefined as React.CSSProperties | undefined,
    },
    income: {
      border: 'border-emerald-200 bg-emerald-50/20',
      text: 'text-emerald-700',
      bgIcon: 'bg-emerald-100 text-emerald-800',
      inlineStyle: undefined as React.CSSProperties | undefined,
    },
    expense: {
      border: 'border-red-200 bg-red-50/20',
      text: 'text-red-700',
      bgIcon: 'bg-red-100 text-red-800',
      inlineStyle: undefined as React.CSSProperties | undefined,
    },
    highlight: {
      border: 'border-[var(--brand-primary,#ea580c)]/30',
      text: 'text-[var(--brand-ink,var(--brand-primary,#ea580c))]',
      bgIcon: '',
      inlineStyle: { backgroundColor: 'var(--brand-50, #fff7ed)' } as React.CSSProperties,
    },
  };

  const style = variantStyles[variant];

  return (
    <Card
      className={cn('overflow-hidden transition-all shadow-xs rounded-lg', style.border)}
      style={style.inlineStyle}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 truncate">
            {title}
          </p>
          {Icon && (
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[var(--radius-btn,0.5rem)] shrink-0',
                style.bgIcon
              )}
              style={
                variant === 'highlight'
                  ? {
                      backgroundColor: 'var(--brand-100, #ffedd5)',
                      color: 'var(--brand-ink, var(--brand-primary, #ea580c))',
                    }
                  : undefined
              }
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline">
          <p className={cn('text-xl sm:text-2xl font-bold tracking-tight', style.text)}>
            {valueType === 'count' ? (
              <Count value={numericValue} suffix={countSuffix} />
            ) : (
              <Money value={numericValue} />
            )}
          </p>
        </div>

        {subtitle && (
          <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
