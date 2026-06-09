import React from 'react';
import { usePOSStore } from '../../app/store';
import { StaffProfile } from '../../types/pos';
import { 
  Users, UserPlus, Shield, Key, Search,
  CheckCircle2, AlertCircle, Trash2, Edit2, ChevronRight,
  ShieldAlert, ShieldCheck, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

const AVAILABLE_ROLES: StaffProfile['role'][] = [
  'waiter', 'bartender', 'chef', 'supervisor', 'manager', 'admin'
];

export const StaffManagement: React.FC = () => {
  const { staffList, addStaff, updateStaff } = usePOSStore();
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<StaffProfile | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredStaff = staffList.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text"
            placeholder="Search staff by name or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-brand-primary hover:bg-brand-primary-light text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all shadow-lg shadow-brand-primary/20"
        >
          <UserPlus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((staff) => (
          <motion.div 
            key={staff.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/5 rounded-3xl p-6 hover:border-brand-primary/30 transition-all group"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                  <span className="text-white font-black text-xl">{staff.name[0]}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-bold text-base leading-tight">{staff.name}</h3>
                    {staff.isClockedIn ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500/50" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-brand-primary/20 text-brand-primary text-[9px] font-black uppercase tracking-widest rounded-full">{staff.role}</span>
                    <span className="text-[10px] text-text-muted font-mono font-bold tracking-widest">PIN: {staff.pin}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setEditingStaff(staff)}
                className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-text-muted">
                <span>POS Access</span>
                {staff.role !== 'chef' ? (
                   <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Granted</span>
                ) : (
                   <span className="text-amber-400 flex items-center gap-1"><Shield className="w-3 h-3" /> Kitchen Only</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <PermissionBadge label="Void" active={staff.permissions?.canVoid || false} />
                <PermissionBadge label="Discount" active={staff.permissions?.canDiscount || false} />
                <PermissionBadge label="Refund" active={staff.permissions?.canRefund || false} />
                <PermissionBadge label="Floor" active={staff.permissions?.canManageFloor || false} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {(showAddModal || editingStaff) && (
          <StaffModal 
            staff={editingStaff} 
            onClose={() => { setShowAddModal(false); setEditingStaff(null); }}
            onSave={async (data) => {
              if (editingStaff) {
                await updateStaff(editingStaff.id, data);
              } else {
                await addStaff(data as any);
              }
              setShowAddModal(false);
              setEditingStaff(null);
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const PermissionBadge = ({ label, active }: { label: string, active: boolean }) => (
  <div className={cn(
    "px-3 py-1.5 rounded-xl border flex items-center justify-between transition-all",
    active ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-white/2 border-white/5 text-text-muted opacity-50"
  )}>
    <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    {active ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
  </div>
);

interface StaffModalProps {
  staff?: StaffProfile | null;
  onClose: () => void;
  onSave: (data: Partial<StaffProfile>) => Promise<void>;
}

const StaffModal: React.FC<StaffModalProps> = ({ staff, onClose, onSave }) => {
  const [formData, setFormData] = React.useState<Partial<StaffProfile>>(
    {
      name: staff?.name || '',
      pin: staff?.pin || '',
      role: staff?.role || 'waiter',
      permissions: {
        canVoid: staff?.permissions?.canVoid ?? false,
        canDiscount: staff?.permissions?.canDiscount ?? false,
        canRefund: staff?.permissions?.canRefund ?? false,
        canManageFloor: staff?.permissions?.canManageFloor ?? true,
      }
    }
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const handleRoleChange = (role: StaffProfile['role']) => {
    // Default permissions based on role
    const permissions = {
      canVoid: ['manager', 'admin', 'supervisor'].includes(role),
      canDiscount: ['manager', 'admin', 'supervisor'].includes(role),
      canRefund: ['manager', 'admin'].includes(role),
      canManageFloor: ['waiter', 'bartender', 'supervisor', 'manager', 'admin'].includes(role),
    };
    setFormData(prev => ({ ...prev, role, permissions }));
  };

  const togglePermission = (key: keyof StaffProfile['permissions']) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions!,
        [key]: !prev.permissions?.[key]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.pin || formData.pin.length < 4) return;
    setIsSaving(true);
    await onSave(formData);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-bg-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary/20 rounded-2xl flex items-center justify-center border border-brand-primary/40 text-brand-primary">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{staff ? 'Edit Employee' : 'New Employee'}</h2>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest mt-0.5">HUB POS Access Management</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">Full Name</label>
              <input 
                autoFocus
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none focus:border-brand-primary transition-colors text-sm"
                placeholder="e.g. John Smith"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">Access PIN</label>
              <input 
                required
                type="text"
                pattern="[0-9]*"
                maxLength={6}
                value={formData.pin}
                onChange={e => setFormData(p => ({ ...p, pin: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono font-bold tracking-[0.5em] focus:outline-none focus:border-brand-primary transition-colors text-sm"
                placeholder="4-6 Digits"
              />
            </div>
          </div>

          <div className="space-y-4">
             <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">Assigned Role</label>
             <div className="grid grid-cols-3 gap-3">
                {AVAILABLE_ROLES.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleRoleChange(role)}
                    className={cn(
                      "px-4 py-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                      formData.role === role 
                        ? "bg-brand-primary/20 border-brand-primary border-2 text-brand-primary" 
                        : "bg-white/2 border-white/5 text-text-muted hover:border-white/20"
                    )}
                  >
                    {role}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
             <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] ml-2">POS Permissions</label>
                <div className="flex items-center gap-2 text-[10px] font-black text-brand-primary uppercase italic">
                   <Shield className="w-3 h-3" /> Auto-Preset by Role
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <PermissionToggle 
                  label="Can Void Items" 
                  description="Required for corrections"
                  active={formData.permissions?.canVoid || false}
                  onToggle={() => togglePermission('canVoid')}
                />
                <PermissionToggle 
                  label="Can Apply Discounts" 
                  description="Approval rights"
                  active={formData.permissions?.canDiscount || false}
                  onToggle={() => togglePermission('canDiscount')}
                />
                <PermissionToggle 
                  label="Can Refund" 
                  description="High-security access"
                  active={formData.permissions?.canRefund || false}
                  onToggle={() => togglePermission('canRefund')}
                />
                <PermissionToggle 
                  label="Floor Management" 
                  description="Table seating & zones"
                  active={formData.permissions?.canManageFloor || false}
                  onToggle={() => togglePermission('canManageFloor')}
                />
             </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-[2] bg-brand-primary hover:bg-brand-primary-light disabled:opacity-50 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-3"
            >
              {isSaving ? 'Processing...' : staff ? 'Save Changes' : 'Create Employee'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const PermissionToggle = ({ label, description, active, onToggle }: any) => (
  <button 
    type="button"
    onClick={onToggle}
    className={cn(
      "p-4 rounded-3xl border flex items-center gap-4 transition-all text-left",
      active ? "bg-brand-primary/5 border-brand-primary/30" : "bg-white/2 border-white/5 opacity-60"
    )}
  >
    <div className={cn(
       "w-5 h-5 rounded-lg flex items-center justify-center transition-all",
       active ? "bg-brand-primary text-white" : "bg-white/10 text-text-muted"
    )}>
       {active ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-2 h-2 rounded-full bg-white/20" />}
    </div>
    <div>
      <p className={cn("text-[10px] font-black uppercase tracking-tight", active ? "text-brand-primary" : "text-white")}>{label}</p>
      <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest mt-0.5">{description}</p>
    </div>
  </button>
);
