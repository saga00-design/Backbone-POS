import React from 'react';
import { usePOSStore, POSState } from './app/store';
import { PinLoginScreen } from './features/auth/PinLoginScreen';
import { FloorPlanScreen } from './features/floor/FloorPlanScreen';
import { OrderEntryScreen } from './features/orders/OrderEntryScreen';
import { MenuManagementScreen } from './features/menu/MenuManagementScreen';
import { KdsScreen } from './features/kds/KdsScreen';
import { DualKdsScreen } from './features/kds/DualKdsScreen';
import { ExpoScreen } from './features/kds/ExpoScreen';
import { ReportingScreen } from './features/reporting/ReportingScreen';
import { PerformanceScreen } from './features/performance/PerformanceScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { BriefingOverlay } from './components/auth/BriefingOverlay';
import { OfflineBanner } from './components/OfflineBanner';
import { useFirestoreSync } from './lib/useFirestoreSync';
import { useConnectivity } from './lib/useConnectivity';
import { usePacingMonitor } from './lib/usePacingMonitor';
import { NotificationCenter } from './components/ui/NotificationCenter';
import { PricingEngine } from './domain/PricingEngine';
import { startOfDay } from 'date-fns';
import { LayoutGrid, Utensils, ChefHat, Wine, BarChart3, Settings, LogOut, Menu, BookOpen, ClipboardList, LogIn } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const { currentStaff, setStaff, activeScreen, setActiveScreen, allOrders, clockOut } = usePOSStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Sync real-time data from Firestore
  useFirestoreSync();
  useConnectivity();
  usePacingMonitor();

  // Update time every 30 seconds
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const shiftTotal = React.useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    return allOrders.reduce((acc, order) => {
      if (order.createdAt >= todayStart && ['paid', 'completed', 'closed'].includes(order.status)) {
        return acc + (order.totalGross || 0);
      }
      return acc;
    }, 0);
  }, [allOrders]);

  if (!currentStaff) {
    return <PinLoginScreen />;
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'floor': return <FloorPlanScreen />;
      case 'order': return <OrderEntryScreen />;
      case 'kitchen_kds': return <KdsScreen station="kitchen" />;
      case 'bar_kds': return <KdsScreen station="bar" />;
      case 'kds': return <KdsScreen station={currentStaff.role === 'chef' ? 'kitchen' : 'bar'} />;
      case 'kds_dual': return <DualKdsScreen />;
      case 'expo': return <ExpoScreen />;
      case 'menu': return <MenuManagementScreen />;
      case 'reporting': return <ReportingScreen />;
      case 'performance': return <PerformanceScreen />;
      case 'settings': return <SettingsScreen />;
      default: return <FloorPlanScreen />;
    }
  };

  const navItems: { id: POSState['activeScreen']; label: string; icon: React.ReactNode; roles: string[] }[] = [
    { id: 'floor', label: 'Floor', icon: <LayoutGrid />, roles: ['waiter', 'bartender', 'manager', 'admin', 'supervisor'] },
    { id: 'performance', label: 'Performance', icon: <BarChart3 />, roles: ['waiter', 'bartender', 'chef', 'manager', 'admin', 'supervisor'] },
    { id: 'expo', label: 'Expo', icon: <ClipboardList />, roles: ['waiter', 'manager', 'admin', 'supervisor'] },
    { id: 'kitchen_kds', label: 'Kitchen KDS', icon: <ChefHat />, roles: ['chef', 'manager', 'admin'] },
    { id: 'bar_kds', label: 'Bar KDS', icon: <Wine />, roles: ['bartender', 'manager', 'admin'] },
    { id: 'menu', label: 'Menu', icon: <BookOpen />, roles: ['manager', 'admin'] },
    { id: 'reporting', label: 'Reports', icon: <ClipboardList />, roles: ['manager', 'admin'] },
    { id: 'settings', label: 'Setup', icon: <Settings />, roles: ['admin', 'manager'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(currentStaff.role));

  return (
    <div className="h-screen bg-bg-dark flex flex-col md:flex-row overflow-hidden">
      <OfflineBanner position="top" />
      <BriefingOverlay />
      <NotificationCenter />
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-bg-card border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
            <img src="/Backbonehub-ico.png" alt="Backbone" className="w-full h-full object-contain p-1.5" referrerPolicy="no-referrer" />
          </div>
          <span className="text-white font-black uppercase tracking-tighter text-sm">Backbone</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-text-secondary hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <div className={cn(
        "fixed inset-0 z-50 bg-black/60 md:relative md:inset-auto md:bg-transparent transition-opacity duration-300",
        isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
      )} onClick={() => setIsMobileMenuOpen(false)}>
        <div 
          className={cn(
            "w-64 md:w-24 h-full bg-bg-card border-r border-white/5 flex flex-col items-center py-8 gap-8 transition-transform duration-300",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
          onClick={e => e.stopPropagation()}
        >
          <div className="hidden md:flex w-14 h-14 bg-white/5 rounded-2xl items-center justify-center border border-white/10 overflow-hidden mb-6 p-2 transition-all hover:bg-white/10">
            <img src="/Backbonehub-ico.png" alt="Backbone" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
          </div>
          
          <nav className="flex-1 flex flex-col gap-4 w-full px-4 md:px-0">
            {filteredNav.map((item, index) => (
              <NavItem 
                key={item.id}
                icon={item.icon} 
                active={activeScreen === item.id} 
                label={item.label} 
                index={index}
                onClick={() => { setActiveScreen(item.id as any); setIsMobileMenuOpen(false); }} 
              />
            ))}
          </nav>

          <div className="flex flex-col gap-2 w-full px-4 items-center">
            <button 
              onClick={() => {
                if (currentStaff) {
                  clockOut(currentStaff.id);
                }
              }}
              title="End Shift & Clock Out"
              className="w-full md:w-12 h-12 rounded-xl flex items-center justify-center gap-3 md:gap-0 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all px-4 md:px-0"
            >
              <LogOut className="w-5 h-5 md:w-6 md:h-6" />
              <span className="md:hidden text-[10px] font-black uppercase tracking-widest">End Shift</span>
            </button>
            
            <button 
              onClick={() => setStaff(null)}
              title="Lock Screen"
              className="w-full md:w-12 h-12 rounded-xl flex items-center justify-center gap-3 md:gap-0 text-text-muted hover:text-white hover:bg-white/5 transition-all px-4 md:px-0"
            >
              <LogIn className="w-5 h-5 md:w-6 md:h-6" />
              <span className="md:hidden text-[10px] font-black uppercase tracking-widest">Switch User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - Desktop Only */}
        <header className="hidden md:flex h-20 bg-bg-card border-b border-white/5 items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <span className="text-white font-bold text-sm">{currentStaff?.name?.[0] || '?'}</span>
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">{currentStaff?.name || 'Unknown'}</h3>
              <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">{currentStaff?.role || 'Staff'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">Shift Total</p>
              <p className="text-white font-mono font-bold">{PricingEngine.formatCurrency(shiftTotal)}</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-text-secondary text-[10px] uppercase tracking-widest font-bold">Time</p>
              <p className="text-white font-mono font-bold">{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}

const NavItem: React.FC<{ icon: React.ReactNode; active?: boolean; label: string; index?: number; onClick: () => void }> = ({ icon, active, label, index, onClick }) => {
  const getCustomStyle = () => {
    if (index === undefined) return {};
    if (index === 0) {
      return {
        paddingTop: '0px',
        paddingBottom: '0px',
        paddingRight: '0px',
        paddingLeft: '0px',
        marginLeft: '15px',
      };
    }
    if (index === 1) {
      return {
        paddingLeft: '0px',
        paddingTop: '0px',
        marginLeft: '15px',
      };
    }
    return {
      paddingLeft: '0px',
      marginLeft: '15px',
    };
  };

  return (
    <button 
      onClick={onClick}
      style={getCustomStyle()}
      className={cn(
        "w-full md:w-16 h-12 md:h-16 rounded-2xl flex flex-row md:flex-col items-center justify-start md:justify-center gap-3 md:gap-1 transition-all group px-4 md:px-0",
        active ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-muted hover:text-white hover:bg-white/5"
      )}
    >
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5 md:w-6 md:h-6" })}
      <span className="text-[10px] md:text-[8px] uppercase font-black tracking-widest md:tracking-tighter">{label}</span>
    </button>
  );
}
