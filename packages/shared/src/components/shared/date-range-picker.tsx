'use client';

import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  formatDate,
  formatDBDate,
  getMonthBounds,
  getPreviousMonth,
  getCurrentMonthKolkata,
} from '@/lib/calculations/dates';
import {
  startOfWeek,
  endOfWeek,
  subDays,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const applyPreset = (preset: string) => {
    const today = new Date();
    let start = today;
    let end = today;

    switch (preset) {
      case 'today':
        start = today;
        end = today;
        break;
      case 'yesterday':
        start = subDays(today, 1);
        end = subDays(today, 1);
        break;
      case 'this_week':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = today;
        break;
      case 'this_month':
        start = startOfMonth(today);
        end = today;
        break;
      case 'last_month': {
        const lastM = subMonths(today, 1);
        start = startOfMonth(lastM);
        end = endOfMonth(lastM);
        break;
      }
      case 'last_12_months': {
        start = subMonths(today, 12);
        end = today;
        break;
      }
    }

    onChange({
      startDate: formatDBDate(start),
      endDate: formatDBDate(end),
    });
    setIsOpen(false);
  };

  const displayText = `${formatDate(value.startDate)} - ${formatDate(value.endDate)}`;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-medium border-slate-200 bg-white shadow-xs"
          >
            <Calendar className="mr-2 h-3.5 w-3.5 text-slate-500" />
            <span>{displayText}</span>
            <ChevronDown className="ml-2 h-3 w-3 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => applyPreset('today')}>
            Today
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset('yesterday')}>
            Yesterday
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset('this_week')}>
            This Week
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset('this_month')}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applyPreset('last_month')}>
            Last Month
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => applyPreset('last_12_months')}>
            Last 12 Months (Max)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

