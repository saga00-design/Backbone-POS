import React, { useState, useEffect } from 'react';
import { 
  Save, RotateCcw, Printer, Copy, Download, Upload, 
  HelpCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, 
  Eye, EyeOff, Layout, FileText, Settings, Image as ImageIcon, 
  Hash, DollarSign, Percent, QrCode, CreditCard, AlignCenter, 
  AlignLeft, AlignRight, Play, Sun, Moon
} from 'lucide-react';
import { usePOSStore } from '../../app/store';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ReceiptTemplate } from '../../types/receipt';
import { getDefaultReceiptTemplate, SAMPLE_POS_ORDERS } from './receiptDefaults';
import { ReceiptPreview } from './ReceiptPreview';
import { printCustomerReceipt } from '../../lib/receiptPrinter';
import { POS_CONFIG } from '../../app/config';
import { cn } from '../../lib/utils';

export const ReceiptTemplateEditor: React.FC = () => {
  const { currentStaff, staffList = [], allOrders = [] } = usePOSStore();
  const LOCATION_ID = POS_CONFIG.LOCATION_ID;

  // Active designer states
  const [template, setTemplate] = useState<ReceiptTemplate>(() => getDefaultReceiptTemplate(LOCATION_ID));
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activePreviewOrder, setActivePreviewOrder] = useState<'sample' | 'real'>('sample');
  const [reprintWatermark, setReprintWatermark] = useState<'reprint' | 'training' | 'nosale' | null>(null);
  const [activeSection, setActiveSection] = useState<string>('header');
  const [errorMessage, setErrorMessage] = useState('');

  // Validation Warnings list
  const [warnings, setWarnings] = useState<string[]>([]);

  // Selected real order for template preview (if available, pick the latest paid/completed one)
  const realOrderForPreview = React.useMemo(() => {
    const sorted = [...allOrders].sort((a, b) => b.createdAt - a.createdAt);
    const completed = sorted.find(o => ['paid', 'completed'].includes(o.status));
    return completed || sorted[0] || null;
  }, [allOrders]);

  // Load from firestore on mount
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setIsLoading(true);
        const docRef = doc(db, 'receiptTemplates', LOCATION_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setTemplate(docSnap.data() as ReceiptTemplate);
        } else {
          // If no template in firestore, initialize with default
          const defaultTpl = getDefaultReceiptTemplate(LOCATION_ID);
          setTemplate(defaultTpl);
        }
      } catch (err) {
        console.error('Failed to loading receipt template:', err);
        setErrorMessage('Could not load custom receipt template. Using local defaults.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplate();
  }, [LOCATION_ID]);

  // Handle active warnings assessment
  useEffect(() => {
    const list: string[] = [];
    if (!template.header.businessName.trim()) {
      list.push('Business Name is currently empty.');
    }
    if (template.totals.showVat && !template.header.vatNumber.trim()) {
      list.push('VAT Table/Summary is enabled, but VAT Number is missing under Header details.');
    }
    if (template.qrCode.enabled && template.qrCode.qrType === 'payment_link') {
      list.push('Dynamic Payment QR Code is enabled (ensure payment integrations are activated under Backbone HUB).');
    }
    if (template.header.logoUrl && template.header.logoSize === 'large') {
      list.push('Primary logo size is set to Large - this might increase thermal paper roll usage.');
    }
    if (template.paperSize === '58mm' && template.footer.refundPolicy.length > 80) {
      list.push('Refund/Return text is quite long and may cause formatting overlap on 58mm narrow printers.');
    }
    setWarnings(list);
  }, [template]);

  // Guard: Only manager/admin/architect can access (we checked currentStaff inside parent SettingsScreen, but let's have an extra safety layer)
  const canEdit = currentStaff?.role === 'admin' || currentStaff?.role === 'manager';

  // Toggle editor accordions
  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? '' : section);
  };

  // Helper to deep update template state
  const updateNestedSetting = (category: keyof ReceiptTemplate, field: string, value: any) => {
    setTemplate(prev => {
      const categoryObj = prev[category];
      if (typeof categoryObj === 'object' && categoryObj !== null) {
        return {
          ...prev,
          [category]: {
            ...categoryObj,
            [field]: value
          }
        };
      }
      return {
        ...prev,
        [category]: value
      };
    });
  };

  // Save changes to Firestore
  const handleSave = async () => {
    if (!canEdit) {
      alert('Permission Denied: Only Manager or Admin roles can save ticket configurations.');
      return;
    }
    setSaveStatus('saving');
    try {
      const docRef = doc(db, 'receiptTemplates', LOCATION_ID);
      await setDoc(docRef, {
        ...template,
        updatedAt: Date.now(),
        updatedBy: currentStaff?.id || 'unknown'
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save receipt template:', err);
      setSaveStatus('error');
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    if (window.confirm('Are you sure you want to reset this receipt layout to Backbone defaults? This will overwrite your current settings.')) {
      setTemplate(getDefaultReceiptTemplate(LOCATION_ID));
    }
  };

  // Export as JSON file
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${template.templateName.replace(/\s+/g, '_')}_${LOCATION_ID}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON configuration
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === 'object' && parsed.header && parsed.items) {
          setTemplate({
            ...parsed,
            id: LOCATION_ID,
            siteId: LOCATION_ID
          });
          alert('Receipt template successfully imported!');
        } else {
          alert('Invalid template format. Please check the JSON integrity.');
        }
      } catch (err) {
        alert('Could not parse template JSON file.');
      }
    };
    fileReader.readAsText(file);
  };

  // Trigger test-print (browser native modal execution)
  const handleTestPrint = async () => {
    const dataOrder = activePreviewOrder === 'sample' ? SAMPLE_POS_ORDERS[0] : realOrderForPreview;
    if (!dataOrder) {
      alert('No order available to trigger print page. Try sample order option.');
      return;
    }
    await printCustomerReceipt(
      dataOrder.id, 
      template, 
      dataOrder, 
      currentStaff?.id || 'stf_stefy', 
      reprintWatermark || 'customer_copy'
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center p-12 bg-bg-dark text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="text-text-muted text-[10px] uppercase font-black tracking-widest">Loading designer database...</p>
        </div>
      </div>
    );
  }

  // Get active order object safely
  const previewOrder = activePreviewOrder === 'sample' 
    ? SAMPLE_POS_ORDERS[0] 
    : (realOrderForPreview || SAMPLE_POS_ORDERS[0]);

  return (
    <div className="h-full grid grid-cols-1 xl:grid-cols-12 gap-8 p-1">
      
      {/* LEFT: SETTINGS COLUMN (7 cols) */}
      <div className="xl:col-span-7 flex flex-col gap-6 bg-bg-card/50 border border-white/5 rounded-3xl p-6 overflow-y-auto max-h-[82vh] custom-scrollbar">
        
        {/* Editor Title Panel */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-widest flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-primary" />
              Template Customiser
            </h2>
            <p className="text-text-muted text-[10px] font-bold uppercase mt-1 tracking-wider">
              Visual designer engine for customer receipts and kitchen dockets
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[10px] font-sans font-bold">MODE:</span>
            <span className="bg-brand-primary/10 text-brand-primary text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-brand-primary/20">
              {currentStaff?.role} Access
            </span>
          </div>
        </div>

        {/* Global Template Properties */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Template Name</label>
            <input 
              type="text" 
              value={template.templateName}
              onChange={(e) => setTemplate(p => ({ ...p, templateName: e.target.value }))}
              className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans focus:outline-none focus:border-brand-primary"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Layout Preset</label>
            <select 
              value={template.paperSize}
              onChange={(e) => setTemplate(p => ({ ...p, paperSize: e.target.value as any }))}
              className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans focus:outline-none focus:border-brand-primary"
            >
              <option value="80mm">80mm Standard Thermal Roll</option>
              <option value="58mm">58mm Narrow POS Receipt</option>
              <option value="A4">A4 Formal Invoice / Bill Layout</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Receipt Font Size</label>
            <select 
              value={template.fontSize}
              onChange={(e) => setTemplate(p => ({ ...p, fontSize: e.target.value as any }))}
              className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans focus:outline-none focus:border-brand-primary"
            >
              <option value="small">Small (Dense Printing)</option>
              <option value="medium">Medium Standard</option>
              <option value="large">Large Legibility</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">Line Spacing Ratio</label>
            <select 
              value={template.lineSpacing}
              onChange={(e) => setTemplate(p => ({ ...p, lineSpacing: e.target.value as any }))}
              className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans focus:outline-none focus:border-brand-primary"
            >
              <option value="compact">Compact (Save Paper)</option>
              <option value="normal">Normal Elegant</option>
              <option value="spacious">Spacious/Airy</option>
            </select>
          </div>
        </div>

        {/* ACCORDION EDITOR BLOCKS */}
        <div className="space-y-4">
          
          {/* SEC 1: HEADER CUSTOMISATION */}
          <AccordionBlock 
            title="Header & Brand" 
            icon={<Layout className="w-4 h-4 text-emerald-500" />}
            isOpen={activeSection === 'header'}
            onClick={() => toggleSection('header')}
          >
            <div className="space-y-4 pt-2">
              <ToggleRow 
                label="Show Brand Logo" 
                checked={template.header.showLogo}
                onChange={(v) => updateNestedSetting('header', 'showLogo', v)}
              />
              
              {template.header.showLogo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-brand-primary/20 pb-2">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-zinc-400 mb-1">LOGO IMAGE URL</label>
                    <input 
                      type="text" 
                      value={template.header.logoUrl}
                      onChange={(e) => updateNestedSetting('header', 'logoUrl', e.target.value)}
                      placeholder="https://images.unsplash.com/etc..."
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans focus:outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-1">LOGO ALIGNMENT</label>
                    <div className="flex gap-1 bg-bg-dark p-1 rounded-xl border border-white/10">
                      <button 
                        onClick={() => updateNestedSetting('header', 'logoAlign', 'left')}
                        className={cn("flex-1 py-1 rounded text-[10px] font-bold text-zinc-400 hover:text-white", template.header.logoAlign === 'left' && "bg-brand-primary text-white shadow")}
                      >
                        Left
                      </button>
                      <button 
                        onClick={() => updateNestedSetting('header', 'logoAlign', 'center')}
                        className={cn("flex-1 py-1 rounded text-[10px] font-bold text-zinc-400 hover:text-white", template.header.logoAlign === 'center' && "bg-brand-primary text-white shadow")}
                      >
                        Center
                      </button>
                      <button 
                        onClick={() => updateNestedSetting('header', 'logoAlign', 'right')}
                        className={cn("flex-1 py-1 rounded text-[10px] font-bold text-zinc-400 hover:text-white", template.header.logoAlign === 'right' && "bg-brand-primary text-white shadow")}
                      >
                        Right
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-1">LOGO SIZE</label>
                    <select 
                      value={template.header.logoSize}
                      onChange={(e) => updateNestedSetting('header', 'logoSize', e.target.value)}
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                    >
                      <option value="small">Small (40px)</option>
                      <option value="medium">Medium (80px)</option>
                      <option value="large">Large (110px)</option>
                    </select>
                  </div>
                </div>
              )}

              <ToggleRow 
                label="Show Business Name" 
                checked={template.header.showBusinessName}
                onChange={(v) => updateNestedSetting('header', 'showBusinessName', v)}
              />

              {template.header.showBusinessName && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-brand-primary/20 pb-2">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-1">BUSINESS NAME TEXT</label>
                    <input 
                      type="text" 
                      value={template.header.businessName}
                      onChange={(e) => updateNestedSetting('header', 'businessName', e.target.value)}
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 mb-1">FONT DISPLAY SIZE</label>
                    <select 
                      value={template.header.businessNameFontSize}
                      onChange={(e) => updateNestedSetting('header', 'businessNameFontSize', e.target.value)}
                      className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                    >
                      <option value="sm">Small H2</option>
                      <option value="md">Medium H2</option>
                      <option value="lg">Large Title</option>
                      <option value="xl">Extra Large Title (XOLO Special)</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">CUSTOM HEADER SLOGAN / MESSAGE</label>
                <input 
                  type="text" 
                  value={template.header.customHeaderText}
                  onChange={(e) => updateNestedSetting('header', 'customHeaderText', e.target.value)}
                  placeholder="e.g. Welcome to XOLO Tacos!"
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>
          </AccordionBlock>

          {/* SEC 2: BUSINESS DETAILS */}
          <AccordionBlock 
            title="Business Details & Info" 
            icon={<Settings className="w-4 h-4 text-sky-500" />}
            isOpen={activeSection === 'details'}
            onClick={() => toggleSection('details')}
          >
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">ADDRESS LINES (one per line)</label>
                <textarea 
                  rows={3}
                  value={template.header.addressLines.join('\n')}
                  onChange={(e) => updateNestedSetting('header', 'addressLines', e.target.value.split('\n'))}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-mono focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">VAT REGISTRATION NO.</label>
                  <input 
                    type="text" 
                    value={template.header.vatNumber}
                    onChange={(e) => updateNestedSetting('header', 'vatNumber', e.target.value)}
                    placeholder="e.g. GB 123 4567 89"
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">COMPANY HOUSE NO.</label>
                  <input 
                    type="text" 
                    value={template.header.companyNumber}
                    onChange={(e) => updateNestedSetting('header', 'companyNumber', e.target.value)}
                    placeholder="e.g. SC 987654"
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">CONTACT PHONE</label>
                  <input 
                    type="text" 
                    value={template.header.phone}
                    onChange={(e) => updateNestedSetting('header', 'phone', e.target.value)}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">EMAIL CONTACT</label>
                  <input 
                    type="email" 
                    value={template.header.email}
                    onChange={(e) => updateNestedSetting('header', 'email', e.target.value)}
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                  />
                </div>
              </div>
            </div>
          </AccordionBlock>

          {/* SEC 3: ORDER DETAILS */}
          <AccordionBlock 
            title="Order Details Layout" 
            icon={<Hash className="w-4 h-4 text-purple-500" />}
            isOpen={activeSection === 'orderinfo'}
            onClick={() => toggleSection('orderinfo')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <ToggleRow 
                label="Show Server/Staff Name" 
                checked={template.orderDetails.showServer}
                onChange={(v) => updateNestedSetting('orderDetails', 'showServer', v)}
              />
              <ToggleRow 
                label="Show Staff Work Role" 
                checked={template.orderDetails.showStaffRole}
                onChange={(v) => updateNestedSetting('orderDetails', 'showStaffRole', v)}
              />
              <ToggleRow 
                label="Show Table/Zone Name" 
                checked={template.orderDetails.showTableNumber}
                onChange={(v) => updateNestedSetting('orderDetails', 'showTableNumber', v)}
              />
              <ToggleRow 
                label="Show Guest Covers Count" 
                checked={template.orderDetails.showGuestCount}
                onChange={(v) => updateNestedSetting('orderDetails', 'showGuestCount', v)}
              />
              <ToggleRow 
                label="Show Order ID Check #" 
                checked={template.orderDetails.showCheckNumber}
                onChange={(v) => updateNestedSetting('orderDetails', 'showCheckNumber', v)}
              />
              <ToggleRow 
                label="Show Receipt Creation Date" 
                checked={template.orderDetails.showDate}
                onChange={(v) => updateNestedSetting('orderDetails', 'showDate', v)}
              />
              <ToggleRow 
                label="Show Paid Complete Time" 
                checked={template.orderDetails.showTime}
                onChange={(v) => updateNestedSetting('orderDetails', 'showTime', v)}
              />
              <ToggleRow 
                label="Show Customer Type Label" 
                checked={template.orderDetails.showCustomerName}
                onChange={(v) => updateNestedSetting('orderDetails', 'showCustomerName', v)}
              />
            </div>
          </AccordionBlock>

          {/* SEC 4: ITEMS LIST OPTIONS */}
          <AccordionBlock 
            title="Itemised Entries & Styling" 
            icon={<Layout className="w-4 h-4 text-brand-primary" />}
            isOpen={activeSection === 'items'}
            onClick={() => toggleSection('items')}
          >
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToggleRow 
                  label="Show Itemised Quantity" 
                  checked={template.items.showQuantity}
                  onChange={(v) => updateNestedSetting('items', 'showQuantity', v)}
                />
                <ToggleRow 
                  label="Show Unique Price Fields" 
                  checked={template.items.showPrice}
                  onChange={(v) => updateNestedSetting('items', 'showPrice', v)}
                />
                <ToggleRow 
                  label="Display Modifiers" 
                  checked={template.items.showModifiers}
                  onChange={(v) => updateNestedSetting('items', 'showModifiers', v)}
                />
                <ToggleRow 
                  label="Show Custom Order Notes" 
                  checked={template.items.showNotes}
                  onChange={(v) => updateNestedSetting('items', 'showNotes', v)}
                />
                <ToggleRow 
                  label="Include Voided Items in List" 
                  checked={template.items.showVoidedItems}
                  onChange={(v) => updateNestedSetting('items', 'showVoidedItems', v)}
                />
                <ToggleRow 
                  label="Print Course Categories (e.g. Starters)" 
                  checked={template.items.showCourseName}
                  onChange={(v) => updateNestedSetting('items', 'showCourseName', v)}
                />
                <ToggleRow 
                  label="Show Calories Count per Dish" 
                  checked={template.items.showCalories}
                  onChange={(v) => updateNestedSetting('items', 'showCalories', v)}
                />
                <ToggleRow 
                  label="Display Hub Sustainability Score" 
                  checked={template.items.showSustainabilityScore}
                  onChange={(v) => updateNestedSetting('items', 'showSustainabilityScore', v)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">ITEM FORMATTING STYLE</label>
                <select 
                  value={template.items.itemStyle}
                  onChange={(e) => updateNestedSetting('items', 'itemStyle', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                >
                  <option value="standard">Standard Detailed Row Layout</option>
                  <option value="compact">Narrow No-Gap Compact Alignment</option>
                  <option value="detailed">Expanded Description Blocks</option>
                  <option value="premium">Premium Centred Branding Frame</option>
                </select>
              </div>
            </div>
          </AccordionBlock>

          {/* SEC 5: ALLERGENS OPTIONS */}
          <AccordionBlock 
            title="Allergen Warnings & Dietary Notes" 
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            isOpen={activeSection === 'safety'}
            onClick={() => toggleSection('safety')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <ToggleRow 
                label="Show Allergen Safety Tags" 
                checked={template.items.showAllergens}
                onChange={(v) => updateNestedSetting('items', 'showAllergens', v)}
              />
              <ToggleRow 
                label="Transform Allergens to UPPERCASE" 
                checked={template.allergensAndNotes.allergensInUppercase}
                onChange={(v) => updateNestedSetting('allergensAndNotes', 'allergensInUppercase', v)}
              />
              <ToggleRow 
                label="Highlight Warnings (Bold Amber Font)" 
                checked={template.allergensAndNotes.highlightAllergenWarnings}
                onChange={(v) => updateNestedSetting('allergensAndNotes', 'highlightAllergenWarnings', v)}
              />
              <ToggleRow 
                label="Show Kitchen-only Notes on Ticket" 
                checked={template.allergensAndNotes.kitchenNotesOnReceipt}
                onChange={(v) => updateNestedSetting('allergensAndNotes', 'kitchenNotesOnReceipt', v)}
              />
            </div>
          </AccordionBlock>

          {/* SEC 6: SERVICE CHARGES */}
          <AccordionBlock 
            title="Service Charge Settings" 
            icon={<Percent className="w-4 h-4 text-yellow-500" />}
            isOpen={activeSection === 'servicecharge'}
            onClick={() => toggleSection('servicecharge')}
          >
            <div className="space-y-4 pt-2">
              <ToggleRow 
                label="Apply Optional Service Charge" 
                checked={template.serviceCharge.enabled}
                onChange={(v) => updateNestedSetting('serviceCharge', 'enabled', v)}
              />

              {template.serviceCharge.enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-brand-primary/20 pb-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">SERVICE LABEL ON TICKET</label>
                      <input 
                        type="text" 
                        value={template.serviceCharge.label}
                        onChange={(e) => updateNestedSetting('serviceCharge', 'label', e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">PERCENTAGE RATIO (%)</label>
                      <input 
                        type="number" 
                        step="0.5"
                        value={template.serviceCharge.percentage}
                        onChange={(e) => updateNestedSetting('serviceCharge', 'percentage', parseFloat(e.target.value) || 0)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                      />
                    </div>
                  </div>

                  <ToggleRow 
                    label="Show Service charge disclaimer text" 
                    checked={template.serviceCharge.showDisclaimer}
                    onChange={(v) => updateNestedSetting('serviceCharge', 'showDisclaimer', v)}
                  />

                  {template.serviceCharge.showDisclaimer && (
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">DISCLAIMER FOOTER STATEMENT</label>
                      <textarea 
                        rows={2}
                        value={template.serviceCharge.disclaimerText}
                        onChange={(e) => updateNestedSetting('serviceCharge', 'disclaimerText', e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </AccordionBlock>

          {/* SEC 7: VAT & TAX SUMMARY */}
          <AccordionBlock 
            title="VAT & Tax Matrix" 
            icon={<DollarSign className="w-4 h-4 text-pink-500" />}
            isOpen={activeSection === 'vat'}
            onClick={() => toggleSection('vat')}
          >
            <div className="space-y-4 pt-2">
              <ToggleRow 
                label="Show Inclusive VAT Breakdown Table" 
                checked={template.vat.showVatBreakdown}
                onChange={(v) => updateNestedSetting('vat', 'showVatBreakdown', v)}
              />
              <ToggleRow 
                label="Display General VAT Summary Badge" 
                checked={template.vat.showVatSummary}
                onChange={(v) => updateNestedSetting('vat', 'showVatSummary', v)}
              />

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">DEFAULT TAX LABEL</label>
                <input 
                  type="text" 
                  value={template.vat.vatLabel}
                  onChange={(e) => updateNestedSetting('vat', 'vatLabel', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">TAX COMPLIANCE MESSAGE</label>
                <input 
                  type="text" 
                  value={template.vat.vatMessage}
                  onChange={(e) => updateNestedSetting('vat', 'vatMessage', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans"
                />
              </div>
            </div>
          </AccordionBlock>

          {/* SEC 8: QR CODE SETUP */}
          <AccordionBlock 
            title="QR Code & Web Payments" 
            icon={<QrCode className="w-4 h-4 text-emerald-400" />}
            isOpen={activeSection === 'qrcode'}
            onClick={() => toggleSection('qrcode')}
          >
            <div className="space-y-4 pt-2">
              <ToggleRow 
                label="Enable Customer Code Scan" 
                checked={template.qrCode.enabled}
                onChange={(v) => updateNestedSetting('qrCode', 'enabled', v)}
              />

              {template.qrCode.enabled && (
                <div className="space-y-4 pl-4 border-l-2 border-brand-primary/20 pb-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">QR RESOLUTION TYPE</label>
                      <select 
                        value={template.qrCode.qrType}
                        onChange={(e) => updateNestedSetting('qrCode', 'qrType', e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-sans"
                      >
                        <option value="payment_link">Dynamic Bill Payment Link (HUB integration)</option>
                        <option value="review_link">Google Business Review Generator</option>
                        <option value="loyalty_signup">Loyalty Card Signup</option>
                        <option value="menu">Digital Food/Cocktail Menu</option>
                        <option value="feedback">Instant Customer Feedback Form</option>
                        <option value="custom">Custom Site URL (Static Fallback)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">QR DISPLAY BLOCK TITLE</label>
                      <input 
                        type="text" 
                        value={template.qrCode.title}
                        onChange={(e) => updateNestedSetting('qrCode', 'title', e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-zinc-400 mb-1">STATIC FAILBACK / SECURE URL</label>
                      <input 
                        type="text" 
                        value={template.qrCode.customUrl}
                        onChange={(e) => updateNestedSetting('qrCode', 'customUrl', e.target.value)}
                        className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-sans"
                      />
                    </div>
                  </div>

                  <ToggleRow 
                    label="Show Digital wallets logo bar below QR (Apple Pay, VISA etc)" 
                    checked={template.qrCode.showPaymentLogos}
                    onChange={(v) => updateNestedSetting('qrCode', 'showPaymentLogos', v)}
                  />
                </div>
              )}
            </div>
          </AccordionBlock>

          {/* SEC 9: PAYMENT DETAILS */}
          <AccordionBlock 
            title="Card & Transaction Details" 
            icon={<CreditCard className="w-4 h-4 text-violet-500" />}
            isOpen={activeSection === 'payments'}
            onClick={() => toggleSection('payments')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <ToggleRow 
                label="Show Payment Method Used" 
                checked={template.payment.showPaymentMethod}
                onChange={(v) => updateNestedSetting('payment', 'showPaymentMethod', v)}
              />
              <ToggleRow 
                label="Show Credit Card Scheme Logo" 
                checked={template.payment.showCardType}
                onChange={(v) => updateNestedSetting('payment', 'showCardType', v)}
              />
              <ToggleRow 
                label="Masked PAN (Last 4 Digits)" 
                checked={template.payment.showLastFourDigits}
                onChange={(v) => updateNestedSetting('payment', 'showLastFourDigits', v)}
              />
              <ToggleRow 
                label="Bank Authorization Code / MID" 
                checked={template.payment.showAuthCode}
                onChange={(v) => updateNestedSetting('payment', 'showAuthCode', v)}
              />
              <ToggleRow 
                label="Transaction Tracking ID" 
                checked={template.payment.showTransactionId}
                onChange={(v) => updateNestedSetting('payment', 'showTransactionId', v)}
              />
              <ToggleRow 
                label="Split Bill Breakdown Share" 
                checked={template.payment.showSplitPayments}
                onChange={(v) => updateNestedSetting('payment', 'showSplitPayments', v)}
              />
            </div>
          </AccordionBlock>

          {/* SEC 10: RECEIPT FOOTER BLOCKS */}
          <AccordionBlock 
            title="Footer Info & Promos" 
            icon={<FileText className="w-4 h-4 text-neutral-400" />}
            isOpen={activeSection === 'footer'}
            onClick={() => toggleSection('footer')}
          >
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">THANK YOU MESSAGE</label>
                <input 
                  type="text" 
                  value={template.footer.thankYouMessage}
                  onChange={(e) => updateNestedSetting('footer', 'thankYouMessage', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">MARKETING REVIEW PROMPT</label>
                <input 
                  type="text" 
                  value={template.footer.reviewMessage}
                  onChange={(e) => updateNestedSetting('footer', 'reviewMessage', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">INSTAGRAM CHANNEL</label>
                  <input 
                    type="text" 
                    value={template.footer.socialMessage}
                    onChange={(e) => updateNestedSetting('footer', 'socialMessage', e.target.value)}
                    placeholder="@xoloaberdeen"
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 mb-1">WIFI DETAILS ON TICKET</label>
                  <input 
                    type="text" 
                    value={template.footer.wifiDetails}
                    onChange={(e) => updateNestedSetting('footer', 'wifiDetails', e.target.value)}
                    placeholder="SSID / Password"
                    className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">CHARITY MESSAGE</label>
                <input 
                  type="text" 
                  value={template.footer.charityMessage}
                  onChange={(e) => updateNestedSetting('footer', 'charityMessage', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">REFUND & EXCHANGE POLICY</label>
                <textarea 
                  rows={2}
                  value={template.footer.refundPolicy}
                  onChange={(e) => updateNestedSetting('footer', 'refundPolicy', e.target.value)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs"
                />
              </div>

              <div className="bg-brand-primary/5 p-4 rounded-2xl border border-brand-primary/10">
                <ToggleRow 
                  label="Enable Promotional Banner offer" 
                  checked={template.promoBanner.enabled}
                  onChange={(v) => updateNestedSetting('promoBanner', 'enabled', v)}
                />

                {template.promoBanner.enabled && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-black text-brand-primary mb-1">PROMO BANNER TEXT STATEMENT</label>
                    <input 
                      type="text" 
                      value={template.promoBanner.text}
                      onChange={(e) => updateNestedSetting('promoBanner', 'text', e.target.value)}
                      className="w-full bg-bg-dark border border-brand-primary/20 rounded-xl px-4 py-2 text-brand-primary font-bold text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </AccordionBlock>

          {/* SEC 11: ADVANCED CONTROLS */}
          <AccordionBlock 
            title="Advanced Printer Signals" 
            icon={<Printer className="w-4 h-4 text-amber-500" />}
            isOpen={activeSection === 'advanced'}
            onClick={() => toggleSection('advanced')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <ToggleRow 
                label="Auto Print immediately after Payment" 
                checked={template.printOptions.autoPrintAfterPayment}
                onChange={(v) => updateNestedSetting('printOptions', 'autoPrintAfterPayment', v)}
              />
              <ToggleRow 
                label="Ask Permission before printing ticket" 
                checked={template.printOptions.askBeforePrinting}
                onChange={(v) => updateNestedSetting('printOptions', 'askBeforePrinting', v)}
              />
              <ToggleRow 
                label="Trigger Cash Drawer Open signal on Print" 
                checked={template.printOptions.openCashDrawer}
                onChange={(v) => updateNestedSetting('printOptions', 'openCashDrawer', v)}
              />
              <ToggleRow 
                label="Execute automatic Cutter mechanism" 
                checked={template.printOptions.autoCut}
                onChange={(v) => updateNestedSetting('printOptions', 'autoCut', v)}
              />
              <div>
                <label className="block text-[10px] font-black text-zinc-400 mb-1">COPIES COUNT SETTINGS</label>
                <input 
                  type="number" 
                  min="1"
                  max="5"
                  value={template.printOptions.copies}
                  onChange={(e) => updateNestedSetting('printOptions', 'copies', parseInt(e.target.value) || 1)}
                  className="w-full bg-bg-dark border border-white/10 rounded-xl px-4 py-2 text-white text-xs font-bold"
                />
              </div>
            </div>
          </AccordionBlock>

        </div>

        {/* Validation Errors/Warnings Center */}
        {warnings.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl p-4">
            <h4 className="text-amber-500 text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Quality Validation Checks ({warnings.length})
            </h4>
            <ul className="space-y-1 list-disc pl-4 text-[10px] font-bold text-zinc-400">
              {warnings.map((w, idx) => (
                <li key={idx} className="leading-tight">{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Foot Action Buttons */}
        <div className="flex flex-wrap gap-3 border-t border-white/5 pt-6 mt-4">
          <button 
            type="button" 
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={cn(
              "flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl",
              saveStatus === 'saved' 
                ? "bg-emerald-600 text-white shadow-emerald-600/10"
                : saveStatus === 'error'
                  ? "bg-rose-600 text-white shadow-rose-600/10"
                  : "bg-brand-primary text-white hover:bg-brand-primary-light shadow-brand-primary/20"
            )}
          >
            <Save className="w-4 h-4" />
            {saveStatus === 'saving' ? 'Saving Template...' : saveStatus === 'saved' ? 'Settings Saved!' : 'Save Template'}
          </button>

          <button 
            type="button" 
            onClick={handleResetToDefault}
            className="flex items-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
          >
            <RotateCcw className="w-4 h-4 text-zinc-400" />
            Reset Defaults
          </button>

          <button 
            type="button" 
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Export Config
          </button>

          <div className="relative">
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <button 
              type="button" 
              className="flex items-center gap-2 px-5 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 pointer-events-none"
            >
              <Upload className="w-4 h-4 text-zinc-400" />
              Import Template
            </button>
          </div>
        </div>

      </div>

      {/* RIGHT: LIVE THERMAL PREVIEW PANEL (5 cols) */}
      <div className="xl:col-span-5 flex flex-col gap-6">
        
        {/* Right Header Navigation */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase italic tracking-widest flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-emerald-500" />
            Live Preview
          </h3>

          <div className="flex gap-1.5 bg-bg-card p-1 rounded-xl border border-white/5">
            <button 
              onClick={() => updateNestedSetting('themeMode', 'themeMode', 'light')}
              className={cn(
                "p-2 rounded-lg text-zinc-400 hover:text-white transition-all",
                template.themeMode === 'light' && "bg-white/5 text-white shadow"
              )}
              title="Light Thermal roll"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button 
              onClick={() => updateNestedSetting('themeMode', 'themeMode', 'dark')}
              className={cn(
                "p-2 rounded-lg text-zinc-400 hover:text-white transition-all",
                template.themeMode === 'dark' && "bg-white/5 text-white shadow"
              )}
              title="Dark contrast roll"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Data Source Selector Tab */}
        <div className="bg-bg-card border border-white/5 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Preview Dataset</span>
            <div className="flex bg-bg-dark p-1 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest">
              <button 
                onClick={() => setActivePreviewOrder('sample')}
                className={cn("px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white", activePreviewOrder === 'sample' && "bg-brand-primary text-white shadow")}
              >
                Sample Order
              </button>
              <button 
                onClick={() => setActivePreviewOrder('real')}
                className={cn("px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white", activePreviewOrder === 'real' && "bg-brand-primary text-white shadow")}
              >
                Current/Real Order
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Watermark Overlay</span>
            <select 
              value={reprintWatermark || ''} 
              onChange={(e) => setReprintWatermark((e.target.value || null) as any)}
              className="bg-bg-dark border border-white/10 rounded-xl px-3 py-1.5 text-white text-[10px] font-bold"
            >
              <option value="">No Watermark</option>
              <option value="reprint">Reprint Watermark</option>
              <option value="training">Training Mode Warning</option>
              <option value="nosale">No Sale Audit Line</option>
            </select>
          </div>

          <button 
            type="button" 
            onClick={handleTestPrint}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Printer className="w-4 h-4" />
            Run Print / Verify Template
          </button>
        </div>

        {/* Preview Holder Core with elegant paper cutting border effect */}
        <div className="flex-1 bg-bg-dark border border-white/5 rounded-[2.5rem] p-6 overflow-y-auto max-h-[58vh] custom-scrollbar flex items-start justify-center">
          <div className="relative w-full">
            <ReceiptPreview 
              template={template}
              order={previewOrder}
              staffList={staffList}
              watermark={reprintWatermark}
            />
          </div>
        </div>

      </div>

    </div>
  );
};

/* Mini Utility Components */
const AccordionBlock = ({ title, icon, isOpen, onClick, children }: any) => (
  <div className="bg-bg-dark border border-white/5 rounded-2xl overflow-hidden transition-all">
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors uppercase italic font-black text-xs text-white"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="tracking-widest">{title}</span>
      </div>
      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
    {isOpen && (
      <div className="p-4 border-t border-white/5 bg-bg-card/40 space-y-4">
        {children}
      </div>
    )}
  </div>
);

const ToggleRow = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition-all">
    <span className="text-[10px] font-black tracking-tight text-zinc-300 uppercase">{label}</span>
    <button 
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
        checked ? "bg-brand-primary" : "bg-zinc-800"
      )}
    >
      <span 
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  </div>
);
