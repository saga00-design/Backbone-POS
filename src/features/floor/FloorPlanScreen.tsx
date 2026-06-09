import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../app/store';
import { Table, TableStatus, TableShape } from '../../types/pos';
import { Users, Clock, Plus, Trash2, Move, Maximize2, Settings2, Check, LayoutGrid, Copy, Square, Circle, Sofa, Edit2, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { GuestCountModal } from '../../components/floor/GuestCountModal';

export const FloorPlanScreen: React.FC = () => {
  const { zones, tables, setActiveTable, setActiveScreen, isDesignMode, toggleDesignMode, addTable, updateTable, deleteTable, copyTable, addZone, allOrders, kdsTickets, barKdsTickets, menuItems, seatTable } = usePOSStore();
  const [activeZone, setActiveZone] = useState(zones[0]?.id || '');
  const [now, setNow] = useState(Date.now());
  const [guestModal, setGuestModal] = useState<{ isOpen: boolean; table: Table | null }>({
    isOpen: false,
    table: null
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      if (window.innerWidth < 768) {
        const padding = 16; // Mobile padding guardrail
        const maxW = containerWidth - padding;
        const maxH = containerHeight - padding;

        const scaleX = maxW / 800;
        const scaleY = maxH / 600;
        // Fit completely both horizontally and vertically
        const newScale = Math.min(scaleX, scaleY, 1);
        setScale(newScale);
      } else {
        setScale(1);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(containerRef.current);
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!activeZone && zones.length > 0) {
      setActiveZone(zones[0].id);
    }
  }, [zones, activeZone]);

  const handleTableClick = (table: Table) => {
    if (isDesignMode) return;
    
    // Show guest count modal if table is available
    if (table.status === 'available') {
      setGuestModal({ isOpen: true, table });
      return;
    }

    setActiveTable(table);
    setActiveScreen('order');
  };

  const handleConfirmGuestCount = async (count: number) => {
    if (guestModal.table) {
      await seatTable(guestModal.table.id, count);
      setActiveScreen('order');
    }
  };

  const formatTime = (ms: number) => {
    if (!ms) return '0:00';
    const elapsed = now - ms;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyClass = (table: Table) => {
    if (table.status === 'payment_pending') return 'border-status-pending shadow-lg shadow-status-pending/20 animate-pulse';
    
    // Check for "Ready to Serve"
    if (table.currentOrderId) {
      const tickets = [...kdsTickets, ...barKdsTickets].filter(t => t.orderId === table.currentOrderId);
      if (tickets.length > 0 && tickets.every(t => t.status === 'ready')) {
        return 'border-status-available shadow-lg shadow-status-available/20 ring-4 ring-status-available/10';
      }
    }

    if (table.status === 'fired' || table.status === 'ordering') {
      const elapsed = now - (table.seatedAt || now);
      if (elapsed > 900000) return 'border-status-pending shadow-lg shadow-status-pending/20'; // 15 mins
      if (elapsed > 600000) return 'border-amber-500 shadow-lg shadow-amber-500/20'; // 10 mins
    }
    return 'border-white/5';
  };

  const getPacingAlert = (table: Table) => {
    if (table.status === 'available') return null;
    const order = allOrders.find(o => o.id === table.currentOrderId);
    if (!order) return null;

    const timeSinceLast = order.lastCourseAt ? now - order.lastCourseAt : (now - (table.seatedAt || now));
    
    const tickets = [...kdsTickets, ...barKdsTickets].filter(t => t.orderId === table.currentOrderId);
    const isReady = tickets.length > 0 && tickets.every(t => t.status === 'ready');

    if (isReady) return { type: 'ready' as const, label: 'READY' };
    if (timeSinceLast > 900000) return { type: 'delay' as const, label: 'DELAY' };
    
    return null;
  };

  if (zones.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted opacity-20">
        <LayoutGrid className="w-16 h-16 mb-4" />
        <span className="text-xs font-black uppercase tracking-widest">No Zones Configured</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-dark overflow-hidden ml-0 mr-0 mt-0 mb-0 pt-[10px] pb-[10px]">
      {/* Header */}
      <div className="w-[1934px] h-[130px] md:h-[130px] bg-bg-card border-0 border-solid border-white/5 flex flex-col md:flex-row items-center justify-between pl-[32px] pr-4 md:pr-8 pt-0 pb-0 shrink-0 gap-4 mt-0 mb-[10px] rounded-none">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto mt-0 mb-[-11px] h-[52.6667px] p-0 ml-0 mr-0">
          <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Floor Plan</h2>
          <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
            {zones.map(zone => (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                className={cn(
                  "px-4 md:px-6 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeZone === zone.id 
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" 
                    : "text-text-secondary hover:text-white hover:bg-white/5"
                )}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
          {isDesignMode && (
            <div className="flex items-center gap-1 md:gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => {
                  const name = prompt('Enter Room Name:');
                  if (name) addZone(name);
                }}
                className="flex items-center gap-2 px-2 md:px-3 py-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all border-r border-white/10 pr-3 md:pr-4 mr-1 md:mr-2"
                title="Add New Room"
              >
                <Plus className="w-3 h-3 md:w-4 md:h-4" />
                <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Add Room</span>
              </button>
              <button 
                onClick={() => addTable(activeZone, 'square')}
                className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all"
                title="Add Square Table"
              >
                <Square className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              <button 
                onClick={() => addTable(activeZone, 'round')}
                className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all"
                title="Add Round Table"
              >
                <Circle className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              <button 
                onClick={() => addTable(activeZone, 'booth')}
                className="p-1.5 md:p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-all"
                title="Add Booth"
              >
                <Sofa className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
          )}
          <button 
            onClick={toggleDesignMode}
            className={cn(
              "flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all",
              isDesignMode 
                ? "bg-status-pending text-white shadow-lg shadow-status-pending/20" 
                : "bg-white/5 border border-white/10 text-text-secondary hover:text-white"
            )}
          >
            {isDesignMode ? (
              <>
                <Check className="w-3 h-3 md:w-4 md:h-4" />
                Exit Design
              </>
            ) : (
              <>
                <Settings2 className="w-3 h-3 md:w-4 md:h-4" />
                Design
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floor Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative p-2 md:p-12 overflow-hidden md:overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:40px_40px] no-scrollbar flex items-center justify-center"
      >
        <div 
          style={{
            width: '800px',
            height: '600px',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            position: 'relative',
            flexShrink: 0
          }}
          className={cn(
            "transition-transform duration-100 ease-out",
            isDesignMode ? "border border-dashed border-white/10" : ""
          )}
        >
          {tables.filter(t => t.zoneId === activeZone).map(table => (
            <TableCard 
              key={table.id} 
              table={table} 
              onClick={() => handleTableClick(table)}
              isDesignMode={isDesignMode}
              onUpdate={(updates) => updateTable(table.id, updates)}
              onDelete={() => deleteTable(table.id)}
              onCopy={() => copyTable(table.id)}
              urgencyClass={getUrgencyClass(table)}
              timer={formatTime(table.seatedAt || 0)}
              alert={getPacingAlert(table)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="h-12 md:h-16 bg-bg-card border-t border-white/5 flex items-center px-4 md:px-8 gap-4 md:gap-8 shrink-0 overflow-x-auto no-scrollbar">
        <LegendItem status="available" label="Available" />
        <LegendItem status="seated" label="Seated" />
        <LegendItem status="ordering" label="Ordering" />
        <LegendItem status="fired" label="Fired" />
        <LegendItem status="served" label="Served" />
        <LegendItem status="payment_pending" label="Paying" />
      </div>

      <GuestCountModal 
        isOpen={guestModal.isOpen}
        onClose={() => setGuestModal({ isOpen: false, table: null })}
        onConfirm={handleConfirmGuestCount}
        tableName={guestModal.table?.name || ''}
      />
    </div>
  );
};

interface TableCardProps {
  table: Table;
  onClick: () => void;
  isDesignMode: boolean;
  onUpdate: (updates: Partial<Table>) => void;
  onDelete: () => void;
  onCopy: () => void;
  urgencyClass: string;
  timer: string;
  alert: { type: 'ready' | 'delay'; label: string } | null;
}

const TableCard: React.FC<TableCardProps> = ({ table, onClick, isDesignMode, onUpdate, onDelete, onCopy, urgencyClass, timer, alert }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(table.name);

  const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize') => {
    if (!isDesignMode || isEditingName) return;
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startTableX = table.x;
    const startTableY = table.y;
    const startWidth = table.width;
    const startHeight = table.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (type === 'drag') {
        onUpdate({ x: startTableX + dx, y: startTableY + dy });
      } else {
        onUpdate({ width: Math.max(80, startWidth + dx), height: Math.max(80, startHeight + dy) });
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    if (type === 'drag') setIsDragging(true);
    else setIsResizing(true);
  };

  const statusColors: Record<TableStatus, string> = {
    available: 'bg-white/5 border-white/10 text-text-muted',
    seated: 'bg-status-seated/20 border-status-seated text-status-seated',
    ordering: 'bg-brand-primary/20 border-brand-primary text-brand-primary',
    fired: 'bg-status-fired/20 border-status-fired text-status-fired',
    served: 'bg-status-served/20 border-status-served text-status-served',
    payment_pending: 'bg-status-pending/20 border-status-pending text-status-pending',
    closed: 'bg-white/5 border-white/10 text-text-muted',
    cleaning: 'bg-amber-500/20 border-amber-500 text-amber-500',
  };

  const shapeClasses = {
    square: 'rounded-[2rem]',
    round: 'rounded-full',
    booth: 'rounded-xl border-x-8 border-white/10',
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ name: tempName });
    setIsEditingName(false);
  };

  return (
    <div
      style={{
        left: table.x,
        top: table.y,
        width: table.width,
        height: table.height,
        position: 'absolute',
      }}
      onClick={onClick}
      className={cn(
        "border transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group shadow-xl",
        shapeClasses[table.shape || 'square'],
        statusColors[table.status],
        urgencyClass,
        isDesignMode && "cursor-move border-dashed border-white/40 bg-white/5",
        isDragging && "scale-105 shadow-2xl z-50 opacity-80",
        isResizing && "z-50"
      )}
      onMouseDown={(e) => handleMouseDown(e, 'drag')}
    >
      {isDesignMode && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-bg-card border border-white/10 p-1 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all z-50">
          <button 
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="p-1.5 hover:bg-white/10 rounded text-text-secondary hover:text-white transition-all"
            title="Copy Table"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
            className="p-1.5 hover:bg-white/10 rounded text-text-secondary hover:text-white transition-all"
            title="Edit Name"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate({ shape: 'square' }); }}
            className={cn("p-1.5 hover:bg-white/10 rounded transition-all", table.shape === 'square' ? "text-brand-primary bg-brand-primary/10" : "text-text-secondary")}
            title="Square"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate({ shape: 'round' }); }}
            className={cn("p-1.5 hover:bg-white/10 rounded transition-all", table.shape === 'round' ? "text-brand-primary bg-brand-primary/10" : "text-text-secondary")}
            title="Round"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onUpdate({ shape: 'booth' }); }}
            className={cn("p-1.5 hover:bg-white/10 rounded transition-all", table.shape === 'booth' ? "text-brand-primary bg-brand-primary/10" : "text-text-secondary")}
            title="Booth"
          >
            <Sofa className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 hover:bg-status-pending/20 rounded text-text-secondary hover:text-status-pending transition-all"
            title="Delete Table"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isDesignMode && (
        <div 
          onMouseDown={(e) => handleMouseDown(e, 'resize')}
          className="absolute -bottom-1 -right-1 w-6 h-6 bg-white/20 rounded-tl-xl rounded-br-[2rem] flex items-center justify-center text-white/40 cursor-nwse-resize hover:bg-white/40 transition-all z-50"
        >
          <Maximize2 className="w-3 h-3" />
        </div>
      )}

      {isEditingName ? (
        <form onSubmit={handleNameSubmit} onClick={e => e.stopPropagation()}>
          <input
            autoFocus
            value={tempName}
            onChange={e => setTempName(e.target.value)}
            onBlur={handleNameSubmit}
            className="bg-black/40 border border-white/20 rounded px-2 py-1 text-center text-white font-black w-20 outline-none focus:border-brand-primary"
          />
        </form>
      ) : (
        <span className="text-2xl font-black uppercase tracking-tighter">{table.name}</span>
      )}
      
      {!isDesignMode && table.status !== 'available' && (
        <div className="flex flex-col items-center gap-1">
          {alert && (
            <div className={cn(
              "px-2 py-0.5 rounded-full text-[7px] font-black tracking-widest",
              alert.type === 'ready' ? "bg-status-available text-bg-dark animate-bounce" : "bg-status-pending text-white animate-pulse"
            )}>
              {alert.label}
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest opacity-60">
            <Users className="w-3 h-3" />
            {table.guestCount}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono font-black opacity-60">
            <Clock className="w-3 h-3" />
            {timer}
          </div>
        </div>
      )}

      {isDesignMode && !isEditingName && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Move className="w-6 h-6 text-white/10" />
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ status, label }: { status: TableStatus; label: string }) => {
  const colors: Record<string, string> = {
    available: 'bg-white/10',
    seated: 'bg-status-seated',
    ordering: 'bg-brand-primary',
    fired: 'bg-status-fired',
    served: 'bg-status-served',
    payment_pending: 'bg-status-pending',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full", colors[status])} />
      <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{label}</span>
    </div>
  );
};
