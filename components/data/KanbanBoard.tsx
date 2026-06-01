"use client";

import { useState, type ReactNode } from "react";

export type KanbanColumn = { key: string; label: string };

/**
 * Generic Kanban board with native HTML5 drag-and-drop. Dropping a card on a
 * column calls onMove(id, columnKey) so the caller can persist the change.
 */
export default function KanbanBoard<T>({
  columns,
  items,
  getId,
  getColumn,
  renderCard,
  onMove,
}: {
  columns: KanbanColumn[];
  items: T[];
  getId: (item: T) => string;
  getColumn: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (id: string, toColumn: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colItems = items.filter((it) => getColumn(it) === col.key);
        const isOver = overCol === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              setOverCol(null);
              if (dragId) onMove(dragId, col.key);
              setDragId(null);
            }}
            className={`flex w-[280px] shrink-0 flex-col rounded-[14px] border bg-[#fafafb] transition-colors ${
              isOver ? "border-brand bg-brand-50" : "border-line"
            }`}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-[13px] font-semibold text-ink-2">{col.label}</span>
              <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-medium text-ink-3">
                {colItems.length}
              </span>
            </div>
            <div className="flex min-h-[60px] flex-col gap-2 px-2 pb-3">
              {colItems.map((it) => (
                <div
                  key={getId(it)}
                  draggable
                  onDragStart={() => setDragId(getId(it))}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  className="cursor-grab rounded-[10px] border border-line bg-white p-3 shadow-[0_1px_2px_rgba(20,22,30,.06)] active:cursor-grabbing"
                >
                  {renderCard(it)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
