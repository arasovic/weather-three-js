import * as THREE from 'three'

const UP_VECTOR = new THREE.Vector3(0, 1, 0)

export function latLonToVector3(lat: number, lon: number, radius = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon + 180) 

  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const sinTheta = Math.sin(theta)
  const cosTheta = Math.cos(theta)

  const x = -radius * sinPhi * cosTheta
  const y = radius * cosPhi
  const z = radius * sinPhi * sinTheta

  return new THREE.Vector3(x, y, z)
}

export function latLonToCartesian(lat: number, lon: number, radius = 1): [number, number, number] {
  const position = latLonToVector3(lat, lon, radius)
  return [position.x, position.y, position.z]
}

export function surfaceOrientationFromPosition(position: THREE.Vector3): THREE.Quaternion {
  const orientation = new THREE.Quaternion()
  orientation.setFromUnitVectors(UP_VECTOR, position.clone().normalize())
  return orientation
}
