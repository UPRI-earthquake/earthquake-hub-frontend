import React from "react";
import styles from "./SidebarItem.module.css"
import { useSelector, useDispatch } from 'react-redux';

function SidebarItem({publicID, title, description, subDescription}) {
  const dispatch = useDispatch();
  const selectedEvent = useSelector(state => state)
  function handleClick(){
    if(selectedEvent !== publicID){
      console.log('dispatch select')
      dispatch({type: 'SELECT', payload: publicID})
    }else{
      console.log('dispatch deselect')
      dispatch({type: 'DESELECT'})
    }
  }

  return(
    <div 
      className={styles.sidebarItem}
      onClick={handleClick}
    >
      <h4>{title}</h4>
      <div>
        <p className={styles.desc}>{description}</p>
        <p className={styles.subDesc}>{subDescription}</p>
      </div>

    </div>
  )
}

export default SidebarItem
