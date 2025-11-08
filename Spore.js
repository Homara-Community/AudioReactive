class Spore {
    constructor(scene, particleCount = 8000) {
        this.scene = scene;
        this.particleCount = particleCount;

        // Animation properties
        this.animationTime = 0;
        this.animationTimeOffset = 0; // For variety between multiple spheres
        this.animationDuration = 30; // 30 seconds for full cycle
        this.baseRadius = 10;
        this.maxRadius = 25;
        this.minRadius = 5;

        // Store original positions for animation
        this.originalPositions = [];
        this.currentPositions = [];

        // Frequency Sphere mode properties
        this.mode = 'unified'; // 'unified', 'separated', or 'frequencySphere'
        this.particleFrequencyAssignments = []; // Which frequency band each particle responds to
        this.particleDisplacements = []; // Current displacement for each particle (for smooth return)

        // Color settings
        this.centerColor = { r: 0.8, g: 0.53, b: 0.4 }; // #cc8866
        this.middleColor = { r: 0.6, g: 0.4, b: 0.27 }; // #996644
        this.edgeColor = { r: 0.4, g: 0.2, b: 0.13 };   // #663322

        // Create the pointcloud
        this.createPointcloud();

        // Add to scene
        this.scene.add(this.pointcloud);
    }
    
    createPointcloud() {
        // Create geometry
        const geometry = new THREE.BufferGeometry();
        
        // Generate points on a sphere surface with some randomness
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);
        const sizes = new Float32Array(this.particleCount);
        
        for (let i = 0; i < this.particleCount; i++) {
            // Generate points using spherical coordinates for even distribution
            const phi = Math.acos(2 * Math.random() - 1); // Polar angle
            const theta = 2 * Math.PI * Math.random(); // Azimuthal angle
            
            // Add some randomness to the radius for organic look
            const radiusVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
            const radius = this.baseRadius * radiusVariation;
            
            // Convert to Cartesian coordinates
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            // Store positions
            const index = i * 3;
            positions[index] = x;
            positions[index + 1] = y;
            positions[index + 2] = z;
            
            // Store original positions for animation
            this.originalPositions.push(new THREE.Vector3(x, y, z));
            this.currentPositions.push(new THREE.Vector3(x, y, z));
            
            // Create color gradient from center to edge using 3-color system
            const distanceFromCenter = Math.sqrt(x * x + y * y + z * z);
            const normalizedDistance = distanceFromCenter / (this.baseRadius * 1.2);

            // Interpolate between center, middle, and edge colors
            let r, g, b;
            if (normalizedDistance < 0.5) {
                // Interpolate between center and middle
                const t = normalizedDistance * 2; // 0 to 1
                r = this.centerColor.r * (1 - t) + this.middleColor.r * t;
                g = this.centerColor.g * (1 - t) + this.middleColor.g * t;
                b = this.centerColor.b * (1 - t) + this.middleColor.b * t;
            } else {
                // Interpolate between middle and edge
                const t = (normalizedDistance - 0.5) * 2; // 0 to 1
                r = this.middleColor.r * (1 - t) + this.edgeColor.r * t;
                g = this.middleColor.g * (1 - t) + this.edgeColor.g * t;
                b = this.middleColor.b * (1 - t) + this.edgeColor.b * t;
            }

            colors[index] = Math.max(0.05, r);
            colors[index + 1] = Math.max(0.05, g);
            colors[index + 2] = Math.max(0.05, b);
            
            // Vary particle sizes
            sizes[i] = 1.0 + Math.random() * 2.0;
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Create material
        const material = new THREE.PointsMaterial({
            size: 0.5,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        // Create the pointcloud
        this.pointcloud = new THREE.Points(geometry, material);
        this.geometry = geometry;
        this.material = material;
    }

    assignParticleFrequencies() {
        // Assign each particle to a random frequency band (0-9)
        this.particleFrequencyAssignments = [];
        this.particleDisplacements = [];

        for (let i = 0; i < this.particleCount; i++) {
            // Randomly assign to one of 10 frequency bands
            const frequencyBand = Math.floor(Math.random() * 10);
            this.particleFrequencyAssignments.push(frequencyBand);

            // Initialize displacement to 0
            this.particleDisplacements.push(0);
        }
    }

    updateFrequencySphere(detailedAudioData) {
        // Frequency Sphere mode: particles stay at base radius with jitter,
        // and fly outward based on their assigned frequency band

        this.animationTime += 0.016; // Assuming 60fps

        const positions = this.geometry.attributes.position.array;

        // Frequency Sphere mode parameters
        const MAX_DISPLACEMENT = 4.0;
        const IDLE_JITTER_AMOUNT = 0.08;
        const SNAP_BACK_SPEED = 0.15;

        for (let i = 0; i < this.particleCount; i++) {
            const originalPos = this.originalPositions[i];
            const index = i * 3;

            // Get this particle's assigned frequency band
            const frequencyBand = this.particleFrequencyAssignments[i];
            const amplitude = detailedAudioData[frequencyBand] || 0;

            // Calculate target displacement based on frequency amplitude
            const targetDisplacement = amplitude * MAX_DISPLACEMENT;

            // Smooth interpolation towards target (snap back effect)
            this.particleDisplacements[i] += (targetDisplacement - this.particleDisplacements[i]) * SNAP_BACK_SPEED;

            // Add gentle jitter when idle
            const jitterX = Math.sin(this.animationTime * 2.0 + originalPos.x * 0.5) * IDLE_JITTER_AMOUNT;
            const jitterY = Math.sin(this.animationTime * 2.3 + originalPos.y * 0.5) * IDLE_JITTER_AMOUNT;
            const jitterZ = Math.sin(this.animationTime * 1.7 + originalPos.z * 0.5) * IDLE_JITTER_AMOUNT;

            // Calculate direction from center (normalized)
            const direction = originalPos.clone().normalize();

            // Apply displacement outward along the direction
            const displacedPos = originalPos.clone().add(
                direction.multiplyScalar(this.particleDisplacements[i])
            );

            // Add jitter
            displacedPos.x += jitterX;
            displacedPos.y += jitterY;
            displacedPos.z += jitterZ;

            // Update positions
            positions[index] = displacedPos.x;
            positions[index + 1] = displacedPos.y;
            positions[index + 2] = displacedPos.z;

            // Store current position
            this.currentPositions[i].copy(displacedPos);
        }

        // Mark positions as needing update
        this.geometry.attributes.position.needsUpdate = true;

        // Update particle sizes with subtle variation
        const sizes = this.geometry.attributes.size.array;
        for (let i = 0; i < this.particleCount; i++) {
            const baseSizeVariation = 1.0 + Math.random() * 2.0;
            const frequencyBand = this.particleFrequencyAssignments[i];
            const amplitude = detailedAudioData[frequencyBand] || 0;
            const sizeMultiplier = 0.8 + amplitude * 0.4;
            sizes[i] = baseSizeVariation * sizeMultiplier;
        }
        this.geometry.attributes.size.needsUpdate = true;

        // Subtle opacity variation
        this.material.opacity = 0.7 + Math.sin(this.animationTime * 0.5) * 0.1;
    }

    update(audioData = null) {
        // Update animation time
        this.animationTime += 0.016; // Assuming 60fps
        
        // Calculate animation progress (0 to 1) with offset
        const adjustedTime = this.animationTime + this.animationTimeOffset;
        const progress = (adjustedTime % this.animationDuration) / this.animationDuration;

        // Create a smooth pulse using sine wave
        // This creates expansion and contraction over the 30-second cycle
        const pulsePhase = progress * Math.PI * 2; // Full cycle
        let pulseIntensity = (Math.sin(pulsePhase) + 1) * 0.5; // 0 to 1

        // Apply audio reactivity if available
        if (audioData && audioData.overall > 0) {
            // Bass affects overall size - no cap, pure frequency response
            const bassBoost = 1 + (audioData.bass * 3); // Increased multiplier
            // Mid frequencies affect pulse intensity
            const midBoost = 1 + (audioData.mid * 2); // Increased multiplier
            // Treble affects particle jitter
            this.trebleJitter = audioData.treble * 0.8; // Increased jitter

            // No cap - let it expand as much as the audio demands!
            pulseIntensity = pulseIntensity * bassBoost * midBoost;
        } else {
            this.trebleJitter = 0;
        }

        // Calculate current radius multiplier - now uncapped and audio-driven
        let radiusMultiplier = this.minRadius / this.baseRadius +
            (this.maxRadius / this.baseRadius - this.minRadius / this.baseRadius) * pulseIntensity;

        // Add extra expansion for extreme audio peaks
        if (audioData && audioData.overall > 0.8) {
            // Extreme peaks can push beyond normal limits
            const extremeBoost = (audioData.overall - 0.8) * 5; // 5x multiplier for peaks above 80%
            radiusMultiplier += extremeBoost;
        }
        
        // Update particle positions
        const positions = this.geometry.attributes.position.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const originalPos = this.originalPositions[i];
            const index = i * 3;
            
            // Add some noise for organic movement
            const noiseScale = 0.1;
            let noiseX = (Math.sin(this.animationTime * 0.5 + originalPos.x * 0.1) * noiseScale);
            let noiseY = (Math.sin(this.animationTime * 0.7 + originalPos.y * 0.1) * noiseScale);
            let noiseZ = (Math.sin(this.animationTime * 0.3 + originalPos.z * 0.1) * noiseScale);

            // Add treble-based jitter for audio reactivity
            if (this.trebleJitter > 0) {
                const jitterScale = this.trebleJitter * 2;
                noiseX += (Math.random() - 0.5) * jitterScale;
                noiseY += (Math.random() - 0.5) * jitterScale;
                noiseZ += (Math.random() - 0.5) * jitterScale;
            }

            // Apply pulse and noise
            const newPos = originalPos.clone().multiplyScalar(radiusMultiplier);
            newPos.x += noiseX;
            newPos.y += noiseY;
            newPos.z += noiseZ;
            
            // Update positions
            positions[index] = newPos.x;
            positions[index + 1] = newPos.y;
            positions[index + 2] = newPos.z;
            
            // Store current position
            this.currentPositions[i].copy(newPos);
        }
        
        // Mark positions as needing update
        this.geometry.attributes.position.needsUpdate = true;
        
        // Update particle opacity based on pulse
        this.material.opacity = 0.6 + pulseIntensity * 0.4;
        
        // Update particle size based on pulse
        const sizes = this.geometry.attributes.size.array;
        for (let i = 0; i < this.particleCount; i++) {
            const baseSizeVariation = 1.0 + Math.random() * 2.0;
            const pulseSizeMultiplier = 0.8 + pulseIntensity * 0.4;
            sizes[i] = baseSizeVariation * pulseSizeMultiplier;
        }
        this.geometry.attributes.size.needsUpdate = true;
    }
    
    // Method to get current animation state for export
    getCurrentState() {
        return {
            animationTime: this.animationTime,
            progress: (this.animationTime % this.animationDuration) / this.animationDuration
        };
    }
    
    // Method to set animation time (useful for export at specific frames)
    setAnimationTime(time) {
        this.animationTime = time;
        this.update();
    }
    
    // Method to reset animation
    resetAnimation() {
        this.animationTime = 0;
    }
    
    // Method to update colors
    updateColors(centerColor, middleColor, edgeColor) {
        // Update stored colors
        this.centerColor = centerColor;
        this.middleColor = middleColor;
        this.edgeColor = edgeColor;

        // Regenerate colors for all particles
        const colors = this.geometry.attributes.color.array;

        for (let i = 0; i < this.particleCount; i++) {
            const originalPos = this.originalPositions[i];
            const index = i * 3;

            // Calculate distance from center
            const distanceFromCenter = Math.sqrt(
                originalPos.x * originalPos.x +
                originalPos.y * originalPos.y +
                originalPos.z * originalPos.z
            );
            const normalizedDistance = distanceFromCenter / (this.baseRadius * 1.2);

            // Interpolate between center, middle, and edge colors
            let r, g, b;
            if (normalizedDistance < 0.5) {
                // Interpolate between center and middle
                const t = normalizedDistance * 2; // 0 to 1
                r = this.centerColor.r * (1 - t) + this.middleColor.r * t;
                g = this.centerColor.g * (1 - t) + this.middleColor.g * t;
                b = this.centerColor.b * (1 - t) + this.middleColor.b * t;
            } else {
                // Interpolate between middle and edge
                const t = (normalizedDistance - 0.5) * 2; // 0 to 1
                r = this.middleColor.r * (1 - t) + this.edgeColor.r * t;
                g = this.middleColor.g * (1 - t) + this.edgeColor.g * t;
                b = this.middleColor.b * (1 - t) + this.edgeColor.b * t;
            }

            colors[index] = Math.max(0.05, r);
            colors[index + 1] = Math.max(0.05, g);
            colors[index + 2] = Math.max(0.05, b);
        }

        // Mark colors as needing update
        this.geometry.attributes.color.needsUpdate = true;
    }

    // Method to dispose of resources
    dispose() {
        if (this.geometry) {
            this.geometry.dispose();
        }
        if (this.material) {
            this.material.dispose();
        }
        if (this.pointcloud && this.scene) {
            this.scene.remove(this.pointcloud);
        }
    }
}

// Export the Spore class
window.Spore = Spore;
