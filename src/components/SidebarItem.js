import React from "react";
import styles from "./SidebarItem.module.css"
import { useSelector, useDispatch } from 'react-redux';

function animate(status, type){
  switch(status){
    case 'NEW': 
    case 'UPDATE':
      return styles[type]
    default:
      return null
  }
}

function SidebarItem({publicID, title, description, subDescription, status}) {
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
      key={Math.random() /*force re-render from scratch to animate*/}
      className={`${styles.sidebarItem} ${animate(status, 'heartBeat')}`}
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

export default React.memo(SidebarItem, (prevProps, nextProps) => {
  // render if status is NEW or UPDATE
  return !(nextProps.status === 'UPDATE' 
        || nextProps.status === 'NEW')
});
