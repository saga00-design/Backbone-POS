import React from 'react';
import { KdsScreen } from './KdsScreen';

export const DualKdsScreen: React.FC = () => {
  return (
    <div className="h-full flex flex-col md:flex-row overflow-hidden bg-bg-dark">
      <div className="flex-1 h-1/2 md:h-full overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
        <KdsScreen station="kitchen" />
      </div>
      <div className="flex-1 h-1/2 md:h-full overflow-hidden">
        <KdsScreen station="bar" />
      </div>
    </div>
  );
};
