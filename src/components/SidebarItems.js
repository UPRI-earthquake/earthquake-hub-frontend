import SidebarItem from "./SidebarItem"

function SidebarItems({initData}) {
   return(initData.map(row => 
     <SidebarItem 
       key={row.publicId}
       title={+row.magnitude_value.toFixed(1)}
       description={row.place}
       subDescription={row.OT}
     />
   ))
}

export default SidebarItems
