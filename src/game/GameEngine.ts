import * as THREE from 'three';

export interface CarConfig {
  name: string;
  color: number;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  braking: number;
  nitroCapacity: number;
  bodyStyle: 'sports' | 'supercar' | 'muscle' | 'drift' | 'hypercar' | 'offroad';
  price: number;
}

export interface GameState {
  speed: number;
  rpm: number;
  nitro: number;
  gear: number;
  money: number;
  score: number;
  time: number;
  lap: number;
  checkpoint: number;
  totalCheckpoints: number;
  isPaused: boolean;
  gameMode: 'freeroam' | 'race' | 'timetrial' | 'police';
  cameraMode: 'third' | 'first' | 'top';
  dayTime: number;
  weather: 'sunny' | 'cloudy' | 'rain' | 'fog';
  wantedLevel: number;
}

export const CARS: CarConfig[] = [
  { name: 'Velocity GT', color: 0xff2200, maxSpeed: 280, acceleration: 0.8, handling: 0.7, braking: 0.7, nitroCapacity: 100, bodyStyle: 'sports', price: 0 },
  { name: 'Phantom X', color: 0x0044ff, maxSpeed: 340, acceleration: 0.9, handling: 0.8, braking: 0.8, nitroCapacity: 120, bodyStyle: 'supercar', price: 50000 },
  { name: 'Thunder Bolt', color: 0xff8800, maxSpeed: 260, acceleration: 0.95, handling: 0.5, braking: 0.6, nitroCapacity: 80, bodyStyle: 'muscle', price: 35000 },
  { name: 'Sidewinder', color: 0x00ff88, maxSpeed: 240, acceleration: 0.7, handling: 0.95, braking: 0.8, nitroCapacity: 110, bodyStyle: 'drift', price: 40000 },
  { name: 'Apex Nova', color: 0xaa00ff, maxSpeed: 380, acceleration: 0.98, handling: 0.85, braking: 0.9, nitroCapacity: 150, bodyStyle: 'hypercar', price: 100000 },
  { name: 'Trail Blazer', color: 0x886600, maxSpeed: 200, acceleration: 0.6, handling: 0.6, braking: 0.7, nitroCapacity: 90, bodyStyle: 'offroad', price: 25000 },
];

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  // Car
  private car: THREE.Group;
  private carBody: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private carVelocity = new THREE.Vector3();
  private carRotation = 0;
  private carSpeed = 0;
  private steerAngle = 0;
  private nitroFuel = 100;
  private isDrifting = false;
  private driftAngle = 0;
  
  // World
  private buildings: THREE.Mesh[] = [];
  private roads: THREE.Mesh[] = [];
  private streetLights: THREE.Group[] = [];
  private trees: THREE.Group[] = [];
  private trafficCars: THREE.Group[] = [];
  private checkpoints: THREE.Mesh[] = [];
  private particles: THREE.Points[] = [];
  
  // Lighting
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private headlights: THREE.SpotLight[] = [];
  private neonLights: THREE.PointLight[] = [];
  
  // Input
  private keys: { [key: string]: boolean } = {};
  
  // State
  private state: GameState;
  private onStateChange: (state: GameState) => void;
  private animationId: number = 0;
  private dayTime = 0.3;
  private weather: 'sunny' | 'cloudy' | 'rain' | 'fog' = 'sunny';
  private rainParticles: THREE.Points | null = null;
  private fogDensity = 0;
  
  // Camera
  private cameraOffset = new THREE.Vector3(0, 5, -12);
  private cameraLookOffset = new THREE.Vector3(0, 1, 10);
  private cameraShake = 0;
  private cameraMode: 'third' | 'first' | 'top' = 'third';
  
  // Current car config
  private currentCar: CarConfig;
  private carColor: number;
  
  // Audio context
  private audioCtx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  
  // Collision
  private colliders: THREE.Box3[] = [];
  
  // Effects
  private tireSmoke: THREE.Points | null = null;
  private nitroFlame: THREE.Mesh | null = null;
  private skidMarks: THREE.Mesh[] = [];
  
  // Police
  private policeCars: THREE.Group[] = [];
  private policeLights: THREE.PointLight[] = [];

  constructor(container: HTMLElement, onStateChange: (state: GameState) => void, carIndex: number = 0) {
    this.onStateChange = onStateChange;
    this.currentCar = CARS[carIndex];
    this.carColor = this.currentCar.color;
    this.nitroFuel = this.currentCar.nitroCapacity;
    
    this.state = {
      speed: 0,
      rpm: 800,
      nitro: 100,
      gear: 1,
      money: 10000,
      score: 0,
      time: 0,
      lap: 1,
      checkpoint: 0,
      totalCheckpoints: 12,
      isPaused: false,
      gameMode: 'freeroam',
      cameraMode: 'third',
      dayTime: 0.3,
      weather: 'sunny',
      wantedLevel: 0,
    };

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.001);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(0, 8, -15);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // Clock
    this.clock = new THREE.Clock();

    // Lighting
    this.ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sunLight.position.set(100, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.scene.add(this.sunLight);

    // Hemisphere light for sky
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x444444, 0.6);
    this.scene.add(hemiLight);

    // Build world
    this.createGround();
    this.createRoads();
    this.createBuildings();
    this.createStreetLights();
    this.createTrees();
    this.createCheckpoints();
    this.createTraffic();
    this.createEnvironment();

    // Create car
    this.car = new THREE.Group();
    this.carBody = this.createCarModel();
    this.car.add(this.carBody);
    this.car.position.set(0, 0.5, 0);
    this.scene.add(this.car);

    // Headlights
    this.createHeadlights();
    
    // Effects
    this.createEffects();
    
    // Police (for chase mode)
    this.createPoliceCars();

    // Input
    this.setupInput();

    // Audio
    this.initAudio();

    // Resize
    window.addEventListener('resize', this.onResize.bind(this));

    // Start
    this.animate();
  }

  private createGround() {
    // Main ground
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x2d5a27,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ 
      color: 0x333333,
      roughness: 0.7,
    });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });

    // Main roads - grid pattern
    const roadWidth = 16;
    const roadLength = 800;
    
    // North-South roads
    for (let x = -300; x <= 300; x += 150) {
      const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.01, 0);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roads.push(road);

      // Center line
      for (let z = -roadLength/2; z < roadLength/2; z += 8) {
        const lineGeo = new THREE.PlaneGeometry(0.3, 4);
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.02, z);
        this.scene.add(line);
      }

      // Sidewalks
      for (let side = -1; side <= 1; side += 2) {
        const swGeo = new THREE.BoxGeometry(3, 0.3, roadLength);
        const sw = new THREE.Mesh(swGeo, sidewalkMat);
        sw.position.set(x + side * 9.5, 0.15, 0);
        sw.receiveShadow = true;
        sw.castShadow = true;
        this.scene.add(sw);
      }
    }

    // East-West roads
    for (let z = -300; z <= 300; z += 150) {
      const roadGeo = new THREE.PlaneGeometry(roadLength, roadWidth);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, z);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roads.push(road);

      // Center line
      for (let x = -roadLength/2; x < roadLength/2; x += 8) {
        const lineGeo = new THREE.PlaneGeometry(4, 0.3);
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(x, 0.02, z);
        this.scene.add(line);
      }
    }

    // Highway - elevated
    const highwayMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    const highwayGeo = new THREE.BoxGeometry(24, 0.5, 1200);
    const highway = new THREE.Mesh(highwayGeo, highwayMat);
    highway.position.set(400, 8, 0);
    highway.receiveShadow = true;
    highway.castShadow = true;
    this.scene.add(highway);

    // Highway pillars
    for (let z = -500; z <= 500; z += 50) {
      const pillarGeo = new THREE.BoxGeometry(3, 8, 3);
      const pillar = new THREE.Mesh(pillarGeo, new THREE.MeshStandardMaterial({ color: 0x666666 }));
      pillar.position.set(395, 4, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
      const pillar2 = pillar.clone();
      pillar2.position.set(405, 4, z);
      this.scene.add(pillar2);
    }

    // Highway barriers
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    for (let side = -1; side <= 1; side += 2) {
      const barrierGeo = new THREE.BoxGeometry(0.5, 1.2, 1200);
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(400 + side * 12, 8.8, 0);
      this.scene.add(barrier);
    }

    // Tunnel
    const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    const tunnelGeo = new THREE.CylinderGeometry(12, 12, 100, 16, 1, true);
    const tunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnel.rotation.z = Math.PI / 2;
    tunnel.position.set(-200, 6, -200);
    this.scene.add(tunnel);

    // Tunnel road
    const tunnelRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 100),
      roadMat
    );
    tunnelRoad.rotation.x = -Math.PI / 2;
    tunnelRoad.position.set(-200, 0.02, -200);
    this.scene.add(tunnelRoad);

    // Bridge
    const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const bridgeGeo = new THREE.BoxGeometry(20, 1, 80);
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.position.set(0, 5, 350);
    bridge.castShadow = true;
    this.scene.add(bridge);

    // Bridge supports
    for (let x = -8; x <= 8; x += 16) {
      const supportGeo = new THREE.CylinderGeometry(1, 1.5, 5, 8);
      const support = new THREE.Mesh(supportGeo, new THREE.MeshStandardMaterial({ color: 0x666666 }));
      support.position.set(x, 2.5, 350);
      support.castShadow = true;
      this.scene.add(support);
    }

    // Racing track (oval)
    const trackPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      const rx = 120, rz = 70;
      trackPoints.push(new THREE.Vector3(
        Math.cos(angle) * rx - 350,
        0.02,
        Math.sin(angle) * rz + 200
      ));
    }
    const trackShape = new THREE.Shape();
    trackShape.moveTo(-8, 0);
    trackShape.lineTo(8, 0);
    trackShape.lineTo(8, 0.1);
    trackShape.lineTo(-8, 0.1);
    trackShape.closePath();

    // Simple track surface
    const trackGeo = new THREE.RingGeometry(55, 75, 64);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.set(-350, 0.02, 200);
    this.scene.add(track);
  }

  private createBuildings() {
    const buildingColors = [0x445566, 0x556677, 0x334455, 0x667788, 0x554433, 0x443322, 0x778899, 0x889999];
    
    // Downtown buildings (tall)
    for (let i = 0; i < 80; i++) {
      const width = 10 + Math.random() * 20;
      const depth = 10 + Math.random() * 20;
      const height = 20 + Math.random() * 80;
      
      const geo = new THREE.BoxGeometry(width, height, depth);
      const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
      const mat = new THREE.MeshStandardMaterial({ 
        color,
        roughness: 0.3,
        metalness: 0.7,
      });
      const building = new THREE.Mesh(geo, mat);
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * 600;
        z = (Math.random() - 0.5) * 600;
      } while (this.isOnRoad(x, z));
      
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);
      this.buildings.push(building);
      
      // Add collider
      const box = new THREE.Box3().setFromObject(building);
      this.colliders.push(box);

      // Windows (emissive planes)
      if (height > 30) {
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.6 });
        for (let wy = 5; wy < height - 5; wy += 6) {
          for (let side = 0; side < 4; side++) {
            if (Math.random() > 0.3) {
              const winGeo = new THREE.PlaneGeometry(2, 3);
              const win = new THREE.Mesh(winGeo, windowMat);
              const offset = 0.1;
              switch(side) {
                case 0: win.position.set(x + width/2 + offset, wy, z); win.rotation.y = 0; break;
                case 1: win.position.set(x - width/2 - offset, wy, z); win.rotation.y = Math.PI; break;
                case 2: win.position.set(x, wy, z + depth/2 + offset); win.rotation.y = Math.PI/2; break;
                case 3: win.position.set(x, wy, z - depth/2 - offset); win.rotation.y = -Math.PI/2; break;
              }
              this.scene.add(win);
            }
          }
        }
      }
    }

    // Industrial area
    for (let i = 0; i < 20; i++) {
      const width = 20 + Math.random() * 30;
      const height = 8 + Math.random() * 15;
      const depth = 20 + Math.random() * 30;
      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9 });
      const building = new THREE.Mesh(geo, mat);
      building.position.set(200 + Math.random() * 100, height/2, -200 + Math.random() * 100);
      building.castShadow = true;
      this.scene.add(building);
      this.buildings.push(building);
      this.colliders.push(new THREE.Box3().setFromObject(building));
    }

    // Gas station
    const stationMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const stationRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 15), stationMat);
    stationRoof.position.set(100, 4, 50);
    stationRoof.castShadow = true;
    this.scene.add(stationRoof);
    
    // Gas pumps
    for (let i = 0; i < 4; i++) {
      const pumpGeo = new THREE.BoxGeometry(1, 3, 1);
      const pumpMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(95 + i * 3, 1.5, 50);
      pump.castShadow = true;
      this.scene.add(pump);
    }

    // Parking lot
    const parkingMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const parkingGeo = new THREE.PlaneGeometry(80, 60);
    const parking = new THREE.Mesh(parkingGeo, parkingMat);
    parking.rotation.x = -Math.PI / 2;
    parking.position.set(200, 0.02, 100);
    this.scene.add(parking);

    // Parking lines
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 15; i++) {
      const lineGeo = new THREE.PlaneGeometry(0.2, 6);
      const line = new THREE.Mesh(lineGeo, whiteMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(165 + i * 5, 0.03, 100);
      this.scene.add(line);
    }
  }

  private isOnRoad(x: number, z: number): boolean {
    // Check if position is on any road
    for (let rx = -300; rx <= 300; rx += 150) {
      if (Math.abs(x - rx) < 15 && Math.abs(z) < 400) return true;
    }
    for (let rz = -300; rz <= 300; rz += 150) {
      if (Math.abs(z - rz) < 15 && Math.abs(x) < 400) return true;
    }
    // Highway
    if (Math.abs(x - 400) < 20 && Math.abs(z) < 600) return true;
    return false;
  }

  private createStreetLights() {
    const lightMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9 });
    
    for (let x = -300; x <= 300; x += 150) {
      for (let z = -350; z <= 350; z += 40) {
        for (let side = -1; side <= 1; side += 2) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 6), lightMat);
          pole.position.set(x + side * 11, 4, z);
          pole.castShadow = true;
          this.scene.add(pole);

          const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 0.15), lightMat);
          arm.position.set(x + side * 9.5, 8, z);
          this.scene.add(arm);

          const lampGeo = new THREE.SphereGeometry(0.4, 8, 8);
          const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
          const lamp = new THREE.Mesh(lampGeo, lampMat);
          lamp.position.set(x + side * 8, 7.8, z);
          this.scene.add(lamp);

          // Only add point lights for nearby ones (performance)
          if (Math.abs(z) < 200) {
            const pointLight = new THREE.PointLight(0xffdd88, 0.5, 20);
            pointLight.position.set(x + side * 8, 7.5, z);
            this.scene.add(pointLight);
            this.neonLights.push(pointLight);
          }
        }
      }
    }
  }

  private createTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228800 });
    
    for (let i = 0; i < 150; i++) {
      let x, z;
      do {
        x = (Math.random() - 0.5) * 800;
        z = (Math.random() - 0.5) * 800;
      } while (this.isOnRoad(x, z));

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4, 6), trunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      tree.add(trunk);

      const leaves = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), leafMat);
      leaves.position.y = 5.5;
      leaves.castShadow = true;
      tree.add(leaves);

      tree.position.set(x, 0, z);
      this.scene.add(tree);
      this.trees.push(tree);
    }
  }

  private createCheckpoints() {
    const cpMat = new THREE.MeshBasicMaterial({ 
      color: 0x00ff88, 
      transparent: true, 
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    
    const positions = [
      [0, 0], [100, 0], [100, 100], [0, 100],
      [-100, 100], [-100, 0], [-100, -100], [0, -100],
      [100, -100], [200, -100], [200, 0], [200, 100]
    ];

    positions.forEach(([x, z]) => {
      const cpGeo = new THREE.TorusGeometry(5, 0.3, 8, 16);
      const cp = new THREE.Mesh(cpGeo, cpMat);
      cp.position.set(x, 4, z);
      cp.rotation.y = Math.PI / 2;
      this.scene.add(cp);
      this.checkpoints.push(cp);
    });
  }

  private createTraffic() {
    const trafficColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00, 0xffffff, 0x333333, 0xff8800];
    
    for (let i = 0; i < 25; i++) {
      const trafficCar = this.createSimpleCar(trafficColors[Math.floor(Math.random() * trafficColors.length)]);
      
      // Place on roads
      const roadX = [-300, -150, 0, 150, 300][Math.floor(Math.random() * 5)];
      const roadZ = [-300, -150, 0, 150, 300][Math.floor(Math.random() * 5)];
      
      if (Math.random() > 0.5) {
        trafficCar.position.set(roadX + (Math.random() > 0.5 ? 4 : -4), 0.5, (Math.random() - 0.5) * 600);
        trafficCar.rotation.y = Math.random() > 0.5 ? 0 : Math.PI;
      } else {
        trafficCar.position.set((Math.random() - 0.5) * 600, 0.5, roadZ + (Math.random() > 0.5 ? 4 : -4));
        trafficCar.rotation.y = Math.random() > 0.5 ? Math.PI/2 : -Math.PI/2;
      }
      
      (trafficCar as any).speed = 5 + Math.random() * 15;
      (trafficCar as any).direction = new THREE.Vector3(
        Math.sin(trafficCar.rotation.y),
        0,
        Math.cos(trafficCar.rotation.y)
      );
      
      this.scene.add(trafficCar);
      this.trafficCars.push(trafficCar);
    }
  }

  private createSimpleCar(color: number): THREE.Group {
    const car = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(2.2, 1, 4.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    car.add(body);

    // Roof
    const roofGeo = new THREE.BoxGeometry(1.8, 0.8, 2.2);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.2, -0.3);
    roof.castShadow = true;
    car.add(roof);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelPositions = [[-1.1, 0.4, 1.3], [1.1, 0.4, 1.3], [-1.1, 0.4, -1.3], [1.1, 0.4, -1.3]];
    wheelPositions.forEach(([x, y, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, y, z);
      wheel.rotation.z = Math.PI / 2;
      car.add(wheel);
    });

    return car;
  }

  private createCarModel(): THREE.Mesh {
    const group = new THREE.Group() as any;
    
    const bodyColor = this.carColor;
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: bodyColor, 
      metalness: 0.9, 
      roughness: 0.1,
    });

    let bodyMesh: THREE.Mesh;
    
    switch(this.currentCar.bodyStyle) {
      case 'sports':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.8), bodyMat);
        bodyMesh.position.y = 0.6;
        // Hood slope
        const hood = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1.5), bodyMat);
        hood.position.set(0, 1.05, 1.2);
        hood.rotation.x = -0.15;
        this.car.add(hood);
        break;
      case 'supercar':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 5), bodyMat);
        bodyMesh.position.y = 0.5;
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1), bodyMat);
        scoop.position.set(0, 1.1, -0.5);
        this.car.add(scoop);
        break;
      case 'muscle':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 5), bodyMat);
        bodyMesh.position.y = 0.7;
        const blower = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 }));
        blower.position.set(0, 1.4, 0.8);
        this.car.add(blower);
        break;
      case 'drift':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.5), bodyMat);
        bodyMesh.position.y = 0.6;
        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.6), bodyMat);
        wing.position.set(0, 1.8, -2.2);
        this.car.add(wing);
        const wingPylons = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), bodyMat);
        wingPylons.position.set(-0.8, 1.4, -2.2);
        this.car.add(wingPylons);
        const wingPylon2 = wingPylons.clone();
        wingPylon2.position.set(0.8, 1.4, -2.2);
        this.car.add(wingPylon2);
        break;
      case 'hypercar':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 5.2), bodyMat);
        bodyMesh.position.y = 0.45;
        const rearDiff = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 1), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        rearDiff.position.set(0, 0.3, -2.5);
        this.car.add(rearDiff);
        break;
      case 'offroad':
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 4.8), bodyMat);
        bodyMesh.position.y = 1;
        const rollBar = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        rollBar.position.set(0, 1.8, -0.5);
        this.car.add(rollBar);
        break;
      default:
        bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 4.8), bodyMat);
        bodyMesh.position.y = 0.6;
    }
    
    bodyMesh.castShadow = true;
    this.car.add(bodyMesh);

    // Cabin/roof
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.7 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2), cabinMat);
    cabin.position.set(0, 1.3, -0.2);
    cabin.castShadow = true;
    this.car.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.35, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9 });
    
    const wheelPositions = [[-1.2, 0.4, 1.5], [1.2, 0.4, 1.5], [-1.2, 0.4, -1.5], [1.2, 0.4, -1.5]];
    this.wheels = [];
    wheelPositions.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheelGroup.add(wheel);
      
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 6), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);
      
      wheelGroup.position.set(x, y, z);
      this.car.add(wheelGroup);
      this.wheels.push(wheelGroup as any);
    });

    // Tail lights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    tailL.position.set(-0.8, 0.7, -2.4);
    this.car.add(tailL);
    const tailR = tailL.clone();
    tailR.position.set(0.8, 0.7, -2.4);
    this.car.add(tailR);

    // Front lights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headMat);
    headL.position.set(-0.8, 0.7, 2.4);
    this.car.add(headL);
    const headR = headL.clone();
    headR.position.set(0.8, 0.7, 2.4);
    this.car.add(headR);

    return bodyMesh;
  }

  private createHeadlights() {
    for (let side = -1; side <= 1; side += 2) {
      const spotlight = new THREE.SpotLight(0xffffee, 2, 50, Math.PI / 6, 0.5);
      spotlight.position.set(side * 0.8, 0.7, 2.5);
      spotlight.target.position.set(side * 0.8, 0, 20);
      this.car.add(spotlight);
      this.car.add(spotlight.target);
      this.headlights.push(spotlight);
    }
  }

  private createEffects() {
    // Tire smoke particles
    const smokeGeo = new THREE.BufferGeometry();
    const smokeCount = 100;
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeSizes = new Float32Array(smokeCount);
    for (let i = 0; i < smokeCount; i++) {
      smokePositions[i * 3] = 0;
      smokePositions[i * 3 + 1] = -10; // hidden below ground
      smokePositions[i * 3 + 2] = 0;
      smokeSizes[i] = 0;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeo.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));
    const smokeMat = new THREE.PointsMaterial({ 
      color: 0xcccccc, 
      size: 1, 
      transparent: true, 
      opacity: 0.4,
      sizeAttenuation: true 
    });
    this.tireSmoke = new THREE.Points(smokeGeo, smokeMat);
    this.scene.add(this.tireSmoke);

    // Nitro flame
    const flameGeo = new THREE.ConeGeometry(0.3, 1.5, 8);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.8 });
    this.nitroFlame = new THREE.Mesh(flameGeo, flameMat);
    this.nitroFlame.position.set(0, 0.5, -3);
    this.nitroFlame.rotation.x = Math.PI / 2;
    this.nitroFlame.visible = false;
    this.car.add(this.nitroFlame);
  }

  private createPoliceCars() {
    for (let i = 0; i < 3; i++) {
      const policeCar = new THREE.Group();
      
      // Body
      const bodyGeo = new THREE.BoxGeometry(2.2, 1, 4.5);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      body.castShadow = true;
      policeCar.add(body);

      // White stripe
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.3, 4.55), stripeMat);
      stripe.position.y = 0.6;
      policeCar.add(stripe);

      // Roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2), bodyMat);
      roof.position.set(0, 1.3, -0.2);
      policeCar.add(roof);

      // Light bar
      const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x333333 }));
      lightBar.position.set(0, 1.75, -0.2);
      policeCar.add(lightBar);

      // Red/blue lights
      const redLight = new THREE.PointLight(0xff0000, 0, 15);
      redLight.position.set(-0.5, 1.9, -0.2);
      policeCar.add(redLight);
      this.policeLights.push(redLight);

      const blueLight = new THREE.PointLight(0x0000ff, 0, 15);
      blueLight.position.set(0.5, 1.9, -0.2);
      policeCar.add(blueLight);
      this.policeLights.push(blueLight);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      [[-1.1, 0.4, 1.3], [1.1, 0.4, 1.3], [-1.1, 0.4, -1.3], [1.1, 0.4, -1.3]].forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z);
        wheel.rotation.z = Math.PI / 2;
        policeCar.add(wheel);
      });

      policeCar.position.set(
        this.car.position.x + (Math.random() - 0.5) * 100,
        0.5,
        this.car.position.z + (Math.random() - 0.5) * 100
      );
      policeCar.visible = false;
      
      this.scene.add(policeCar);
      this.policeCars.push(policeCar);
    }
  }

  private createEnvironment() {
    // Mountains in distance
    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x445533, roughness: 0.9 });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist = 700 + Math.random() * 200;
      const height = 50 + Math.random() * 100;
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(40 + Math.random() * 30, height, 6),
        mountainMat
      );
      mountain.position.set(Math.cos(angle) * dist, height/2, Math.sin(angle) * dist);
      this.scene.add(mountain);
    }

    // Airport runway
    const runwayMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(30, 300), runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(-300, 0.02, -300);
    this.scene.add(runway);

    // Runway markings
    for (let z = -140; z < 140; z += 20) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(-300, 0.03, -300 + z);
      this.scene.add(mark);
    }

    // Traffic lights at intersections
    const trafficLightPositions = [
      [0, 0], [150, 0], [-150, 0], [0, 150], [0, -150],
      [150, 150], [-150, -150], [150, -150], [-150, 150]
    ];
    trafficLightPositions.forEach(([x, z]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 5, 6),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      pole.position.set(x + 8, 2.5, z + 8);
      this.scene.add(pole);

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 1.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      box.position.set(x + 8, 5.5, z + 8);
      this.scene.add(box);

      // Lights
      const colors = [0xff0000, 0xffff00, 0x00ff00];
      colors.forEach((color, i) => {
        const light = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 8, 8),
          new THREE.MeshBasicMaterial({ color })
        );
        light.position.set(x + 8, 6 - i * 0.5, z + 8.3);
        this.scene.add(light);
      });
    });

    // Neon signs / billboards
    const neonColors = [0xff0066, 0x00ffcc, 0xff6600, 0x6600ff, 0x00ff66, 0xff00ff];
    for (let i = 0; i < 15; i++) {
      const signGeo = new THREE.BoxGeometry(8, 3, 0.3);
      const color = neonColors[Math.floor(Math.random() * neonColors.length)];
      const signMat = new THREE.MeshBasicMaterial({ color });
      const sign = new THREE.Mesh(signGeo, signMat);
      
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      sign.position.set(x, 15 + Math.random() * 20, z);
      sign.rotation.y = Math.random() * Math.PI;
      this.scene.add(sign);

      // Glow
      const glow = new THREE.PointLight(color, 1, 20);
      glow.position.copy(sign.position);
      this.scene.add(glow);
    }

    // Water feature / river
    const waterMat = new THREE.MeshStandardMaterial({ 
      color: 0x004488, 
      metalness: 0.9, 
      roughness: 0.1,
      transparent: true,
      opacity: 0.8
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 400), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(500, 0.1, 0);
    this.scene.add(water);

    // Benches in parks
    for (let i = 0; i < 20; i++) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x8B4513 })
      );
      seat.position.y = 0.5;
      bench.add(seat);
      const back = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.6, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x8B4513 })
      );
      back.position.set(0, 0.8, -0.25);
      bench.add(back);
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 200;
      bench.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      bench.rotation.y = Math.random() * Math.PI;
      this.scene.add(bench);
    }

    // Landmark: Tall tower
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.9, roughness: 0.1 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 5, 120, 16), towerMat);
    tower.position.set(50, 60, -100);
    tower.castShadow = true;
    this.scene.add(tower);
    this.colliders.push(new THREE.Box3().setFromObject(tower));
    
    // Tower antenna
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 30, 8), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    antenna.position.set(50, 135, -100);
    this.scene.add(antenna);
    
    // Tower light
    const towerLight = new THREE.PointLight(0xff0000, 2, 50);
    towerLight.position.set(50, 150, -100);
    this.scene.add(towerLight);

    // Landmark: Large sphere building
    const sphereBuilding = new THREE.Mesh(
      new THREE.SphereGeometry(15, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x4488aa, metalness: 0.9, roughness: 0.1 })
    );
    sphereBuilding.position.set(-100, 15, 200);
    sphereBuilding.castShadow = true;
    this.scene.add(sphereBuilding);
    this.colliders.push(new THREE.Box3().setFromObject(sphereBuilding));

    // Stadium
    const stadiumGeo = new THREE.TorusGeometry(30, 8, 8, 24);
    const stadiumMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const stadium = new THREE.Mesh(stadiumGeo, stadiumMat);
    stadium.position.set(300, 8, -300);
    stadium.rotation.x = Math.PI / 2;
    stadium.castShadow = true;
    this.scene.add(stadium);
    
    // Stadium field
    const fieldGeo = new THREE.CircleGeometry(25, 32);
    const fieldMat = new THREE.MeshStandardMaterial({ color: 0x228822 });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.position.set(300, 0.5, -300);
    field.rotation.x = -Math.PI / 2;
    this.scene.add(field);

    // Parking structures
    for (let i = 0; i < 3; i++) {
      const lotGroup = new THREE.Group();
      for (let floor = 0; floor < 4; floor++) {
        const floorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(30, 0.5, 20),
          new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        floorMesh.position.y = floor * 4;
        floorMesh.castShadow = true;
        floorMesh.receiveShadow = true;
        lotGroup.add(floorMesh);

        // Pillars
        for (let px = -12; px <= 12; px += 8) {
          const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.4, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0x777777 })
          );
          pillar.position.set(px, floor * 4 + 2, -8);
          lotGroup.add(pillar);
          const pillar2 = pillar.clone();
          pillar2.position.z = 8;
          lotGroup.add(pillar2);
        }
      }
      lotGroup.position.set(-200 + i * 100, 0, 300);
      this.scene.add(lotGroup);
      this.colliders.push(new THREE.Box3().setFromObject(lotGroup));
    }

    // Cranes in industrial area
    for (let i = 0; i < 4; i++) {
      const crane = new THREE.Group();
      const craneMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
      
      // Vertical
      const vert = new THREE.Mesh(new THREE.BoxGeometry(1.5, 40, 1.5), craneMat);
      vert.position.y = 20;
      crane.add(vert);
      
      // Horizontal arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(25, 1, 1), craneMat);
      arm.position.set(8, 40, 0);
      crane.add(arm);
      
      // Counter weight
      const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 2), new THREE.MeshStandardMaterial({ color: 0x444444 }));
      cw.position.set(-6, 39, 0);
      crane.add(cw);
      
      crane.position.set(250 + i * 30, 0, -250 + Math.random() * 50);
      crane.rotation.y = Math.random() * Math.PI;
      this.scene.add(crane);
    }
  }

  private createRain() {
    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 5000;
    const positions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xaaaaff, size: 0.1, transparent: true, opacity: 0.6 });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      
      if (e.key.toLowerCase() === 'c') {
        this.cycleCamera();
      }
      if (e.key.toLowerCase() === 'r') {
        this.resetCar();
      }
      if (e.key === 'Escape') {
        this.state.isPaused = !this.state.isPaused;
        this.onStateChange({ ...this.state });
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  private cycleCamera() {
    const modes: ('third' | 'first' | 'top')[] = ['third', 'first', 'top'];
    const idx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(idx + 1) % modes.length];
    this.state.cameraMode = this.cameraMode;
    this.onStateChange({ ...this.state });
  }

  private resetCar() {
    this.car.position.set(0, 0.5, 0);
    this.car.rotation.y = 0;
    this.carSpeed = 0;
    this.steerAngle = 0;
    this.driftAngle = 0;
    this.carVelocity.set(0, 0, 0);
  }

  private initAudio() {
    try {
      this.audioCtx = new AudioContext();
      this.engineOsc = this.audioCtx.createOscillator();
      this.engineGain = this.audioCtx.createGain();
      
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 80;
      this.engineGain.gain.value = 0;
      
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.audioCtx.destination);
      this.engineOsc.start();
    } catch(e) {
      // Audio not supported
    }
  }

  private updateAudio() {
    if (!this.engineOsc || !this.engineGain || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    const speedRatio = Math.abs(this.carSpeed) / this.currentCar.maxSpeed;
    const freq = 60 + speedRatio * 300;
    this.engineOsc.frequency.value = freq;
    this.engineGain.gain.value = Math.min(0.05, speedRatio * 0.08);
  }

  private updatePhysics(dt: number) {
    if (this.state.isPaused) return;

    const maxSpeed = this.currentCar.maxSpeed / 3.6; // Convert km/h to m/s
    const accel = this.currentCar.acceleration * 30;
    const handling = this.currentCar.handling;
    const braking = this.currentCar.braking;

    // Acceleration
    if (this.keys['w']) {
      this.carSpeed += accel * dt;
    } else if (this.keys['s']) {
      this.carSpeed -= accel * braking * dt * 1.5;
    } else {
      // Natural deceleration
      this.carSpeed *= (1 - 0.5 * dt);
    }

    // Nitro boost
    if (this.keys['shift'] && this.nitroFuel > 0) {
      this.carSpeed += accel * 2 * dt;
      this.nitroFuel -= 30 * dt;
      this.cameraShake = Math.min(this.cameraShake + dt * 2, 0.3);
    } else {
      this.nitroFuel = Math.min(this.nitroFuel + 5 * dt, this.currentCar.nitroCapacity);
    }

    // Speed limits
    this.carSpeed = Math.max(-maxSpeed * 0.3, Math.min(maxSpeed * (this.keys['shift'] && this.nitroFuel > 0 ? 1.3 : 1), this.carSpeed));

    // Steering
    const steerSpeed = handling * 3;
    if (this.keys['a']) {
      this.steerAngle += steerSpeed * dt;
    } else if (this.keys['d']) {
      this.steerAngle -= steerSpeed * dt;
    } else {
      this.steerAngle *= (1 - 5 * dt);
    }
    this.steerAngle = Math.max(-0.8, Math.min(0.8, this.steerAngle));

    // Handbrake / Drift
    if (this.keys[' ']) {
      this.isDrifting = true;
      this.driftAngle += this.steerAngle * dt * 3;
      this.driftAngle = Math.max(-0.5, Math.min(0.5, this.driftAngle));
      this.carSpeed *= (1 - 1 * dt);
    } else {
      this.isDrifting = false;
      this.driftAngle *= (1 - 3 * dt);
    }

    // Apply rotation
    const turnRate = this.steerAngle * (this.carSpeed / maxSpeed) * 2;
    this.car.rotation.y += turnRate * dt + this.driftAngle * dt;

    // Body roll during turns
    const targetRoll = -this.steerAngle * 0.08 * (this.carSpeed / maxSpeed);
    this.carBody.rotation.z += (targetRoll - this.carBody.rotation.z) * 5 * dt;
    
    // Pitch during acceleration/braking
    const targetPitch = this.keys['w'] ? -0.02 : this.keys['s'] ? 0.03 : 0;
    this.carBody.rotation.x += (targetPitch - this.carBody.rotation.x) * 5 * dt;

    // Move car
    const direction = new THREE.Vector3(
      Math.sin(this.car.rotation.y),
      0,
      Math.cos(this.car.rotation.y)
    );
    
    this.car.position.add(direction.multiplyScalar(this.carSpeed * dt));

    // Simple collision with buildings
    const carBox = new THREE.Box3().setFromCenterAndSize(
      this.car.position,
      new THREE.Vector3(3, 2, 5)
    );
    
    for (const collider of this.colliders) {
      if (carBox.intersectsBox(collider)) {
        this.carSpeed *= -0.3;
        this.cameraShake = 0.5;
        // Push car back
        this.car.position.sub(direction.multiplyScalar(this.carSpeed * dt * 2));
        break;
      }
    }

    // Keep car on ground
    this.car.position.y = 0.5;

    // World bounds
    this.car.position.x = Math.max(-900, Math.min(900, this.car.position.x));
    this.car.position.z = Math.max(-900, Math.min(900, this.car.position.z));

    // Update wheels
    this.wheels.forEach((wheel, i) => {
      wheel.rotation.x += this.carSpeed * dt * 2;
      if (i < 2) { // Front wheels steer
        wheel.rotation.y = this.steerAngle * 0.5;
      }
    });

    // Update state
    const speedKmh = Math.abs(this.carSpeed * 3.6);
    this.state.speed = Math.round(speedKmh);
    this.state.rpm = Math.round(800 + (speedKmh / this.currentCar.maxSpeed) * 7200);
    this.state.nitro = Math.round((this.nitroFuel / this.currentCar.nitroCapacity) * 100);
    this.state.gear = Math.max(1, Math.min(6, Math.ceil(speedKmh / (this.currentCar.maxSpeed / 6))));

    // Checkpoint detection
    if (this.checkpoints.length > 0) {
      const nextCp = this.checkpoints[this.state.checkpoint];
      if (nextCp) {
        const dist = this.car.position.distanceTo(nextCp.position);
        if (dist < 8) {
          this.state.checkpoint++;
          this.state.score += 100;
          this.state.money += 50;
          if (this.state.checkpoint >= this.checkpoints.length) {
            this.state.checkpoint = 0;
            this.state.lap++;
            this.state.money += 500;
          }
        }
      }
    }

    // Day/night cycle
    this.dayTime += dt * 0.01;
    if (this.dayTime > 1) this.dayTime = 0;
    this.state.dayTime = this.dayTime;

    // Update sun position based on time
    const sunAngle = this.dayTime * Math.PI * 2;
    this.sunLight.position.set(
      Math.cos(sunAngle) * 100,
      Math.sin(sunAngle) * 100 + 20,
      50
    );
    
    // Adjust lighting based on time
    const dayIntensity = Math.max(0, Math.sin(sunAngle));
    this.sunLight.intensity = dayIntensity * 1.5;
    this.ambientLight.intensity = 0.2 + dayIntensity * 0.4;
    
    // Sky color
    const skyR = 0.1 + dayIntensity * 0.4;
    const skyG = 0.1 + dayIntensity * 0.6;
    const skyB = 0.2 + dayIntensity * 0.7;
    this.scene.background = new THREE.Color(skyR, skyG, skyB);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color = new THREE.Color(skyR, skyG, skyB);
    }

    // Headlights at night
    const nightFactor = 1 - dayIntensity;
    this.headlights.forEach(h => {
      h.intensity = nightFactor * 3;
    });

    // Camera shake decay
    this.cameraShake *= (1 - 3 * dt);

    // Score over time
    this.state.time += dt;
    if (Math.floor(this.state.time) % 10 === 0) {
      this.state.score += 1;
    }

    // Update effects
    this.updateEffects(dt);
    
    // Update police
    this.updatePolice(dt);

    this.onStateChange({ ...this.state });
  }

  private updateEffects(dt: number) {
    // Tire smoke during drift
    if (this.tireSmoke && (this.isDrifting || Math.abs(this.steerAngle) > 0.4 && Math.abs(this.carSpeed) > 10)) {
      const positions = this.tireSmoke.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        if (positions[i + 1] < -5) {
          // Respawn at rear wheels
          const side = (i / 3) % 2 === 0 ? -1 : 1;
          const wheelOffset = new THREE.Vector3(side * 1.2, 0.2, -1.5);
          wheelOffset.applyQuaternion(this.car.quaternion);
          positions[i] = this.car.position.x + wheelOffset.x + (Math.random() - 0.5) * 0.5;
          positions[i + 1] = 0.3;
          positions[i + 2] = this.car.position.z + wheelOffset.z + (Math.random() - 0.5) * 0.5;
        } else {
          positions[i + 1] += 2 * dt;
          positions[i] += (Math.random() - 0.5) * dt;
          positions[i + 2] += (Math.random() - 0.5) * dt;
        }
      }
      this.tireSmoke.geometry.attributes.position.needsUpdate = true;
      (this.tireSmoke.material as THREE.PointsMaterial).opacity = 0.3;
    } else if (this.tireSmoke) {
      (this.tireSmoke.material as THREE.PointsMaterial).opacity = 0;
    }

    // Nitro flame
    if (this.nitroFlame) {
      const isNitroActive = this.keys['shift'] && this.nitroFuel > 0;
      this.nitroFlame.visible = isNitroActive;
      if (isNitroActive) {
        this.nitroFlame.scale.set(
          0.8 + Math.random() * 0.4,
          0.8 + Math.random() * 0.4,
          1 + Math.random() * 0.5
        );
        const mat = this.nitroFlame.material as THREE.MeshBasicMaterial;
        mat.color.setHex(Math.random() > 0.5 ? 0x0088ff : 0x00ccff);
      }
    }
  }

  private updatePolice(dt: number) {
    const isPoliceMode = this.state.gameMode === 'police';
    
    this.policeCars.forEach((car, i) => {
      car.visible = isPoliceMode;
      
      if (isPoliceMode) {
        // Chase player
        const toPlayer = this.car.position.clone().sub(car.position);
        const dist = toPlayer.length();
        toPlayer.normalize();
        
        // Move towards player
        const policeSpeed = 18 + i * 3;
        if (dist > 8) {
          car.position.add(toPlayer.multiplyScalar(policeSpeed * dt));
          car.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        }
        
        // Flash lights
        const time = performance.now() * 0.005;
        const lightIdx = i * 2;
        if (this.policeLights[lightIdx]) {
          this.policeLights[lightIdx].intensity = Math.sin(time + i) > 0 ? 3 : 0;
        }
        if (this.policeLights[lightIdx + 1]) {
          this.policeLights[lightIdx + 1].intensity = Math.sin(time + i + Math.PI) > 0 ? 3 : 0;
        }

        // Collision with player
        if (dist < 4) {
          this.carSpeed *= 0.95;
          this.cameraShake = 0.3;
          this.state.wantedLevel = Math.min(5, this.state.wantedLevel + dt * 0.5);
        }
      }
    });

    // Update wanted level display
    if (isPoliceMode) {
      this.state.wantedLevel = Math.min(5, Math.max(0, this.state.wantedLevel));
    } else {
      this.state.wantedLevel = 0;
    }
  }

  private updateCamera(dt: number) {
    const carPos = this.car.position.clone();
    const carDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.quaternion);

    let targetPos: THREE.Vector3;
    let lookAt: THREE.Vector3;

    switch(this.cameraMode) {
      case 'first':
        targetPos = carPos.clone().add(new THREE.Vector3(0, 1.5, 0));
        lookAt = carPos.clone().add(carDir.multiplyScalar(20));
        break;
      case 'top':
        targetPos = carPos.clone().add(new THREE.Vector3(0, 40, 0));
        lookAt = carPos.clone();
        break;
      default: // third
        const behind = carDir.clone().multiplyScalar(-12);
        targetPos = carPos.clone().add(behind).add(new THREE.Vector3(0, 5, 0));
        lookAt = carPos.clone().add(carDir.multiplyScalar(10));
    }

    // Camera shake
    if (this.cameraShake > 0.01) {
      targetPos.x += (Math.random() - 0.5) * this.cameraShake;
      targetPos.y += (Math.random() - 0.5) * this.cameraShake;
      targetPos.z += (Math.random() - 0.5) * this.cameraShake;
    }

    // Speed-based FOV
    const speedRatio = Math.abs(this.carSpeed) / (this.currentCar.maxSpeed / 3.6);
    this.camera.fov = 75 + speedRatio * 15;
    this.camera.updateProjectionMatrix();

    // Smooth camera
    this.camera.position.lerp(targetPos, 5 * dt);
    
    const currentLookAt = new THREE.Vector3();
    this.camera.getWorldDirection(currentLookAt);
    const targetLookDir = lookAt.clone().sub(this.camera.position).normalize();
    currentLookAt.lerp(targetLookDir, 5 * dt);
    this.camera.lookAt(this.camera.position.clone().add(currentLookAt.multiplyScalar(10)));
  }

  private updateTraffic(dt: number) {
    this.trafficCars.forEach(car => {
      const speed = (car as any).speed;
      const dir = (car as any).direction as THREE.Vector3;
      car.position.add(dir.clone().multiplyScalar(speed * dt));

      // Wrap around
      if (car.position.z > 400) car.position.z = -400;
      if (car.position.z < -400) car.position.z = 400;
      if (car.position.x > 400) car.position.x = -400;
      if (car.position.x < -400) car.position.x = 400;
    });
  }

  private updateCheckpoints(time: number) {
    this.checkpoints.forEach((cp, i) => {
      cp.rotation.x = time * 2;
      const isActive = i === this.state.checkpoint;
      (cp.material as THREE.MeshBasicMaterial).color.setHex(isActive ? 0x00ff88 : 0x444444);
      (cp.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.7 : 0.3;
      cp.scale.setScalar(isActive ? 1 + Math.sin(time * 5) * 0.2 : 0.8);
    });
  }

  private updateWeather(dt: number) {
    if (this.weather === 'rain' && !this.rainParticles) {
      this.createRain();
    }
    if (this.rainParticles) {
      const positions = this.rainParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 50 * dt;
        if (positions[i + 1] < 0) {
          positions[i + 1] = 100;
          positions[i] = this.car.position.x + (Math.random() - 0.5) * 200;
          positions[i + 2] = this.car.position.z + (Math.random() - 0.5) * 200;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
      this.rainParticles.position.set(0, 0, 0);
    }

    if (this.weather === 'fog') {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.005;
      }
    } else {
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.001;
      }
    }
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const time = this.clock.getElapsedTime();

    this.updatePhysics(dt);
    this.updateCamera(dt);
    this.updateTraffic(dt);
    this.updateCheckpoints(time);
    this.updateWeather(dt);
    this.updateAudio();

    this.renderer.render(this.scene, this.camera);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Public methods
  setGameMode(mode: 'freeroam' | 'race' | 'timetrial' | 'police') {
    this.state.gameMode = mode;
    this.state.time = 0;
    this.state.lap = 1;
    this.state.checkpoint = 0;
    this.state.score = 0;
    this.onStateChange({ ...this.state });
  }

  setWeather(weather: 'sunny' | 'cloudy' | 'rain' | 'fog') {
    this.weather = weather;
    this.state.weather = weather;
    
    if (weather === 'rain' || weather === 'cloudy') {
      this.scene.background = new THREE.Color(0x444455);
    }
    
    if (weather !== 'rain' && this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles = null;
    }
    
    this.onStateChange({ ...this.state });
  }

  setCarColor(color: number) {
    this.carColor = color;
    (this.carBody.material as THREE.MeshStandardMaterial).color.setHex(color);
  }

  pause() {
    this.state.isPaused = true;
    this.onStateChange({ ...this.state });
  }

  resume() {
    this.state.isPaused = false;
    this.onStateChange({ ...this.state });
  }

  getState(): GameState {
    return { ...this.state };
  }

  getCarPosition(): THREE.Vector3 {
    return this.car.position.clone();
  }

  getCarRotation(): number {
    return this.car.rotation.y;
  }

  getCheckpointPositions(): { x: number; z: number }[] {
    return this.checkpoints.map(cp => ({ x: cp.position.x, z: cp.position.z }));
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.engineOsc) this.engineOsc.stop();
    if (this.audioCtx) this.audioCtx.close();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
