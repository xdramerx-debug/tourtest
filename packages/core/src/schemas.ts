import { z } from 'zod';
import type { ScoreAction } from './model';

/** Shared zod-схемы (NFR §6: валидация всех входов и на клиенте, и на сервере). */

export const roleSchema = z.enum(['player', 'marker', 'captain', 'referee', 'spectator', 'admin']);
export const idSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const holeScoreSchema = z.object({
  strokes: z.number().int().min(1).max(15).optional(),
  penalties: z.number().int().min(0).max(10).optional(),
  pickup: z.boolean().optional(),
  conceded: z.boolean().optional(),
  note: z.string().max(280).optional(),
});

export const scoreActionSchema = z.object({
  actionId: z.string().uuid(),
  type: z.enum(['score.set', 'score.pickup', 'score.penalty', 'score.concede', 'score.clear', 'entry.status', 'match.result']),
  tournamentId: idSchema,
  roundIndex: z.number().int().min(0).max(9),
  playerId: idSchema.optional(),
  teamId: idSchema.optional(),
  hole: z.number().int().min(1).max(36).optional(),
  payload: z.object({
    strokes: z.number().int().min(1).max(15).optional(),
    penalties: z.number().int().min(0).max(10).optional(),
    note: z.string().max(280).optional(),
    status: z.enum(['active', 'dq', 'wd', 'dns']).optional(),
    reason: z.string().max(280).optional(),
  }),
  authorId: idSchema,
  authorRole: roleSchema,
  deviceId: idSchema,
  clientTs: z.number().int().nonnegative(),
  lamport: z.number().int().nonnegative(),
  supersedesActionId: z.string().uuid().optional(),
}) satisfies z.ZodType<ScoreAction>;

export const actionsBatchSchema = z.array(scoreActionSchema).min(1).max(50);

export const joinFormSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  name: z.string().trim().min(2).max(60),
  hi: z.number().min(-5).max(54),
  teeSetKey: z.enum(['championship', 'mens', 'womens', 'senior', 'junior', 'custom']),
  acceptRules: z.literal(true),
  acceptPhoto: z.boolean(),
  asMarker: z.boolean().default(false),
});

export type JoinForm = z.infer<typeof joinFormSchema>;

export const courseHoleSchema = z.object({
  n: z.number().int().min(1).max(36),
  par: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  si: z.number().int().min(1).max(18),
  lengths: z.record(z.number().int().min(50).max(800)).default({}),
});

/** Валидация поля клуба (USER_FLOWS F6): SI уникальны в пределах девятки. */
export function validateCourseSi(holes: { n: number; si: number }[]): string | null {
  const perLoop = new Map<number, Set<number>>();
  for (const h of holes) {
    const loop = Math.floor((h.n - 1) / 9);
    const set = perLoop.get(loop) ?? new Set<number>();
    if (set.has(h.si)) return `SI ${h.si} дублируется на девятке ${loop + 1}`;
    set.add(h.si);
    perLoop.set(loop, set);
  }
  return null;
}
