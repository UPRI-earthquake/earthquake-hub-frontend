import React, { useRef, useEffect } from "react";
import styles from "./SidebarItem.module.css"
import { useSelector, useDispatch } from 'react-redux';

function SidebarItem({publicID, title, description, 
                      subDescription, status, last_modification}) {

  // Change state when clicked, to tell EventMarker (with same publicID)
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

  
  // Animation
  const output = useRef(null) // hold output div
  const reversed  = useRef(false); // to alternate between two "identical" animations
  useEffect(() => {
    if(status === 'NEW' || status === 'UPDATE'){
      // add animation, but alternate between
      // the heartbeat animation and its reversed-reversed copy
      if(reversed.current){
        output.current.classList.add(styles.heartBeat)
        reversed.current = false 
      }else{
        output.current.classList.add(styles.heartBeatReverse)
        reversed.current = true 
      }
    }

    // cleanup, remove the previously added class before updating
    const outputComponent = output.current 
    return(()=>{
      reversed.current
      ? outputComponent.classList.remove(styles.heartBeatReverse)
      : outputComponent.classList.remove(styles.heartBeat)
    })

    // run effect when a modification is made
  }, [status, last_modification]);


  return(
    <div 
      className={`${styles.sidebarItem}`}
      onClick={handleClick}
      ref={output}
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
  // render if next status is NEW or was modified
  return !(nextProps.status === 'NEW' 
        || nextProps.last_modification !== prevProps.last_modification)
});
