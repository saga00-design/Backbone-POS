import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePOSStore } from '../../app/store';
import { PricingEngine } from '../../domain/PricingEngine';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Clock, 
  Filter, 
  Download, 
  Users, 
  Percent, 
  Calculator, 
  Info, 
  HelpCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Moon, 
  Receipt,
  Mail,
  Printer,
  Undo,
  ShieldCheck,
  XCircle,
  FileSpreadsheet, 
  Utensils, 
  Wine,
  Brain,
  Coffee, 
  GlassWater,
  Trophy,
  Zap,
  Activity,
  Search
} from 'lucide-react';
import { EndOfDayModal } from './EndOfDayModal';
import { TicketsTransactionsView } from './TicketsTransactionsView';
import { cn } from '../../lib/utils';
import { 
  format, 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  startOfYear, 
  isWithinInterval, 
  endOfDay, 
  endOfWeek, 
  endOfMonth, 
  endOfYear, 
  eachHourOfInterval, 
  eachDayOfInterval, 
  eachMonthOfInterval, 
  isSameHour, 
  isSameDay, 
  isSameMonth,
  subDays
} from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  ComposedChart,
  Line,
  Area,
  Legend
} from 'recharts';

type Period = 'hour' | 'day' | 'week' | 'month' | 'year' | 'custom';
type Tab = 'financials' | 'tickets' | 'audit' | 'inventory' | 'knowledge';

export const ReportingScreen: React.FC = () => {
  const { 
    allOrders, staffList, categories, cancelledSessions, stockMovements, menuItems, quizSubmissions,
    allTransactions, voidTransaction, refundTransaction, correctPaymentMethod, currentStaff
  } = usePOSStore();
  const [period, setPeriod] = useState<Period>('day');
  const [activeTab, setActiveTab] = useState<Tab>('financials');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [showEndOfDay, setShowEndOfDay] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [appliedDateRange, setAppliedDateRange] = useState(dateRange);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [chartType, setChartType] = useState<'revenue' | 'covers'>('revenue');

  const handleApplyFilter = () => {
    setAppliedDateRange(dateRange);
  };

  const filteredOrders = useMemo(() => {
    let start: Date;
    let end: Date;

    if (period === 'custom') {
      const s = appliedDateRange.start ? new Date(appliedDateRange.start) : new Date();
      const e = appliedDateRange.end ? new Date(appliedDateRange.end) : new Date();
      start = startOfDay(isNaN(s.getTime()) ? new Date() : s);
      end = endOfDay(isNaN(e.getTime()) ? new Date() : e);
    } else {
      switch (period) {
        case 'day':
        case 'hour':
          start = startOfDay(selectedDate);
          end = endOfDay(selectedDate);
          break;
        case 'week':
          start = startOfWeek(selectedDate);
          end = endOfWeek(selectedDate);
          break;
        case 'month':
          start = startOfMonth(selectedDate);
          end = endOfMonth(selectedDate);
          break;
        case 'year':
          start = startOfYear(selectedDate);
          end = endOfYear(selectedDate);
          break;
        default:
          start = startOfDay(selectedDate);
          end = endOfDay(selectedDate);
      }
    }

    const matched = allOrders.filter(order => {
      const d = new Date(order.createdAt);
      if (isNaN(d.getTime())) return false;
      return isWithinInterval(d, { start, end });
    });

    // Only include final/paid orders for reporting
    const finalOrders = matched.filter(order => 
      ['paid', 'partially_paid', 'closed', 'completed'].includes(order.status)
    );

    console.log(`[POS Reports] Orders loaded for ${period}:`, matched.length);
    console.log(`[POS Reports] Final/Paid orders:`, finalOrders.length);

    return finalOrders;
  }, [allOrders, period, selectedDate, appliedDateRange]);

  const stats = useMemo(() => {
    let rawTotalGross = 0;
    let rawTotalVAT = 0;
    let rawTotalService = 0;
    let rawTotalDiscount = 0;

    const employeeSales: Record<string, { 
      name: string, 
      total: number, 
      count: number, 
      serviceCharge: number,
      items: Record<string, number> 
    }> = {};
    const categorySales: Record<string, { name: string, total: number, count: number }> = {};
    const stationSales: Record<string, { name: string, total: number, count: number }> = {};
    const shiftSales: Record<string, { name: string, total: number, count: number }> = {
      lunch: { name: 'Lunch', total: 0, count: 0 },
      dinner: { name: 'Dinner', total: 0, count: 0 }
    };
    
    let foodTotal = 0;
    let drinkTotal = 0;
    let alcoholicTotal = 0;
    let nonAlcoholicTotal = 0;
    let totalCovers = 0;

    const hourlyHeatmap: Record<number, number> = {};
    const activeHours = new Set<number>();
    for (let i = 0; i < 24; i++) hourlyHeatmap[i] = 0;

    let totalSeatedToFirst = 0;
    let countSeatedToFirst = 0;
    let totalFirstToMains = 0;
    let countFirstToMains = 0;
    let totalMainsToDesserts = 0;
    let countMainsToDesserts = 0;
    let totalFullDuration = 0;
    let countFullDuration = 0;

    filteredOrders.forEach(order => {
      const gross = Number(order.totalGross || 0);
      const vat = Number(order.vatTotal || 0);
      const service = Number(order.serviceCharge || 0);
      const orderCovers = Number(order.covers || 0);
      totalCovers += orderCovers;
      
      const orderDate = new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return;
      const orderHour = orderDate.getHours();
      hourlyHeatmap[orderHour] = (hourlyHeatmap[orderHour] || 0) + gross;
      activeHours.add(orderHour);

      // Shift logic
      const shift = orderHour >= 11 && orderHour < 16 ? 'lunch' : 'dinner';
      shiftSales[shift].total += gross;
      shiftSales[shift].count++;

      // Breakdown by items for category/station/food-drink split
      order.items.forEach(item => {
        if (item.status === 'voided') return;
        
        const itemGross = item.totalPrice;
        
        // Food vs Drink
        if (item.snapshot?.isDrink) {
          drinkTotal += itemGross;
          if (item.snapshot?.isAlcoholic) {
            alcoholicTotal += itemGross;
          } else {
            nonAlcoholicTotal += itemGross;
          }
        } else {
          foodTotal += itemGross;
        }

        // Category Split
        const categoryId = item.snapshot?.categoryId || 'uncategorized';
        if (!categorySales[categoryId]) {
          const category = categories.find(c => c.id === categoryId);
          categorySales[categoryId] = {
            name: category?.name || 'Uncategorized',
            total: 0,
            count: 0
          };
        }
        categorySales[categoryId].total += itemGross;
        categorySales[categoryId].count += item.quantity;

        // Station Split
        const station = item.snapshot?.station || 'unassigned';
        if (!stationSales[station]) {
          stationSales[station] = {
            name: station.charAt(0).toUpperCase() + station.slice(1),
            total: 0,
            count: 0
          };
        }
        stationSales[station].total += itemGross;
        stationSales[station].count += item.quantity;

        // Detailed Employee Metrics (assigned per item if possible, fallback to order staff)
        const staffId = item.staffId || order.staffId;
        if (!employeeSales[staffId]) {
          const staff = staffList.find(s => s.id === staffId);
          employeeSales[staffId] = {
            name: staff?.name || 'Unknown',
            total: 0,
            count: 0,
            serviceCharge: 0,
            items: {}
          };
        }
        employeeSales[staffId].total += itemGross;
        employeeSales[staffId].count += item.quantity;
        
        const itemName = item.snapshot?.name || 'Unknown Item';
        employeeSales[staffId].items[itemName] = (employeeSales[staffId].items[itemName] || 0) + item.quantity;
      });

      // Split service charge to employee
      const staffId = order.staffId;
      if (employeeSales[staffId]) {
        employeeSales[staffId].serviceCharge += service;
      }

      // Aggregate item discounts and order-level discount
      const itemDiscounts = order.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
      const orderDiscount = Number(order.discountAmount || 0);
      const discount = itemDiscounts + orderDiscount;

      rawTotalGross += gross;
      rawTotalVAT += vat;
      rawTotalService += service;
      rawTotalDiscount += discount;

      // Turnaround Metrics (Fallback to createdAt if seatedAt is missing for older records)
      const seatTime = order.seatedAt || order.createdAt;
      if (seatTime) {
        if (order.firstOrderSentAt) {
          totalSeatedToFirst += Math.max(0, order.firstOrderSentAt - seatTime);
          countSeatedToFirst++;
        }
        if (order.firstOrderSentAt && order.mainsFiredAt) {
          totalFirstToMains += Math.max(0, order.mainsFiredAt - order.firstOrderSentAt);
          countFirstToMains++;
        }
        if (order.mainsFiredAt && order.dessertsFiredAt) {
          totalMainsToDesserts += Math.max(0, order.dessertsFiredAt - order.mainsFiredAt);
          countMainsToDesserts++;
        }
        if (order.paidAt) {
          totalFullDuration += Math.max(0, order.paidAt - seatTime);
          countFullDuration++;
        }
      }

      const staffIdForStats = order.staffId || 'unknown';
      if (!employeeSales[staffIdForStats]) {
        const staff = staffList.find(s => s.id === staffIdForStats);
        employeeSales[staffIdForStats] = {
          name: staff?.name || 'Unknown',
          total: 0,
          count: 0,
          serviceCharge: 0,
          items: {}
        };
      }
    });

    const netSales = rawTotalGross - rawTotalVAT;
    const profitTakeHome = rawTotalGross - rawTotalVAT - rawTotalService;
    const orderCount = filteredOrders.length;
    
    const methodBreakdown = filteredOrders.reduce((acc, o) => {
      o.payments?.forEach(p => {
        const amount = Number(p.amount ?? 0);
        acc[p.method] = (acc[p.method] || 0) + amount;
      });
      return acc;
    }, {} as Record<string, number>);

    return { 
      totalGross: rawTotalGross, 
      totalVAT: rawTotalVAT, 
      totalService: rawTotalService, 
      totalNet: netSales,
      totalDiscount: rawTotalDiscount,
      totalProfit: profitTakeHome,
      totalCovers,
      orderCount, 
      atv: orderCount > 0 ? rawTotalGross / orderCount : 0,
      sph: totalCovers > 0 ? rawTotalGross / totalCovers : 0,
      sphr: activeHours.size > 0 ? rawTotalGross / activeHours.size : rawTotalGross,
      methodBreakdown,
      employeeSales,
      categorySales,
      stationSales,
      shiftSales,
      foodTotal,
      drinkTotal,
      alcoholicTotal,
      nonAlcoholicTotal,
      foodPercentage: rawTotalGross > 0 ? (foodTotal / rawTotalGross) * 100 : 0,
      drinkPercentage: rawTotalGross > 0 ? (drinkTotal / rawTotalGross) * 100 : 0,
      hourlyHeatmap,
      itemSales: Object.values(filteredOrders.reduce((acc, o) => {
        o.items.forEach(i => {
          if (i.status === 'voided') return;
          if (!acc[i.menuItemId]) {
            acc[i.menuItemId] = { name: i.snapshot?.name || 'Unknown Item', quantity: 0, revenue: 0 };
          }
          acc[i.menuItemId].quantity += i.quantity;
          acc[i.menuItemId].revenue += i.totalPrice;
        });
        return acc;
      }, {} as Record<string, { name: string, quantity: number, revenue: number }>))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5) as { name: string, quantity: number, revenue: number }[],
      avgSeatedToFirst: countSeatedToFirst > 0 ? totalSeatedToFirst / countSeatedToFirst / 60000 : 0,
      avgFirstToMains: countFirstToMains > 0 ? totalFirstToMains / countFirstToMains / 60000 : 0,
      avgMainsToDesserts: countMainsToDesserts > 0 ? totalMainsToDesserts / countMainsToDesserts / 60000 : 0,
      avgTotalDuration: countFullDuration > 0 ? totalFullDuration / countFullDuration / 60000 : 0,
    };
  }, [filteredOrders, staffList, categories]);

  const exportToCSV = () => {
    const headers = ["Date", "Order ID", "Gross", "VAT", "Service", "Discount", "Net", "Staff", "Status"];
    const rows = filteredOrders.map(order => {
      const gross = (order as any).totalGross ?? 0;
      const vat = (order as any).vatTotal ?? 0;
      const service = (order as any).serviceCharge ?? 0;
      const discount = (order as any).discountTotal ?? 0;
      const net = gross - vat;
      const staff = staffList.find(s => s.id === order.staffId)?.name || 'Unknown';
      
      return [
        format(order.createdAt, 'yyyy-MM-dd HH:mm:ss'),
        order.id,
        (gross / 100).toFixed(2),
        (vat / 100).toFixed(2),
        (service / 100).toFixed(2),
        (discount / 100).toFixed(2),
        (net / 100).toFixed(2),
        staff,
        order.status
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `POS_Report_${period}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartData = useMemo(() => {
    const getChartData = () => {
      let interval: { start: Date; end: Date };
      
      if (period === 'custom') {
        interval = { start: startOfDay(new Date(appliedDateRange.start)), end: endOfDay(new Date(appliedDateRange.end)) };
        const days = eachDayOfInterval(interval);
        return days.map(d => {
          const periodOrders = filteredOrders.filter(o => isSameDay(new Date(o.createdAt), d));
          const amount = periodOrders.reduce((sum, o) => sum + (o.totalGross || 0), 0);
          const covers = periodOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
          return { name: format(d, 'dd/MM'), amount: amount / 100, covers };
        });
      }

      switch (period) {
        case 'day':
        case 'hour':
          interval = { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
          return eachHourOfInterval(interval).map(h => {
            const periodOrders = filteredOrders.filter(o => isSameHour(new Date(o.createdAt), h));
            const amount = periodOrders.reduce((sum, o) => sum + (o.totalGross || 0), 0);
            const covers = periodOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
            return { name: format(h, 'HH:00'), amount: amount / 100, covers };
          });
        case 'week':
          interval = { start: startOfWeek(selectedDate), end: endOfWeek(selectedDate) };
          return eachDayOfInterval(interval).map(d => {
            const periodOrders = filteredOrders.filter(o => isSameDay(new Date(o.createdAt), d));
            const amount = periodOrders.reduce((sum, o) => sum + (o.totalGross || 0), 0);
            const covers = periodOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
            return { name: format(d, 'EEE'), amount: amount / 100, covers };
          });
        case 'month':
          interval = { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
          return eachDayOfInterval(interval).map(d => {
            const periodOrders = filteredOrders.filter(o => isSameDay(new Date(o.createdAt), d));
            const amount = periodOrders.reduce((sum, o) => sum + (o.totalGross || 0), 0);
            const covers = periodOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
            return { name: format(d, 'dd'), amount: amount / 100, covers };
          });
        case 'year':
          interval = { start: startOfYear(selectedDate), end: endOfYear(selectedDate) };
          return eachMonthOfInterval(interval).map(m => {
            const periodOrders = filteredOrders.filter(o => isSameMonth(new Date(o.createdAt), m));
            const amount = periodOrders.reduce((sum, o) => sum + (o.totalGross || 0), 0);
            const covers = periodOrders.reduce((sum, o) => sum + (o.covers || 0), 0);
            return { name: format(m, 'MMM'), amount: amount / 100, covers };
          });
        default:
          return [];
      }
    };

    const data = getChartData();
    // Add 3-point moving average
    return data.map((entry, idx, arr) => {
      const start = Math.max(0, idx - 2);
      const window = arr.slice(start, idx + 1);
      const avg = window.reduce((sum, e) => sum + e.amount, 0) / window.length;
      return { ...entry, average: avg };
    });
  }, [filteredOrders, period, selectedDate, appliedDateRange]);

  const pieData = useMemo(() => {
    return Object.entries(stats.methodBreakdown).map(([name, value]) => ({
      name,
      value: (value as number) / 100
    }));
  }, [stats.methodBreakdown]);

  const PIE_COLORS = ['var(--color-brand-primary)', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="h-full flex flex-col bg-bg-dark overflow-hidden ml-0 mr-0 mt-0 mb-0 pt-[10px] pb-[10px]">
      {/* Header */}
      <div className="w-[1934px] h-[100px] md:h-[100px] bg-bg-card border-0 border-solid border-white/5 flex flex-col justify-end pl-[32px] pr-4 md:pr-8 pt-0 pb-0 shrink-0 mt-[15px] mb-[10px] rounded-none">
        <div className="flex items-center justify-between mb-[-11px] h-[52.6667px] p-0 ml-0 mr-0 mt-0 w-full">
          <div className="flex items-center gap-4">
            <BarChart3 className="w-6 h-6 text-brand-primary" />
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Management Hub</h2>
          </div>

          <div className="flex items-center gap-4">
            {activeTab === 'financials' && (
              <div className="flex items-center gap-4">
                {period === 'custom' && (
                  <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="bg-transparent text-[10px] font-black text-white outline-none uppercase"
                    />
                    <span className="text-[10px] font-black text-white/20">TO</span>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="bg-transparent text-[10px] font-black text-white outline-none uppercase"
                    />
                  </div>
                )}
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                  {(['hour', 'day', 'week', 'month', 'year', 'custom'] as Period[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                        period === p ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:text-white"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              onClick={exportToCSV}
              className="p-3 bg-white/5 border border-white/10 rounded-xl text-text-secondary hover:text-white transition-all group relative"
            >
              <Download className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowEndOfDay(true)}
              className="flex items-center gap-3 px-6 py-3 bg-brand-primary text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Moon className="w-4 h-4" />
              End of Day
            </button>
          </div>
        </div>

        <div className="flex gap-8">
          {[
            { id: 'financials', label: 'Financials', icon: Calculator },
            { id: 'tickets', label: 'Tickets & Transactions', icon: Receipt },
            { id: 'knowledge', label: 'Knowledge', icon: Brain },
            { id: 'audit', label: 'Audit Trail', icon: Search },
            { id: 'inventory', label: 'Inventory', icon: Utensils }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={cn(
                "pb-3 text-[10px] font-black uppercase tracking-widest transition-all relative flex items-center gap-2",
                activeTab === t.id ? "text-brand-primary" : "text-text-secondary hover:text-white"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {activeTab === t.id && (
                <motion.div 
                  layoutId="tab-active"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* End of Day Modal */}
      {showEndOfDay && <EndOfDayModal onClose={() => setShowEndOfDay(false)} />}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
        {activeTab === 'financials' ? (
          <>
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
          <StatCard 
            label="Gross Sales" 
            value={PricingEngine.formatCurrency(stats.totalGross)} 
            icon={TrendingUp}
            color="text-emerald-500"
            info="[NET SALES] + [VAT] + [SERVICE CHARGE]"
          />
          <StatCard 
            label="VAT" 
            value={PricingEngine.formatCurrency(stats.totalVAT)} 
            icon={Filter}
            color="text-amber-500"
            info="VAT % applied per item (Sales Tax)"
          />
          <StatCard 
            label="Service" 
            value={PricingEngine.formatCurrency(stats.totalService)} 
            icon={Clock}
            color="text-sky-500"
            info="12.5% applied to Total Gross for staff"
          />
          <StatCard 
            label="Discount" 
            value={PricingEngine.formatCurrency(stats.totalDiscount)} 
            icon={Percent}
            color="text-rose-500"
            info="Total value of item-level and order-level discounts"
          />
          <StatCard 
            label="Profit" 
            value={PricingEngine.formatCurrency(stats.totalProfit)} 
            icon={TrendingUp}
            color="text-emerald-400"
            info="[GROSS SALES] - [VAT] - [SERVICE CHARGE]"
            highlight
          />
          <StatCard 
            label="Transactions" 
            value={stats.orderCount.toString()} 
            icon={Calendar}
            color="text-white"
            info="Total number of completed orders"
          />
          <StatCard 
            label="ATV" 
            value={PricingEngine.formatCurrency(stats.atv)} 
            icon={Calculator}
            color="text-brand-primary"
            info="[GROSS SALES] / [TOTAL TRANSACTIONS]"
          />
          <StatCard 
            label="Food %" 
            value={`${Math.round(stats.foodPercentage)}%`} 
            icon={Utensils}
            color="text-orange-400"
            info="[FOOD REVENUE] / [GROSS SALES]"
          />
          <StatCard 
            label="Drinks %" 
            value={`${Math.round(stats.drinkPercentage)}%`} 
            icon={GlassWater}
            color="text-blue-400"
            info="[DRINK REVENUE] / [GROSS SALES]"
          />
          <StatCard 
            label="Covers" 
            value={stats.totalCovers.toString()} 
            icon={Users}
            color="text-purple-400"
            info="Total number of guests served"
          />
          <StatCard 
            label="SPH" 
            value={PricingEngine.formatCurrency(stats.sph)} 
            icon={Activity}
            color="text-yellow-400"
            info="[GROSS SALES] / [TOTAL COVERS]"
          />
          <StatCard 
            label="SPHr" 
            value={PricingEngine.formatCurrency(stats.sphr)} 
            icon={Clock}
            color="text-yellow-400"
            info="[GROSS SALES] / [NUMBER OF ACTIVE HOURS]"
          />
        </div>

        {/* Turnaround Performance Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center group hover:border-brand-primary/30 transition-all shadow-sm">
            <Clock className="w-6 h-6 text-brand-primary mb-3" />
            <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Avg Seat to Order</p>
            <p className="text-2xl font-black text-white mt-1 uppercase tracking-tight">{Math.round(stats.avgSeatedToFirst)} <span className="text-[10px] text-text-secondary">min</span></p>
          </div>
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center group hover:border-brand-primary/30 transition-all shadow-sm">
            <TrendingUp className="w-6 h-6 text-emerald-500 mb-3" />
            <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Order to Mains</p>
            <p className="text-2xl font-black text-white mt-1 uppercase tracking-tight">{Math.round(stats.avgFirstToMains)} <span className="text-[10px] text-text-secondary">min</span></p>
          </div>
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center group hover:border-brand-primary/30 transition-all shadow-sm">
            <Coffee className="w-6 h-6 text-amber-500 mb-3" />
            <p className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Mains to Desserts</p>
            <p className="text-2xl font-black text-white mt-1 uppercase tracking-tight">{Math.round(stats.avgMainsToDesserts)} <span className="text-[10px] text-text-secondary">min</span></p>
          </div>
          <div className="bg-bg-card border border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center text-center group hover:border-emerald-500/30 transition-all shadow-sm bg-emerald-500/5">
            <Activity className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Avg Total Turnaround</p>
            <p className="text-2xl font-black text-white mt-1 uppercase tracking-tight">{Math.round(stats.avgTotalDuration)} <span className="text-[10px] text-text-secondary">min</span></p>
          </div>
        </div>

        {/* Shift & Department Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Food vs Drink Split */}
          <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Department Mix</h3>
              <Utensils className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-text-secondary">Food</span>
                  <span className="text-white">{PricingEngine.formatCurrency(stats.foodTotal)} ({stats.totalGross > 0 ? Math.round((stats.foodTotal / stats.totalGross) * 100) : 0}%)</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.totalGross > 0 ? (stats.foodTotal / stats.totalGross) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-text-secondary">Drinks</span>
                  <span className="text-white">{PricingEngine.formatCurrency(stats.drinkTotal)} ({stats.totalGross > 0 ? Math.round((stats.drinkTotal / stats.totalGross) * 100) : 0}%)</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500" style={{ width: `${stats.drinkTotal > 0 ? (stats.alcoholicTotal / stats.drinkTotal) * 100 : 0}%` }} />
                  <div className="h-full bg-cyan-400" style={{ width: `${stats.drinkTotal > 0 ? (stats.nonAlcoholicTotal / stats.drinkTotal) * 100 : 0}%` }} />
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[8px] font-black text-text-muted uppercase">Alcoholic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-[8px] font-black text-text-muted uppercase">Non-Alco.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Shift Performance */}
          <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Shift Analytics</h3>
              <Moon className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {(Object.entries(stats.shiftSales) as [string, { name: string, count: number, total: number }][]).map(([id, data]) => (
                <div key={id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{data.name} SESSION</p>
                    <p className="text-[8px] font-bold text-text-muted uppercase">{data.count} Transactions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-white">{PricingEngine.formatCurrency(data.total)}</p>
                    <p className="text-[8px] font-bold text-brand-primary uppercase">{stats.totalGross > 0 ? Math.round((data.total / stats.totalGross) * 100) : 0}% share</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hourly Sales Heatmap */}
          <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Hourly Velocity</h3>
              <Activity className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="h-24 flex items-end gap-1">
              {(Object.entries(stats.hourlyHeatmap) as unknown as [string, number][]).slice(11, 23).map(([hour, total]) => {
                const max = Math.max(...Object.values(stats.hourlyHeatmap) as number[]);
                const height = max > 0 ? (total / max) * 100 : 0;
                return (
                  <div key={hour} className="flex-1 group relative">
                    <div 
                      className="w-full bg-brand-primary/20 hover:bg-brand-primary rounded-t-sm transition-all cursor-crosshair"
                      style={{ height: `${Math.max(10, height)}%` }}
                    />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-bg-card border border-white/10 px-2 py-1 rounded text-[8px] font-black text-white opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {hour}:00 - {PricingEngine.formatCurrency(total)}
                    </div>
                    <span className="block text-[6px] font-black text-text-muted mt-2 text-center">{hour}h</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Trends Chart */}
          <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Growth & Volume Trends</h3>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Analysis of {chartType} velocity</p>
              </div>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setChartType('revenue')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    chartType === 'revenue' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:text-white"
                  )}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setChartType('covers')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    chartType === 'covers' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-secondary hover:text-white"
                  )}
                >
                  Covers
                </button>
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900 }}
                    tickFormatter={(value) => chartType === 'revenue' ? `£${value}` : value}
                  />
                  <Tooltip 
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                    contentStyle={{ 
                      backgroundColor: '#1E1E2D', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 900, marginBottom: 8, textTransform: 'uppercase' }}
                    itemStyle={{ color: '#fff', fontSize: 12, fontWeight: 900 }}
                    formatter={(value: any) => [chartType === 'revenue' ? PricingEngine.formatCurrency(value * 100) : value, chartType === 'revenue' ? 'Sales' : 'Covers']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartType === 'revenue' ? 'amount' : 'covers'} 
                    stroke={chartType === 'revenue' ? 'var(--color-brand-primary)' : '#8b5cf6'} 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill={`url(#color${chartType === 'revenue' ? 'Rev' : 'Cov'})`} 
                  />
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-brand-primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-brand-primary)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-8">
            {/* Sales by Category */}
            <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Sales by Category</h3>
                <BarChart3 className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="space-y-4">
                {Object.entries(stats.categorySales)
                  .sort(([, a], [, b]) => (b as any).total - (a as any).total)
                  .map(([id, data]: [string, any], idx) => (
                    <div key={id} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span className="text-text-secondary">{data.name}</span>
                        </div>
                        <span className="text-white">{PricingEngine.formatCurrency(data.total)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ 
                            width: `${stats.totalGross > 0 ? (data.total / stats.totalGross) * 100 : 0}%`,
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]
                          }}
                        />
                      </div>
                    </div>
                  ))}
                {Object.keys(stats.categorySales).length === 0 && (
                  <div className="text-center py-8 text-text-muted text-[10px] font-black uppercase tracking-widest opacity-20">
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Sales by Station */}
            <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Sales by Station</h3>
                <div className="flex gap-1">
                  <div className="w-1 h-3 bg-brand-primary rounded-full" />
                  <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(stats.stationSales).map(([id, data]: [string, any]) => (
                  <div key={id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-1">
                    <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">{data.name}</span>
                    <span className="text-sm font-black text-white">{PricingEngine.formatCurrency(data.total)}</span>
                    <span className="text-[8px] font-bold text-text-secondary uppercase">{data.count} Items</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Payment Method Breakdown - Enhanced with Pie Chart */}
            <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Payment Distribution</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="rgba(0,0,0,0.5)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                       contentStyle={{ 
                        backgroundColor: '#1E1E2D', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                {Object.entries(stats.methodBreakdown).map(([method, amount], idx) => (
                  <div key={method} className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="text-text-secondary">{method}</span>
                      </div>
                      <span className="text-white">{PricingEngine.formatCurrency(amount as number)}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${stats.totalGross > 0 ? ((amount as number) / stats.totalGross) * 100 : 0}%`,
                          backgroundColor: PIE_COLORS[idx % PIE_COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales by Employee Competition */}
            <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Staff Performance</h3>
                <Trophy className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-4">
                {Object.entries(stats.employeeSales)
                  .sort(([, a], [, b]) => (b as any).total - (a as any).total)
                  .map(([id, data]: [string, any]) => (
                    <div key={id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-[12px] font-black text-brand-primary border border-brand-primary/20">
                            {data.name?.[0] || '?'}
                          </div>
                          <div>
                            <p className="text-[12px] font-black text-white uppercase tracking-tight">{data.name}</p>
                            <p className="text-[8px] font-bold text-text-muted uppercase tracking-wider">{data.count} Sales</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-500">{PricingEngine.formatCurrency(data.total)}</p>
                          <p className="text-[8px] font-black text-text-muted uppercase">Total Rev</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className="text-[8px] font-black text-text-secondary uppercase">Svc Charge:</span>
                          <span className="text-[8px] font-black text-emerald-400">{PricingEngine.formatCurrency(data.serviceCharge)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3 h-3 text-brand-primary" />
                          <span className="text-[8px] font-black text-text-secondary uppercase">Top Item:</span>
                          <span className="text-[8px] font-black text-white italic">
                            {Object.entries(data.items).sort(([, a], [, b]) => (b as any) - (a as any))[0]?.[0] || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                {Object.keys(stats.employeeSales).length === 0 && (
                  <div className="text-center py-8 text-text-muted text-[10px] font-black uppercase tracking-widest opacity-20">
                    No staff sales recorded
                  </div>
                )}
              </div>
            </div>

            {/* Top Items */}
            <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Top Sellers</h3>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="space-y-4">
                {stats.itemSales.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-text-muted">#{idx + 1}</span>
                      <p className="text-[10px] font-black text-white uppercase tracking-tight">{item.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-emerald-500">{PricingEngine.formatCurrency(item.revenue)}</p>
                      <p className="text-[8px] font-bold text-text-muted uppercase tracking-wider">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-bg-card border border-white/5 rounded-[2rem] overflow-hidden">
          <div className="p-8 border-b border-white/5">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Time</th>
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Order ID</th>
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Amount</th>
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">VAT</th>
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Service</th>
                  <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.slice(0, 10).map(order => {
                  const gross = Number((order as any).totalGross ?? (order as any).grandTotal ?? (order as any).grossSalesAfterDiscount ?? 0);
                  const vat = Number((order as any).vatTotal ?? (order as any).taxTotal ?? (order as any).vatAfterDiscount ?? 0);
                  const service = Number((order as any).serviceCharge ?? (order as any).serviceChargeAmount ?? (order as any).serviceChargeAfterDiscount ?? 0);
                  
                  const staff = staffList.find(s => s.id === order.staffId);

                  return (
                    <tr key={order.id} className="hover:bg-white/5 transition-all">
                      <td className="px-8 py-4 text-[10px] font-mono text-text-secondary">
                        {format(order.createdAt, 'HH:mm:ss')}
                        <div className="text-[8px] font-bold text-text-muted uppercase mt-1">{staff?.name || 'Unknown'}</div>
                      </td>
                      <td className="px-8 py-4 text-[10px] font-black uppercase">
                        <button
                          onClick={() => {
                            setSelectedTxId(order.id);
                            setActiveTab('tickets');
                          }}
                          className="text-white hover:text-brand-primary active:scale-95 transition-all cursor-pointer font-black hover:underline decoration-brand-primary underline-offset-2 text-left"
                          title="View transaction receipt"
                        >
                          {order.id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="px-8 py-4 text-[10px] font-black text-brand-primary uppercase">{PricingEngine.formatCurrency(gross)}</td>
                      <td className="px-8 py-4 text-[10px] font-black text-amber-500 uppercase">{PricingEngine.formatCurrency(vat)}</td>
                      <td className="px-8 py-4 text-[10px] font-black text-status-available uppercase">{PricingEngine.formatCurrency(service)}</td>
                      <td className="px-8 py-4">
                        <span className="px-2 py-1 bg-status-available/10 text-status-available text-[8px] font-black uppercase rounded-md">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-text-muted text-[10px] font-black uppercase tracking-widest opacity-20">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : activeTab === 'tickets' ? (
          <TicketsTransactionsView 
            initialSelectedId={selectedTxId}
            onClearInitialId={() => setSelectedTxId(null)}
          />
        ) : activeTab === 'knowledge' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Avg Knowledge Score</p>
                <p className="text-3xl font-black text-white">
                  {quizSubmissions.length > 0 
                    ? `${Math.round((quizSubmissions.reduce((acc, s) => acc + (s.score / s.totalQuestions), 0) / quizSubmissions.length) * 100)}%`
                    : '0%'}
                </p>
                <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">Growth Mindset</p>
              </div>
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Quizzes Completed</p>
                <p className="text-3xl font-black text-white">{quizSubmissions.length}</p>
                <p className="text-[8px] font-bold text-brand-primary uppercase tracking-tighter">Shift Learning</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Daily Submissions Chart */}
              <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Knowledge Leaderboard</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Staff Name</th>
                        <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Last Quiz Item</th>
                        <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Score</th>
                        <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quizSubmissions.slice(0, 5).map(sub => (
                        <tr key={sub.id} className="hover:bg-white/5 transition-all">
                          <td className="px-8 py-4 text-[10px] font-black text-white uppercase">
                            {staffList.find(s => s.id === sub.staffId)?.name || sub.staffId}
                          </td>
                          <td className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase">{sub.dishName}</td>
                          <td className="px-8 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                              (sub.score / sub.totalQuestions) >= 0.8 ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {sub.score} / {sub.totalQuestions}
                            </span>
                          </td>
                          <td className="px-8 py-4 text-[10px] font-mono text-text-secondary">{format(sub.completedAt, 'MMM dd, HH:mm')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staff Breakdown */}
              <div className="bg-bg-card border border-white/5 rounded-[2rem] p-8 space-y-6">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Performance by Team Member</h3>
                <div className="space-y-4">
                  {staffList.map(staff => {
                    const subs = quizSubmissions.filter(s => s.staffId === staff.id);
                    if (subs.length === 0) return null;
                    
                    const avgScore = subs.reduce((acc: number, s: any) => acc + (Number(s.score) / Number(s.totalQuestions)), 0) / subs.length;
                    const topDish = subs.reduce((acc: Record<string, number>, s: any) => {
                      acc[s.dishName] = (acc[s.dishName] || 0) + 1;
                      return acc;
                    }, {});
                    const mostTested = (Object.entries(topDish) as [string, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];

                    return (
                      <div key={staff.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px]",
                            avgScore >= 0.8 ? "bg-emerald-500/20 text-emerald-500" : "bg-brand-primary/20 text-brand-primary"
                          )}>
                            {Math.round(avgScore * 100)}%
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{staff.name}</p>
                            <p className="text-[8px] font-bold text-text-muted uppercase">Top Known: {mostTested}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-white">{subs.length}</p>
                          <p className="text-[8px] font-bold text-text-muted uppercase">Quizzes</p>
                        </div>
                      </div>
                    );
                  })}
                  {quizSubmissions.length === 0 && (
                    <div className="text-center py-12 opacity-20">
                      <Brain className="w-12 h-12 text-white mx-auto mb-4" />
                      <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">No quiz data yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'audit' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Cancelled Sessions</p>
                <p className="text-3xl font-black text-white">{cancelledSessions.length}</p>
                <p className="text-[8px] font-bold text-status-pending uppercase tracking-tighter">Needs Review</p>
              </div>
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Total Value Reset</p>
                <p className="text-3xl font-black text-white">{PricingEngine.formatCurrency(cancelledSessions.reduce((acc, s) => acc + s.originalValue, 0))}</p>
                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-tighter">Gross Potential</p>
              </div>
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Abuse Risk Level</p>
                <p className="text-3xl font-black text-status-available uppercase">Low</p>
                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-tighter">Based on trends</p>
              </div>
            </div>

            <div className="bg-bg-card border border-white/5 rounded-[2rem] overflow-hidden">
               <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Empty Session Audit Log</h3>
                <span className="text-[8px] font-black bg-white/5 text-text-muted py-1 px-2 rounded uppercase tracking-widest">Last 30 Days</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Date/Time</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Table</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Staff</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Reason</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Items</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cancelledSessions.slice(0, 20).map(session => (
                      <tr key={session.id} className="hover:bg-white/5 transition-all">
                        <td className="px-8 py-4 text-[10px] font-mono text-text-secondary">{format(session.cancelledAt, 'MMM dd, HH:mm')}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-white uppercase">{session.tableId}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase">{staffList.find(s => s.id === session.staffId)?.name || session.staffId}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-status-pending uppercase">{session.reason}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-white uppercase">{session.originalItemCount}</td>
                        <td className="px-8 py-4 text-[10px] font-black text-text-muted uppercase">{PricingEngine.formatCurrency(session.originalValue)}</td>
                      </tr>
                    ))}
                    {cancelledSessions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-text-muted text-[10px] font-black uppercase tracking-widest opacity-20">
                          No cancelled sessions recorded
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Critical Low Stock</p>
                <p className="text-3xl font-black text-rose-500">0</p>
                <p className="text-[8px] font-bold text-text-secondary uppercase tracking-tighter">Items at 0%</p>
              </div>
              <div className="bg-bg-card border border-white/5 rounded-3xl p-8 space-y-2">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">Theoretical Cost</p>
                <p className="text-3xl font-black text-white">{PricingEngine.formatCurrency(stats.totalNet * 0.28)}</p>
                <p className="text-[8px] font-bold text-brand-primary uppercase tracking-tighter">Est. 28% Food Cost</p>
              </div>
            </div>

            <div className="bg-bg-card border border-white/5 rounded-[2rem] overflow-hidden">
               <div className="p-8 border-b border-white/5">
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Theoretical Stock Depletion</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Item Name</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Category</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Units Sold</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Revenue Impact</th>
                      <th className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest">Est. Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {menuItems.slice(0, 15).map(item => {
                      const unitsSold = stats.itemSales.find(s => s.name === item.name)?.quantity || 0;
                      const revenue = stats.itemSales.find(s => s.name === item.name)?.revenue || 0;
                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-all">
                          <td className="px-8 py-4 text-[10px] font-black text-white uppercase">{item.name}</td>
                          <td className="px-8 py-4 text-[10px] font-black text-text-secondary uppercase">{categories.find(c => c.id === item.categoryId)?.name || 'Misc'}</td>
                          <td className="px-8 py-4 text-[10px] font-black text-white uppercase">{unitsSold}</td>
                          <td className="px-8 py-4 text-[10px] font-black text-emerald-500 uppercase">{PricingEngine.formatCurrency(revenue)}</td>
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[100px]">
                                <div className="h-full bg-emerald-500" style={{ width: '80%' }} />
                              </div>
                              <span className="text-[8px] font-black text-status-available uppercase">Available</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, trend, color = "text-white", info, highlight = false }: { label: string; value: string; icon: any; trend?: string; color?: string; info?: string; highlight?: boolean }) => (
  <div className={cn(
    "bg-bg-card border border-white/5 rounded-2xl p-4 md:p-5 space-y-3 shadow-xl transition-all hover:scale-[1.01] flex flex-col justify-between",
    highlight && "border-emerald-500/30 bg-emerald-500/[0.02]"
  )}>
    <div className="flex items-center justify-between">
      <div className={cn("p-1.5 bg-white/5 rounded-lg", highlight && "bg-emerald-500/10")}>
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="group relative">
        <HelpCircle className="w-3 text-text-muted cursor-help hover:text-white transition-colors" />
        <div className="absolute right-0 bottom-full mb-2 w-48 p-3 bg-bg-card border border-white/10 rounded-2xl text-[8px] font-black uppercase tracking-widest text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-2xl z-50">
          <p className="text-white mb-1.5 border-b border-white/5 pb-1.5 flex items-center gap-1.5">
            <Info className="w-2.5 h-2.5 text-brand-primary" />
            Formula
          </p>
          {info}
        </div>
      </div>
    </div>
    <div className="pt-1">
      <p className="text-[9px] md:text-[10px] font-black text-text-secondary uppercase tracking-widest truncate">{label}</p>
      <h4 className={cn("text-base md:text-lg font-black mt-0.5 tracking-tight", color)}>{value}</h4>
    </div>
  </div>
);
