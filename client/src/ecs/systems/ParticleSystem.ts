import { 
    Scene, 
    Vector3, 
    Color4, 
    SolidParticleSystem, 
    MeshBuilder, 
    Mesh, 
    StandardMaterial,
    Color3,
    Material,
    SolidParticle
} from "@babylonjs/core";

// Interface for internal particle tracking
interface ParticleData {
    id: number; // SPS particle ID (index)
    startTime: number;
    lifetime: number;
    initialVelocity: Vector3;
    initialPosition: Vector3;
}

export class ParticleSystem {
    private scene: Scene;
    private sps: SolidParticleSystem;
    private capacity: number;
    private particles: Map<number, ParticleData> = new Map(); // Track active particle data
    private currentTime: number = 0;
    private baseParticleMesh: Mesh; // Temporary mesh used as template
    private debugMode: boolean = false; // Add debug flag similar to CollisionSystem
    private _tempScaleVector = new Vector3(); // <-- ADD reusable vector for scaling

    constructor(scene: Scene, capacity: number = 2000) {
        this.scene = scene;
        this.capacity = capacity;

        // 1. Create Base Particle Mesh (e.g., small Plane)
        // Make sure it's invisible (isVisible = false)
        const particleBaseSize = 0.1; 
        this.baseParticleMesh = MeshBuilder.CreatePlane("particleBase", { size: particleBaseSize }, scene);
        this.baseParticleMesh.isVisible = false; 

        // 2. Create the SolidParticleSystem instance
        this.sps = new SolidParticleSystem("impactSPS", scene, {
            updatable: true,
            isPickable: false,
        });

        // --- Enable Billboarding for Particles --- 
        this.sps.billboard = true;
        // --- End Enable Billboarding --- 

        // 3. Add the base mesh shape 'capacity' times to the SPS
        this.sps.addShape(this.baseParticleMesh, capacity); 
        
        // Log particle count AFTER adding shape
        console.log(`[ParticleSystem constructor] Added shape. SPS particle count (nbParticles): ${this.sps.nbParticles}`);
        
        // 4. Build the SPS mesh
        const spsMesh = this.sps.buildMesh();
        console.log(`[ParticleSystem constructor] Built SPS mesh: ${spsMesh.name}, isVisible=${spsMesh.isVisible}`);

        // Disable frustum culling for the SPS mesh to prevent it disappearing at certain angles
        spsMesh.alwaysSelectAsActiveMesh = true;
        console.log(`[ParticleSystem constructor] Set alwaysSelectAsActiveMesh=true for ${spsMesh.name}`);

        // 5. Create and assign a suitable material using the private method below
        spsMesh.material = this.createParticleMaterial();
        // Log material properties AFTER assignment
        if (spsMesh.material) {
             console.log(`[ParticleSystem constructor] Assigned material: ${spsMesh.material.name}, transparencyMode=${spsMesh.material.transparencyMode}`);
        } else {
             console.warn(`[ParticleSystem constructor] Material assignment failed?`);
        }

        // 6. Dispose of the temporary base mesh
        this.baseParticleMesh.dispose();

        // 7. Define the sps.updateParticle function
        this.sps.updateParticle = (particle: SolidParticle) => {
            const data = this.particles.get(particle.idx);
            if (!data) {
                // Only log if it *was* visible, to avoid spam for inactive particles
                if (particle.isVisible) {
                    console.log(`[ParticleSystem] updateParticle: No data for visible particle ${particle.idx}, hiding.`);
                    particle.isVisible = false; 
                }
                return particle;
            }

            const age = this.currentTime - data.startTime;
            const lifeRatio = age / data.lifetime;
            // console.log(`[ParticleSystem] updateParticle ${particle.idx}: age=${age.toFixed(2)}, lifetime=${data.lifetime.toFixed(2)}, ratio=${lifeRatio.toFixed(2)}`); // DEBUG: Can be spammy

            // Check lifetime
            if (age >= data.lifetime) {
                console.log(`[ParticleSystem] updateParticle ${particle.idx}: Lifetime ended (age ${age.toFixed(2)} >= lifetime ${data.lifetime.toFixed(2)}). Recycling.`); // Log expiration
                particle.isVisible = false; // Hide the particle
                this.recycleParticle(particle.idx); // Mark as available
                return particle;
            }

            // Update position using initial velocity and age
            // pos = initial_pos + velocity * age
            // We store initial velocity in `data.initialVelocity` and initial position during init
            // Let's adjust how we store/use initial position. We'll add it to ParticleData.
            this._tempScaleVector.copyFrom(data.initialVelocity).scaleInPlace(age); // Reuse vector for scaling
            particle.position.copyFrom(data.initialPosition) // Use stored initial position
                              .addInPlace(this._tempScaleVector); // Add the scaled velocity
            
            // Fade out alpha
            particle.color!.a = 1.0 - lifeRatio;

            // CRITICAL: Ensure particle remains visible until lifetime ends
            if (!particle.isVisible) {
               // console.log(`[ParticleSystem] updateParticle ${particle.idx}: Forcing visible (age=${age.toFixed(2)} < lifetime=${data.lifetime.toFixed(2)})`); // Reduced log noise
               particle.isVisible = true; 
            }

            return particle;
        };
    }

    // Implement the particle material creation
    private createParticleMaterial(): StandardMaterial {
        const mat = new StandardMaterial("particleMat", this.scene);
        mat.emissiveColor = Color3.White(); 
        mat.disableLighting = true; 
        // Set transparency mode for alpha blending based on particle color alpha
        mat.transparencyMode = Material.MATERIAL_ALPHABLEND; 
        mat.needDepthPrePass = true; // Often needed with alpha blend
        console.log(`[ParticleSystem createParticleMaterial] Created material, transparencyMode=${mat.transparencyMode}`);
        return mat;
    }

    // Implement particle recycling
    private recycleParticle(id: number) {
        // Remove from active tracking map
        const deleted = this.particles.delete(id);
        // Log success/failure of deletion
        console.log(`[ParticleSystem] recycleParticle: Attempted to delete particle ${id} from map. Success: ${deleted}. Map size: ${this.particles.size}`);
    }

    /**
     * Spawns a burst of particles.
     * @param position World space position.
     * @param color Base color.
     * @param count Number to spawn.
     * @param lifetime Base lifetime (seconds).
     * @param speedMin Min initial speed.
     * @param speedMax Max initial speed.
     */
    public spawnParticles(
        position: Vector3,
        color: Color4,
        count: number = 10,
        lifetime: number = 0.5,
        speedMin: number = 1,
        speedMax: number = 3
    ) {
        console.log(`[ParticleSystem] spawnParticles called at pos: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}), count: ${count}, color: rgba(${color.r},${color.g},${color.b},${color.a})`); // Log color too
        let spawned = 0;
        let searched = 0;

        // Log particle count BEFORE the loop
        console.log(`[ParticleSystem] spawnParticles: Checking pool of ${this.sps.nbParticles} particles.`);

        // Iterate through SPS particle pool
        for (let i = 0; i < this.sps.nbParticles && spawned < count; i++) {
            searched++;
            const particle = this.sps.particles[i];
            // Log state BEFORE the check for inactivity
            console.log(`[ParticleSystem] spawn check loop ${i}: particle.idx=${particle.idx}, isVisible=${particle.isVisible}, particles.has(idx)=${this.particles.has(particle.idx)}`);
            // Check if inactive (isVisible is false AND not tracked in our map)
            if (!particle.isVisible && !this.particles.has(particle.idx)) { 
                console.log(`[ParticleSystem] Condition met for particle ${particle.idx}. Initializing directly...`); // Log direct init

                // --- Direct Initialization ---
                // Generate random velocity
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.acos(Math.random() * 2 - 1); 
                const speed = speedMin + Math.random() * (speedMax - speedMin);
                const velocity = new Vector3(
                    Math.sin(theta) * Math.cos(phi),
                    Math.cos(theta),
                    Math.sin(theta) * Math.sin(phi)
                ).scaleInPlace(speed);

                 // Store internal tracking data
                 const particleLifetime = lifetime * (0.8 + Math.random() * 0.4);
                 const initialPos = position.clone(); // Clone position for storage
                 const data: ParticleData = {
                    id: particle.idx, // Use particle.idx from loop
                    startTime: this.currentTime,
                    lifetime: particleLifetime, 
                    initialVelocity: velocity,
                    initialPosition: initialPos // Store initial position
                };
                this.particles.set(particle.idx, data);

                // Set SPS particle properties DIRECTLY
                particle.position.copyFrom(initialPos); // Set initial position
                particle.color = color.clone();
                particle.isVisible = true; // Make it visible!
                particle.scaling.setAll(1.0); // Reset scale/rotation if needed
                particle.rotation.setAll(0);
                
                console.log(`[ParticleSystem] Directly Initialized particle ${particle.idx} with lifetime ${particleLifetime.toFixed(2)}, initial alpha=${particle.color.a}`); // Log direct init success
                // --- End Direct Initialization ---
                
                spawned++;
            } else if (this.debugMode) { // Add optional debug log if particle is NOT spawned
                 console.log(`[ParticleSystem] spawn check loop ${i}: SKIPPED particle ${particle.idx} (isVisible=${particle.isVisible}, mapHas=${this.particles.has(particle.idx)})`);
            }
        }
        if (spawned < count) {
            console.warn(`[ParticleSystem] Spawned only ${spawned}/${count} particles (searched ${searched}/${this.sps.nbParticles}). Pool might be full or particles not recycled.`);
        }
    }

    /** Updates time and tells SPS to update particle states. Call this every frame. */
    public update(dt: number): void {
        this.currentTime += dt;
        // Log before setParticles to confirm update loop is running
        //console.log(`[ParticleSystem] update: Calling setParticles. Current time: ${this.currentTime.toFixed(2)}, dt: ${dt.toFixed(4)}`); 
        this.sps.setParticles(); 
    }

    // Optional: Method to toggle debug mode if needed later
    public toggleDebug(enabled: boolean): void {
        this.debugMode = enabled;
        console.log(`[ParticleSystem] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
} 