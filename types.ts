export type PacketType = 'DATA' | 'ACK';

export interface Packet {
  id: string;
  type: PacketType;
  seqNum: number;
  from: 'SENDER' | 'RECEIVER';
  to: 'SENDER' | 'RECEIVER';
  progress: number; // 0 to 1
  status: 'IN_FLIGHT' | 'DELIVERED' | 'LOST';
  color: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface SimulationConfig {
  windowSize: number;
  packetSpeed: number; // units per second (abstract)
  autoPlay: boolean;
  totalPackets: number;
  timeoutDuration: number;
}
