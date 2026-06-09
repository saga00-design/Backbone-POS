import React, { useState, useEffect } from 'react';
import { usePOSStore } from '../../app/store';
import { StaffProfile } from '../../types/pos';
import { db, auth, googleProvider } from '../../lib/firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { Delete, ShieldAlert, Wifi, WifiOff, LogIn, UserCheck, Copy, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, sanitizeForFirestore } from '../../lib/utils';
import { POS_CONFIG } from '../../app/config';

export const PinLoginScreen: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [authenticatedStaff, setAuthenticatedStaff] = useState<StaffProfile | null>(null);
  const { setStaff, staffList, syncFromHub, clockIn } = usePOSStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClockingIn, setIsClockingIn] = useState(false);

  const handleSync = async () => {
    if (!googleUser) {
      alert('Please Login with Google first to verify your Manager identity.');
      return;
    }
    console.log('Starting sync from hub...');
    setIsSyncing(true);
    try {
      await syncFromHub();
      console.log('Sync from hub completed successfully.');
      alert('Sync complete!');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Check console for details.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    console.log('PinLoginScreen: staffList updated', staffList);
  }, [staffList]);

  const handleGoogleLogin = async () => {
    console.log('Attempting Google Login...');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Google Login success:', result.user.email);
    } catch (err) {
      console.error('Google Login failed:', err);
      alert('Google Login failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handlePress = (num: string) => {
    setError(false);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      if (newPin.length === 4) {
        const staff = staffList.find(s => s.pin === newPin);
        if (staff) {
          if (staff.isClockedIn) {
            setStaff(staff);
          } else {
            setAuthenticatedStaff(staff);
          }
        } else {
          setTimeout(() => {
            setPin('');
            setError(true);
          }, 200);
        }
      }
    }
  };

  const handleClockIn = async () => {
    if (!authenticatedStaff) return;
    setIsClockingIn(true);
    try {
      await clockIn(authenticatedStaff.id);
      // Re-find staff in list to get updated clock-in timestamp
      const updatedStaff = staffList.find(s => s.id === authenticatedStaff.id);
      setStaff(updatedStaff || authenticatedStaff);
    } catch (err) {
      console.error('Clock in failed:', err);
    } finally {
      setIsClockingIn(false);
    }
  };

  const bootstrapFirstUser = async () => {
    if (!googleUser) {
      alert('Please Login with Google first to verify your Manager identity.');
      return;
    }
    if (googleUser.email !== 'saga00@gmail.com') {
      alert(`Access Denied: Only saga00@gmail.com can bootstrap the system. You are logged in as ${googleUser.email}`);
      return;
    }
    try {
      // Use setDoc with the googleUser.uid to ensure isManager() rule works
      await setDoc(doc(db, 'staffProfiles', googleUser.uid), sanitizeForFirestore({
        id: googleUser.uid,
        name: googleUser.displayName || 'Admin',
        pin: '1234',
        role: 'manager',
        locationId: POS_CONFIG.LOCATION_ID,
        permissions: { canVoid: true, canDiscount: true, canRefund: true, canManageFloor: true }
      }));
      alert('Admin user created (PIN: 1234). You can now log in using the keypad.');
    } catch (err) {
      console.error('Error bootstrapping user:', err);
      alert('Bootstrap failed. Ensure you are logged in as saga00@gmail.com.');
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  if (authenticatedStaff) {
    return (
      <div className="h-screen w-screen bg-bg-dark flex flex-col items-center justify-center p-6 bg-gradient-to-br from-bg-dark to-brand-primary/5">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-bg-card border border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary" />
          
          <div className="mb-8">
            <div className="w-24 h-24 bg-brand-primary/10 rounded-full mx-auto mb-6 flex items-center justify-center border border-brand-primary/20">
              <span className="text-4xl text-brand-primary font-black uppercase tracking-tighter">
                {authenticatedStaff.name[0]}
              </span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-1">Welcome, {authenticatedStaff.name}</h2>
            <p className="text-text-muted text-[10px] font-black uppercase tracking-widest">{authenticatedStaff.role} • Ready for Duty</p>
          </div>

          <div className="space-y-4 mb-10">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em]">Shift Status</span>
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase rounded-full">Off Duty</span>
              </div>
              <p className="text-xs font-bold text-white uppercase tracking-tight leading-relaxed">
                You are currently clocked out. To access the POS and start your session, please clock in now.
              </p>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-brand-primary/5 rounded-xl border border-brand-primary/10">
              <UserCheck className="w-4 h-4 text-brand-primary" />
              <span className="text-[9px] font-black text-brand-primary uppercase tracking-widest">Shift Briefing required upon entry</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button 
              onClick={handleClockIn}
              disabled={isClockingIn}
              className="w-full py-6 bg-brand-primary hover:bg-brand-primary-light text-white rounded-3xl text-sm font-black uppercase tracking-[0.1em] transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {isClockingIn ? 'Clocking In...' : 'Start Shift & Enter'}
              <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setAuthenticatedStaff(null); setPin(''); }}
              className="w-full py-4 text-text-muted hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Wait, Not Me / Back
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-bg-dark flex flex-col items-center justify-center p-6">
      {/* Manager Identity (Google) */}
      <div className="mb-8 flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/10">
        {googleUser ? (
          <>
            <UserCheck className="w-4 h-4 text-status-available" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">{googleUser.displayName}</span>
              <span className="text-[8px] uppercase font-bold text-status-available tracking-tighter">Verified Manager</span>
            </div>
          </>
        ) : (
          <button 
            onClick={handleGoogleLogin}
            className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span className="text-[10px] uppercase font-black tracking-widest">Manager Login (Google)</span>
          </button>
        )}
      </div>

      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-white/5 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-white/5 overflow-hidden p-3 border border-white/10">
          <img src="/Backbonehub-ico.png" alt="Backbone" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white mb-2">Backbone POS</h1>
        <p className="text-text-secondary font-medium uppercase tracking-widest text-[10px]">Enter Staff PIN to Start</p>
        <div className="mt-2 text-[8px] text-text-muted uppercase font-bold tracking-widest">
          {staffList.length} Staff Loaded • {googleUser ? 'Authenticated' : 'Not Authenticated'}
        </div>
      </div>

      <div className="w-full max-w-sm">
        {/* PIN Display */}
        <div className="flex justify-center gap-4 mb-12">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                error ? 'border-status-pending bg-status-pending' :
                pin.length > i ? 'border-brand-primary bg-brand-primary' : 'border-white/10'
              }`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <KeyButton key={num} label={num.toString()} onClick={() => handlePress(num.toString())} />
          ))}
          <div />
          <KeyButton label="0" onClick={() => handlePress('0')} />
          <button 
            onClick={handleDelete}
            className="h-16 md:h-20 rounded-2xl md:rounded-3xl bg-white/5 flex items-center justify-center text-white/40 hover:bg-white/10 active:scale-95 transition-all"
          >
            <Delete className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        </div>

        {(staffList.length === 0 || googleUser) && (
          <div className="mt-12 flex flex-col gap-4 w-full">
            {staffList.length === 0 && (
              <button 
                onClick={bootstrapFirstUser}
                className="w-full flex items-center justify-center gap-2 text-text-muted hover:text-white text-[10px] uppercase font-black tracking-widest"
              >
                <ShieldAlert className="w-3 h-3" />
                Bootstrap First User
              </button>
            )}
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 text-brand-primary hover:text-white text-[10px] uppercase font-black tracking-widest disabled:opacity-50"
            >
              <Copy className="w-3 h-3" />
              {isSyncing ? 'Syncing...' : 'Sync Users from Hub'}
            </button>
            {googleUser && staffList.length > 0 && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-[8px] text-text-muted uppercase font-bold mb-2">Available PINs (Debug):</p>
                <div className="flex flex-wrap gap-2">
                  {staffList.map(s => (
                    <span key={s.id} className="text-[10px] text-white font-mono bg-white/10 px-2 py-1 rounded">
                      {s.name}: {s.pin}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface KeyButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

const KeyButton: React.FC<KeyButtonProps> = ({ label, onClick, className }) => (
  <button 
    onClick={onClick}
    className={cn(
      "h-16 md:h-20 rounded-2xl md:rounded-3xl bg-bg-card border border-white/5 flex items-center justify-center text-2xl md:text-3xl font-bold text-white hover:bg-bg-accent active:scale-95 transition-all shadow-sm",
      className
    )}
  >
    {label}
  </button>
);
