import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Play, Pause, RefreshCw, Send, AlertTriangle, Settings, Zap, Info, CheckCircle, XCircle, HelpCircle, X as CloseIcon, BarChart3, Timer } from 'lucide-react';
import { SimulationScene } from './components/Simulation3D';
import { Packet, LogEntry, SimulationConfig } from './types';

// Constants
const SPEED_MULTIPLIER = 0.5; // Base speed

// --- Sub-components for UI ---

const Modal = ({ title, children, onClose }: { title: string, children?: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50 sticky top-0">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {title}
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <CloseIcon size={24} />
        </button>
      </div>
      <div className="p-6 text-slate-300 space-y-4">
        {children}
      </div>
      <div className="p-4 border-t border-slate-700 bg-slate-900/50 sticky bottom-0 text-right">
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  </div>
);

const GuideContent = () => (
  <div className="space-y-6">
    <section>
      <h3 className="text-lg font-semibold text-blue-400 mb-2 flex items-center gap-2">
        <Info size={20}/> Nguyên lý Sliding Window (Go-Back-N)
      </h3>
      <p className="leading-relaxed">
        Đây là kỹ thuật kiểm soát luồng dữ liệu, cho phép bên gửi (Sender) gửi nhiều gói tin liên tiếp mà không cần chờ xác nhận (ACK) cho từng gói, miễn là số lượng chưa xác nhận nằm trong giới hạn "Cửa sổ" (Window Size).
      </p>
    </section>

    <section className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
      <h3 className="text-lg font-semibold text-red-400 mb-2 flex items-center gap-2">
        <AlertTriangle size={20}/> Cơ chế Tự Động Sửa Lỗi (Auto Retransmit)
      </h3>
      <div className="space-y-3 text-slate-300">
        <p>Khi một gói tin bị mất (ví dụ gói số 2), hiện tượng sau sẽ xảy ra:</p>
        <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Sender vẫn tiếp tục gửi các gói tiếp theo (3, 4...) nếu còn chỗ trong cửa sổ.</li>
            <li>Receiver nhận được 3, 4 nhưng thấy thiếu 2 -> Receiver <strong>hủy bỏ</strong> 3, 4 và gửi lại ACK của gói 1 (gói đúng gần nhất).</li>
            <li>Sender chờ mãi không thấy ACK cho gói 2.</li>
            <li><strong>Timeout:</strong> Khi thanh thời gian chờ (Timer) đầy, Sender nhận ra gói 2 đã mất.</li>
            <li><strong>Gửi lại:</strong> Sender lùi lại và gửi lại toàn bộ từ gói số 2 trở đi.</li>
        </ol>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-4">
      <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
         <div className="flex items-center gap-2 font-semibold text-blue-400 mb-1">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span> Gói tin DATA
         </div>
         <p className="text-xs">Dữ liệu được gửi từ Sender sang Receiver.</p>
      </div>
      <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
         <div className="flex items-center gap-2 font-semibold text-green-400 mb-1">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Gói tin ACK
         </div>
         <p className="text-xs">Xác nhận đã nhận thành công, gửi từ Receiver về Sender.</p>
      </div>
      <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
         <div className="flex items-center gap-2 font-semibold text-red-400 mb-1">
            <XCircle size={14} /> Trạng thái LOST
         </div>
         <p className="text-xs">Mô phỏng rớt mạng, tắc nghẽn đường truyền.</p>
      </div>
      <div className="p-3 bg-slate-900/50 rounded border border-slate-700">
         <div className="flex items-center gap-2 font-semibold text-yellow-400 mb-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span> Cửa sổ (Window)
         </div>
         <p className="text-xs">Số lượng tối đa gói tin đang bay trên đường truyền.</p>
      </div>
    </div>
  </div>
);

const ResultContent = ({ stats, config, onReset }: { stats: { lost: number, retransmitted: number, totalSent: number }, config: SimulationConfig, onReset: () => void }) => {
  const efficiency = Math.round((config.totalPackets / (stats.totalSent || 1)) * 100);
  const isPerfect = stats.lost === 0;

  return (
    <div className="space-y-6">
       <div className="text-center py-4">
          <div className={`inline-flex p-4 rounded-full mb-4 ${isPerfect ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
             {isPerfect ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {isPerfect ? 'Truyền tải Hoàn hảo!' : 'Hoàn thành (Có sự cố)'}
          </h3>
          <p className="text-slate-400">
            Tất cả {config.totalPackets} gói dữ liệu đã được gửi và xác nhận thành công.
          </p>
       </div>

       <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-700/30 p-4 rounded-xl text-center border border-slate-600">
             <div className="text-3xl font-bold text-white mb-1">{stats.totalSent}</div>
             <div className="text-xs text-slate-400 uppercase font-semibold">Tổng gói đã gửi</div>
          </div>
          <div className="bg-slate-700/30 p-4 rounded-xl text-center border border-slate-600">
             <div className="text-3xl font-bold text-red-400 mb-1">{stats.lost}</div>
             <div className="text-xs text-slate-400 uppercase font-semibold">Gói bị mất</div>
          </div>
          <div className="bg-slate-700/30 p-4 rounded-xl text-center border border-slate-600">
             <div className="text-3xl font-bold text-blue-400 mb-1">{efficiency}%</div>
             <div className="text-xs text-slate-400 uppercase font-semibold">Hiệu suất</div>
          </div>
       </div>

       <div className="bg-slate-900/50 p-4 rounded-lg text-sm text-slate-300 border border-slate-700">
          <h4 className="font-semibold text-white mb-2">Phân tích kết quả:</h4>
          {isPerfect ? (
            <p className="text-green-300">
              Tuyệt vời! Đường truyền ổn định tuyệt đối. Không có gói tin nào bị mất, do đó giao thức đạt hiệu suất tối đa (100%).
            </p>
          ) : (
            <p>
              Quá trình truyền tải bị gián đoạn bởi <strong>{stats.lost} gói tin bị mất</strong>. 
              Điều này buộc giao thức Go-Back-N phải gửi lại các gói tin (Retransmission), làm tăng tổng số gói phải gửi lên {stats.totalSent}.
              <br/><br/>
              <span className="text-yellow-400">Kết luận:</span> Giao thức đã tự động phát hiện mất mát thông qua cơ chế <strong>Timeout</strong> và gửi lại dữ liệu thành công.
            </p>
          )}
       </div>
       
       <div className="flex justify-center pt-4">
          <button 
             onClick={onReset}
             className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
          >
             <RefreshCw size={20} /> Chạy Lại Mô Phỏng
          </button>
       </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [packets, setPackets] = useState<Packet[]>([]);
  const [senderBase, setSenderBase] = useState(0);
  const [nextSeqNum, setNextSeqNum] = useState(0);
  const [receiverExpected, setReceiverExpected] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timeoutProgress, setTimeoutProgress] = useState(0); // 0 to 100
  
  // Stats
  const [stats, setStats] = useState({
    lost: 0,
    retransmitted: 0,
    totalSent: 0
  });
  
  // Refs for animation loop logic
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const isFinishedRef = useRef(false);
  const timeoutStartRef = useRef<number | null>(null);

  // Config
  const [config, setConfig] = useState<SimulationConfig>({
    windowSize: 4,
    packetSpeed: 0.3, 
    autoPlay: false,
    totalPackets: 8,
    timeoutDuration: 4000 // 4 seconds timeout
  });

  // --- Logging Helper ---
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    };
    setLogs(prev => [...prev, entry].slice(-50));
  }, []);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Check for completion
  useEffect(() => {
    if (senderBase >= config.totalPackets && !isFinishedRef.current) {
        isFinishedRef.current = true;
        setIsPlaying(false);
        timeoutStartRef.current = null;
        setTimeoutProgress(0);
        addLog('Tất cả dữ liệu đã được truyền thành công!', 'success');
        setTimeout(() => setShowResults(true), 1000);
    }
  }, [senderBase, config.totalPackets, addLog]);

  // --- Logic for Timeout & Resend ---
  const triggerTimeoutResend = useCallback(() => {
    if (senderBase < config.totalPackets) {
        addLog(`TIMEOUT! Không nhận được ACK cho gói ${senderBase}. Gửi lại từ gói ${senderBase}.`, 'warning');
        setNextSeqNum(senderBase); // Rewind nextSeqNum back to base
        setStats(prev => ({...prev, retransmitted: prev.retransmitted + 1}));
        timeoutStartRef.current = Date.now(); // Reset timer
    }
  }, [senderBase, config.totalPackets, addLog]);

  // --- Core Protocol Logic ---

  const sendPacket = useCallback(() => {
    if (isFinishedRef.current) return false;

    if (nextSeqNum < senderBase + config.windowSize && nextSeqNum < config.totalPackets) {
      const newPacket: Packet = {
        id: `pkt-${nextSeqNum}-${Date.now()}`,
        type: 'DATA',
        seqNum: nextSeqNum,
        from: 'SENDER',
        to: 'RECEIVER',
        progress: 0,
        status: 'IN_FLIGHT',
        color: '#3b82f6'
      };
      
      setPackets(prev => [...prev, newPacket]);
      setNextSeqNum(prev => prev + 1);
      setStats(prev => ({ ...prev, totalSent: prev.totalSent + 1 }));
      addLog(`Sender: Đã gửi gói tin (Seq: ${nextSeqNum})`, 'info');
      
      // Start timer if this is the first packet in the window or timer not running
      if (senderBase === nextSeqNum || timeoutStartRef.current === null) {
         timeoutStartRef.current = Date.now();
      }

      return true;
    } else {
      // Window full logic is handled in the UI/Logs, return false implies "cannot send now"
      return false;
    }
  }, [nextSeqNum, senderBase, config.windowSize, config.totalPackets, addLog]);

  const killPacket = () => {
    // Kill a random in-flight packet
    setPackets(prev => {
        const inFlight = prev.filter(p => p.status === 'IN_FLIGHT' && p.type === 'DATA');
        if (inFlight.length === 0) return prev;
        
        const target = inFlight[Math.floor(Math.random() * inFlight.length)];
        addLog(`Mô phỏng: Gói tin DATA ${target.seqNum} bị mất trên đường truyền!`, 'error');
        setStats(s => ({ ...s, lost: s.lost + 1 }));
        
        return prev.map(p => p.id === target.id ? { ...p, status: 'LOST' } : p);
    });
  };

  const resetSimulation = () => {
    setPackets([]);
    setSenderBase(0);
    setNextSeqNum(0);
    setReceiverExpected(0);
    setLogs([]);
    setStats({ lost: 0, retransmitted: 0, totalSent: 0 });
    setIsPlaying(false);
    setShowResults(false);
    isFinishedRef.current = false;
    timeoutStartRef.current = null;
    setTimeoutProgress(0);
    addLog('Hệ thống đã được đặt lại.', 'info');
  };

  // --- Animation Loop ---
  const animate = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const deltaTime = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    if (!isPlaying) {
       requestRef.current = requestAnimationFrame(animate);
       return;
    }

    // --- Timeout Logic Check ---
    if (timeoutStartRef.current && !isFinishedRef.current) {
        const elapsed = Date.now() - timeoutStartRef.current;
        const progress = Math.min((elapsed / config.timeoutDuration) * 100, 100);
        setTimeoutProgress(progress);

        if (elapsed > config.timeoutDuration) {
            triggerTimeoutResend();
        }
    } else {
        setTimeoutProgress(0);
    }


    setPackets(currentPackets => {
      const nextPackets: Packet[] = [];
      
      currentPackets.forEach(p => {
        // Update progress
        let newProgress = p.progress + (config.packetSpeed * deltaTime);
        
        // Handle Lost Packet Logic (it just disappears midway or fades out)
        if (p.status === 'LOST') {
             if (newProgress > 0.6) return; // Remove from array
             nextPackets.push({...p, progress: newProgress});
             return;
        }

        if (newProgress >= 1) {
          // Packet Arrived
          
          if (p.to === 'RECEIVER' && p.type === 'DATA') {
            // Logic at Receiver
            if (p.seqNum === receiverExpected) {
              addLog(`Receiver: Nhận gói ${p.seqNum} đúng. Gửi ACK ${p.seqNum}.`, 'success');
              setReceiverExpected(prev => prev + 1); // Slide receiver window
              
              // Send ACK back
              const ackPacket: Packet = {
                id: `ack-${p.seqNum}-${Date.now()}`,
                type: 'ACK',
                seqNum: p.seqNum,
                from: 'RECEIVER',
                to: 'SENDER',
                progress: 0,
                status: 'IN_FLIGHT',
                color: '#10b981'
              };
              nextPackets.push(ackPacket);

            } else {
              addLog(`Receiver: Nhận gói ${p.seqNum} sai thứ tự (Chờ: ${receiverExpected}). Hủy bỏ.`, 'warning');
              // Optionally send ACK for last received correctly (Go-Back-N behavior)
              if (receiverExpected > 0) {
                 const reAck: Packet = {
                    id: `ack-${receiverExpected - 1}-${Date.now()}`,
                    type: 'ACK',
                    seqNum: receiverExpected - 1,
                    from: 'RECEIVER',
                    to: 'SENDER',
                    progress: 0,
                    status: 'IN_FLIGHT',
                    color: '#10b981'
                  };
                  nextPackets.push(reAck);
              }
            }
          } else if (p.to === 'SENDER' && p.type === 'ACK') {
            // Logic at Sender
            if (p.seqNum >= senderBase) {
                const newBase = p.seqNum + 1;
                if (newBase > senderBase) {
                    addLog(`Sender: Nhận ACK ${p.seqNum}. Cửa sổ trượt đến ${newBase}.`, 'success');
                    setSenderBase(newBase);
                    // Reset timer because window moved
                    if (newBase < config.totalPackets) {
                        timeoutStartRef.current = Date.now();
                    } else {
                        timeoutStartRef.current = null;
                    }
                }
            } else {
                addLog(`Sender: Nhận ACK trùng lặp ${p.seqNum}. Bỏ qua.`, 'info');
            }
          }

        } else {
          // Keep flying
          nextPackets.push({ ...p, progress: newProgress });
        }
      });

      return nextPackets;
    });

    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, config.packetSpeed, config.timeoutDuration, receiverExpected, senderBase, addLog, triggerTimeoutResend]); 

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // Auto-Send Logic if AutoPlay is on
  useEffect(() => {
    let interval: any;
    if (isPlaying && config.autoPlay && !isFinishedRef.current) {
      interval = setInterval(() => {
        // Only attempt to send if window is NOT full
        // We prevent "Infinite Loop" logs by checking logic here
        if (nextSeqNum < senderBase + config.windowSize) {
            sendPacket();
        }
      }, 1500); // Try to send every 1.5s
    }
    return () => clearInterval(interval);
  }, [isPlaying, config.autoPlay, sendPacket, nextSeqNum, senderBase, config.windowSize]);

  // Reset timer if we pause
  useEffect(() => {
      if (!isPlaying) {
          timeoutStartRef.current = null;
          setTimeoutProgress(0);
      } else if (senderBase < config.totalPackets && timeoutStartRef.current === null) {
          // Resume timer if playing and incomplete
          timeoutStartRef.current = Date.now();
      }
  }, [isPlaying]);


  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden flex flex-col">
      
      {/* 3D Viewport */}
      <div className="flex-1 relative z-0">
        <Canvas shadows camera={{ position: [0, 5, 15], fov: 45 }}>
          <color attach="background" args={['#0f172a']} />
          <fog attach="fog" args={['#0f172a', 10, 40]} />
          <SimulationScene 
            senderBase={senderBase}
            windowSize={config.windowSize}
            receiverExpected={receiverExpected}
            totalPackets={config.totalPackets}
            packets={packets}
          />
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex justify-between items-start z-10">
        {/* Header */}
        <div className="pointer-events-auto bg-slate-800/80 backdrop-blur p-4 rounded-xl border border-slate-700 shadow-xl max-w-md">
           <div className="flex justify-between items-start mb-2">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Zap className="text-yellow-400" size={24}/> 
                    Sliding Window Protocol
                </h1>
                <button 
                    onClick={() => setShowGuide(true)}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Hướng dẫn & Nguyên lý"
                >
                    <HelpCircle size={20} />
                </button>
           </div>
           
           <div className="flex flex-wrap gap-2 mb-4">
              <div className="bg-slate-700/50 px-3 py-1 rounded text-xs text-blue-300 border border-blue-500/20">
                Sender Base: <span className="font-mono text-white text-base">{senderBase}</span>
              </div>
              <div className="bg-slate-700/50 px-3 py-1 rounded text-xs text-blue-300 border border-blue-500/20">
                Next Seq: <span className="font-mono text-white text-base">{nextSeqNum}</span>
              </div>
              <div className="bg-slate-700/50 px-3 py-1 rounded text-xs text-green-300 border border-green-500/20">
                Receiver Expect: <span className="font-mono text-white text-base">{receiverExpected}</span>
              </div>
           </div>

           {/* Timeout Bar */}
           <div className="mb-4">
               <div className="flex justify-between text-xs text-slate-400 mb-1">
                   <span className="flex items-center gap-1"><Timer size={12}/> Timeout Timer (Gói {senderBase})</span>
                   <span>{(config.timeoutDuration / 1000).toFixed(1)}s</span>
               </div>
               <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                   <div 
                        className={`h-full transition-all duration-100 ease-linear ${timeoutProgress > 80 ? 'bg-red-500' : 'bg-yellow-500'}`}
                        style={{ width: `${timeoutProgress}%` }}
                   />
               </div>
           </div>

           <div className="flex gap-2">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={isFinishedRef.current}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded font-semibold transition-colors disabled:opacity-50 ${isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {isPlaying ? <><Pause size={18}/> Dừng</> : <><Play size={18}/> Bắt Đầu</>}
              </button>
              <button 
                onClick={resetSimulation}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                title="Reset"
              >
                <RefreshCw size={18} />
              </button>
           </div>
        </div>

        {/* Logs Panel */}
        <div className="pointer-events-auto bg-slate-800/80 backdrop-blur w-96 max-h-[60vh] rounded-xl border border-slate-700 shadow-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-700 font-semibold text-slate-200 flex justify-between items-center bg-slate-800">
            <span className="flex items-center gap-2"><BarChart3 size={16}/> Nhật ký hoạt động</span>
            <span className="text-xs font-normal text-slate-400">Live Log</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm font-mono scroll-smooth bg-slate-900/50">
             {logs.length === 0 && <span className="text-slate-500 italic p-2 block text-center">Nhấn "Bắt đầu" để chạy mô phỏng...</span>}
             {logs.map(log => {
               let Icon = Info;
               let colors = "border-blue-500 bg-blue-500/10 text-blue-200";
               
               if (log.type === 'error') {
                   Icon = XCircle;
                   colors = "border-red-500 bg-red-500/20 text-red-200";
               } else if (log.type === 'success') {
                   Icon = CheckCircle;
                   colors = "border-green-500 bg-green-500/20 text-green-200";
               } else if (log.type === 'warning') {
                   Icon = AlertTriangle;
                   colors = "border-yellow-500 bg-yellow-500/20 text-yellow-200";
               }

               return (
                 <div key={log.id} className={`p-2.5 rounded border-l-4 flex gap-3 items-start ${colors} shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                   <Icon size={16} className="mt-0.5 shrink-0" />
                   <div className="flex-1 min-w-0">
                       <div className="text-[10px] opacity-60 mb-0.5 uppercase tracking-wider font-semibold">{log.timestamp}</div>
                       <div className="leading-snug break-words">{log.message}</div>
                   </div>
                 </div>
               );
             })}
             <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto bg-slate-800/90 backdrop-blur px-6 py-4 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-6 z-10">
          
          <div className="flex flex-col gap-1">
             <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Thao tác</label>
             <div className="flex gap-2">
                <button 
                  onClick={sendPacket}
                  disabled={!isPlaying || isFinishedRef.current}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-transform active:scale-95"
                >
                  <Send size={18} /> Gửi Gói Tin
                </button>
                <button 
                  onClick={killPacket}
                  disabled={!isPlaying || isFinishedRef.current}
                  className="bg-red-600/80 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-transform active:scale-95"
                  title="Mô phỏng mất gói tin để kiểm tra khả năng phục hồi"
                >
                  <XCircle size={18} /> Gây Nhiễu
                </button>
                 <button 
                  onClick={triggerTimeoutResend}
                  disabled={!isPlaying || isFinishedRef.current}
                  className="bg-orange-600/80 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-transform active:scale-95"
                  title="Kích hoạt Timeout ngay lập tức"
                >
                  <RefreshCw size={18} /> Timeout Ngay
                </button>
             </div>
          </div>

          <div className="w-px h-12 bg-slate-700"></div>

          <div className="flex flex-col gap-1 min-w-[180px]">
             <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Tốc độ</span>
                <span>{Math.round(config.packetSpeed * 100)}%</span>
             </label>
             <input 
                type="range" 
                min="0.1" 
                max="1.5" 
                step="0.1" 
                value={config.packetSpeed}
                onChange={(e) => setConfig(prev => ({...prev, packetSpeed: parseFloat(e.target.value)}))}
                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
             />
             <div className="flex items-center gap-2 mt-2">
                <input 
                  type="checkbox" 
                  id="autoplay"
                  checked={config.autoPlay}
                  onChange={(e) => setConfig(prev => ({...prev, autoPlay: e.target.checked}))}
                  className="w-4 h-4 rounded border-slate-600 text-blue-600 focus:ring-blue-500 bg-slate-700"
                />
                <label htmlFor="autoplay" className="text-sm text-slate-300 cursor-pointer select-none">Tự động gửi</label>
             </div>
          </div>

          <div className="w-px h-12 bg-slate-700"></div>
          
           <div className="flex flex-col gap-1">
             <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cấu hình</label>
             <select 
               value={config.totalPackets}
               onChange={(e) => {
                 resetSimulation();
                 setConfig(prev => ({...prev, totalPackets: parseInt(e.target.value)}));
               }}
               className="bg-slate-700 text-white text-sm rounded-lg p-2 border border-slate-600 focus:border-blue-500 outline-none mb-1"
             >
               <option value={8}>Tổng: 8 gói</option>
               <option value={12}>Tổng: 12 gói</option>
               <option value={20}>Tổng: 20 gói</option>
             </select>
             <select 
               value={config.windowSize}
               onChange={(e) => {
                 resetSimulation();
                 setConfig(prev => ({...prev, windowSize: parseInt(e.target.value)}));
               }}
               className="bg-slate-700 text-white text-sm rounded-lg p-2 border border-slate-600 focus:border-blue-500 outline-none"
             >
               <option value={3}>Window: 3</option>
               <option value={4}>Window: 4</option>
               <option value={5}>Window: 5</option>
             </select>
          </div>

      </div>

      {/* Modals */}
      {showGuide && (
        <Modal title="Hướng dẫn & Nguyên lý Hoạt động" onClose={() => setShowGuide(false)}>
           <GuideContent />
        </Modal>
      )}

      {showResults && (
        <Modal title="Kết quả Mô phỏng" onClose={() => setShowResults(false)}>
           <ResultContent stats={stats} config={config} onReset={resetSimulation} />
        </Modal>
      )}

    </div>
  );
}