export interface UrlParams {
  debug: boolean;
  bot: boolean;
  mute: boolean;
  seed: number;
}

const SEED_MAX = 4294967295;
const SEED_PATTERN = /^[0-9]{1,10}$/;
const KNOWN_KEYS = ['debug', 'seed', 'bot', 'mute'];

/** Collects the first occurrence of each known key (manual & / = scan). */
function readFirstValues(query: string): Record<string, string> {
  const found: Record<string, string> = {};
  const start = query.charAt(0) === '?' ? 1 : 0;
  let i = start;
  const n = query.length;
  while (i <= n) {
    let end = query.indexOf('&', i);
    if (end === -1) end = n;
    const pair = query.slice(i, end);
    const eq = pair.indexOf('=');
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? '' : pair.slice(eq + 1);
    if (KNOWN_KEYS.indexOf(key) !== -1 && !Object.prototype.hasOwnProperty.call(found, key)) {
      found[key] = value;
    }
    i = end + 1;
  }
  return found;
}

export function parseUrlParams(query: string, seedSource: () => number): UrlParams {
  const values = readFirstValues(query);
  const flag = (key: string): boolean => values[key] === '1';

  let seed: number | undefined;
  const raw = values['seed'];
  if (raw !== undefined && SEED_PATTERN.test(raw)) {
    const parsed = Number(raw);
    if (parsed <= SEED_MAX) seed = parsed;
  }
  if (seed === undefined) seed = seedSource();

  return { debug: flag('debug'), bot: flag('bot'), mute: flag('mute'), seed };
}

export function serializeUrlParams(params: UrlParams): string {
  return (
    `?debug=${params.debug ? 1 : 0}` +
    `&bot=${params.bot ? 1 : 0}` +
    `&mute=${params.mute ? 1 : 0}` +
    `&seed=${params.seed}`
  );
}
