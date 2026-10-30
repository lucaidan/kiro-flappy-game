import { AdditiveBlending, CircleGeometry, Mesh, MeshBasicMaterial } from 'three';
import { PALETTE } from '../../config/palette';
import { RENDER_CONFIG } from '../../config/render.config';
import { parallaxOffset } from './parallax';

/** Période du dérive de la lune : elle revient sans saut visible, hors du champ. */
const DRIFT_PERIOD = 120;

export interface Moon {
  /** Disque puis halo : 2 appels de dessin. */
  readonly meshes: readonly [Mesh, Mesh];
  /** Dérive lente selon la Distance_Defilement. */
  update(distance: number): void;
  dispose(): void;
}

export function createMoon(): Moon {
  const cfg = RENDER_CONFIG.MOON;

  const diskGeometry = new CircleGeometry(cfg.RADIUS, cfg.SEGMENTS);
  const diskMaterial = new MeshBasicMaterial({ color: PALETTE.MOON, fog: false });
  const disk = new Mesh(diskGeometry, diskMaterial);

  const haloGeometry = new CircleGeometry(cfg.HALO_RADIUS, cfg.SEGMENTS);
  const haloMaterial = new MeshBasicMaterial({
    color: PALETTE.MOON_HALO,
    transparent: true,
    opacity: cfg.HALO_OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const halo = new Mesh(haloGeometry, haloMaterial);

  for (const mesh of [disk, halo]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  }
  // Le halo est derrière le disque et dessiné en premier.
  disk.position.set(cfg.X, cfg.Y, cfg.Z);
  halo.position.set(cfg.X, cfg.Y, cfg.Z - 0.01);
  halo.renderOrder = 1;
  disk.renderOrder = 2;

  function update(distance: number): void {
    const raw = parallaxOffset(distance, cfg.PARALLAX, DRIFT_PERIOD);
    const drift = raw > DRIFT_PERIOD / 2 ? raw - DRIFT_PERIOD : raw;
    disk.position.x = cfg.X - drift;
    halo.position.x = cfg.X - drift;
  }

  function dispose(): void {
    diskGeometry.dispose();
    diskMaterial.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
  }

  update(0);

  return { meshes: [disk, halo], update, dispose };
}
