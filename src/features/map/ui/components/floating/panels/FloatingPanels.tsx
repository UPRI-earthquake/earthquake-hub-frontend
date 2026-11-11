import { useCallback, useRef, useState } from "react";
import EventsPanel from "./events/EventsPanel";
import StationsPanel from "./stations/StationsPanel";
import useDevice from "@/shared/hooks/useDevice";
import ChevronLeftIcon from "@/shared/icons/ChevronLeftIcon";
import WaveIcon from "@/shared/icons/WaveIcon";
import BeaconIcon from "@/shared/icons/BeaconIcon";

export default function FloatingPanels() {
  const { isMobileLandscape, isCompactPanels } = useDevice();
  
  const [activePanel, setActivePanel] = useState('events');
  const [panelOpen, setPanelOpen] = useState(!isCompactPanels);
  const panelRef = useRef(null);

  const blurIfFocusInsidePanel = useCallback(() => {
    try {
      const active = document.activeElement as HTMLElement;
      if (panelRef.current && active && panelRef.current instanceof HTMLElement) {
        if (panelRef.current.contains(active) && typeof active.blur === 'function') {
          active.blur();
        }
      }
    } catch (_) {}
  }, []);

  const hidePanel = useCallback(() => {
    blurIfFocusInsidePanel();
    setPanelOpen(false);
  }, [blurIfFocusInsidePanel]);

  return (<>
    
      <MapPanelsHeader 
        panelOpen={panelOpen}
        activePanel={activePanel} 
        hidePanel={hidePanel}
        setActivePanel={setActivePanel} 
        setPanelOpen={setPanelOpen}
      />

      <main
        className={`panelColumn ${panelOpen ? 'isOpen' : 'isCollapsed'}`}
        data-compact={isCompactPanels}
        data-mobile-landscape={isMobileLandscape ? '1' : '0'}
        role="complementary"
        aria-label="Data panels"
        aria-hidden={!panelOpen}
        ref={panelRef}
      >
        <div className="panelControlsSpacer" aria-hidden />

        <div className={`panelSlot ${activePanel !== 'events' ? 'isHidden' : ''}`}>
          <EventsPanel />
        </div>

        <div className={`panelSlot ${activePanel !== 'stations' ? 'isHidden' : ''}`}>
          <StationsPanel />
        </div>
      </main>

      {isCompactPanels && panelOpen && !isMobileLandscape && (
        <div
          className="panelScrim"
          onClick={hidePanel}
          aria-hidden
        />
      )}
  </>)
}

function MapPanelsHeader({ panelOpen, activePanel, hidePanel, setActivePanel, setPanelOpen }) {
  const { isMobileLandscape } = useDevice();
  const visiblePanelLabel = activePanel === 'stations' ? 'Stations' : 'Events';
  const switcherActive = panelOpen ? activePanel : null;
  
  const handlePanelSelect = useCallback((panelKey) => {
    setActivePanel(panelKey);
    setPanelOpen(true);
  }, []);

  return (<header
    className={`panelControls panelControlsFloating ${isMobileLandscape ? 'isLandscape' : ''}`}
      aria-label="Panel controls"
    >
      {panelOpen && (
        <button
          type="button"
          className="panelHideBtn"
          onClick={hidePanel}
          aria-label={`Hide ${visiblePanelLabel} panel`}
          title="Hide panel"
        >
          <ChevronLeftIcon />
        </button>
      )}
      <div className="panelSwitcher" aria-label="Choose panel">
        <button
          type="button"
          className={switcherActive === 'events' ? 'isActive' : ''}
          onClick={() => handlePanelSelect('events')}
          aria-pressed={switcherActive === 'events'}
          aria-expanded={panelOpen && activePanel === 'events'}
        >
          <span className="panelSwitchIcon"><WaveIcon /></span>
          <span className="panelSwitchLabel">Events</span>
        </button>
        <button
          type="button"
          className={switcherActive === 'stations' ? 'isActive' : ''}
          onClick={() => handlePanelSelect('stations')}
          aria-pressed={switcherActive === 'stations'}
          aria-expanded={panelOpen && activePanel === 'stations'}
        >
          <span className="panelSwitchIcon"><BeaconIcon /></span>
          <span className="panelSwitchLabel">Stations</span>
        </button>
      </div>
    </header>);
}