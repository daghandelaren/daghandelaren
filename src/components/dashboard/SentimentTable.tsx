'use client';

import { useState } from 'react';
import Table, { TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';
import SentimentMiniBar from '@/components/dashboard/SentimentMiniBar';
import { formatTimeAgo } from '@/lib/utils';
import { computeContrarian, getContrarianLabelColor } from '@/lib/sentiment/contrarian';
import { getSourceBadge, getAllSources } from '@/lib/sentiment/blend';

interface SentimentItem {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  assetClass: string;
  longPercent: number;
  shortPercent: number;
  netSentiment: number;
  blendedLong: number;
  blendedShort: number;
  blendedNet: number;
  sourcesUsed: string[];
  sources: {
    name: string;
    longPercent: number;
    shortPercent: number;
    netSentiment: number;
    timestamp: string;
  }[];
  lastUpdated: string;
}

interface SentimentTableProps {
  data: SentimentItem[];
  loading?: boolean;
}

type SortKey = 'symbol' | 'blendedLong' | 'blendedShort' | 'blendedNet' | 'lastUpdated';
type SortOrder = 'asc' | 'desc';

export default function SentimentTable({ data, loading }: SentimentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('blendedNet');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    switch (sortKey) {
      case 'symbol':
        aVal = a.symbol;
        bVal = b.symbol;
        break;
      case 'blendedLong':
        aVal = a.blendedLong;
        bVal = b.blendedLong;
        break;
      case 'blendedShort':
        aVal = a.blendedShort;
        bVal = b.blendedShort;
        break;
      case 'blendedNet':
        aVal = a.blendedNet;
        bVal = b.blendedNet;
        break;
      case 'lastUpdated':
        aVal = new Date(a.lastUpdated).getTime();
        bVal = new Date(b.lastUpdated).getTime();
        break;
      default:
        return 0;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-14 bg-surface-secondary/50" />
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 border-t border-border-primary/40">
              <div className="flex items-center gap-4 px-4 py-4">
                <div className="h-4 w-8 bg-surface-secondary rounded" />
                <div className="h-4 w-24 bg-surface-secondary rounded" />
                <div className="h-4 w-16 bg-surface-secondary rounded" />
                <div className="h-4 w-16 bg-surface-secondary rounded" />
                <div className="h-4 w-16 bg-surface-secondary rounded" />
                <div className="h-2 w-20 bg-surface-secondary rounded-full" />
                <div className="h-4 w-20 bg-surface-secondary rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-secondary/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-text-secondary font-medium">No sentiment data available</p>
        <p className="text-text-muted text-sm mt-1">
          Data will appear once scrapers have collected information
        </p>
      </div>
    );
  }

  const allSources = getAllSources();

  return (
    <div className="card">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-12 text-center sticky-col left-0">
              #
            </TableHeaderCell>
            <TableHeaderCell
              sortable
              sorted={sortKey === 'symbol' ? sortOrder : null}
              onSort={() => handleSort('symbol')}
              className="sticky-col left-12"
            >
              Instrument
            </TableHeaderCell>
            <TableHeaderCell
              sortable
              sorted={sortKey === 'blendedLong' ? sortOrder : null}
              onSort={() => handleSort('blendedLong')}
              className="text-right"
            >
              Long %
            </TableHeaderCell>
            <TableHeaderCell
              sortable
              sorted={sortKey === 'blendedShort' ? sortOrder : null}
              onSort={() => handleSort('blendedShort')}
              className="text-right"
            >
              Short %
            </TableHeaderCell>
            <TableHeaderCell
              sortable
              sorted={sortKey === 'blendedNet' ? sortOrder : null}
              onSort={() => handleSort('blendedNet')}
              className="text-right"
            >
              Net
            </TableHeaderCell>
            <TableHeaderCell className="text-center">
              Ratio
            </TableHeaderCell>
            <TableHeaderCell>Signal</TableHeaderCell>
            <TableHeaderCell>Sources</TableHeaderCell>
            <TableHeaderCell
              sortable
              sorted={sortKey === 'lastUpdated' ? sortOrder : null}
              onSort={() => handleSort('lastUpdated')}
              className="text-right"
            >
              Updated
            </TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedData.map((item, index) => {
            const contrarian = computeContrarian(item.blendedLong, item.blendedShort);
            const labelColor = getContrarianLabelColor(contrarian.label);

            return (
              <TableRow key={item.id} className="group">
                {/* Rank */}
                <TableCell className="text-center text-text-muted font-medium sticky-col left-0 bg-surface-primary group-hover:bg-surface-hover/70">
                  {index + 1}
                </TableCell>

                {/* Instrument */}
                <TableCell className="sticky-col left-12 bg-surface-primary group-hover:bg-surface-hover/70">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary">{item.symbol}</span>
                    <span className="text-[10px] uppercase tracking-wider text-text-muted bg-surface-secondary/80 px-1.5 py-0.5 rounded font-medium">
                      {item.assetClass}
                    </span>
                  </div>
                </TableCell>

                {/* Long % */}
                <TableCell className="text-right">
                  <span className="font-mono tabular-nums text-sentiment-bullish font-medium">
                    {item.blendedLong.toFixed(1)}%
                  </span>
                </TableCell>

                {/* Short % */}
                <TableCell className="text-right">
                  <span className="font-mono tabular-nums text-sentiment-bearish font-medium">
                    {item.blendedShort.toFixed(1)}%
                  </span>
                </TableCell>

                {/* Net */}
                <TableCell className="text-right">
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      item.blendedNet >= 0 ? 'text-sentiment-bullish' : 'text-sentiment-bearish'
                    }`}
                  >
                    {item.blendedNet >= 0 ? '+' : ''}
                    {item.blendedNet.toFixed(1)}%
                  </span>
                </TableCell>

                {/* Ratio Mini Bar */}
                <TableCell>
                  <div className="flex justify-center">
                    <SentimentMiniBar
                      longPercent={item.blendedLong}
                      shortPercent={item.blendedShort}
                    />
                  </div>
                </TableCell>

                {/* Signal */}
                <TableCell>
                  <span
                    className={`text-sm font-semibold ${labelColor}`}
                  >
                    {contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}
                  </span>
                </TableCell>

                {/* Sources */}
                <TableCell>
                  <div className="flex gap-1">
                    {allSources.map((source) => {
                      const isUsed = item.sourcesUsed.includes(source);
                      const sourceData = item.sources.find((s) => s.name.toLowerCase() === source);
                      return (
                        <span
                          key={source}
                          className={`source-badge ${isUsed ? 'source-badge-active' : 'source-badge-inactive'}`}
                          title={
                            sourceData
                              ? `${source}: Long ${sourceData.longPercent.toFixed(1)}% / Short ${sourceData.shortPercent.toFixed(1)}%`
                              : `${source}: No data`
                          }
                        >
                          {getSourceBadge(source)}
                        </span>
                      );
                    })}
                  </div>
                </TableCell>

                {/* Updated */}
                <TableCell className="text-right text-text-muted text-sm">
                  {formatTimeAgo(new Date(item.lastUpdated))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
