import React, {useState, useContext, useEffect} from "react"
import moment from 'moment';
import SidebarItem from "./SidebarItem"
import SSEContext from "../SSEContext";

function SidebarItems({initData, filters, sseEnabled = true}) {
  const [items, setItems] = useState(() => {
    const arr = (initData || []).slice();
    return arr.sort((a, b) => new Date(b.OT) - new Date(a.OT));
  })

  // Keep items in sync when initData changes (e.g., preset switch)
  useEffect(() => {
    const next = (initData || []).slice().sort((a, b) => new Date(b.OT) - new Date(a.OT));
    setItems(next);
  }, [initData]);

  const eventSource = useContext(SSEContext);
  useEffect(() => {
    if (!sseEnabled) return; // disable live updates for curated presets
    const handleEQEvent = (event) => {
      const data = JSON.parse(event.data)// to parse to get valid json-obj

      switch (data.eventType){
        case 'NEW':
          setItems(prevItems => [{
            publicID: data.publicID,
            magnitude_value: data.magnitude_value,
            place: data.place,
            OT: data.OT,
            text: data.text,
            eventType: 'NEW',
            last_modification: data.last_modification,

          }, ...prevItems])
          break;
        case 'UPDATE':
          setItems(prevItems => prevItems.map(item=>{
            if (item.publicID === data.publicID){
              return {
                publicID: data.publicID,
                magnitude_value: data.magnitude_value,
                place: data.place,
                OT: data.OT,
                text: data.text,
                eventType: 'UPDATE',
                last_modification: data.last_modification,
              }
            }else{ return item }
          }));
          break;
        default:
          ;
      }
    }
    eventSource.addEventListener('SC_EVENT', handleEQEvent);

    return () => {
      eventSource.removeEventListener('SC_EVENT', handleEQEvent);
    };
  }, [eventSource, sseEnabled]);

  // Client-side filtering (frontend only for now)
  const f = filters || {};
  const text = (f.searchText || '').trim().toLowerCase();
  const magMin = typeof f.magMin === 'number' ? f.magMin : -Infinity;
  const magMax = typeof f.magMax === 'number' ? f.magMax : Infinity;
  const start = f.startDate ? moment(f.startDate, 'YYYY-MM-DD') : null;
  const end = f.endDate ? moment(f.endDate, 'YYYY-MM-DD').endOf('day') : null;

  const filtered = items.filter((item) => {
    if (Number.isFinite(magMin) && item.magnitude_value < magMin) return false;
    if (Number.isFinite(magMax) && item.magnitude_value > magMax) return false;
    if (start && moment(item.OT).isBefore(start)) return false;
    if (end && moment(item.OT).isAfter(end)) return false;
    if (text) {
      const str = `${item.place || ''} ${item.text || ''}`.toLowerCase();
      if (!str.includes(text)) return false;
    }
    return true;
  });

  const magText = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : String(v ?? '-');
  };

  if (!filtered.length) {
    // Empty-state indicator shown inside the scroll area
    return (
      <div className="sidebar-empty">
        <div className="sidebar-empty-inner">
          <div className="sidebar-empty-title">No results</div>
          <div className="sidebar-empty-desc">Try adjusting search or filters.</div>
        </div>
      </div>
    );
  }

  return (filtered.map(item => (
    <SidebarItem
      key={item.publicID}
      publicID={item.publicID}
      title={magText(item.magnitude_value)}
      description={
        ['Unavailable',
         'Unable to geocode',
         ''].includes(item.place)
           ? item.text : item.place}
      subDescription={moment(item.OT).fromNow()}
      status={item.eventType ? item.eventType : null}
      last_modification={item.last_modification}
    />
  )))
}

export default SidebarItems
