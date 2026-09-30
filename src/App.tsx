import { useState, useEffect, useRef, useCallback } from 'react';
import { GameEngine, GameState, CARS } from './game/GameEngine';

type Screen = 'loading' | 'menu' | 'playing' | 'garage' | 'settings' | 'pause' | 'controls' | 'map' | 'raceSelect';

function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  
  // Auto-transition from loading to menu
  useEffect(() => {
    if (screen === 'loading') {
      const timer = setTimeout(() => setScreen('menu'), 2500);
      return () => clearTimeout(timer);
    }
  }, [screen]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCar, setSelectedCar] = useState(0);
  const [carColor, setCarColor] = useState(0xff2200);
  const [money, setMoney] = useState(10000);
  const [ownedCars, setOwnedCars] = useState<number[]>([0]);
  const [upgrades, setUpgrades] = useState({ engine: 0, brakes: 0, accel: 0, handling: 0, nitro: 0 });
  const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rain' | 'fog'>('sunny');
  const [gameMode, setGameMode] = useState<'freeroam' | 'race' | 'timetrial' | 'police'>('freeroam');
  const [showNotification, setShowNotification] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [screenFlash, setScreenFlash] = useState('');
  const prevCheckpoint = useRef(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const handleStateChange = useCallback((state: GameState) => {
    setGameState(state);
    setMoney(state.money);
    
    // Checkpoint flash effect
    if (state.checkpoint !== prevCheckpoint.current) {
      prevCheckpoint.current = state.checkpoint;
      setScreenFlash('rgba(0, 255, 136, 0.5)');
      setTimeout(() => setScreenFlash(''), 300);
      showNotif(`✅ Checkpoint! +$50`);
    }
  }, []);

  const startGame = useCallback((mode: 'freeroam' | 'race' | 'timetrial' | 'police') => {
    setGameMode(mode);
    setScreen('playing');
    setShowGuide(true);
    setTimeout(() => setShowGuide(false), 5000);
    
    setTimeout(() => {
      if (containerRef.current && !engineRef.current) {
        engineRef.current = new GameEngine(containerRef.current, handleStateChange, selectedCar);
        engineRef.current.setGameMode(mode);
        engineRef.current.setWeather(weather);
        engineRef.current.setCarColor(carColor);
      }
    }, 100);
  }, [selectedCar, weather, carColor, handleStateChange]);

  // Initialize audio on first user interaction
  useEffect(() => {
    const initAudio = () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume();
      ctx.close();
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    document.addEventListener('click', initAudio);
    document.addEventListener('keydown', initAudio);
    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  const returnToMenu = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.destroy();
      engineRef.current = null;
    }
    setScreen('menu');
    setGameState(null);
  }, []);

  const buyCar = (index: number) => {
    const car = CARS[index];
    if (money >= car.price && !ownedCars.includes(index)) {
      setMoney(m => m - car.price);
      setOwnedCars(o => [...o, index]);
      setSelectedCar(index);
      setCarColor(car.color);
      showNotif(`${car.name} purchased!`);
    }
  };

  const showNotif = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(''), 3000);
  };

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  // Loading Screen
  if (screen === 'loading') {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center">
        <div className="relative">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-yellow-500 animate-pulse">
            ULTIMATE
          </h1>
          <h2 className="text-3xl font-bold text-white text-center mt-2">STREET RACER</h2>
        </div>
        <div className="mt-12 w-64">
          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-yellow-500 rounded-full animate-loading-bar"></div>
          </div>
          <p className="text-gray-500 text-center mt-4 text-sm animate-pulse">Loading assets...</p>
        </div>
        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
          }
          .animate-loading-bar {
            animation: loading-bar 2.2s ease-in-out forwards;
          }
        `}</style>
      </div>
    );
  }

  // Main Menu
  if (screen === 'menu') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse top-10 left-10"></div>
          <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse bottom-10 right-10"></div>
          <div className="absolute w-64 h-64 bg-purple-600/10 rounded-full blur-3xl animate-pulse top-1/2 left-1/2"></div>
          {/* Road lines animation */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-gray-800/50 to-transparent"></div>
          {Array.from({length: 30}).map((_, i) => (
            <div key={i} className="absolute w-1 bg-yellow-400/20" 
              style={{ 
                left: `${3 + i * 3.2}%`, 
                bottom: '5%', 
                height: `${10 + Math.random() * 20}px`,
                animation: `roadLine ${1 + Math.random()}s linear infinite`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
          {/* Floating particles */}
          {Array.from({length: 15}).map((_, i) => (
            <div key={`p${i}`} className="absolute w-1 h-1 bg-red-400/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`
              }}
            />
          ))}
          <style>{`
            @keyframes roadLine {
              0% { transform: translateY(0) scaleY(1); opacity: 0.3; }
              50% { transform: translateY(-30px) scaleY(1.5); opacity: 0.6; }
              100% { transform: translateY(-60px) scaleY(1); opacity: 0; }
            }
            @keyframes float {
              0%, 100% { transform: translate(0, 0); opacity: 0.3; }
              25% { transform: translate(10px, -20px); opacity: 0.6; }
              50% { transform: translate(-5px, -40px); opacity: 0.4; }
              75% { transform: translate(15px, -20px); opacity: 0.5; }
            }
          `}</style>
        </div>

        {/* Title */}
        <div className="relative z-10 text-center mb-12">
          <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-yellow-500 tracking-wider mb-2 drop-shadow-2xl">
            ULTIMATE
          </h1>
          <h2 className="text-5xl font-bold text-white tracking-widest">
            STREET RACER
          </h2>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-red-500"></div>
            <span className="text-red-400 text-sm tracking-widest">🏎️ HIGH OCTANE RACING 🏎️</span>
            <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-red-500"></div>
          </div>
        </div>

        {/* Menu buttons */}
        <div className="relative z-10 flex flex-col gap-4 w-80">
          <MenuButton onClick={() => startGame('freeroam')} icon="🌆" label="FREE ROAM" sub="Explore the city" />
          <MenuButton onClick={() => setScreen('raceSelect')} icon="🏁" label="RACE MODE" sub="Checkpoints & laps" />
          <MenuButton onClick={() => startGame('timetrial')} icon="⏱️" label="TIME TRIAL" sub="Beat the clock" />
          <MenuButton onClick={() => startGame('police')} icon="🚔" label="POLICE CHASE" sub="Evade the cops" />
          <div className="h-4"></div>
          <MenuButton onClick={() => setScreen('garage')} icon="🔧" label="GARAGE" sub={`$${money.toLocaleString()}`} />
          <MenuButton onClick={() => setScreen('settings')} icon="⚙️" label="SETTINGS" sub="Graphics & audio" />
          <MenuButton onClick={() => setScreen('controls')} icon="🎮" label="CONTROLS" sub="Keyboard bindings" />
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-gray-500 text-sm">
          v1.0 | Built with Three.js | © 2024 Ultimate Street Racer
        </div>
      </div>
    );
  }

  // Race Select
  if (screen === 'raceSelect') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold text-white mb-8">SELECT RACE</h2>
        <div className="grid grid-cols-2 gap-6 max-w-2xl">
          <RaceCard name="Downtown Sprint" distance="5 km" reward="$500" onClick={() => startGame('race')} />
          <RaceCard name="Highway Blitz" distance="10 km" reward="$1000" onClick={() => startGame('race')} />
          <RaceCard name="Mountain Pass" distance="8 km" reward="$800" onClick={() => startGame('race')} />
          <RaceCard name="Night Circuit" distance="3 km" reward="$400" onClick={() => startGame('race')} />
          <RaceCard name="Airport Run" distance="6 km" reward="$600" onClick={() => startGame('race')} />
          <RaceCard name="Industrial Rush" distance="7 km" reward="$700" onClick={() => startGame('race')} />
        </div>
        <button onClick={() => setScreen('menu')} className="mt-8 px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Controls Screen
  if (screen === 'controls') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold text-white mb-8">CONTROLS</h2>
        <div className="grid grid-cols-2 gap-4 max-w-lg text-white">
          {[
            ['W', 'Accelerate'],
            ['S', 'Brake / Reverse'],
            ['A', 'Steer Left'],
            ['D', 'Steer Right'],
            ['Space', 'Handbrake / Drift'],
            ['Shift', 'Nitro Boost'],
            ['R', 'Reset Car'],
            ['C', 'Change Camera'],
            ['ESC', 'Pause Menu'],
          ].map(([key, action]) => (
            <div key={key} className="flex items-center gap-4 bg-gray-800/50 rounded-lg p-3">
              <kbd className="px-3 py-1 bg-gray-700 rounded font-mono text-yellow-400 min-w-[60px] text-center">{key}</kbd>
              <span className="text-gray-300">{action}</span>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen('menu')} className="mt-8 px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Settings Screen
  if (screen === 'settings') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center">
        <h2 className="text-4xl font-bold text-white mb-8">SETTINGS</h2>
        <div className="bg-gray-800/50 rounded-xl p-8 w-96 space-y-6">
          <div>
            <label className="text-white block mb-2">Weather</label>
            <div className="grid grid-cols-4 gap-2">
              {(['sunny', 'cloudy', 'rain', 'fog'] as const).map(w => (
                <button key={w} onClick={() => setWeather(w)}
                  className={`px-3 py-2 rounded text-sm font-bold transition ${weather === w ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                  {w === 'sunny' ? '☀️' : w === 'cloudy' ? '☁️' : w === 'rain' ? '🌧️' : '🌫️'} {w}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white block mb-2">Graphics Quality</label>
            <select className="w-full bg-gray-700 text-white rounded p-2">
              <option>Ultra</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
          <div>
            <label className="text-white block mb-2">Master Volume</label>
            <input type="range" min="0" max="100" defaultValue="70" className="w-full" />
          </div>
          <div>
            <label className="text-white block mb-2">Music Volume</label>
            <input type="range" min="0" max="100" defaultValue="50" className="w-full" />
          </div>
          <div>
            <label className="text-white block mb-2">SFX Volume</label>
            <input type="range" min="0" max="100" defaultValue="80" className="w-full" />
          </div>
        </div>
        <button onClick={() => setScreen('menu')} className="mt-8 px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Garage Screen
  if (screen === 'garage') {
    return (
      <div className="w-full h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center overflow-y-auto py-8">
        <h2 className="text-4xl font-bold text-white mb-2">🔧 GARAGE</h2>
        <p className="text-yellow-400 mb-6 text-lg">Balance: ${money.toLocaleString()}</p>
        
        {/* Car Selection */}
        <div className="grid grid-cols-3 gap-4 max-w-4xl mb-8">
          {CARS.map((car, i) => (
            <div key={i} className={`bg-gray-800/80 rounded-xl p-4 border-2 transition cursor-pointer ${
              selectedCar === i ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-gray-700 hover:border-gray-500'
            } ${!ownedCars.includes(i) ? 'opacity-60' : ''}`}
            onClick={() => ownedCars.includes(i) ? (setSelectedCar(i), setCarColor(car.color)) : buyCar(i)}>
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {car.bodyStyle === 'sports' ? '🏎️' : car.bodyStyle === 'supercar' ? '🚗' : car.bodyStyle === 'muscle' ? '🚙' : car.bodyStyle === 'drift' ? '🏁' : car.bodyStyle === 'hypercar' ? '⚡' : '🛻'}
                </div>
                <h3 className="text-white font-bold">{car.name}</h3>
                <p className="text-gray-400 text-sm capitalize">{car.bodyStyle}</p>
                <div className="mt-2 space-y-1 text-xs">
                  <StatBar label="Speed" value={car.maxSpeed / 400} color="bg-red-500" />
                  <StatBar label="Accel" value={car.acceleration} color="bg-blue-500" />
                  <StatBar label="Handle" value={car.handling} color="bg-green-500" />
                  <StatBar label="Brake" value={car.braking} color="bg-yellow-500" />
                </div>
                {ownedCars.includes(i) ? (
                  <span className="text-green-400 text-xs mt-2 block">✓ Owned</span>
                ) : (
                  <span className="text-yellow-400 text-xs mt-2 block">${car.price.toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Color Selection */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 w-full max-w-4xl">
          <h3 className="text-white font-bold mb-4">Paint Color</h3>
          <div className="flex flex-wrap gap-3">
            {[0xff2200, 0x0044ff, 0x00ff44, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800, 0xffffff, 0x111111, 0x8800ff, 0xff0088, 0x008844].map(color => (
              <button key={color} onClick={() => setCarColor(color)}
                className={`w-10 h-10 rounded-full border-2 transition ${carColor === color ? 'border-white scale-125' : 'border-gray-600 hover:scale-110'}`}
                style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}
              />
            ))}
          </div>
        </div>

        {/* Upgrades */}
        <div className="bg-gray-800/50 rounded-xl p-6 mb-6 w-full max-w-4xl">
          <h3 className="text-white font-bold mb-4">Upgrades</h3>
          <div className="grid grid-cols-5 gap-4">
            {[
              { key: 'engine', label: 'Engine', icon: '⚙️', cost: 5000 },
              { key: 'brakes', label: 'Brakes', icon: '🛑', cost: 3000 },
              { key: 'accel', label: 'Accel', icon: '🚀', cost: 4000 },
              { key: 'handling', label: 'Handling', icon: '🎯', cost: 3500 },
              { key: 'nitro', label: 'Nitro', icon: '💨', cost: 4500 },
            ].map(upg => (
              <div key={upg.key} className="bg-gray-900/50 rounded-lg p-3 text-center">
                <div className="text-2xl mb-1">{upg.icon}</div>
                <div className="text-white text-sm font-bold">{upg.label}</div>
                <div className="text-yellow-400 text-xs mb-2">Lvl {(upgrades as any)[upg.key]}/5</div>
                <button onClick={() => {
                  if (money >= upg.cost && (upgrades as any)[upg.key] < 5) {
                    setMoney(m => m - upg.cost);
                    setUpgrades(u => ({ ...u, [upg.key]: (u as any)[upg.key] + 1 }));
                    showNotif(`${upg.label} upgraded!`);
                  }
                }} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded font-bold transition">
                  ${upg.cost.toLocaleString()}
                </button>
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => setScreen('menu')} className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition">
          ← Back to Menu
        </button>
      </div>
    );
  }

  // Game Playing / Pause
  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Start Guide */}
      {showGuide && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl p-8 border border-gray-600 max-w-md animate-slide-in pointer-events-auto">
            <h3 className="text-2xl font-bold text-white text-center mb-4">🏎️ Ready to Race!</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">W</kbd> Accelerate
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">S</kbd> Brake
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">A/D</kbd> Steer
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">Space</kbd> Drift
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">Shift</kbd> Nitro
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">C</kbd> Camera
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">R</kbd> Reset
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <kbd className="px-2 py-0.5 bg-gray-700 rounded text-yellow-400 font-mono">ESC</kbd> Pause
              </div>
            </div>
            <p className="text-center text-gray-400 text-xs mt-4">Drive through green checkpoints to earn points!</p>
            <button onClick={() => setShowGuide(false)} className="mt-4 w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition">
              GOT IT!
            </button>
          </div>
        </div>
      )}

      {/* Notification */}
      {showNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-600/90 text-white px-6 py-2 rounded-lg font-bold animate-bounce z-50">
          {showNotification}
        </div>
      )}

      {/* HUD */}
      {gameState && screen === 'playing' && (
        <>
          {/* Speed & RPM - Circular Gauge */}
          <div className="absolute bottom-6 right-6 z-40">
            <div className="bg-black/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-700">
              {/* Circular Speedometer */}
              <div className="relative w-40 h-40 mx-auto">
                <svg viewBox="0 0 120 120" className="w-full h-full">
                  {/* Background arc */}
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#222" strokeWidth="8" 
                    strokeDasharray="245 327" strokeDashoffset="-41" strokeLinecap="round" />
                  {/* Speed arc */}
                  <circle cx="60" cy="60" r="52" fill="none" 
                    stroke={gameState.speed > 250 ? '#ff0000' : gameState.speed > 150 ? '#ff8800' : '#00ff88'} 
                    strokeWidth="8" 
                    strokeDasharray={`${(gameState.speed / 380) * 245} 327`} 
                    strokeDashoffset="-41" strokeLinecap="round"
                    className="transition-all duration-150" />
                  {/* Tick marks */}
                  {Array.from({length: 9}).map((_, i) => {
                    const angle = -225 + i * (270 / 8);
                    const rad = angle * Math.PI / 180;
                    const x1 = 60 + Math.cos(rad) * 44;
                    const y1 = 60 + Math.sin(rad) * 44;
                    const x2 = 60 + Math.cos(rad) * 48;
                    const y2 = 60 + Math.sin(rad) * 48;
                    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#666" strokeWidth="1.5" />;
                  })}
                </svg>
                {/* Center display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-black text-white">{gameState.speed}</div>
                  <div className="text-gray-400 text-xs font-bold">KM/H</div>
                </div>
              </div>
              {/* RPM Bar */}
              <div className="mt-2 w-44 mx-auto">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>RPM</span>
                  <span className={gameState.rpm > 6500 ? 'text-red-400' : ''}>{gameState.rpm}</span>
                </div>
                <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-75"
                    style={{ 
                      width: `${(gameState.rpm / 8000) * 100}%`,
                      background: `linear-gradient(90deg, #00ff44 0%, #ffaa00 60%, #ff0000 85%)`
                    }}></div>
                </div>
              </div>
              {/* Gear */}
              <div className="mt-2 flex items-center justify-center gap-3">
                <div className="flex gap-1">
                  {[1,2,3,4,5,6].map(g => (
                    <div key={g} className={`w-5 h-5 rounded text-xs font-bold flex items-center justify-center ${
                      g === gameState.gear ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-500'
                    }`}>{g}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Nitro */}
          <div className="absolute bottom-6 left-6 z-40">
            <div className="bg-black/70 backdrop-blur-sm rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400 text-sm font-bold">💨 NITRO</span>
                <span className="text-white text-sm">{gameState.nitro}%</span>
              </div>
              <div className="w-40 h-4 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200"
                  style={{ 
                    width: `${gameState.nitro}%`,
                    background: `linear-gradient(90deg, #0066ff, #00ccff)`
                  }}></div>
              </div>
              {/* Score */}
              <div className="mt-3 text-center">
                <div className="text-yellow-400 font-bold text-lg">${gameState.money.toLocaleString()}</div>
                <div className="text-gray-400 text-xs">Score: {gameState.score}</div>
              </div>
            </div>
          </div>

          {/* Top HUD - Mode & Time */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
            <div className="bg-black/70 backdrop-blur-sm rounded-lg px-6 py-2 border border-gray-700 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏁</span>
                <span className="text-white font-bold capitalize text-sm">{gameState.gameMode}</span>
              </div>
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">LAP</span>
                <span className="text-white font-bold">{gameState.lap}</span>
              </div>
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs">CP</span>
                <span className="text-green-400 font-bold">{gameState.checkpoint}/{gameState.totalCheckpoints}</span>
              </div>
              <span className="text-gray-600">|</span>
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <span className="text-yellow-400 font-mono font-bold">{formatTime(gameState.time)}</span>
              </div>
              <span className="text-gray-600">|</span>
              <span className="text-lg">{gameState.weather === 'sunny' ? '☀️' : gameState.weather === 'cloudy' ? '☁️' : gameState.weather === 'rain' ? '🌧️' : '🌫️'}</span>
            </div>
          </div>

          {/* Mini-map & Compass */}
          <div className="absolute top-14 right-4 z-40 flex flex-col items-center gap-2">
            {/* Compass */}
            <div className="bg-black/70 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center border border-gray-700">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-4 bg-red-500 absolute" style={{ 
                    transform: `rotate(${gameState ? -(engineRef.current?.getCarRotation() || 0) * (180/Math.PI) : 0}deg)`,
                    transformOrigin: 'bottom center',
                    bottom: '50%'
                  }}></div>
                </div>
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-red-400 text-[8px] font-bold">N</span>
              </div>
            </div>
            <MiniMap engine={engineRef.current} />
          </div>

          {/* Camera mode indicator */}
          <div className="absolute top-4 left-4 z-40">
            <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 border border-gray-700">
              <span className="text-gray-400 text-xs">Camera: </span>
              <span className="text-white text-xs font-bold capitalize">{gameState.cameraMode}</span>
            </div>
          </div>

          {/* Wanted Level (Police Mode) */}
          {gameState.gameMode === 'police' && gameState.wantedLevel > 0 && (
            <div className="absolute top-16 left-4 z-40">
              <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-red-700">
                <div className="text-red-400 text-xs font-bold mb-1">WANTED</div>
                <div className="flex gap-1">
                  {Array.from({length: 5}).map((_, i) => (
                    <span key={i} className={`text-lg ${i < Math.floor(gameState.wantedLevel) ? 'text-red-500' : 'text-gray-600'}`}>★</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Drift indicator */}
          {gameState.speed > 50 && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="text-orange-400 font-black text-2xl animate-pulse opacity-70">
                {gameState.nitro < 100 ? '🔥 DRIFTING' : ''}
              </div>
            </div>
          )}

          {/* Speed warning at high speed */}
          {gameState.speed > 250 && (
            <div className="absolute bottom-44 right-6 z-40 pointer-events-none">
              <div className="text-red-500 font-bold text-sm animate-pulse">⚠️ HIGH SPEED</div>
            </div>
          )}

          {/* Speed lines effect */}
          {gameState.speed > 150 && (
            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
              {Array.from({length: Math.floor((gameState.speed - 150) / 20)}).map((_, i) => (
                <div key={i} className="absolute bg-white/10 rounded-full"
                  style={{
                    width: '2px',
                    height: `${20 + Math.random() * 40}px`,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    transform: `rotate(${Math.random() * 20 - 10}deg)`,
                    opacity: 0.1 + Math.random() * 0.2,
                    animation: `speedLine ${0.3 + Math.random() * 0.5}s linear infinite`
                  }}
                />
              ))}
              <style>{`
                @keyframes speedLine {
                  from { transform: translateY(-100vh); }
                  to { transform: translateY(100vh); }
                }
              `}</style>
            </div>
          )}

          {/* Vignette effect */}
          <div className="absolute inset-0 pointer-events-none z-20"
            style={{ 
              background: `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,${0.2 + (gameState.speed / 380) * 0.3}) 100%)`
            }}
          />

          {/* Screen flash on checkpoint/collision */}
          {screenFlash && (
            <div className="absolute inset-0 pointer-events-none z-30 animate-pulse"
              style={{ background: screenFlash, opacity: 0.3 }}
            />
          )}
        </>
      )}

      {/* Pause Menu */}
      {gameState?.isPaused && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-900/90 rounded-2xl p-8 border border-gray-700 text-center">
            <h2 className="text-4xl font-bold text-white mb-8">PAUSED</h2>
            <div className="flex flex-col gap-4">
              <button onClick={() => engineRef.current?.resume()} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition text-lg">
                ▶ Resume
              </button>
              <button onClick={() => { engineRef.current?.setWeather('sunny'); }} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition">
                ☀️ Set Sunny
              </button>
              <button onClick={() => { engineRef.current?.setWeather('rain'); }} className="px-8 py-3 bg-blue-800 hover:bg-blue-700 text-white rounded-lg font-bold transition">
                🌧️ Set Rain
              </button>
              <button onClick={() => { engineRef.current?.setWeather('fog'); }} className="px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-bold transition">
                🌫️ Set Fog
              </button>
              <button onClick={returnToMenu} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition">
                🏠 Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Components
function MenuButton({ onClick, icon, label, sub }: { onClick: () => void; icon: string; label: string; sub: string }) {
  return (
    <button onClick={onClick} className="group relative bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 hover:border-red-500/50 rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10">
      <div className="flex items-center gap-4">
        <span className="text-3xl">{icon}</span>
        <div>
          <div className="text-white font-bold text-lg group-hover:text-red-400 transition">{label}</div>
          <div className="text-gray-400 text-sm">{sub}</div>
        </div>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 group-hover:text-red-400 transition">→</div>
    </button>
  );
}

function RaceCard({ name, distance, reward, onClick }: { name: string; distance: string; reward: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 hover:border-yellow-500/50 rounded-xl p-6 text-left transition-all hover:scale-[1.02]">
      <h3 className="text-white font-bold text-xl mb-2">{name}</h3>
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">📏 {distance}</span>
        <span className="text-yellow-400">💰 {reward}</span>
      </div>
    </button>
  );
}

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 w-12 text-left">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }}></div>
      </div>
    </div>
  );
}

function MiniMap({ engine }: { engine: GameEngine | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!engine) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const interval = setInterval(() => {
      const carPos = engine.getCarPosition();
      const carRot = engine.getCarRotation();
      const checkpoints = engine.getCheckpointPositions();
      
      const scale = 0.15;
      const cx = 75, cy = 75;

      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, 150, 150);

      // Draw roads
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 3;
      for (let x = -300; x <= 300; x += 150) {
        const sx = cx + (x - carPos.x) * scale;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, 150);
        ctx.stroke();
      }
      for (let z = -300; z <= 300; z += 150) {
        const sy = cy + (z - carPos.z) * scale;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(150, sy);
        ctx.stroke();
      }

      // Draw checkpoints
      checkpoints.forEach((cp, i) => {
        const state = engine.getState();
        const sx = cx + (cp.x - carPos.x) * scale;
        const sy = cy + (cp.z - carPos.z) * scale;
        if (sx >= 0 && sx <= 150 && sy >= 0 && sy <= 150) {
          ctx.fillStyle = i === state.checkpoint ? '#00ff88' : '#444';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw car (center)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-carRot);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Border
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 150, 150);
    }, 100);

    return () => clearInterval(interval);
  }, [engine]);

  return (
    <canvas ref={canvasRef} width={150} height={150} className="rounded-lg border border-gray-700" />
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default App;
