import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Line, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Packet } from '../types';
import { ArrowRight, X, Check, Send as SendIcon } from 'lucide-react';

// --- Constants ---
const SENDER_POS = new THREE.Vector3(-6, 0, 0);
const RECEIVER_POS = new THREE.Vector3(6, 0, 0);
const PATH_HEIGHT = 1;

// --- Helper Components ---

const ConnectionLine = () => {
  return (
    <group>
        {/* Main Pipe */}
      <Line
        points={[SENDER_POS, RECEIVER_POS]}
        color="#334155"
        lineWidth={4}
        dashed={false}
      />
      {/* Direction Arrows (Decorative) */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
         <coneGeometry args={[0.2, 0.5, 8]} />
         <meshStandardMaterial color="#475569" />
      </mesh>
      <Text position={[0, -0.5, 0]} fontSize={0.3} color="#64748b">
        Mạng (Network Channel)
      </Text>
    </group>
  );
};

const BufferVisualizer = ({ 
  position, 
  label, 
  size, 
  windowStart, 
  windowSize, 
  highlightIndex 
}: { 
  position: THREE.Vector3; 
  label: string; 
  size: number; 
  windowStart: number; 
  windowSize: number;
  highlightIndex?: number;
}) => {
  const cellSize = 0.8;
  const gap = 0.1;
  const rowWidth = size * (cellSize + gap);
  
  return (
    <group position={position}>
      <Text position={[0, 2.5, 0]} fontSize={0.5} color="white" anchorX="center">
        {label}
      </Text>
      
      {/* Base Buffer Grid */}
      <group position={[-(rowWidth / 2) + cellSize/2, 1.5, 0]}>
        {Array.from({ length: size }).map((_, i) => {
          const isAcked = i < windowStart;
          const inWindow = i >= windowStart && i < windowStart + windowSize;
          const isHighlight = i === highlightIndex;

          let color = "#1e293b"; // Default dark
          if (isAcked) color = "#10b981"; // Green (Done)
          if (inWindow) color = "#3b82f6"; // Blue (Active Window)
          if (isHighlight) color = "#f59e0b"; // Orange (Current Action)

          return (
            <group key={i} position={[i * (cellSize + gap), 0, 0]}>
              <RoundedBox args={[cellSize, cellSize, 0.2]} radius={0.1}>
                <meshStandardMaterial color={color} transparent opacity={0.8} />
              </RoundedBox>
              <Text position={[0, 0, 0.11]} fontSize={0.3} color="white">
                {i}
              </Text>
              
              {/* Window Frame */}
              {inWindow && (
                <mesh position={[0, 0, -0.05]}>
                   <boxGeometry args={[cellSize + 0.05, cellSize + 0.05, 0.1]} />
                   <meshBasicMaterial color="#60a5fa" wireframe />
                </mesh>
              )}
            </group>
          );
        })}
      </group>

      {/* Sliding Window Bracket Visual */}
      <group position={[-(rowWidth / 2) + cellSize/2, 1.5, 0]}>
         {/* A simplified visual bracket showing the window range */}
         <Line 
            points={[
                [(windowStart) * (cellSize + gap) - cellSize/2, -cellSize/1.5, 0],
                [(windowStart + windowSize) * (cellSize + gap) - cellSize/2 - gap, -cellSize/1.5, 0]
            ]}
            color="#fbbf24"
            lineWidth={3}
         />
         <Text 
            position={[((windowStart + windowSize/2) - 0.5) * (cellSize + gap), -1.2, 0]} 
            fontSize={0.25} 
            color="#fbbf24"
         >
            Window
         </Text>
      </group>
    </group>
  );
};

const PacketObj: React.FC<{ packet: Packet }> = ({ packet }) => {
    // Lerp position based on progress
    const start = packet.from === 'SENDER' ? SENDER_POS : RECEIVER_POS;
    const end = packet.to === 'SENDER' ? SENDER_POS : RECEIVER_POS;
    
    // Calculate current position
    const x = THREE.MathUtils.lerp(start.x, end.x, packet.progress);
    // Add a little arc
    const y = Math.sin(packet.progress * Math.PI) * 2;
    
    const isLost = packet.status === 'LOST';
    const baseColor = packet.type === 'DATA' ? '#3b82f6' : '#10b981'; // Blue for Data, Green for Ack
    const color = isLost ? '#ef4444' : baseColor;

    if (isLost && packet.progress > 0.5) {
        // Disappear animation or turn red
        return null;
    }

    // Determine Status Visuals
    let StatusIcon = ArrowRight;
    let statusText = "Flying";
    let statusColorClass = packet.type === 'DATA' ? 'bg-blue-600' : 'bg-green-600';

    if (isLost) {
        StatusIcon = X;
        statusText = "Lost";
        statusColorClass = "bg-red-600";
    } else if (packet.progress < 0.1) {
        StatusIcon = SendIcon;
        statusText = "Sent";
    } else if (packet.progress > 0.9) {
        StatusIcon = Check;
        statusText = "Arriving";
    }

    return (
        <group position={[x, y, 0]}>
            <mesh>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial 
                    color={color} 
                    emissive={color} 
                    emissiveIntensity={0.6} 
                />
            </mesh>
            
            {/* Status Light Indicator on top of box */}
            <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial color={isLost ? '#ff0000' : (packet.progress > 0.9 ? '#4ade80' : '#fbbf24')} />
            </mesh>

            <Html center position={[0, 0.8, 0]} zIndexRange={[100, 0]}>
                <div className={`
                    flex flex-col items-center
                    transition-all duration-200
                    ${isLost ? 'opacity-90 scale-110' : 'opacity-100'}
                `}>
                    <div className={`
                        flex items-center gap-1.5 px-2 py-1 rounded-full 
                        ${statusColorClass} 
                        text-white whitespace-nowrap shadow-xl border border-white/20
                    `}>
                        <StatusIcon size={14} strokeWidth={3} />
                        <span className="text-xs font-bold font-mono">
                            {packet.type} {packet.seqNum}
                        </span>
                    </div>
                    {/* Optional small status text tag */}
                    <div className="mt-1 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-[10px] text-white/90 font-medium uppercase tracking-wider">
                       {statusText}
                    </div>
                </div>
            </Html>
        </group>
    );
};

// --- Main Scene ---

interface SceneProps {
  senderBase: number;
  windowSize: number;
  receiverExpected: number;
  totalPackets: number;
  packets: Packet[];
}

export const SimulationScene: React.FC<SceneProps> = ({
  senderBase,
  windowSize,
  receiverExpected,
  totalPackets,
  packets
}) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      
      <OrbitControls enableZoom={true} enablePan={true} maxPolarAngle={Math.PI / 2} minPolarAngle={0} />

      {/* Connection */}
      <ConnectionLine />

      {/* Nodes */}
      <mesh position={SENDER_POS}>
        <cylinderGeometry args={[1, 1, 0.5, 32]} />
        <meshStandardMaterial color="#475569" />
        <Text position={[0, -1, 0]} fontSize={0.5} color="#94a3b8">Sender (Gửi)</Text>
      </mesh>
      
      <mesh position={RECEIVER_POS}>
        <cylinderGeometry args={[1, 1, 0.5, 32]} />
        <meshStandardMaterial color="#475569" />
        <Text position={[0, -1, 0]} fontSize={0.5} color="#94a3b8">Receiver (Nhận)</Text>
      </mesh>

      {/* Buffers */}
      <BufferVisualizer 
        position={new THREE.Vector3(SENDER_POS.x, 2, 0)} 
        label="Sender Buffer" 
        size={totalPackets} 
        windowStart={senderBase}
        windowSize={windowSize}
      />

      <BufferVisualizer 
        position={new THREE.Vector3(RECEIVER_POS.x, 2, 0)} 
        label="Receiver Buffer" 
        size={totalPackets} 
        windowStart={receiverExpected} 
        windowSize={1} // Go-Back-N essentially accepts 1 next expected
        highlightIndex={receiverExpected}
      />

      {/* Packets */}
      {packets.map(p => (
          <PacketObj key={p.id} packet={p} />
      ))}
      
      <gridHelper args={[40, 40, 0x1e293b, 0x1e293b]} position={[0, -2, 0]} />
    </>
  );
};
