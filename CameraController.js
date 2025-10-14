// THREE is loaded via script tags

class CameraController {
  constructor(camera, domElement, initialPosition = new THREE.Vector3(0, 10, 20)) {
    this.camera = camera
    this.domElement = domElement

    // Store initial position for reset functionality
    this.initialPosition = initialPosition.clone()
    this.initialTarget = new THREE.Vector3(0, 0, 0)

    // Camera properties
    this.currentPosition = new THREE.Vector3()
    this.target = new THREE.Vector3()

    // First-person camera properties
    this.pitch = 0 // Up/down rotation (in radians)
    this.yaw = 0 // Left/right rotation (in radians)

    // Movement settings
    this.moveSpeed = 0.125
    this.rotateSpeed = 0.002
    this.dragSpeed = 0.25
    this.verticalSpeed = 0.125 // Speed for up/down movement

    // Zoom limits
    this.minDistance = 5
    this.maxDistance = 200

    // Mouse state
    this.isMouseDown = false
    this.mouseButton = -1
    this.mousePosition = new THREE.Vector2()
    this.previousMousePosition = new THREE.Vector2()

    // Key state
    this.keys = {
      KeyW: false,
      KeyS: false,
      KeyA: false,
      KeyD: false,
      KeyQ: false,
      KeyE: false,
      Space: false,
      ShiftLeft: false,
    }

    // Set initial camera position and calculate target
    this.currentPosition.copy(this.camera.position)

    // Calculate initial pitch and yaw from camera position
    this.calculateInitialRotation()

    // Calculate initial target
    this.updateCameraDirection()

    this.setupEventListeners()
  }

  calculateInitialRotation() {
    // Calculate initial direction vector from origin to camera (since we're looking at origin by default)
    const direction = this.currentPosition.clone().normalize().negate()

    // Calculate initial yaw (horizontal rotation)
    this.yaw = Math.atan2(direction.x, direction.z)

    // Calculate initial pitch (vertical rotation)
    const horizontalDistance = Math.sqrt(direction.x * direction.x + direction.z * direction.z)
    this.pitch = Math.atan2(direction.y, horizontalDistance)
  }

  setupEventListeners() {
    // Use bind to create bound methods that maintain 'this' context
    this._boundMouseDown = this.onMouseDown.bind(this)
    this._boundMouseMove = this.onMouseMove.bind(this)
    this._boundMouseUp = this.onMouseUp.bind(this)
    this._boundWheel = this.onMouseWheel.bind(this)
    this._boundKeyDown = this.onKeyDown.bind(this)
    this._boundKeyUp = this.onKeyUp.bind(this)
    this._boundContextMenu = (e) => e.preventDefault()

    // Add listeners with bound methods
    this.domElement.addEventListener("mousedown", this._boundMouseDown, false)
    document.addEventListener("mousemove", this._boundMouseMove, false)
    document.addEventListener("mouseup", this._boundMouseUp, false)
    this.domElement.addEventListener("wheel", this._boundWheel, { passive: false })
    document.addEventListener("keydown", this._boundKeyDown, false)
    document.addEventListener("keyup", this._boundKeyUp, false)
    this.domElement.addEventListener("contextmenu", this._boundContextMenu, false)
  }

  onMouseDown(event) {
    // If another button is already pressed, ignore new button presses
    if (this.isMouseDown) return

    // Only track left click (0) or middle click (1), ignore right click (2)
    if (event.button === 0 || event.button === 1) {
      this.isMouseDown = true
      this.mouseButton = event.button
      this.mousePosition.set(event.clientX, event.clientY)
    }
  }

  onMouseMove(event) {
    // Get mouse movement delta
    const newMousePosition = new THREE.Vector2(event.clientX, event.clientY)
    const delta = new THREE.Vector2().subVectors(newMousePosition, this.mousePosition)
    this.mousePosition.copy(newMousePosition)

    if (!this.isMouseDown) return

    // Use delta magnitude to prevent large jumps
    const maxDelta = 20 // Max pixels of movement to consider per frame
    if (delta.length() > maxDelta) {
      delta.normalize().multiplyScalar(maxDelta)
    }

    if (this.mouseButton === 0 || this.mouseButton === 1) {
      // Left click or middle click - First-person camera rotation
      // Update yaw (left/right rotation)
      this.yaw -= delta.x * this.rotateSpeed

      // Update pitch (up/down rotation) with limits to prevent flipping
      this.pitch -= delta.y * this.rotateSpeed
      this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch))

      // Update camera direction based on pitch and yaw
      this.updateCameraDirection()
    }
    // Right click functionality removed - does nothing now
  }

  updateCameraDirection() {
    // Calculate the new look direction based on pitch and yaw
    const direction = new THREE.Vector3()
    direction.x = Math.sin(this.yaw) * Math.cos(this.pitch)
    direction.y = Math.sin(this.pitch)
    direction.z = Math.cos(this.yaw) * Math.cos(this.pitch)

    // Get current distance to target
    const distanceToTarget = this.currentPosition.distanceTo(this.target)

    // Update the target position based on the camera position and direction
    this.target.copy(this.currentPosition).add(direction.multiplyScalar(distanceToTarget))

    // Update the camera to look at the target
    this.camera.lookAt(this.target)
  }

  onMouseUp(event) {
    // Only clear mouse state if the released button matches the tracked button
    if (event.button === this.mouseButton) {
      this.isMouseDown = false
      this.mouseButton = -1
    }
  }

  onMouseWheel(event) {
    event.preventDefault()

    // Simple fixed zoom rate - INVERTED (negative becomes positive and vice versa)
    const zoomStep = event.deltaY > 0 ? -2.0 : 2.0

    // Get direction from camera to target
    const directionToTarget = new THREE.Vector3().subVectors(this.target, this.currentPosition).normalize()

    // Move camera along the view direction
    const newPosition = this.currentPosition.clone().addScaledVector(directionToTarget, zoomStep)

    // Calculate new distance
    const newDistance = newPosition.distanceTo(this.target)

    // Apply zoom only if within limits
    if (newDistance >= this.minDistance && newDistance <= this.maxDistance) {
      this.currentPosition.copy(newPosition)
      this.camera.position.copy(this.currentPosition)
    }
  }

  onKeyDown(event) {
    if (this.keys.hasOwnProperty(event.code)) {
      this.keys[event.code] = true
    }
  }

  onKeyUp(event) {
    if (this.keys.hasOwnProperty(event.code)) {
      this.keys[event.code] = false
    }
  }

  update() {
    // Handle WASD movement (relative to camera orientation)
    const movement = new THREE.Vector3()

    if (this.keys.KeyW) movement.z -= this.moveSpeed
    if (this.keys.KeyS) movement.z += this.moveSpeed
    if (this.keys.KeyA) movement.x -= this.moveSpeed
    if (this.keys.KeyD) movement.x += this.moveSpeed

    // Apply WASD movement in camera's local space
    if (movement.lengthSq() > 0) {
      // Create a quaternion based on the camera's current rotation
      const quaternion = new THREE.Quaternion()
      quaternion.setFromEuler(this.camera.rotation)

      // Apply the quaternion to the movement vector
      movement.applyQuaternion(quaternion)

      // Apply the movement to the camera position
      this.currentPosition.add(movement)
      this.target.add(movement)
    }

    // Handle Space/Shift for global Y-axis movement (independent of camera orientation)
    const verticalMovement = new THREE.Vector3(0, 0, 0)

    if (this.keys.Space) verticalMovement.y += this.verticalSpeed
    if (this.keys.ShiftLeft) verticalMovement.y -= this.verticalSpeed

    // Apply vertical movement directly (global Y-axis)
    if (verticalMovement.lengthSq() > 0) {
      this.currentPosition.add(verticalMovement)
      this.target.add(verticalMovement)
    }

    // Update camera position if any movement occurred
    if (movement.lengthSq() > 0 || verticalMovement.lengthSq() > 0) {
      this.camera.position.copy(this.currentPosition)
    }

    // Handle Q/E rotation around Y axis
    if (this.keys.KeyQ) {
      this.yaw += 0.01
      this.updateCameraDirection()
    }
    if (this.keys.KeyE) {
      this.yaw -= 0.01
      this.updateCameraDirection()
    }

    // Ensure camera is looking at target
    this.camera.lookAt(this.target)
  }

  // Set zoom limits
  setZoomLimits(min, max) {
    this.minDistance = min
    this.maxDistance = max

    // Enforce limits on current position if needed
    const currentDist = this.currentPosition.distanceTo(this.target)
    if (currentDist < min) {
      // Too close, move back
      const dir = new THREE.Vector3().subVectors(this.currentPosition, this.target).normalize()
      this.currentPosition.copy(this.target).add(dir.multiplyScalar(min))
      this.camera.position.copy(this.currentPosition)
    } else if (currentDist > max) {
      // Too far, move closer
      const dir = new THREE.Vector3().subVectors(this.currentPosition, this.target).normalize()
      this.currentPosition.copy(this.target).add(dir.multiplyScalar(max))
      this.camera.position.copy(this.currentPosition)
    }
  }

  // Add reset method
  reset() {
    // Reset camera position and target to initial values
    this.camera.position.copy(this.initialPosition)
    this.currentPosition.copy(this.initialPosition)
    this.target.copy(this.initialTarget)

    // Reset rotation values
    this.calculateInitialRotation()

    // Update camera direction based on reset pitch and yaw
    this.updateCameraDirection()

    console.log("Camera reset to position:", this.initialPosition)
  }

  // Set a new initial position (useful when changing default position)
  setInitialPosition(position, target = new THREE.Vector3(0, 0, 0)) {
    this.initialPosition.copy(position)
    this.initialTarget.copy(target)
  }

  dispose() {
    // Remove event listeners using stored bound methods
    this.domElement.removeEventListener("mousedown", this._boundMouseDown)
    document.removeEventListener("mousemove", this._boundMouseMove)
    document.removeEventListener("mouseup", this._boundMouseUp)
    this.domElement.removeEventListener("wheel", this._boundWheel)
    document.removeEventListener("keydown", this._boundKeyDown)
    document.removeEventListener("keyup", this._boundKeyUp)
    this.domElement.removeEventListener("contextmenu", this._boundContextMenu)
  }
}

// Export the CameraController class
window.CameraController = CameraController;
