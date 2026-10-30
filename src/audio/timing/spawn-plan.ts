import { AUDIO_CONFIG } from '../../config/audio.config';
import type { SpawnRequest } from '../../game/spawner';
import { beatSeconds, compensatedAdvance, deriveScrollSpeed } from './beat-math';
import type { BeatEvent, TempoParams } from './beat-math';

/**
 * Convertit les événements échus en demandes de spawn. Vide `out`, y pousse une
 * requête par événement retenu et retourne leur nombre.
 * Retenu : `beatIndex % SPAWN_EVERY_BEATS === 0` et
 * `0 ≤ audioNow − audioTime ≤ MAX_LATENESS_BEATS × beat`.
 */
export function buildSpawnPlan(
  due: readonly BeatEvent[],
  audioNow: number,
  p: TempoParams,
  out: SpawnRequest[],
): number {
  out.length = 0;
  const speed = deriveScrollSpeed(p);
  const maxLateness = AUDIO_CONFIG.MAX_LATENESS_BEATS * beatSeconds(p.bpm);
  for (let i = 0; i < due.length; i++) {
    const e = due[i]!;
    if (e.beatIndex % AUDIO_CONFIG.SPAWN_EVERY_BEATS !== 0) continue;
    const lateness = audioNow - e.audioTime;
    if (lateness < 0 || lateness > maxLateness) continue;
    out.push({
      atDistance: compensatedAdvance(speed, audioNow, e.audioTime),
      gapLevels: AUDIO_CONFIG.GAP_LEVELS,
    });
  }
  return out.length;
}
