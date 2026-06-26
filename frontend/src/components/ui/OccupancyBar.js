'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ROOM_UNIT_OFFLINE_BED_HINT } from '@/lib/constants';

/**
 * OccupancyBar — Visualizes bed-level occupancy within a room.
 * Used in Room grid and detail views.
 */
export default function OccupancyBar({ bedSpaces, capacity, roomStatus }) {
  const shouldReduceMotion = useReducedMotion();
  const bedList = Array.isArray(bedSpaces) ? bedSpaces : [];
  const occupied = bedList.filter((b) => b.status === 'occupied').length;
  const vacant = bedList.filter((b) => b.status === 'vacant').length;

  /** Prefer room capacity; fall back to bed row count. */
  const total = Math.max(Number(capacity) || 0, bedList.length);
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const rs = String(roomStatus ?? '').toLowerCase();
  const unitOffline = rs === 'maintenance';
  const offlineHint =
    rs === 'maintenance' ? ROOM_UNIT_OFFLINE_BED_HINT[rs] : null;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-bold tracking-widest text-stone-400 uppercase">
            BED OCCUPANCY
          </p>
          {unitOffline ? (
            <p className="text-[9px] font-medium leading-snug text-amber-800">
              {offlineHint}
            </p>
          ) : (
            vacant > 0 && (
              <p className="text-[9px] font-medium text-teal-600">
                {vacant} {vacant === 1 ? 'bed' : 'beds'} available
              </p>
            )
          )}
        </div>
        <p className="text-[10px] font-bold tabular-nums text-stone-900">
          {occupied}/{total}
        </p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          unitOffline
            ? `Occupancy ${occupied} of ${total}. Unit not bookable.`
            : `Occupancy ${occupied} of ${total}`
        }
      >
        <motion.div
          className="h-full rounded-full bg-teal-600"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.6, ease: 'easeOut' }
          }
        />
      </div>
    </div>
  );
}
