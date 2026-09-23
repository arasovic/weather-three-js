import * as THREE from 'three'
import { materials, paint } from './kit'

/** A few gulls wheeling over the island on clear days. */
export function createBirds(count = 6) {
  const group = new THREE.Group()
  const wing = new THREE.BufferGeometry()
  // One wing: a thin swept triangle from the body out along +x.
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.05, 0, 0, 0.05, 0.3, 0, 0.04], 3))
  wing.computeVertexNormals()
  paint(wing, '#f4f1ea', 0, 0.01)
  const mat = materials.clay.clone()
  mat.side = THREE.DoubleSide
  const birds = Array.from({ length: count }, (_, i) => {
    const bird = new THREE.Group()
    const left = new THREE.Mesh(wing, mat)
    const right = new THREE.Mesh(wing, mat)
    right.scale.x = -1
    bird.add(left, right)
    group.add(bird)
    return { bird, left, right, radius: 2.5 + (i % 3) * 1.4, height: 2.2 + (i % 4) * 0.45, speed: 0.12 + (i % 5) * 0.025, phase: i * 1.7 }
  })
  let shown = 0
  return {
    group,
    update(t: number, show: boolean) {
      shown += ((show ? 1 : 0) - shown) * 0.02
      group.visible = shown > 0.01
      if (!group.visible) return
      for (const b of birds) {
        const a = t * b.speed + b.phase
        b.bird.position.set(Math.cos(a) * b.radius, b.height + Math.sin(t * 0.5 + b.phase) * 0.2, Math.sin(a) * b.radius)
        b.bird.rotation.y = -a
        b.bird.scale.setScalar(shown)
        // Flap in bursts, then glide.
        const flap = Math.sin(t * 9 + b.phase) * 0.5 * Math.max(0, Math.sin(t * 0.6 + b.phase))
        b.left.rotation.z = 0.15 + flap
        b.right.rotation.z = -0.15 - flap
      }
    },
  }
}
